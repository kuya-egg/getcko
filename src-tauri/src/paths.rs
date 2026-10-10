use crate::{
    engine::CHAT_MODEL_FILE,
    error::{AppError, AppResult},
};
use std::path::PathBuf;
use tauri::Manager;

pub fn vector_extension(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::new(crate::error::ErrorKind::Io, e.to_string()))?;
    #[cfg(target_os = "macos")]
    let file = "vector.dylib";
    #[cfg(target_os = "windows")]
    let file = "vector.dll";
    let bundled = resource.join("sqlite-vector").join(file);
    #[cfg(debug_assertions)]
    if !bundled.exists() {
        #[cfg(target_os = "macos")]
        let fallback = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("vendor/sqlite-vector/macos-arm64/vector.dylib");
        #[cfg(target_os = "windows")]
        let fallback = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("vendor/sqlite-vector/windows-x86_64/vector.dll");
        if fallback.exists() {
            return Ok(fallback);
        }
    }
    Ok(bundled)
}

/// Where downloaded models go. On Windows the local (not roaming) app data folder: a
/// roaming profile would copy the 3–5 GB of models to the server at every sign-in and
/// sign-out on school and office PCs.
pub fn download_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let paths = app.path();
    #[cfg(target_os = "windows")]
    let base = paths.app_local_data_dir();
    #[cfg(not(target_os = "windows"))]
    let base = paths.app_data_dir();
    let dir = base
        .map_err(|e| AppError::new(crate::error::ErrorKind::Io, e.to_string()))?
        .join("models");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn models_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    if let Some(path) = std::env::var_os("GETCKO_MODELS_DIR") {
        return Ok(PathBuf::from(path));
    }
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::new(crate::error::ErrorKind::Io, e.to_string()))?
        .join("models");
    if resource.join(CHAT_MODEL_FILE).is_file() {
        return Ok(resource);
    }
    #[cfg(debug_assertions)]
    {
        let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models");
        if development.join(CHAT_MODEL_FILE).is_file() {
            return Ok(development);
        }
    }
    download_dir(app)
}

pub fn database(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new(crate::error::ErrorKind::Io, e.to_string()))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::new(crate::error::ErrorKind::Io, e.to_string()))?;
    Ok(dir.join("getcko.db"))
}
