//! GetCko's English speech-to-text helper. whisper.cpp bundles its own ggml, which
//! cannot be linked into the app next to llama.cpp's (different versions, duplicate
//! symbols), so it runs here, in its own process, with the model loaded once.
//!
//! Usage: `getcko-whisper <model.bin>`. Protocol on stdin/stdout, little-endian:
//! - after loading, writes one byte [`READY`];
//! - request: `u32` sample count, that many `f32` samples (16 kHz mono, -1..1),
//!   `u32` hint length, hint UTF-8 (vocabulary to expect; may be empty);
//! - reply: `u8` status ([`OK`] or [`FAILED`]), `u32` length, UTF-8 (transcript or
//!   error message).
//!
//! It exits when stdin closes. whisper.cpp's own logging goes to stderr, which the
//! app discards.

use std::io::{self, BufReader, BufWriter, Read, Write};

use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const READY: u8 = 0xA5;
const OK: u8 = 0;
const FAILED: u8 = 1;
/// 60 s of 16 kHz audio; push-to-talk turns are seconds long.
const MAX_SAMPLES: u32 = 16_000 * 60;
/// Whisper's prompt holds about 224 tokens; the app sends a few hundred characters.
const MAX_HINT: u32 = 4096;

fn main() {
    if let Err(error) = run() {
        // stderr is this process's log; the app reports the failure itself.
        eprintln!("getcko-whisper: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let model = std::env::args()
        .nth(1)
        .ok_or("usage: getcko-whisper <model.bin>")?;
    let context = WhisperContext::new_with_params(&model, WhisperContextParameters::default())
        .map_err(|error| format!("loading {model}: {error}"))?;
    let mut state = context
        .create_state()
        .map_err(|error| format!("whisper state: {error}"))?;
    let threads = std::thread::available_parallelism()
        .ok()
        .and_then(|n| i32::try_from(n.get()).ok())
        .unwrap_or(4);

    let mut input = BufReader::new(io::stdin().lock());
    let mut output = BufWriter::new(io::stdout().lock());
    output.write_all(&[READY]).map_err(|e| e.to_string())?;
    output.flush().map_err(|e| e.to_string())?;

    loop {
        let samples = match read_u32(&mut input) {
            Ok(count) => count,
            // The app closed the pipe: done.
            Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(()),
            Err(error) => return Err(error.to_string()),
        };
        if samples > MAX_SAMPLES {
            return Err(format!("request of {samples} samples is too long"));
        }
        let mut pcm = vec![0f32; samples as usize];
        let mut bytes = [0u8; 4];
        for sample in &mut pcm {
            input.read_exact(&mut bytes).map_err(|e| e.to_string())?;
            *sample = f32::from_le_bytes(bytes);
        }
        let hint_len = read_u32(&mut input).map_err(|e| e.to_string())?;
        if hint_len > MAX_HINT {
            return Err(format!("hint of {hint_len} bytes is too long"));
        }
        let mut hint = vec![0u8; hint_len as usize];
        input.read_exact(&mut hint).map_err(|e| e.to_string())?;
        let hint = String::from_utf8_lossy(&hint);

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_n_threads(threads);
        params.set_no_context(true);
        params.set_single_segment(true);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_print_special(false);
        if !hint.is_empty() {
            params.set_initial_prompt(&hint);
        }
        let reply = state
            .full(params, &pcm)
            .map_err(|error| error.to_string())
            .map(|_| {
                (0..state.full_n_segments())
                    .filter_map(|index| state.get_segment(index))
                    .filter_map(|segment| segment.to_str_lossy().ok().map(|s| s.into_owned()))
                    .collect::<String>()
                    .trim()
                    .to_owned()
            });
        let (status, text) = match reply {
            Ok(text) => (OK, text),
            Err(error) => (FAILED, error),
        };
        let length = u32::try_from(text.len()).map_err(|e| e.to_string())?;
        output.write_all(&[status]).map_err(|e| e.to_string())?;
        output
            .write_all(&length.to_le_bytes())
            .map_err(|e| e.to_string())?;
        output
            .write_all(text.as_bytes())
            .map_err(|e| e.to_string())?;
        output.flush().map_err(|e| e.to_string())?;
    }
}

fn read_u32(input: &mut impl Read) -> io::Result<u32> {
    let mut bytes = [0u8; 4];
    input.read_exact(&mut bytes)?;
    Ok(u32::from_le_bytes(bytes))
}
