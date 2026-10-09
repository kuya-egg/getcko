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

pub fn models_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Some(path) = std::env::var_os("GETCKO_MODELS_DIR") {
        return PathBuf::from(path);
    }
    let resource = app.path().resource_dir().unwrap_or_default().join("models");
    if resource.join(CHAT_MODEL_FILE).is_file() {
        return resource;
    }
    #[cfg(debug_assertions)]
    {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("models")
    }
    #[cfg(not(debug_assertions))]
    {
        resource
    }
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
