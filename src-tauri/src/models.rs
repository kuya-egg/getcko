use crate::{
    error::{AppError, AppResult, ErrorKind},
    model::{DownloadStage, ModelFile, ModelProgress, ModelRole, ModelsStatus},
};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::Path,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tauri::Emitter;

#[derive(serde::Deserialize)]
struct ManifestFile {
    file: String,
    url: String,
    sha256: String,
    bytes: u64,
    role: ModelRole,
    required: bool,
}

fn manifest() -> Result<Vec<ManifestFile>, String> {
    serde_json::from_str(include_str!("../models.json")).map_err(|error| error.to_string())
}

#[derive(Default)]
pub struct ModelDownloads {
    running: Mutex<bool>,
    cancel: Arc<AtomicBool>,
}
impl ModelDownloads {
    pub fn is_running(&self) -> bool {
        self.running.lock().map(|running| *running).unwrap_or(false)
    }
    pub fn start(self: &Arc<Self>, app: tauri::AppHandle, include_optional: bool) -> AppResult<()> {
        let mut running = self
            .running
            .lock()
            .map_err(|_| AppError::new(ErrorKind::Engine, "model download state unavailable"))?;
        if *running {
            return Err(AppError::invalid("a model download is already running"));
        }
        check_available_space(&app, include_optional)?;
        *running = true;
        self.cancel.store(false, Ordering::SeqCst);
        let state = Arc::clone(self);
        std::thread::spawn(move || {
            let result = download_all(&app, &state.cancel, include_optional);
            let (stage, error) = match result {
                Ok(()) => (DownloadStage::Done, None),
                Err((stage, message)) => (stage, Some(message)),
            };
            let _ = app.emit(
                "models",
                ModelProgress {
                    file: String::new(),
                    received: 0,
                    total: 0,
                    stage,
                    error,
                },
            );
            if let Ok(mut running) = state.running.lock() {
                *running = false;
            }
        });
        Ok(())
    }
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }
}

pub fn status(engine_dir: &Path, downloading: bool) -> AppResult<ModelsStatus> {
    let manifest =
        manifest().map_err(|_| AppError::new(ErrorKind::Engine, "model manifest is invalid"))?;
    let files: Vec<_> = manifest
        .iter()
        .map(|entry| {
            let present = fs::metadata(engine_dir.join(&entry.file))
                .is_ok_and(|metadata| metadata.len() == entry.bytes);
            ModelFile {
                file: entry.file.clone(),
                role: entry.role,
                required: entry.required,
                bytes: entry.bytes,
                present,
            }
        })
        .collect();
    let missing_bytes = files
        .iter()
        .filter(|file| !file.present)
        .map(|file| file.bytes)
        .sum();
    let free_bytes = available_space(engine_dir).ok();
    Ok(ModelsStatus {
        dir: engine_dir.to_string_lossy().into_owned(),
        files,
        missing_bytes,
        free_bytes,
        downloading,
    })
}

fn check_available_space(app: &tauri::AppHandle, include_optional: bool) -> AppResult<()> {
    let entries =
        manifest().map_err(|_| AppError::new(ErrorKind::Engine, "model manifest is invalid"))?;
    let dir = crate::paths::models_dir(app)?;
    let missing_bytes: u64 = entries
        .iter()
        .filter(|entry| (entry.required || include_optional) && !is_present(&dir, entry))
        .map(|entry| entry.bytes)
        .sum();
    if available_space(&dir).is_ok_and(|free| missing_bytes > free) {
        return Err(AppError::invalid("not enough disk space"));
    }
    Ok(())
}

fn download_all(
    app: &tauri::AppHandle,
    cancel: &AtomicBool,
    include_optional: bool,
) -> Result<(), (DownloadStage, String)> {
    let entries = manifest().map_err(|_| {
        (
            DownloadStage::Failed,
            "model manifest is invalid".to_owned(),
        )
    })?;
    let dir = crate::paths::models_dir(app).map_err(|_| {
        (
            DownloadStage::Failed,
            "could not create model folder".to_owned(),
        )
    })?;
    let missing: Vec<_> = entries
        .iter()
        .filter(|entry| (entry.required || include_optional) && !is_present(&dir, entry))
        .collect();
    let needed: u64 = missing
        .iter()
        .map(|entry| {
            entry.bytes.saturating_sub(
                fs::metadata(dir.join(format!("{}.part", entry.file))).map_or(0, |m| m.len()),
            )
        })
        .sum();
    if available_space(&dir).is_ok_and(|free| needed > free) {
        return Err((DownloadStage::Failed, "not enough disk space".to_owned()));
    }
    for entry in missing {
        if cancel.load(Ordering::SeqCst) {
            return Err((DownloadStage::Cancelled, "download cancelled".to_owned()));
        }
        download_one(&dir, entry, cancel, |progress| {
            let _ = app.emit("models", progress);
        })?;
    }
    Ok(())
}

fn is_present(dir: &Path, entry: &ManifestFile) -> bool {
    fs::metadata(dir.join(&entry.file)).is_ok_and(|metadata| metadata.len() == entry.bytes)
}

