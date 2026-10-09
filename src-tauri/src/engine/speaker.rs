use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::Duration;

use crate::model::{Language, Voice};

use super::{EngineError, EngineResult, Speaker};

enum Command {
    Speak {
        text: String,
        voice_id: Option<String>,
        language: Language,
        rate: f32,
        generation: u64,
    },
    Stop,
    Voices(Sender<Vec<Voice>>),
}

/// OS-backed speech synthesis, confined to its own thread.
pub struct OsSpeaker {
    commands: Sender<Command>,
    generation: Arc<AtomicU64>,
}

impl OsSpeaker {
    /// Creates the speech backend and its dedicated worker thread.
    ///
    /// # Errors
    /// Returns an error if the backend cannot initialize or the worker does not respond in time.
    pub fn new() -> EngineResult<Self> {
        let (commands, receiver) = mpsc::channel();
        let (ready_sender, ready_receiver) = mpsc::sync_channel(1);
        let generation = Arc::new(AtomicU64::new(0));
        let worker_generation = Arc::clone(&generation);
        let worker = std::thread::Builder::new()
            .name("getcko-tts".to_owned())
            .spawn(move || speech_thread(receiver, ready_sender, worker_generation))
            .map_err(|error| {
                EngineError::Runtime(format!("could not start speech thread: {error}"))
            })?;

        match ready_receiver.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(())) => Ok(Self {
                commands,
                generation,
            }),
            Ok(Err(reason)) => {
                drop(commands);
                let _ = worker.join();
                Err(EngineError::Runtime(reason))
            }
            Err(error) => {
                drop(commands);
                Err(EngineError::Runtime(format!(
                    "speech backend initialization timed out: {error}"
                )))
            }
        }
    }
}

impl Speaker for OsSpeaker {
    fn voices(&self) -> Vec<Voice> {
        let (reply, response) = mpsc::channel();
        if self.commands.send(Command::Voices(reply)).is_err() {
            return Vec::new();
        }
        response.recv().unwrap_or_default()
    }

    fn speak(
        &self,
        text: &str,
        voice_id: Option<&str>,
        language: Language,
        rate: f32,
    ) -> EngineResult<()> {
        let generation = self.generation.load(Ordering::Acquire);
        self.commands
            .send(Command::Speak {
                text: text.to_owned(),
                voice_id: voice_id.map(str::to_owned),
                language,
                rate,
                generation,
            })
            .map_err(|error| EngineError::Runtime(format!("speech thread unavailable: {error}")))
    }

    fn stop(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
        let _ = self.commands.send(Command::Stop);
    }
}

fn speech_thread(
    receiver: Receiver<Command>,
    ready: mpsc::SyncSender<Result<(), String>>,
    generation: Arc<AtomicU64>,
) {
    let mut tts = match tts::Tts::default() {
        Ok(tts) => tts,
        Err(error) => {
            let _ = ready.send(Err(error.to_string()));
            return;
        }
    };
    let backend_voices = tts.voices().unwrap_or_else(|error| {
        tracing::warn!(error = %error, "could not enumerate speech voices");
        Vec::new()
    });
    let voices = backend_voices
        .iter()
        .map(|voice| Voice {
            id: voice.id(),
            name: voice.name(),
            language: voice.language().to_string(),
        })
        .collect::<Vec<_>>();
    let voice_choices = backend_voices
        .iter()
        .map(|voice| (voice.id(), voice.language().to_string()))
        .collect::<Vec<_>>();
    let mut selected_voice: Option<String> = None;
    if ready.send(Ok(())).is_err() {
        return;
    }

    while let Ok(command) = receiver.recv() {
        match command {
            Command::Stop => {
                if let Err(error) = tts.stop() {
                    tracing::warn!(error = %error, "could not stop speech");
                }
            }
            Command::Voices(reply) => {
                let _ = reply.send(voices.clone());
            }
            Command::Speak {
                text,
                voice_id,
                language,
                rate,
                generation: speak_generation,
            } => {
                if generation.load(Ordering::Acquire) != speak_generation {
                    continue;
                }
                let voice = choose_voice(&voice_choices, voice_id.as_deref(), language);
                if voice != selected_voice
                    && let Some(id) = voice.as_deref()
                    && let Some(backend_voice) =
                        backend_voices.iter().find(|candidate| candidate.id() == id)
                {
                    if let Err(error) = tts.set_voice(backend_voice) {
                        tracing::warn!(error = %error, "could not select speech voice");
                    } else {
                        selected_voice = Some(id.to_owned());
                    }
                }
                if tts.supported_features().rate {
                    let mapped = map_rate(rate, tts.min_rate(), tts.normal_rate(), tts.max_rate());
                    if let Err(error) = tts.set_rate(mapped) {
                        tracing::warn!(error = %error, "could not set speech rate");
                    }
                }
                if let Err(error) = tts.speak(text, false) {
                    tracing::warn!(error = %error, "could not speak text");
                }
            }
        }
    }
}

