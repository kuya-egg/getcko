//! English speech-to-text with whisper.cpp in a helper process
//! (`src-tauri/sidecars/whisper`, built by `scripts/build-whisper.sh`).
//!
//! whisper.cpp and llama.cpp each bundle their own, different ggml; linking both into
//! one binary gives duplicate symbols resolved arbitrarily (undefined behaviour), so
//! Whisper runs in its own process with the model loaded once, spoken to over pipes.
//! The protocol is documented in the helper's `main.rs`.

use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;

use super::{EngineError, EngineResult, Transcriber};

/// Bundled English Whisper model (`scripts/fetch-models.sh`).
pub const WHISPER_MODEL_FILE: &str = "ggml-small.en.bin";
const HELPER: &str = "getcko-whisper";
const READY: u8 = 0xA5;
const OK: u8 = 0;
/// Whisper's prompt holds about 224 tokens; longer hints are cut at a character boundary.
const MAX_HINT_BYTES: usize = 1024;

/// Whisper transcriber backed by the helper process.
pub struct WhisperTranscriber {
    helper: PathBuf,
    model: PathBuf,
    process: Mutex<Option<Helper>>,
}

struct Helper {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl Drop for Helper {
    fn drop(&mut self) {
        // Closing stdin ends the helper's loop; kill covers a stuck one.
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl WhisperTranscriber {
    /// Starts the helper with `model` and waits until it has loaded.
    ///
    /// # Errors
    /// The helper or model is missing, or the helper failed to start.
    pub fn start(helper: &Path, model: &Path) -> EngineResult<Self> {
        if !model.is_file() {
            return Err(EngineError::MissingModel(model.display().to_string()));
        }
        if !helper.is_file() {
            return Err(EngineError::MissingModel(helper.display().to_string()));
        }
        let process = spawn(helper, model)?;
        Ok(Self {
            helper: helper.to_owned(),
            model: model.to_owned(),
            process: Mutex::new(Some(process)),
        })
    }

    /// Where the helper is: `GETCKO_WHISPER_SIDECAR`, next to the app executable
    /// (bundled sidecar), or `src-tauri/binaries/getcko-whisper-<target>` (dev).
    #[must_use]
    pub fn locate_helper() -> Option<PathBuf> {
        let exe = std::env::consts::EXE_SUFFIX;
        let candidates = [
            std::env::var_os("GETCKO_WHISPER_SIDECAR").map(PathBuf::from),
            std::env::current_exe()
                .ok()
                .and_then(|path| path.parent().map(|dir| dir.join(format!("{HELPER}{exe}")))),
            Some(
                Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("binaries")
                    .join(format!("{HELPER}-{}{exe}", env!("GETCKO_TARGET"))),
            ),
        ];
        candidates.into_iter().flatten().find(|path| path.is_file())
    }

    fn request(
        helper: &mut Helper,
        pcm: &[f32],
        hint: &str,
    ) -> std::io::Result<Result<String, String>> {
        let count = u32::try_from(pcm.len())
            .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidInput, "audio too long"))?;
        let mut message = Vec::with_capacity(8 + pcm.len() * 4 + hint.len());
        message.extend_from_slice(&count.to_le_bytes());
        for sample in pcm {
            message.extend_from_slice(&sample.to_le_bytes());
        }
        let hint = clip_hint(hint);
        let hint_len = u32::try_from(hint.len())
            .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidInput, "hint too long"))?;
        message.extend_from_slice(&hint_len.to_le_bytes());
        message.extend_from_slice(hint.as_bytes());
        helper.stdin.write_all(&message)?;
        helper.stdin.flush()?;

        let mut status = [0u8; 1];
        helper.stdout.read_exact(&mut status)?;
        let mut length = [0u8; 4];
        helper.stdout.read_exact(&mut length)?;
        let mut text = vec![0u8; u32::from_le_bytes(length) as usize];
        helper.stdout.read_exact(&mut text)?;
        let text = String::from_utf8_lossy(&text).into_owned();
        Ok(if status[0] == OK { Ok(text) } else { Err(text) })
    }
}

