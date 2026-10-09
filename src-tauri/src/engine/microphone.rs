//! Push-to-talk capture from the default input device through `cpal`, shared by
//! macOS and Windows.
//!
//! A `cpal::Stream` is not `Send` on every host, so one dedicated thread owns it and
//! takes `start`/`stop` commands over a channel. The audio callback downmixes to mono
//! at the device rate; `stop` resamples to the 16 kHz the transcriber expects.

use std::sync::mpsc::{self, Receiver, SyncSender};
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat};

use super::{EngineError, EngineResult, Microphone};

/// Sample rate handed to the transcriber.
pub const TARGET_RATE: u32 = 16_000;
/// Longest recording kept; the transcriber accepts at most 30 s.
const MAX_SECONDS: usize = 30;

type Reply<T> = SyncSender<EngineResult<T>>;

enum Command {
    Start(Reply<()>),
    Stop(Reply<Vec<f32>>),
}

/// Default-input-device recorder. Cheap to share; all work happens on its thread.
pub struct CpalMicrophone {
    commands: Mutex<SyncSender<Command>>,
}

impl CpalMicrophone {
    /// Starts the capture thread.
    ///
    /// # Errors
    /// No default input device, or the thread could not be spawned.
    pub fn new() -> EngineResult<Self> {
        if cpal::default_host().default_input_device().is_none() {
            return Err(EngineError::Runtime("no microphone found".into()));
        }
        let (tx, rx) = mpsc::sync_channel(4);
        std::thread::Builder::new()
            .name("getcko-mic".into())
            .spawn(move || run(&rx))
            .map_err(|error| EngineError::Runtime(error.to_string()))?;
        Ok(Self {
            commands: Mutex::new(tx),
        })
    }

    fn request<T>(&self, make: impl FnOnce(Reply<T>) -> Command) -> EngineResult<T> {
        let (reply, response) = mpsc::sync_channel(1);
        self.commands
            .lock()
            .map_err(|_| EngineError::Runtime("microphone thread poisoned".into()))?
            .send(make(reply))
            .map_err(|_| EngineError::Runtime("microphone thread stopped".into()))?;
        response
            .recv()
            .map_err(|_| EngineError::Runtime("microphone thread stopped".into()))?
    }
}

impl Microphone for CpalMicrophone {
    fn start(&self) -> EngineResult<()> {
        self.request(Command::Start)
    }

    fn stop(&self) -> EngineResult<Vec<f32>> {
        self.request(Command::Stop)
    }
}

/// An open input stream and the mono samples it has produced.
struct Recording {
    _stream: cpal::Stream,
    samples: Arc<Mutex<Vec<f32>>>,
    rate: u32,
}

fn run(commands: &Receiver<Command>) {
    let mut recording: Option<Recording> = None;
    while let Ok(command) = commands.recv() {
        match command {
            Command::Start(reply) => {
                // A second press restarts: the old stream is dropped first.
                recording = None;
                let result = open().map(|r| recording = Some(r));
                let _ = reply.send(result);
            }
            Command::Stop(reply) => {
                let result = match recording.take() {
                    Some(Recording {
                        _stream,
                        samples,
                        rate,
                    }) => {
                        drop(_stream);
                        let mono = samples
                            .lock()
                            .map(|mut s| std::mem::take(&mut *s))
                            .unwrap_or_default();
                        tracing::debug!(
                            device_rate = rate,
                            seconds = mono.len() as f64 / f64::from(rate.max(1)),
                            "recording stopped"
                        );
                        Ok(resample(&mono, rate, TARGET_RATE))
                    }
                    None => Err(EngineError::Runtime("not recording".into())),
                };
                let _ = reply.send(result);
            }
        }
    }
}

fn open() -> EngineResult<Recording> {
    let device = cpal::default_host()
        .default_input_device()
        .ok_or_else(|| EngineError::Runtime("no microphone found".into()))?;
    let config = device
        .default_input_config()
        .map_err(|error| EngineError::Runtime(format!("microphone config: {error}")))?;
    let rate = config.sample_rate();
    let channels = usize::from(config.channels().max(1));
    let samples = Arc::new(Mutex::new(Vec::with_capacity(rate as usize * 10)));
    let limit = rate as usize * MAX_SECONDS;
    let on_error = |error: cpal::Error| tracing::warn!(%error, "microphone stream error");
    let format = config.sample_format();
    let stream_config = config.into();
    let sink = Arc::clone(&samples);
    let stream = match format {
        SampleFormat::F32 => device.build_input_stream(
            stream_config,
            move |data: &[f32], _: &_| push_mono(data, channels, limit, &sink),
            on_error,
            None,
        ),
        SampleFormat::I16 => device.build_input_stream(
            stream_config,
            move |data: &[i16], _: &_| push_mono(data, channels, limit, &sink),
            on_error,
            None,
        ),
        SampleFormat::I32 => device.build_input_stream(
            stream_config,
            move |data: &[i32], _: &_| push_mono(data, channels, limit, &sink),
            on_error,
            None,
        ),
        SampleFormat::U16 => device.build_input_stream(
            stream_config,
            move |data: &[u16], _: &_| push_mono(data, channels, limit, &sink),
            on_error,
            None,
        ),
        other => {
            return Err(EngineError::Runtime(format!(
                "unsupported microphone sample format {other}"
            )));
        }
    }
    .map_err(|error| EngineError::Runtime(format!("microphone: {error}")))?;
    stream
        .play()
        .map_err(|error| EngineError::Runtime(format!("microphone: {error}")))?;
    Ok(Recording {
        _stream: stream,
        samples,
        rate,
    })
}

