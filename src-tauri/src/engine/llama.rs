//! In-process llama.cpp runtime for local chat and embeddings.
use std::{
    path::Path,
    sync::{Arc, LazyLock, Mutex},
    time::Instant,
};

use super::{
    ChatModel, ChatRequest, EMBEDDING_DIM, Embedder, EngineError, EngineResult, Flow,
    GenerationStats,
};
use llama_cpp_2::{
    LogOptions,
    context::{
        LlamaContext,
        params::{LlamaContextParams, LlamaPoolingType},
    },
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{LlamaChatMessage, LlamaModel, params::LlamaModelParams},
    sampling::LlamaSampler,
    send_logs_to_tracing,
};

static BACKEND: LazyLock<Result<Arc<LlamaBackend>, String>> = LazyLock::new(|| {
    LlamaBackend::init()
        .map(Arc::new)
        .map_err(|error| error.to_string())
});
const CHAT_CONTEXT: u32 = 4096;
const EMBED_CONTEXT: u32 = 2048;

/// Initialized llama.cpp backend shared by all loaded models.
pub struct Runtime {
    backend: Arc<LlamaBackend>,
}

impl Runtime {
    /// Initializes llama.cpp and routes its logs through tracing.
    ///
    /// # Errors
    /// Returns a runtime error if the backend cannot be initialized.
    pub fn init() -> EngineResult<Self> {
        send_logs_to_tracing(LogOptions::default());
        let backend = BACKEND
            .as_ref()
            .map_err(|error| EngineError::Runtime(error.clone()))?;
        Ok(Self {
            backend: Arc::clone(backend),
        })
    }
}

fn runtime_error(error: impl std::fmt::Display) -> EngineError {
    EngineError::Runtime(error.to_string())
}
fn threads() -> i32 {
    std::thread::available_parallelism().map_or(1, |n| i32::try_from(n.get()).unwrap_or(i32::MAX))
}

fn load_model(rt: &Runtime, path: &Path, layers: u32) -> EngineResult<LlamaModel> {
    if !path.is_file() {
        return Err(EngineError::MissingModel(path.display().to_string()));
    }
    LlamaModel::load_from_file(
        &rt.backend,
        path,
        &LlamaModelParams::default().with_n_gpu_layers(layers),
    )
    .map_err(runtime_error)
}
fn context<'a>(
    model: &'a LlamaModel,
    backend: &LlamaBackend,
    size: u32,
    embeddings: bool,
    pooling: LlamaPoolingType,
) -> EngineResult<LlamaContext<'a>> {
    let n_ctx = std::num::NonZeroU32::new(size);
    let params = LlamaContextParams::default()
        .with_n_ctx(n_ctx)
        .with_n_threads(threads())
        .with_n_threads_batch(threads())
        .with_embeddings(embeddings)
        .with_pooling_type(pooling);
    model.new_context(backend, params).map_err(runtime_error)
}

/// Chat model loaded from a GGUF file.
pub struct LlamaChat {
    backend: Arc<LlamaBackend>,
    model: Mutex<LlamaModel>,
    device: &'static str,
}
impl LlamaChat {
    /// Loads a chat model, trying full GPU offload before CPU fallback.
    ///
    /// # Errors
    /// Returns [`EngineError::MissingModel`] for a missing file or a runtime error if loading fails.
    pub fn load(rt: &Runtime, path: &Path) -> EngineResult<Self> {
        Self::load_with_gpu_layers(rt, path, u32::MAX)
    }

