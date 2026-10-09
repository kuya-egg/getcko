//! OS seam: everything that differs between macOS and Windows lives behind
//! [`Platform`]. Both implementations expose exactly this surface — no
//! OS-only methods — so the rest of the core and the client never branch on OS.
//!
//! Owners: `macos.rs` (macOS engineer, AX API), `windows.rs` (Windows engineer,
//! UI Automation). Each implementation must pass [`conformance`] on its OS.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;
use crate::error::{AppError, ErrorKind};
use crate::model::{
    MonitorFrame, PermissionKind, PermissionStatus, Rect, ScreenElement, ScreenSnapshot,
};

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

    /// Pixels of the window [`Platform::snapshot`] reads (the topmost window that is
    /// not this process), on the monitor holding it. The caller hides GetCko's own
    /// windows first.
    ///
    /// # Errors
    /// [`PlatformError::PermissionDenied`] when Screen Recording is not granted,
    /// [`PlatformError::Unavailable`] where capture is not implemented.
    fn capture(&self) -> Result<ScreenCapture, PlatformError>;

    /// Text the OS reads in `capture` (tier 3: screens without accessible elements).
    /// Bounds are desktop physical pixels, like [`ScreenElement::bounds`]. On-device
    /// only (macOS Vision; Windows `Windows.Media.Ocr`).
    ///
    /// # Errors
    /// [`PlatformError::Unavailable`] where text recognition is not implemented.
    fn recognize_text(&self, capture: &ScreenCapture) -> Result<Vec<TextBox>, PlatformError>;
}

/// One line of text read from a screenshot.
#[derive(Debug, Clone, PartialEq)]
pub struct TextBox {
    pub text: String,
    /// Desktop physical pixels.
    pub bounds: Rect,
}

/// Captured pixels (the target window's area), top row first, 4 bytes per pixel in RGBA order, no row
/// padding (`rgba.len() == width * height * 4`).
#[derive(Debug, Clone)]
pub struct ScreenCapture {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
    /// Physical desktop position of the top-left pixel (same space as
    /// `ScreenElement.bounds`). Captures may be cropped to the target window.
    pub x: i32,
    pub y: i32,
    /// Display holding the capture; the overlay covers it to draw a guess.
    pub monitor: MonitorFrame,
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
    return Box::new(macos::MacPlatform::new());
    #[cfg(target_os = "windows")]
    return Box::new(windows::WindowsPlatform::new());
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    return Box::new(Unbuilt(std::env::consts::OS));
}

/// Reports screen reading as unavailable; used until an OS implementation lands
/// and on unsupported OSes.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
struct Unbuilt(&'static str);

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
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

    fn capture(&self) -> Result<ScreenCapture, PlatformError> {
        Err(PlatformError::Unavailable(format!(
            "screen capture is not built for {} yet",
            self.0
        )))
    }

    fn recognize_text(&self, _capture: &ScreenCapture) -> Result<Vec<TextBox>, PlatformError> {
        Err(PlatformError::Unavailable(format!(
            "text recognition is not built for {} yet",
            self.0
        )))
    }
}

/// Drops static text that only names a control: a form caption next to its field,
/// a button's own title listed again as text, "Male" beside the radio "Sex, Male".
/// The model picked such captions instead of the control (held-out forms), and the
/// duplicate line costs prompt tokens. A caption is dropped when every one of its
/// words is in one control's label. Both OS walks call this before ranking.
pub fn drop_control_captions(elements: &mut Vec<ScreenElement>) {
    let controls: Vec<std::collections::HashSet<String>> = elements
        .iter()
        .filter(|e| e.role != "text" && e.role != "other" && !e.label.trim().is_empty())
        .map(|e| caption_words(&e.label).collect())
        .collect();
    if controls.is_empty() {
        return;
    }
    elements.retain(|e| {
        if e.role != "text" {
            return true;
        }
        let words: Vec<String> = caption_words(&e.label).collect();
        words.is_empty() || !controls.iter().any(|c| words.iter().all(|w| c.contains(w)))
    });
}

/// A label's words for caption matching: lowercase, punctuation and `*` removed.
fn caption_words(label: &str) -> impl Iterator<Item = String> + '_ {
    label
        .split(|c: char| c.is_whitespace() || c == ',' || c == ':' || c == '*')
        .filter(|w| !w.is_empty())
        .map(str::to_lowercase)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn captions_that_name_a_control_are_dropped() {
        let make = |role: &str, label: &str| ScreenElement {
            id: String::new(),
            role: role.into(),
            label: label.into(),
            value: None,
            bounds: Rect {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            },
        };
        let mut elements = vec![
            make("text", "Last name *"),
            make("textField", "Last name"),
            make("text", "Place of birth:"),
            make("textField", "place of birth"),
            make("text", "Fill in every field"),
            make("text", "Save"),
            make("button", "Save"),
            make("text", "Male"),
            make("radio", "Sex, Male"),
            make("text", "Field"),
            make("text", "Other things"),
            make("other", "Other things"),
        ];
        drop_control_captions(&mut elements);
        let labels: Vec<&str> = elements.iter().map(|e| e.label.as_str()).collect();
        assert_eq!(
            labels,
            [
                "Last name",
                "place of birth",
                "Fill in every field",
                "Save",
                "Sex, Male",
                "Field",
                "Other things",
                "Other things"
            ]
        );
    }
}