fn download_one(
    dir: &Path,
    entry: &ManifestFile,
    cancel: &AtomicBool,
    emit: impl Fn(ModelProgress),
) -> Result<(), (DownloadStage, String)> {
    let part = dir.join(format!("{}.part", entry.file));
    let final_path = dir.join(&entry.file);
    let mut offset = fs::metadata(&part).map_or(0, |metadata| metadata.len());
    let mut hasher = Sha256::new();
    if offset > entry.bytes {
        let _ = fs::remove_file(&part);
        offset = 0;
    }
    if offset > 0 {
        let mut existing = File::open(&part).map_err(io_failure)?;
        let mut buffer = [0_u8; 64 * 1024];
        loop {
            let count = existing.read(&mut buffer).map_err(io_failure)?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }
    }
    let mut request = ureq::get(&entry.url);
    if offset > 0 {
        request = request.header("Range", &format!("bytes={offset}-"));
    }
    let mut response = request
        .call()
        .map_err(|_| (DownloadStage::Failed, "no internet connection".to_owned()))?;
    let status = response.status().as_u16();
    if offset > 0 && status != 206 {
        offset = 0;
        hasher = Sha256::new();
    }
    let mut output = if offset == 0 {
        File::create(&part)
    } else {
        OpenOptions::new().append(true).open(&part)
    }
    .map_err(io_failure)?;
    let mut reader = response.body_mut().as_reader();
    let mut buffer = [0_u8; 64 * 1024];
    let mut received = offset;
    let mut last_emit = Instant::now() - Duration::from_secs(1);
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err((DownloadStage::Cancelled, "download cancelled".to_owned()));
        }
        let count = reader
            .read(&mut buffer)
            .map_err(|_| (DownloadStage::Failed, "download interrupted".to_owned()))?;
        if count == 0 {
            break;
        }
        output.write_all(&buffer[..count]).map_err(io_failure)?;
        hasher.update(&buffer[..count]);
        received += u64::try_from(count).unwrap_or(0);
        if last_emit.elapsed() >= Duration::from_millis(100) {
            emit(ModelProgress {
                file: entry.file.clone(),
                received,
                total: entry.bytes,
                stage: DownloadStage::Downloading,
                error: None,
            });
            last_emit = Instant::now();
        }
    }
    output.flush().map_err(io_failure)?;
    emit(ModelProgress {
        file: entry.file.clone(),
        received,
        total: entry.bytes,
        stage: DownloadStage::Verifying,
        error: None,
    });
    let hash = hex::encode(hasher.finalize());
    if received != entry.bytes || hash != entry.sha256 {
        let _ = fs::remove_file(&part);
        return Err((DownloadStage::Failed, "checksum mismatch".to_owned()));
    }
    fs::rename(&part, &final_path).map_err(io_failure)?;
    emit(ModelProgress {
        file: entry.file.clone(),
        received,
        total: entry.bytes,
        stage: DownloadStage::Done,
        error: None,
    });

    Ok(())
}

fn io_failure(_: std::io::Error) -> (DownloadStage, String) {
    (
        DownloadStage::Failed,
        "could not save model file".to_owned(),
    )
}
fn available_space(path: &Path) -> std::io::Result<u64> {
    #[cfg(unix)]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;
        let path = CString::new(path.as_os_str().as_bytes()).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "invalid model directory")
        })?;
        let mut stats = std::mem::MaybeUninit::<libc::statvfs>::uninit();
        // SAFETY: path is NUL-terminated and stats points to writable storage.
        if unsafe { libc::statvfs(path.as_ptr(), stats.as_mut_ptr()) } != 0 {
            return Err(std::io::Error::last_os_error());
        }
        // SAFETY: statvfs initialized the structure on success.
        let stats = unsafe { stats.assume_init() };
        Ok(u64::from(stats.f_bavail).saturating_mul(stats.f_frsize))
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        let mut free = 0u64;
        // SAFETY: `wide` is NUL-terminated and outlives the call; `free` is writable.
        unsafe {
            windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                windows::core::PCWSTR(wide.as_ptr()),
                Some(&raw mut free),
                None,
                None,
            )
        }
        .map_err(|error| std::io::Error::other(error.to_string()))?;
        Ok(free)
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = path;
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "free space is unavailable on this platform",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_contains_each_engine_model_once() {
        let entries = manifest().expect("embedded manifest parses");
        let expected = [
            crate::engine::CHAT_MODEL_FILE,
            crate::engine::PROJECTOR_FILE,
            crate::engine::EMBEDDING_MODEL_FILE,
            crate::engine::GROUNDER_MODEL_FILE,
            crate::engine::GROUNDER_PROJECTOR_FILE,
            crate::engine::whisper::WHISPER_MODEL_FILE,
        ];
        for name in expected {
            assert_eq!(
                entries.iter().filter(|entry| entry.file == name).count(),
                1,
                "{name}"
            );
        }
    }

    #[test]
    fn resume_hash_continues_from_existing_part_bytes() {
        let mut hasher = Sha256::new();
        hasher.update(b"first ");
        hasher.update(b"second");
        assert_eq!(
            hex::encode(hasher.finalize()),
            hex::encode(Sha256::digest(b"first second"))
        );
    }
    #[test]
    #[ignore = "downloads the real 36 MB embedding model"]
    fn real_bge_model_download_and_skip_smoke() {
        let dir = tempfile::tempdir().expect("temporary model directory");
        let entry = manifest()
            .expect("embedded manifest parses")
            .into_iter()
            .find(|entry| entry.file == crate::engine::EMBEDDING_MODEL_FILE)
            .expect("embedding model is in manifest");
        let cancel = AtomicBool::new(false);
        if !is_present(dir.path(), &entry) {
            download_one(dir.path(), &entry, &cancel, |_| {}).expect("real model downloads");
        }
        assert!(is_present(dir.path(), &entry));
        if !is_present(dir.path(), &entry) {
            download_one(dir.path(), &entry, &cancel, |_| {}).expect("second download succeeds");
        }
        assert!(is_present(dir.path(), &entry));
    }
}