    pub(crate) fn load_with_gpu_layers(
        rt: &Runtime,
        path: &Path,
        layers: u32,
    ) -> EngineResult<Self> {
        if layers == 0 {
            let model = load_model(rt, path, 0)?;
            let _ = context(
                &model,
                &rt.backend,
                CHAT_CONTEXT,
                false,
                LlamaPoolingType::Unspecified,
            )?;
            tracing::info!(device = "cpu", "loaded chat model");
            return Ok(Self {
                backend: Arc::clone(&rt.backend),
                model: Mutex::new(model),
                device: "cpu",
            });
        }
        match load_model(rt, path, layers) {
            Ok(model) => {
                let gpu_context_available = {
                    match context(
                        &model,
                        &rt.backend,
                        CHAT_CONTEXT,
                        false,
                        LlamaPoolingType::Unspecified,
                    ) {
                        Ok(_) => true,
                        Err(error) => {
                            tracing::warn!(%error, "GPU chat context unavailable; retrying on CPU");
                            false
                        }
                    }
                };
                if gpu_context_available {
                    tracing::info!(device = "gpu", "loaded chat model");
                    Ok(Self {
                        backend: Arc::clone(&rt.backend),
                        model: Mutex::new(model),
                        device: "gpu",
                    })
                } else {
                    let model = load_model(rt, path, 0)?;
                    let _ = context(
                        &model,
                        &rt.backend,
                        CHAT_CONTEXT,
                        false,
                        LlamaPoolingType::Unspecified,
                    )?;
                    tracing::info!(device = "cpu", "loaded chat model");
                    Ok(Self {
                        backend: Arc::clone(&rt.backend),
                        model: Mutex::new(model),
                        device: "cpu",
                    })
                }
            }
            Err(error) => {
                tracing::warn!(%error, "GPU chat model unavailable; retrying on CPU");
                let model = load_model(rt, path, 0)?;
                let _ = context(
                    &model,
                    &rt.backend,
                    CHAT_CONTEXT,
                    false,
                    LlamaPoolingType::Unspecified,
                )?;
                tracing::info!(device = "cpu", "loaded chat model");
                Ok(Self {
                    backend: Arc::clone(&rt.backend),
                    model: Mutex::new(model),
                    device: "cpu",
                })
            }
        }
    }
    /// Reports whether the model is running with GPU or CPU placement.
    pub fn device(&self) -> &'static str {
        self.device
    }
}

impl ChatModel for LlamaChat {
    fn generate(
        &self,
        request: &ChatRequest<'_>,
        on_text: &mut dyn FnMut(&str) -> Flow,
    ) -> EngineResult<GenerationStats> {
        let start = Instant::now();
        let model = self.model.lock().map_err(runtime_error)?;
        let mut ctx = context(
            &model,
            &self.backend,
            CHAT_CONTEXT,
            false,
            LlamaPoolingType::Unspecified,
        )?;
        let prompt = match model.chat_template(None) {
            Ok(template) => {
                let messages = [
                    LlamaChatMessage::new("system".to_owned(), request.system.to_owned())
                        .map_err(runtime_error)?,
                    LlamaChatMessage::new("user".to_owned(), request.user.to_owned())
                        .map_err(runtime_error)?,
                ];
                model
                    .apply_chat_template(&template, &messages, true)
                    .unwrap_or_else(|_| {
                        format!(
                            "<start_of_turn>user\n{}\n\n{}<end_of_turn>\n<start_of_turn>model\n",
                            request.system, request.user
                        )
                    })
            }
            Err(_) => format!(
                "<start_of_turn>user\n{}\n\n{}<end_of_turn>\n<start_of_turn>model\n",
                request.system, request.user
            ),
        };
        let vocab = model.vocab();
        let tokens = vocab.tokenize(prompt.as_bytes(), true, true);
        let count = tokens.len();
        let total = count.saturating_add(request.max_tokens as usize);
        if total > CHAT_CONTEXT as usize {
            return Err(EngineError::TooLong {
                tokens: total,
                limit: CHAT_CONTEXT as usize,
            });
        }
        if tokens.is_empty() {
            return Err(runtime_error("chat prompt tokenized to empty input"));
        }
        let mut batch = LlamaBatch::new(count.max(1), 1);
        batch
            .add_sequence(&tokens, 0, true)
            .map_err(runtime_error)?;
        ctx.decode(&mut batch).map_err(runtime_error)?;
        let mut stats = GenerationStats {
            prompt_tokens: u32::try_from(count).unwrap_or(u32::MAX),
            ..GenerationStats::default()
        };
        let mut raw = Vec::with_capacity(8);
        let mut pending = Vec::with_capacity(4);
        let mut sampler =
            LlamaSampler::chain_simple([LlamaSampler::temp(0.2), LlamaSampler::dist(0)]);
        for index in 0..request.max_tokens {
            let token = sampler.sample(&ctx, -1);
            sampler.accept(token);
            stats.generated_tokens = index.saturating_add(1);
            if vocab.is_eog(token) {
                break;
            }
            raw.clear();
            vocab.token_to_piece_into(token, &mut raw, false, None);
            pending.extend_from_slice(&raw);
            let valid = match std::str::from_utf8(&pending) {
                Ok(text) => text.len(),
                Err(error) if error.error_len().is_none() => error.valid_up_to(),
                Err(error) => {
                    return Err(runtime_error(format!(
                        "invalid UTF-8 generated by model: {error}"
                    )));
                }
            };
            if valid > 0 {
                let text = std::str::from_utf8(&pending[..valid]).map_err(runtime_error)?;
                if stats.first_token_ms == 0 {
                    stats.first_token_ms =
                        u32::try_from(start.elapsed().as_millis()).unwrap_or(u32::MAX);
                }
                let stop = on_text(text) == Flow::Stop;
                pending.drain(..valid);
                if stop {
                    break;
                }
            }
            if index + 1 < request.max_tokens {
                batch.clear();
                batch
                    .add(token, count as i32 + index as i32, &[0], true)
                    .map_err(runtime_error)?;
                ctx.decode(&mut batch).map_err(runtime_error)?;
            }
        }
        if !pending.is_empty() {
            let text = String::from_utf8_lossy(&pending);
            if !text.is_empty() {
                if stats.first_token_ms == 0 {
                    stats.first_token_ms =
                        u32::try_from(start.elapsed().as_millis()).unwrap_or(u32::MAX);
                }
                let _ = on_text(&text);
            }
        }
        stats.total_ms = u32::try_from(start.elapsed().as_millis()).unwrap_or(u32::MAX);
        Ok(stats)
    }
}

