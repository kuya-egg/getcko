//! OS seam: everything that differs between macOS and Windows lives behind
//! [`Platform`]. Both implementations expose exactly this surface — no
//! OS-only methods — so the rest of the core and the client never branch on OS.
//!
//! Owners: `macos.rs` (macOS engineer, AX API), `windows.rs` (Windows engineer,
//! UI Automation). Each implementation must pass [`conformance`] on its OS.

use crate::error::{AppError, ErrorKind};
use crate::model::{PermissionKind, PermissionStatus, ScreenSnapshot};

/// Upper bound on elements sent to the model; keeps the prompt within the
/// 0.3 s screen+retrieval budget.
pub const MAX_SNAPSHOT_ELEMENTS: usize = 150;

#[derive(Debug, thiserror::Error)]
pub enum PlatformError {
    #[error("permission not granted: {0:?}")]
    PermissionDenied(PermissionKind),
    #[error("no focused app to read")]
    NoFocusedApp,
    #[error("{0}")]
    Unavailable(String),
    #[error("screen reading failed: {0}")]
    Os(String),
}

impl From<PlatformError> for AppError {
    fn from(err: PlatformError) -> Self {
        let kind = match err {
            PlatformError::PermissionDenied(_) => ErrorKind::PermissionDenied,
            PlatformError::Unavailable(_) => ErrorKind::Unavailable,
            PlatformError::NoFocusedApp | PlatformError::Os(_) => ErrorKind::Platform,
        };
        AppError::new(kind, err.to_string())
    }
}

/// Screen reading and OS permissions. Called from worker threads.
pub trait Platform: Send + Sync {
    /// Current status without prompting.
    fn permission(&self, kind: PermissionKind) -> PermissionStatus;

    /// Prompt for (or open system settings for) `kind`, then return the status.
    /// Kinds the OS does not gate return [`PermissionStatus::NotRequired`].
    fn request_permission(&self, kind: PermissionKind) -> PermissionStatus;

    /// Elements of the most recently focused app **that is not this process**
    /// (GetCko's own windows are never read).
    ///
    /// Contract (checked by [`conformance`]):
    /// - at most `max_elements`, preferring visible, labelled, actionable ones;
    /// - `id`s unique within the snapshot (`e1`, `e2`, ...);
    /// - `bounds` in desktop physical pixels, origin at the primary display's
    ///   top-left (Tauri's `PhysicalPosition` space), non-zero size;
    /// - `role` normalised to the lower-camel vocabulary in [`ROLES`].
    ///
    /// # Errors
    /// [`PlatformError::PermissionDenied`] when Accessibility is not granted,
    /// [`PlatformError::NoFocusedApp`] when nothing is focused.
    fn snapshot(&self, max_elements: usize) -> Result<ScreenSnapshot, PlatformError>;
}

/// Shared role vocabulary so prompts are identical on both OSes. Map native
/// roles onto these; anything else becomes `other`.
pub const ROLES: &[&str] = &[
    "button",
    "checkbox",
    "radio",
    "textField",
    "textArea",
    "comboBox",
    "list",
    "listItem",
    "menu",
    "menuItem",
    "menuBar",
    "tab",
    "link",
    "cell",
    "row",
    "table",
    "image",
    "text",
    "slider",
    "toolbar",
    "window",
    "other",
];

/// The implementation for the OS this binary was built for.
#[must_use]
pub fn current() -> Box<dyn Platform> {
    // Each OS engineer swaps their arm to their implementation; the trait is the contract.
    #[cfg(target_os = "macos")]
    return Box::new(Unbuilt("macOS"));
    #[cfg(target_os = "windows")]
    return Box::new(Unbuilt("Windows"));
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    return Box::new(Unbuilt(std::env::consts::OS));
}

/// Reports screen reading as unavailable; used until an OS implementation lands
/// and on unsupported OSes.
struct Unbuilt(&'static str);

impl Platform for Unbuilt {
    fn permission(&self, kind: PermissionKind) -> PermissionStatus {
        match kind {
            PermissionKind::Microphone => PermissionStatus::NotAsked,
            _ => PermissionStatus::NotRequired,
        }
    }

    fn request_permission(&self, kind: PermissionKind) -> PermissionStatus {
        self.permission(kind)
    }

    fn snapshot(&self, _max_elements: usize) -> Result<ScreenSnapshot, PlatformError> {
        Err(PlatformError::Unavailable(format!(
            "screen reading is not built for {} yet",
            self.0
        )))
    }
}

/// Checks one snapshot against the [`Platform::snapshot`] contract. OS
/// implementations call this from their own `#[ignore]` tests run on a real
/// desktop (`cargo test -- --ignored platform`), so both OSes are held to the same bar.
///
/// # Errors
/// Describes the first violation.
pub fn conformance(snapshot: &ScreenSnapshot, max_elements: usize) -> Result<(), String> {
    if snapshot.elements.len() > max_elements {
        return Err(format!(
            "{} elements > max {max_elements}",
            snapshot.elements.len()
        ));
    }
    let mut ids = std::collections::HashSet::with_capacity(snapshot.elements.len());
    for el in &snapshot.elements {
        if !ids.insert(el.id.as_str()) {
            return Err(format!("duplicate id {}", el.id));
        }
        if !ROLES.contains(&el.role.as_str()) {
            return Err(format!("{}: role {:?} not in ROLES", el.id, el.role));
        }
        if el.bounds.width <= 0.0 || el.bounds.height <= 0.0 {
            return Err(format!("{}: empty bounds {:?}", el.id, el.bounds));
        }
    }
    Ok(())
}
