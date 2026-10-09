//! Shared by the measurement examples (`#[path = "common/mod.rs"] mod common;`).

use std::{path::Path, sync::Arc};

use getcko_lib::engine::{
    self, ChatModel,
    llama::{LlamaChat, PromptFormat, Runtime},
};

/// The answering model under test: `GETCKO_CHAT=qwen3-vl` loads Qwen3-VL-2B-Instruct
/// (ChatML turns, its own projector) instead of the engine's Gemma 4 E2B. Measurement
/// only; the app always uses the engine's model.
pub fn chat_under_test(engine_chat: Arc<dyn ChatModel>, models: &Path) -> Arc<dyn ChatModel> {
    match std::env::var("GETCKO_CHAT").as_deref() {
        Ok("qwen3-vl") => {
            let rt = Runtime::init().expect("runtime");
            let chat = LlamaChat::load_with_format(
                &rt,
                &models.join(engine::GROUNDER_MODEL_FILE),
                &models.join(engine::GROUNDER_PROJECTOR_FILE),
                PromptFormat::ChatMl,
            )
            .expect("Qwen3-VL loads");
            eprintln!("answering model: Qwen3-VL-2B");
            Arc::new(chat)
        }
        Ok(other) => panic!("unknown GETCKO_CHAT {other} (qwen3-vl)"),
        Err(_) => engine_chat,
    }
}