/// Averages interleaved frames to mono and appends them, up to `limit` samples.
fn push_mono<T>(data: &[T], channels: usize, limit: usize, sink: &Mutex<Vec<f32>>)
where
    T: Sample,
    f32: FromSample<T>,
{
    let Ok(mut samples) = sink.lock() else {
        return;
    };
    let room = limit.saturating_sub(samples.len());
    let frames = data.chunks_exact(channels).take(room);
    samples
        .extend(frames.map(|frame| {
            frame.iter().map(|s| s.to_sample::<f32>()).sum::<f32>() / channels as f32
        }));
}

/// Linear-interpolation resampling; when downsampling, a moving average over one
/// output period first removes most content above the new Nyquist frequency.
fn resample(input: &[f32], from: u32, to: u32) -> Vec<f32> {
    if input.is_empty() || from == 0 || from == to {
        return input.to_vec();
    }
    let ratio = f64::from(from) / f64::from(to);
    let smoothed;
    let source = if ratio > 1.0 {
        let width = ratio.ceil() as usize;
        smoothed = moving_average(input, width);
        smoothed.as_slice()
    } else {
        input
    };
    let out_len = (input.len() as f64 / ratio).floor() as usize;
    (0..out_len)
        .map(|index| {
            let position = index as f64 * ratio;
            let left = position.floor() as usize;
            let right = (left + 1).min(source.len() - 1);
            let fraction = (position - left as f64) as f32;
            source[left] * (1.0 - fraction) + source[right] * fraction
        })
        .collect()
}

fn moving_average(input: &[f32], width: usize) -> Vec<f32> {
    let mut out = Vec::with_capacity(input.len());
    let mut sum = 0.0_f32;
    for (index, sample) in input.iter().enumerate() {
        sum += sample;
        if index >= width {
            sum -= input[index - width];
        }
        out.push(sum / (index + 1).min(width) as f32);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(rate: u32, hz: f32, seconds: f32) -> Vec<f32> {
        let n = (rate as f32 * seconds) as usize;
        (0..n)
            .map(|i| (std::f32::consts::TAU * hz * i as f32 / rate as f32).sin())
            .collect()
    }

    /// Zero crossings per second ≈ 2 × frequency.
    fn crossings_per_second(samples: &[f32], rate: u32) -> f32 {
        let crossings = samples
            .windows(2)
            .filter(|w| (w[0] < 0.0) != (w[1] < 0.0))
            .count();
        crossings as f32 * rate as f32 / samples.len() as f32
    }

    #[test]
    fn downsampling_keeps_duration_and_pitch() {
        for from in [44_100, 48_000] {
            let out = resample(&sine(from, 440.0, 1.0), from, TARGET_RATE);
            assert!(
                (out.len() as i64 - 16_000).abs() <= 1,
                "{from}: {}",
                out.len()
            );
            let rate = crossings_per_second(&out, TARGET_RATE);
            assert!((rate - 880.0).abs() < 10.0, "{from}: {rate}");
        }
    }

    #[test]
    fn same_rate_is_unchanged_and_empty_stays_empty() {
        let input = sine(16_000, 300.0, 0.1);
        assert_eq!(resample(&input, 16_000, 16_000), input);
        assert!(resample(&[], 48_000, 16_000).is_empty());
    }

    #[test]
    fn interleaved_frames_are_averaged_and_capped() {
        let sink = Mutex::new(Vec::new());
        push_mono(&[1.0_f32, 0.0, 0.5, 0.5, -1.0, -1.0], 2, 2, &sink);
        assert_eq!(*sink.lock().expect("lock"), vec![0.5, 0.5]);
        push_mono(&[i16::MAX, i16::MAX], 2, 3, &sink);
        let samples = sink.lock().expect("lock");
        assert_eq!(samples.len(), 3);
        assert!((samples[2] - 1.0).abs() < 1e-3);
    }

    #[test]
    #[ignore = "needs a microphone and microphone permission for the terminal"]
    fn records_from_the_default_microphone() {
        let mic = CpalMicrophone::new().expect("microphone");
        assert!(mic.stop().is_err(), "stop before start is an error");
        mic.start().expect("start");
        std::thread::sleep(std::time::Duration::from_millis(1_000));
        let pcm = mic.stop().expect("stop");
        let peak = pcm.iter().fold(0.0_f32, |m, s| m.max(s.abs()));
        eprintln!("{} samples at 16 kHz, peak {peak:.3}", pcm.len());
        assert!((14_000..=18_000).contains(&pcm.len()));
    }
}
