//! Local AI components behind small traits. Every implementation is
//! cross-platform and built identically for macOS and Windows; only the GPU
//! backend llama.cpp is compiled with differs (Metal / Vulkan, CPU fallback on both).
//!
//! | Component     | Impl                         | Owner            |
//! |---------------|------------------------------|------------------|
//! | [`ChatModel`] | `llama::LlamaChat` (Gemma 4 E2B)        | core (done)      |
//! | [`Embedder`]  | `llama::LlamaEmbedder` (EmbeddingGemma) | core (done)      |
//! | [`Transcriber`] | whisper.cpp via `whisper-rs`  | macOS engineer   |
//! | [`Speaker`]   | OS voices via the `tts` crate | macOS engineer   |
//! | [`Microphone`]| `cpal`, 16 kHz mono           | Windows engineer |
//!
//! All methods are blocking; callers run them on worker threads, never on the
//! async runtime.

pub mod llama;

use std::path::Path;
use std::sync::Arc;

use crate::error::{AppError, ErrorKind};
use crate::model::{ComponentStatus, EngineComponent, Language, Voice};

/// Vectors stored and searched. EmbeddingGemma is Matryoshka-trained, so the
/// first 256 of its 768 dims (re-normalised) keep most of the quality at a third
/// of the size. Changing this requires re-importing every document.
pub const EMBEDDING_DIM: usize = 256;

/// Model files, relative to the models directory (see `scripts/fetch-models.sh`).
pub const CHAT_MODEL_FILE: &str = "gemma-4-E2B-it-Q4_0.gguf";
pub const EMBEDDING_MODEL_FILE: &str = "embeddinggemma-300M-Q8_0.gguf";

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("model file missing: {0}")]
    MissingModel(String),
    #[error("model runtime error: {0}")]
    Runtime(String),
    #[error("input too long: {tokens} tokens > {limit}")]
    TooLong { tokens: usize, limit: usize },
}

impl From<EngineError> for AppError {
    fn from(err: EngineError) -> Self {
        let kind = match err {
            EngineError::MissingModel(_) => ErrorKind::Unavailable,
            EngineError::TooLong { .. } => ErrorKind::Invalid,
            EngineError::Runtime(_) => ErrorKind::Engine,
        };
        AppError::new(kind, err.to_string())
    }
}

pub type EngineResult<T> = Result<T, EngineError>;

/// Turns text into unit-length vectors of [`EMBEDDING_DIM`].
pub trait Embedder: Send + Sync {
    /// Passages being stored. Output order matches input order.
    ///
    /// # Errors
    /// Runtime failure or a text longer than the model context.
    fn embed_documents(&self, texts: &[&str]) -> EngineResult<Vec<Vec<f32>>>;

    /// A question being searched with (EmbeddingGemma uses a different prompt
    /// for queries than for documents).
    ///
    /// # Errors
    /// Runtime failure.
    fn embed_query(&self, text: &str) -> EngineResult<Vec<f32>>;
}

/// Returned by streaming callbacks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flow {
    Continue,
    Stop,
}

#[derive(Debug, Clone, Copy)]
pub struct ChatRequest<'a> {
    pub system: &'a str,
    pub user: &'a str,
    pub max_tokens: u32,
}

/// Measured during generation (BR-24).
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct GenerationStats {
    pub prompt_tokens: u32,
    pub generated_tokens: u32,
    pub first_token_ms: u32,
    pub total_ms: u32,
}

/// Instruction-tuned text generation.
pub trait ChatModel: Send + Sync {
    /// Streams decoded text pieces to `on_text` until end of turn,
    /// `max_tokens`, or `on_text` returns [`Flow::Stop`].
    ///
    /// # Errors
    /// Runtime failure or a prompt longer than the context window.
    fn generate(
        &self,
        request: &ChatRequest<'_>,
        on_text: &mut dyn FnMut(&str) -> Flow,
    ) -> EngineResult<GenerationStats>;
}