impl Transcriber for WhisperTranscriber {
    fn transcribe(&self, pcm: &[f32], hint: &str) -> EngineResult<String> {
        let mut process = self
            .process
            .lock()
            .map_err(|_| EngineError::Runtime("speech helper lock poisoned".into()))?;
        // One restart: the helper may have died since the last turn.
        for attempt in 0..2 {
            if process.is_none() {
                *process = Some(spawn(&self.helper, &self.model)?);
            }
            let Some(helper) = process.as_mut() else {
                continue;
            };
            match Self::request(helper, pcm, hint) {
                Ok(Ok(text)) => return Ok(text),
                Ok(Err(message)) => return Err(EngineError::Runtime(message)),
                Err(error) => {
                    tracing::warn!(%error, attempt, "speech helper stopped; restarting");
                    *process = None;
                }
            }
        }
        Err(EngineError::Runtime("speech helper keeps failing".into()))
    }
}

fn spawn(helper: &Path, model: &Path) -> EngineResult<Helper> {
    let mut command = Command::new(helper);
    command
        .arg(model)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        // whisper.cpp logs every load and run to stderr.
        .stderr(Stdio::null());
    // The helper is a console program; from the windowed app it would otherwise open
    // a console window for as long as it runs.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = command
        .spawn()
        .map_err(|error| EngineError::Runtime(format!("starting speech helper: {error}")))?;
    let (Some(stdin), Some(stdout)) = (child.stdin.take(), child.stdout.take()) else {
        let _ = child.kill();
        return Err(EngineError::Runtime(
            "speech helper pipes unavailable".into(),
        ));
    };
    let mut helper = Helper {
        child,
        stdin,
        stdout: BufReader::new(stdout),
    };
    let mut ready = [0u8; 1];
    helper
        .stdout
        .read_exact(&mut ready)
        .map_err(|error| EngineError::Runtime(format!("speech helper did not start: {error}")))?;
    if ready[0] != READY {
        return Err(EngineError::Runtime(
            "speech helper sent an unexpected greeting".into(),
        ));
    }
    Ok(helper)
}

/// The hint cut to [`MAX_HINT_BYTES`] at a character boundary.
fn clip_hint(hint: &str) -> &str {
    if hint.len() <= MAX_HINT_BYTES {
        return hint;
    }
    let mut end = MAX_HINT_BYTES;
    while !hint.is_char_boundary(end) {
        end -= 1;
    }
    &hint[..end]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn long_hints_are_cut_on_a_character_boundary() {
        let hint = "é".repeat(MAX_HINT_BYTES);
        let clipped = clip_hint(&hint);
        assert!(clipped.len() <= MAX_HINT_BYTES);
        assert!(clipped.chars().all(|c| c == 'é'));
        assert_eq!(clip_hint("Juan Dela Cruz"), "Juan Dela Cruz");
    }

    #[test]
    #[ignore = "needs the speech helper (scripts/build-whisper.sh) and model files"]
    fn helper_transcribes_and_survives_a_restart() {
        let helper = WhisperTranscriber::locate_helper().expect("speech helper built");
        let model = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("models")
            .join(WHISPER_MODEL_FILE);
        let whisper = WhisperTranscriber::start(&helper, &model).expect("helper starts");
        let silence = vec![0f32; 16_000];
        whisper
            .transcribe(&silence, "")
            .expect("silence transcribes");
        // Kill the running helper; the next call must restart it.
        if let Ok(mut process) = whisper.process.lock()
            && let Some(running) = process.as_mut()
        {
            let _ = running.child.kill();
            let _ = running.child.wait();
        }
        whisper
            .transcribe(&silence, "Juan Dela Cruz")
            .expect("restarted helper transcribes");
        assert!(WhisperTranscriber::start(&helper, Path::new("missing.bin")).is_err());
    }
}
