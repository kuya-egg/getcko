use crate::{error::AppResult, model::*, pipeline::AppState};
use std::{path::PathBuf, sync::Arc};
use tauri::State;
fn state(s: &State<'_, Arc<AppState>>) -> Arc<AppState> {
    Arc::clone(s.inner())
}
#[tauri::command]
pub async fn setup_status(s: State<'_, Arc<AppState>>) -> AppResult<SetupStatus> {
    let st = state(&s);
    let platform = Arc::clone(&st.platform);
    let engine = Arc::clone(&st.engine);
    tauri::async_runtime::spawn_blocking(move || {
        let permissions = [
            PermissionKind::Accessibility,
            PermissionKind::ScreenRecording,
            PermissionKind::Microphone,
        ]
        .into_iter()
        .map(|kind| PermissionState {
            kind,
            status: platform.permission(kind),
        })
        .collect();
        let components = engine
            .get()
            .map(|e| e.status().to_vec())
            .unwrap_or_else(|| {
                [
                    EngineComponent::Chat,
                    EngineComponent::Embeddings,
                    EngineComponent::SpeechToText,
                    EngineComponent::TextToSpeech,
                    EngineComponent::Microphone,
                ]
                .into_iter()
                .map(|component| ComponentStatus {
                    component,
                    ready: false,
                    detail: Some("loading models".into()),
                })
                .collect()
            });
        Ok(SetupStatus {
            permissions,
            components,
        })
    })
    .await
    .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn permission_request(
    kind: PermissionKind,
    s: State<'_, Arc<AppState>>,
) -> AppResult<PermissionStatus> {
    let p = Arc::clone(&s.platform);
    tauri::async_runtime::spawn_blocking(move || Ok(p.request_permission(kind)))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn voice_list(s: State<'_, Arc<AppState>>) -> AppResult<Vec<Voice>> {
    let e = Arc::clone(&s.engine);
    tauri::async_runtime::spawn_blocking(move || {
        Ok(e.get()
            .and_then(|x| x.speaker.as_ref().map(|s| s.voices()))
            .unwrap_or_default())
    })
    .await
    .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn kb_list(s: State<'_, Arc<AppState>>) -> AppResult<Vec<KnowledgeBase>> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.kb_list())
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn kb_create(name: String, s: State<'_, Arc<AppState>>) -> AppResult<KnowledgeBase> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.kb_create(&name))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn kb_rename(
    id: KnowledgeBaseId,
    name: String,
    s: State<'_, Arc<AppState>>,
) -> AppResult<KnowledgeBase> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.kb_rename(id, &name))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn kb_delete(id: KnowledgeBaseId, s: State<'_, Arc<AppState>>) -> AppResult<()> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.kb_delete(id))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn doc_list(
    knowledge_base_id: KnowledgeBaseId,
    s: State<'_, Arc<AppState>>,
) -> AppResult<Vec<Document>> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.doc_list(knowledge_base_id))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn doc_import(
    app: tauri::AppHandle,
    knowledge_base_id: KnowledgeBaseId,
    path: String,
    s: State<'_, Arc<AppState>>,
) -> AppResult<Document> {
    let st = state(&s);
    let p = PathBuf::from(path);
    tauri::async_runtime::spawn_blocking(move || {
        crate::pipeline::import_document(app, st, knowledge_base_id, p)
    })
    .await
    .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn doc_delete(id: DocumentId, s: State<'_, Arc<AppState>>) -> AppResult<()> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.doc_delete(id))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub fn template_list() -> AppResult<Vec<Template>> {
    Ok(crate::templates::all())
}
#[tauri::command]
pub async fn agent_list(s: State<'_, Arc<AppState>>) -> AppResult<Vec<Agent>> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.agent_list())
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_get(id: AgentId, s: State<'_, Arc<AppState>>) -> AppResult<Agent> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.agent_get(id))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_create(draft: AgentDraft, s: State<'_, Arc<AppState>>) -> AppResult<Agent> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.agent_create(&draft, None))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_create_from_template(
    template_id: TemplateId,
    s: State<'_, Arc<AppState>>,
) -> AppResult<Agent> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || {
        let t = crate::templates::get(template_id);
        x.agent_create(&t.draft, Some(template_id))
    })
    .await
    .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_update(
    id: AgentId,
    draft: AgentDraft,
    s: State<'_, Arc<AppState>>,
) -> AppResult<Agent> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.agent_update(id, &draft))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_duplicate(id: AgentId, s: State<'_, Arc<AppState>>) -> AppResult<Agent> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.agent_duplicate(id))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_delete(id: AgentId, s: State<'_, Arc<AppState>>) -> AppResult<()> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.agent_delete(id))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_active(s: State<'_, Arc<AppState>>) -> AppResult<Option<Agent>> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.active_agent())
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn agent_set_active(id: AgentId, s: State<'_, Arc<AppState>>) -> AppResult<Agent> {
    let x = Arc::clone(&s.store);
    tauri::async_runtime::spawn_blocking(move || x.set_active_agent(id))
        .await
        .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub async fn ptt_start(s: State<'_, Arc<AppState>>) -> AppResult<()> {
    let e = Arc::clone(&s.engine);
    tauri::async_runtime::spawn_blocking(move || {
        let engine = e
            .get()
            .ok_or_else(|| crate::error::AppError::unavailable("models are loading"))?;
        engine
            .microphone
            .as_ref()
            .ok_or_else(|| crate::error::AppError::unavailable("microphone is not available"))?
            .start()
            .map_err(|e| crate::error::AppError::unavailable(e.to_string()))
    })
    .await
    .map_err(|e| crate::error::AppError::unavailable(e.to_string()))?
}
#[tauri::command]
pub fn ask(
    app: tauri::AppHandle,
    request: AskRequest,
    s: State<'_, Arc<AppState>>,
) -> AppResult<TurnId> {
    crate::pipeline::run_turn(app, state(&s), request)
}
#[tauri::command]
pub fn stop(s: State<'_, Arc<AppState>>) -> AppResult<()> {
    crate::pipeline::stop(&s);
    Ok(())
}
#[tauri::command]
pub fn screen_snapshot(s: State<'_, Arc<AppState>>) -> AppResult<ScreenSnapshot> {
    s.platform
        .snapshot(crate::platform::MAX_SNAPSHOT_ELEMENTS)
        .map_err(crate::error::AppError::from)
}