/// EmbeddingGemma-backed normalized vector generator.
pub struct LlamaEmbedder {
    backend: Arc<LlamaBackend>,
    model: Mutex<LlamaModel>,
    device: &'static str,
}
impl LlamaEmbedder {
    /// Loads EmbeddingGemma with mean pooling and CPU fallback.
    ///
    /// # Errors
    /// Returns [`EngineError::MissingModel`] for a missing file or a runtime error if loading fails.
    pub fn load(rt: &Runtime, path: &Path) -> EngineResult<Self> {
        Self::load_with_gpu_layers(rt, path, u32::MAX)
    }
    pub(crate) fn load_with_gpu_layers(
        rt: &Runtime,
        path: &Path,
        layers: u32,
    ) -> EngineResult<Self> {
        let attempt = |gpu_layers| -> EngineResult<LlamaModel> {
            let model = load_model(rt, path, gpu_layers)?;
            let _ = context(
                &model,
                &rt.backend,
                EMBED_CONTEXT,
                true,
                LlamaPoolingType::Mean,
            )?;
            Ok(model)
        };
        if layers == 0 {
            let model = attempt(0)?;
            tracing::info!(device = "cpu", "loaded embedding model");
            return Ok(Self {
                backend: Arc::clone(&rt.backend),
                model: Mutex::new(model),
                device: "cpu",
            });
        }
        match attempt(layers) {
            Ok(model) => {
                tracing::info!(device = "gpu", "loaded embedding model");
                Ok(Self {
                    backend: Arc::clone(&rt.backend),
                    model: Mutex::new(model),
                    device: "gpu",
                })
            }
            Err(error) => {
                tracing::warn!(%error, "GPU embedding model unavailable; retrying on CPU");
                let model = attempt(0)?;
                tracing::info!(device = "cpu", "loaded embedding model");
                Ok(Self {
                    backend: Arc::clone(&rt.backend),
                    model: Mutex::new(model),
                    device: "cpu",
                })
            }
        }
    }
    /// Reports whether the model is running with GPU or CPU placement.
    pub fn device(&self) -> &'static str {
        self.device
    }
    fn embed(&self, text: &str, prefix: &str) -> EngineResult<Vec<f32>> {
        let model = self.model.lock().map_err(runtime_error)?;
        let mut ctx = context(
            &model,
            &self.backend,
            EMBED_CONTEXT,
            true,
            LlamaPoolingType::Mean,
        )?;
        let input = format!("{prefix}{text}");
        let vocab = model.vocab();
        let tokens = vocab.tokenize(input.as_bytes(), true, true);
        if tokens.len() > EMBED_CONTEXT as usize {
            return Err(EngineError::TooLong {
                tokens: tokens.len(),
                limit: EMBED_CONTEXT as usize,
            });
        }
        if tokens.is_empty() {
            return Err(runtime_error("embedding input tokenized to empty input"));
        }
        let mut batch = LlamaBatch::new(tokens.len(), 1);
        batch
            .add_sequence(&tokens, 0, false)
            .map_err(runtime_error)?;
        ctx.decode(&mut batch).map_err(runtime_error)?;
        let vector = ctx.embeddings_seq_ith(0).map_err(runtime_error)?;
        if vector.len() < EMBEDDING_DIM {
            return Err(runtime_error(format!(
                "embedding has {} dimensions, expected at least {EMBEDDING_DIM}",
                vector.len()
            )));
        }
        let mut result = vector[..EMBEDDING_DIM].to_vec();
        let norm = result.iter().map(|value| value * value).sum::<f32>().sqrt();
        if norm.is_finite() && norm > f32::EPSILON {
            for value in &mut result {
                *value /= norm;
            }
        } else {
            return Err(runtime_error("embedding has zero or non-finite norm"));
        }
        Ok(result)
    }
}
impl Embedder for LlamaEmbedder {
    fn embed_documents(&self, texts: &[&str]) -> EngineResult<Vec<Vec<f32>>> {
        let mut result = Vec::with_capacity(texts.len());
        for text in texts {
            result.push(self.embed(text, "title: none | text: ")?);
        }
        Ok(result)
    }
    fn embed_query(&self, text: &str) -> EngineResult<Vec<f32>> {
        self.embed(text, "task: search result | query: ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    fn model_path(file: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("models")
            .join(file)
    }
    #[test]
    #[ignore = "needs model files"]
    fn chat_streams_answer_and_stats() {
        let rt = Runtime::init().expect("runtime initializes");
        let model = LlamaChat::load(&rt, &model_path("gemma-4-E2B-it-Q4_0.gguf"))
            .expect("chat model loads");
        let request = ChatRequest {
            system: "Reply with exactly the word OK",
            user: "Reply with exactly the word OK",
            max_tokens: 32,
        };
        let mut answer = String::new();
        let stats = model
            .generate(&request, &mut |piece| {
                answer.push_str(piece);
                Flow::Continue
            })
            .expect("generation succeeds");
        assert!(answer.contains("OK"));
        assert!(stats.generated_tokens > 0);
        assert!(stats.first_token_ms <= stats.total_ms);
    }
    #[test]
    #[ignore = "needs model files"]
    fn embeddings_are_normalized_and_rank_relevant_passage_higher() {
        let rt = Runtime::init().expect("runtime initializes");
        let model = LlamaEmbedder::load(&rt, &model_path("embeddinggemma-300M-Q8_0.gguf"))
            .expect("embedding model loads");
        let docs = model
            .embed_documents(&[
                "Grading assignments requires assessing student work against a rubric.",
                "Cooking pasta requires boiling water and adding salt.",
            ])
            .expect("documents embed");
        let query = model
            .embed_query("How should I grade student assignments?")
            .expect("query embeds");
        assert_eq!(query.len(), 256);
        let norm = query.iter().map(|v| v * v).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-4);
        let cosine = |a: &[f32], b: &[f32]| a.iter().zip(b).map(|(x, y)| x * y).sum::<f32>();
        assert!(cosine(&query, &docs[0]) > cosine(&query, &docs[1]));
    }
    #[test]
    #[ignore = "needs model files"]
    fn forced_cpu_model_loads() {
        let rt = Runtime::init().expect("runtime initializes");
        let model =
            LlamaChat::load_with_gpu_layers(&rt, &model_path("gemma-4-E2B-it-Q4_0.gguf"), 0)
                .expect("CPU model loads");
        assert_eq!(model.device(), "cpu");
    }
}
