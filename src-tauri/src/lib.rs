//! GetCko core: local RAG, agents, screen help and voice behind Tauri commands.

pub mod commands;
pub mod engine;
pub mod error;
pub mod ingest;
pub mod model;
pub mod paths;
pub mod pipeline;
pub mod platform;
pub mod pointer;
pub mod prompt;
pub mod screenshot;
pub mod store;
pub mod templates;

/// Event channel carrying [`model::TurnEvent`].
pub const EVENT_TURN: &str = "turn";
/// Event channel carrying [`model::Document`] on every status change.
pub const EVENT_DOCUMENT: &str = "document";
/// Event channel carrying the final `Vec<ComponentStatus>` once models finish loading,
/// so onboarding can leave its "loading models" state without polling.
pub const EVENT_ENGINE: &str = "engine";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use std::sync::{Arc, OnceLock};
    use tauri::Manager;
    use tracing_subscriber::EnvFilter;
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                // llama.cpp dumps hundreds of model-metadata lines at info; keep its warnings.
                .unwrap_or_else(|_| {
                    EnvFilter::new("info,getcko_lib=debug,llama-cpp-2=warn,llama_cpp_2=warn")
                }),
        )
        .try_init();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let vector = paths::vector_extension(app.handle()).map_err(Box::<dyn std::error::Error>::from)?;
            let db = paths::database(app.handle()).map_err(Box::<dyn std::error::Error>::from)?;
            let store = Arc::new(store::Store::open(&db, &vector, engine::EMBEDDING_DIM).map_err(Box::<dyn std::error::Error>::from)?);
            match store.vector_version() { Ok(version) => tracing::info!(%version, "sqlite-vector loaded"), Err(error) => tracing::warn!("sqlite-vector version unavailable: {error}") }
            let engine = Arc::new(OnceLock::new());
            let state = Arc::new(pipeline::AppState { store, engine: Arc::clone(&engine), platform: Arc::from(platform::current()), turns: Arc::new(pipeline::TurnControl::new()), prepared: std::sync::Mutex::new(None) });
            let models = paths::models_dir(app.handle());
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                use tauri::Emitter;
                let started = std::time::Instant::now();
                let loaded = engine::Engine::load(&models);
                for status in loaded.status() { tracing::info!(component=?status.component, ready=status.ready, detail=?status.detail, "engine component status"); }
                tracing::info!(elapsed_ms=started.elapsed().as_millis(), "engine load complete");
                let statuses = loaded.status().to_vec();
                if engine.set(loaded).is_err() { tracing::error!("engine initialized more than once"); }
                if let Err(error) = handle.emit(EVENT_ENGINE, statuses) { tracing::warn!("could not emit engine event: {error}"); }
            });
            // The OS loads its text-recognition model on first use (~28 s cold on macOS);
            // pay that at startup instead of on a user's first tier-3 question.
            let ocr_platform = Arc::clone(&state.platform);
            std::thread::spawn(move || pipeline::warm_up_text_recognition(ocr_platform.as_ref()));
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::setup_status, commands::permission_request, commands::voice_list,
            commands::kb_list, commands::kb_create, commands::kb_rename, commands::kb_delete,
            commands::doc_list, commands::doc_import, commands::doc_delete, commands::template_list,
            commands::agent_list, commands::agent_get, commands::agent_create, commands::agent_create_from_template,
            commands::agent_update, commands::agent_duplicate, commands::agent_delete, commands::agent_active,
            commands::agent_set_active, commands::ptt_start, commands::screen_prepare, commands::ask, commands::stop, commands::screen_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