/// On-device speech-to-text.
pub trait Transcriber: Send + Sync {
    /// `pcm` is 16 kHz mono f32 in [-1, 1].
    ///
    /// # Errors
    /// Runtime failure.
    fn transcribe(&self, pcm: &[f32], language: Language) -> EngineResult<String>;
}

/// On-device text-to-speech through OS voices.
pub trait Speaker: Send + Sync {
    fn voices(&self) -> Vec<Voice>;

    /// Queue `text` after anything already queued; returns immediately.
    /// `voice_id: None` uses the best installed voice for `language`, falling
    /// back to English (BR-23).
    ///
    /// # Errors
    /// Runtime failure.
    fn speak(
        &self,
        text: &str,
        voice_id: Option<&str>,
        language: Language,
        rate: f32,
    ) -> EngineResult<()>;

    /// Silence now and drop the queue (BR-22).
    fn stop(&self);
}

/// Push-to-talk recording from the default input device.
pub trait Microphone: Send + Sync {
    /// # Errors
    /// No input device or permission denied.
    fn start(&self) -> EngineResult<()>;

    /// Stop and return everything recorded since `start`, as 16 kHz mono f32.
    ///
    /// # Errors
    /// Not recording.
    fn stop(&self) -> EngineResult<Vec<f32>>;
}

/// The loaded components. A missing component is `None` plus a reason, so the
/// app runs (and onboarding can explain) with whatever is available.
pub struct Engine {
    pub chat: Option<Arc<dyn ChatModel>>,
    pub embedder: Option<Arc<dyn Embedder>>,
    pub transcriber: Option<Arc<dyn Transcriber>>,
    pub speaker: Option<Arc<dyn Speaker>>,
    pub microphone: Option<Arc<dyn Microphone>>,
    status: Vec<ComponentStatus>,
}

impl Engine {
    /// Loads every component it can from `models_dir`. Never fails as a whole.
    #[must_use]
    pub fn load(models_dir: &Path) -> Self {
        let mut status = Vec::with_capacity(5);
        let mut record = |component, result: Result<(), String>| {
            if let Err(detail) = &result {
                tracing::warn!(?component, %detail, "engine component unavailable");
            }
            status.push(ComponentStatus {
                component,
                ready: result.is_ok(),
                detail: result.err(),
            });
        };

        let (chat, embedder) = match llama::Runtime::init() {
            Ok(rt) => {
                let chat = llama::LlamaChat::load(&rt, &models_dir.join(CHAT_MODEL_FILE))
                    .map(|m| Arc::new(m) as Arc<dyn ChatModel>);
                let embedder =
                    llama::LlamaEmbedder::load(&rt, &models_dir.join(EMBEDDING_MODEL_FILE))
                        .map(|m| Arc::new(m) as Arc<dyn Embedder>);
                (chat, embedder)
            }
            Err(err) => (Err(EngineError::Runtime(err.to_string())), Err(err)),
        };
        record(
            EngineComponent::Chat,
            chat.as_ref().map(|_| ()).map_err(ToString::to_string),
        );
        record(
            EngineComponent::Embeddings,
            embedder.as_ref().map(|_| ()).map_err(ToString::to_string),
        );
        record(
            EngineComponent::SpeechToText,
            Err("speech-to-text is not built yet".into()),
        );
        record(
            EngineComponent::TextToSpeech,
            Err("text-to-speech is not built yet".into()),
        );
        record(
            EngineComponent::Microphone,
            Err("microphone capture is not built yet".into()),
        );

        Self {
            chat: chat.ok(),
            embedder: embedder.ok(),
            transcriber: None,
            speaker: None,
            microphone: None,
            status,
        }
    }

    #[must_use]
    pub fn status(&self) -> &[ComponentStatus] {
        &self.status
    }
}

/// Unwraps an optional component or reports it as unavailable.
///
/// # Errors
/// [`ErrorKind::Unavailable`] naming the component.
pub fn require<T: ?Sized>(component: Option<&Arc<T>>, name: &str) -> Result<Arc<T>, AppError> {
    component
        .cloned()
        .ok_or_else(|| AppError::unavailable(format!("{name} is not available")))
}