fn map_rate(rate: f32, min: f32, normal: f32, max: f32) -> f32 {
    let rate = rate.clamp(0.5, 2.0);
    let mapped = if rate > 1.0 {
        normal + (rate - 1.0) * (max - normal)
    } else {
        normal - (1.0 - rate) * 2.0 * (normal - min)
    };
    mapped.clamp(min, max)
}

fn choose_voice(
    voices: &[(String, String)],
    requested: Option<&str>,
    language: Language,
) -> Option<String> {
    if let Some(id) = requested
        && voices.iter().any(|(voice_id, _)| voice_id == id)
    {
        return Some(id.to_owned());
    }
    let language_prefix = match language {
        Language::Filipino | Language::Taglish => "fil",
        Language::English => "en",
    };
    let mut matching = voices.iter().filter(|(_, tag)| {
        tag.split(['-', '_'])
            .next()
            .is_some_and(|part| part.eq_ignore_ascii_case(language_prefix))
    });
    let selected = if language == Language::English {
        matching
            .clone()
            .find(|(_, tag)| tag.eq_ignore_ascii_case("en-US"))
            .or_else(|| matching.next())
    } else {
        matching.next()
    };
    selected.map(|(id, _)| id.clone()).or_else(|| {
        if language != Language::English {
            let mut english = voices.iter().filter(|(_, tag)| {
                tag.split(['-', '_'])
                    .next()
                    .is_some_and(|part| part.eq_ignore_ascii_case("en"))
            });
            english
                .clone()
                .find(|(_, tag)| tag.eq_ignore_ascii_case("en-US"))
                .or_else(|| english.next())
                .map(|(id, _)| id.clone())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_mapping_uses_backend_range() {
        assert!((map_rate(1.0, 0.0, 1.0, 2.0) - 1.0).abs() < f32::EPSILON);
        assert!((map_rate(2.0, 0.0, 1.0, 2.0) - 2.0).abs() < f32::EPSILON);
        assert!((map_rate(0.5, 0.0, 1.0, 2.0) - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn voice_choice_prefers_requested_then_language() {
        let voices = vec![
            ("a".into(), "en-GB".into()),
            ("b".into(), "en-US".into()),
            ("c".into(), "fil-PH".into()),
        ];
        assert_eq!(
            choose_voice(&voices, Some("a"), Language::Filipino).as_deref(),
            Some("a")
        );
        assert_eq!(
            choose_voice(&voices, None, Language::English).as_deref(),
            Some("b")
        );
        assert_eq!(
            choose_voice(&voices, None, Language::Taglish).as_deref(),
            Some("c")
        );
        assert_eq!(
            choose_voice(&voices[..2], None, Language::Filipino).as_deref(),
            Some("b")
        );
    }

    #[test]
    #[ignore = "speaks out loud"]
    fn speaks_with_installed_voice() {
        let speaker = OsSpeaker::new().expect("speech backend should initialize");
        assert!(!speaker.voices().is_empty());
        speaker
            .speak("Hello from GetCko.", None, Language::English, 1.0)
            .expect("speech should queue");
        speaker.stop();
    }
}
