//! Windows screen reading through UI Automation, screenshots through
//! Windows.Graphics.Capture, text recognition through Windows.Media.Ocr, plus OS
//! permissions.
//!
//! Mirrors `macos.rs`: reads the topmost normal on-screen window that is not
//! GetCko, fetches its UI Automation subtree in one cached call, and returns
//! labelled/actionable elements with bounds in desktop physical pixels (the space
//! Tauri's `PhysicalPosition` uses). Every COM call runs on a short-lived worker
//! thread that is multithreaded-apartment and per-monitor-v2 DPI aware, so results
//! are physical pixels whichever thread (or test) calls in.

use std::collections::VecDeque;
use std::ffi::c_void;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use ::windows::core::{BOOL, BSTR, HSTRING, Interface, PCWSTR, PWSTR, w};
use ::windows::Graphics::Capture::{Direct3D11CaptureFramePool, GraphicsCaptureItem, GraphicsCaptureSession};
use ::windows::Graphics::DirectX::Direct3D11::IDirect3DDevice;
use ::windows::Graphics::DirectX::DirectXPixelFormat;
use ::windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
use ::windows::Media::Ocr::OcrEngine;
use ::windows::Security::Cryptography::CryptographicBuffer;
use ::windows::Win32::Foundation::{CloseHandle, HMODULE, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use ::windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_HARDWARE;
use ::windows::Win32::Graphics::Direct3D11::{
    D3D11_BIND_FLAG, D3D11_CPU_ACCESS_READ, D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_MAP_READ,
    D3D11_MAPPED_SUBRESOURCE, D3D11_RESOURCE_MISC_FLAG, D3D11_SDK_VERSION, D3D11_TEXTURE2D_DESC,
    D3D11_USAGE_STAGING, D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D,
};
use ::windows::Win32::Graphics::Dwm::{DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS, DwmGetWindowAttribute};
use ::windows::Win32::Graphics::Dxgi::IDXGIDevice;
use ::windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromPoint};
use ::windows::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
use ::windows::Win32::System::Com::{
    CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoIncrementMTAUsage, CoInitializeEx,
    CoUninitialize,
};
use ::windows::Win32::System::Registry::{HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ, RegGetValueW};
use ::windows::Win32::System::Threading::{
    OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use ::windows::Win32::System::Variant::VARIANT;
use ::windows::Win32::System::WinRT::Direct3D11::{CreateDirect3D11DeviceFromDXGIDevice, IDirect3DDxgiInterfaceAccess};
use ::windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;
use ::windows::Win32::UI::Accessibility::{
    CUIAutomation8, IAccessible, IUIAutomation, IUIAutomation2, IUIAutomationElement, ObjectFromLresult,
    TreeScope_Children, UIA_AppBarControlTypeId, UIA_CustomControlTypeId, UIA_IsControlElementPropertyId,
    UIA_IsGridItemPatternAvailablePropertyId, UIA_IsTableItemPatternAvailablePropertyId,
    UIA_IsRangeValuePatternAvailablePropertyId, UIA_IsSelectionItemPatternAvailablePropertyId,
    UIA_IsTogglePatternAvailablePropertyId, UIA_ProgressBarControlTypeId, UIA_RangeValueValuePropertyId,
    UIA_SelectionItemIsSelectedPropertyId, UIA_ToggleToggleStatePropertyId, UIA_BoundingRectanglePropertyId, UIA_ButtonControlTypeId,
    UIA_CheckBoxControlTypeId, UIA_ComboBoxControlTypeId, UIA_CONTROLTYPE_ID, UIA_ControlTypePropertyId,
    UIA_DataGridControlTypeId, UIA_DataItemControlTypeId, UIA_DocumentControlTypeId, UIA_EditControlTypeId,
    UIA_GroupControlTypeId, UIA_HeaderItemControlTypeId, UIA_HelpTextPropertyId, UIA_HyperlinkControlTypeId,
    UIA_ImageControlTypeId, UIA_IsOffscreenPropertyId, UIA_IsPasswordPropertyId, UIA_IsValuePatternAvailablePropertyId,
    UIA_ListControlTypeId, UIA_ListItemControlTypeId, UIA_MenuBarControlTypeId, UIA_MenuControlTypeId,
    UIA_MenuItemControlTypeId, UIA_NamePropertyId, UIA_PaneControlTypeId, UIA_ProcessIdPropertyId,
    UIA_RadioButtonControlTypeId, UIA_ScrollBarControlTypeId, UIA_SeparatorControlTypeId, UIA_SliderControlTypeId,
    UIA_SpinnerControlTypeId, UIA_SplitButtonControlTypeId, UIA_TabItemControlTypeId, UIA_TableControlTypeId,
    UIA_TextControlTypeId, UIA_ThumbControlTypeId, UIA_TitleBarControlTypeId, UIA_ToolBarControlTypeId,
    UIA_TreeControlTypeId, UIA_TreeItemControlTypeId, UIA_ValueIsReadOnlyPropertyId, UIA_ValueValuePropertyId,
    UIA_WindowControlTypeId,
};
use ::windows::Win32::UI::HiDpi::{
    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, GetDpiForMonitor, MDT_EFFECTIVE_DPI, SetThreadDpiAwarenessContext,
};
use ::windows::Win32::UI::Shell::ShellExecuteW;
use ::windows::Win32::UI::WindowsAndMessaging::{
    EnumChildWindows, GW_HWNDNEXT, GWL_EXSTYLE, GetClassNameW, GetForegroundWindow, GetTopWindow, GetWindow,
    GetWindowRect,
    GetWindowLongPtrW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible, OBJID_CLIENT,
    SMTO_ABORTIFHUNG, SW_SHOWNORMAL, SendMessageTimeoutW, WM_GETOBJECT, WS_EX_APPWINDOW, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
};

use super::{Platform, PlatformError, ScreenCapture, TextBox};
use crate::model::{
    MonitorFrame, PermissionKind, PermissionStatus, Rect, ScreenElement, ScreenSnapshot,
};

/// One UI Automation call to a hung app gives up after this long.
const UIA_TIMEOUT_MS: u32 = 500;
/// Same walk budget as `macos.rs`: the snapshot returns what it read in time.
const MAX_DEPTH: usize = 30;
const MAX_NODES: usize = 4000;
const WALK_BUDGET: Duration = Duration::from_millis(300);
/// Upper bound for one snapshot or capture, including thread and COM start-up.
const WORKER_TIMEOUT: Duration = Duration::from_secs(4);
/// Upper bound for one text recognition; the first call loads the OCR model.
const OCR_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_TEXT: usize = 120;
/// Windows.Graphics.Capture delivers the first frame within a few ms; wait at most this.
const FIRST_FRAME_TIMEOUT: Duration = Duration::from_millis(1000);
/// How long a Chromium/Electron app gets to build its web tree after the first
/// request (same as `macos.rs`).
const WEB_TREE_DELAY: Duration = Duration::from_millis(250);

/// Desktop surfaces that are never "the app the user is looking at".
const SHELL_CLASSES: &[&str] = &[
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "Windows.UI.Core.CoreWindow",
];

/// Windows UI Automation-backed screen reader. Stateless, so `Send + Sync`.
#[derive(Debug, Default)]
pub(super) struct WindowsPlatform;

impl WindowsPlatform {
    /// Creates the platform adapter.
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl Platform for WindowsPlatform {
    fn permission(&self, kind: PermissionKind) -> PermissionStatus {
        match kind {
            // Windows has no Accessibility gate for UI Automation clients.
            PermissionKind::Accessibility => PermissionStatus::NotRequired,
            // No gate for desktop apps unless a policy or the user turned capture off.
            PermissionKind::ScreenRecording => match consent("graphicsCaptureProgrammatic") {
                Consent::Denied => PermissionStatus::Denied,
                Consent::Allowed | Consent::Unset => PermissionStatus::NotRequired,
            },
            // Unpackaged desktop apps get no consent prompt: allowed unless switched off.
            PermissionKind::Microphone => match consent("microphone") {
                Consent::Denied => PermissionStatus::Denied,
                Consent::Allowed | Consent::Unset => PermissionStatus::Granted,
            },
        }
    }

    fn request_permission(&self, kind: PermissionKind) -> PermissionStatus {
        let status = self.permission(kind);
        if status == PermissionStatus::Denied {
            // Nothing can be granted in-process; take the user to the switch.
            let page = match kind {
                PermissionKind::Microphone => w!("ms-settings:privacy-microphone"),
                PermissionKind::ScreenRecording => w!("ms-settings:privacy-graphicscaptureprogrammatic"),
                PermissionKind::Accessibility => return status,
            };
            // SAFETY: all string arguments are static, NUL-terminated wide strings.
            unsafe { ShellExecuteW(None, w!("open"), page, PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL) };
        }
        status
    }

    fn snapshot(&self, max_elements: usize) -> Result<ScreenSnapshot, PlatformError> {
        on_worker("getcko-uia", WORKER_TIMEOUT, move || {
            let target = topmost_window(std::process::id()).ok_or(PlatformError::NoFocusedApp)?;
            snapshot_window(&target, max_elements)
        })
    }

    fn capture(&self) -> Result<ScreenCapture, PlatformError> {
        if consent("graphicsCaptureProgrammatic") == Consent::Denied {
            return Err(PlatformError::PermissionDenied(PermissionKind::ScreenRecording));
        }
        on_worker("getcko-capture", WORKER_TIMEOUT, move || {
            match topmost_window(std::process::id()) {
                Some(target) => capture_window(&target),
                // Only the desktop: the whole primary monitor (tier 3 reads it), as
                // `macos.rs` captures the main display.
                None => capture_primary_monitor(),
            }
        })
    }

    fn capture_shows_own_windows(&self) -> bool {
        // A target window is captured on its own; only the whole-monitor capture (no
        // app window, just the desktop) would include the overlay.
        topmost_window(std::process::id()).is_none()
    }

    fn recognize_text(&self, capture: &ScreenCapture) -> Result<Vec<TextBox>, PlatformError> {
        let (width, height) = (capture.width as usize, capture.height as usize);
        if width == 0 || height == 0 || capture.rgba.len() != width * height * 4 {
            return Ok(Vec::new());
        }
        let image = OcrImage::from_rgba(width, height, &capture.rgba);
        let origin = (f64::from(capture.x), f64::from(capture.y));
        on_worker("getcko-ocr", OCR_TIMEOUT, move || recognize_lines(image, origin))
    }
}

/// A capture converted for Windows OCR: BGRA, no row padding.
struct OcrImage {
    width: usize,
    height: usize,
    bgra: Vec<u8>,
}

impl OcrImage {
    fn from_rgba(width: usize, height: usize, rgba: &[u8]) -> Self {
        let bgra = rgba.as_chunks::<4>().0.iter().flat_map(|p| [p[2], p[1], p[0], 255]).collect();
        Self { width, height, bgra }
    }

    /// Shrunk by a whole factor until neither side exceeds `max_side` (OCR rejects
    /// larger images), averaging each `factor`×`factor` block. Returns the factor.
    fn fit(self, max_side: usize) -> (Self, usize) {
        let factor = self.width.max(self.height).div_ceil(max_side.max(1)).max(1);
        if factor == 1 {
            return (self, 1);
        }
        let (width, height) = (self.width / factor, self.height / factor);
        let mut bgra = Vec::with_capacity(width * height * 4);
        for y in 0..height {
            for x in 0..width {
                let mut sum = [0u32; 3];
                for dy in 0..factor {
                    let row = (y * factor + dy) * self.width;
                    for dx in 0..factor {
                        let p = (row + x * factor + dx) * 4;
                        for (c, total) in sum.iter_mut().enumerate() {
                            *total += u32::from(self.bgra[p + c]);
                        }
                    }
                }
                let n = (factor * factor) as u32;
                bgra.extend(sum.map(|total| (total / n) as u8));
                bgra.push(255);
            }
        }
        (Self { width, height, bgra }, factor)
    }
}

/// Reads each line of text in `image` with Windows.Media.Ocr (on device, in the
/// user's profile languages), boxed in desktop physical pixels; the counterpart of
/// Vision's `VNRecognizeTextRequest` in `macos.rs`.
fn recognize_lines(image: OcrImage, origin: (f64, f64)) -> Result<Vec<TextBox>, PlatformError> {
    let unavailable = |e: ::windows::core::Error| PlatformError::Unavailable(format!("text recognition is unavailable: {e}"));
    // Fails when none of the user's languages has an OCR pack installed.
    let engine = OcrEngine::TryCreateFromUserProfileLanguages().map_err(unavailable)?;
    let max_side = OcrEngine::MaxImageDimension().map_err(unavailable)? as usize;
    let (image, factor) = image.fit(max_side);
    if image.width == 0 || image.height == 0 {
        return Ok(Vec::new());
    }
    let failed = |e: ::windows::core::Error| PlatformError::Os(format!("text recognition failed: {e}"));
    let to_i32 = |v: usize| i32::try_from(v).map_err(|e| PlatformError::Os(e.to_string()));
    let buffer = CryptographicBuffer::CreateFromByteArray(&image.bgra).map_err(failed)?;
    let bitmap =
        SoftwareBitmap::CreateCopyFromBuffer(&buffer, BitmapPixelFormat::Bgra8, to_i32(image.width)?, to_i32(image.height)?)
            .map_err(failed)?;
    let result = wait_for(engine.RecognizeAsync(&bitmap).map_err(failed)?, OCR_TIMEOUT - OCR_TIMEOUT / 10)?;
    let lines = result.Lines().map_err(failed)?;
    // Word boxes are given for the deskewed image (text rotated to level); boxes of
    // tilted text (a scanned page shown at an angle) are turned back onto the screen.
    let angle = result.TextAngle().ok().and_then(|a| a.Value().ok()).unwrap_or(0.0);
    let size = (image.width as f64, image.height as f64);
    let scale = factor as f64;
    let mut boxes = Vec::new();
    for index in 0..lines.Size().map_err(failed)? {
        let line = lines.GetAt(index).map_err(failed)?;
        let text = line.Text().map_err(failed)?.to_string();
        if text.trim().is_empty() {
            continue;
        }
        // A line has no box of its own: it spans its words.
        let words = line.Words().map_err(failed)?;
        let rects = (0..words.Size().map_err(failed)?)
            .filter_map(|i| words.GetAt(i).and_then(|w| w.BoundingRect()).ok())
            .map(|r| (f64::from(r.X), f64::from(r.Y), f64::from(r.X + r.Width), f64::from(r.Y + r.Height)))
            .map(|r| unrotate(r, angle, size));
        let Some(bounds) = union(rects) else { continue };
        boxes.push(TextBox {
            text,
            bounds: Rect {
                x: origin.0 + bounds.0 * scale,
                y: origin.1 + bounds.1 * scale,
                width: (bounds.2 - bounds.0) * scale,
                height: (bounds.3 - bounds.1) * scale,
            },
        });
    }
    let _ = bitmap.Close();
    Ok(boxes)
}

/// Waits for `op` (at most `timeout`), cancelling it when time runs out so the
/// worker thread always ends; `join` would wait forever on a wedged OCR service.
fn wait_for<T: ::windows::core::RuntimeType + 'static>(
    op: windows_future::IAsyncOperation<T>,
    timeout: Duration,
) -> Result<T, PlatformError> {
    let failed = |e: ::windows::core::Error| PlatformError::Os(format!("text recognition failed: {e}"));
    let started = Instant::now();
    while op.Status().map_err(failed)? == windows_future::AsyncStatus::Started {
        if started.elapsed() >= timeout {
            let _ = op.Cancel();
            return Err(PlatformError::Os("text recognition timed out".into()));
        }
        std::thread::sleep(Duration::from_millis(5));
    }
    // Completed, or the error/cancellation that ended it.
    op.GetResults().map_err(failed)
}

/// `rect` (left, top, right, bottom) in the frame OCR read the text in, which is the
/// image turned so text with `angle` (degrees, clockwise) is level, mapped back to
/// the image (`size` = width, height) as the box around its four turned corners,
/// kept within the image.
fn unrotate(rect: (f64, f64, f64, f64), angle: f64, size: (f64, f64)) -> (f64, f64, f64, f64) {
    if angle.abs() < 0.01 {
        return rect;
    }
    let (sin, cos) = angle.to_radians().sin_cos();
    let (cx, cy) = (size.0 / 2.0, size.1 / 2.0);
    let corners = [(rect.0, rect.1), (rect.2, rect.1), (rect.0, rect.3), (rect.2, rect.3)].map(|(x, y)| {
        let (dx, dy) = (x - cx, y - cy);
        let (x, y) = (cx + dx * cos - dy * sin, cy + dx * sin + dy * cos);
        (x, y, x, y)
    });
    let (left, top, right, bottom) = union(corners.into_iter()).unwrap_or(rect);
    (left.clamp(0.0, size.0), top.clamp(0.0, size.1), right.clamp(0.0, size.0), bottom.clamp(0.0, size.1))
}

/// The smallest (left, top, right, bottom) box holding every box, if any.
fn union(boxes: impl Iterator<Item = (f64, f64, f64, f64)>) -> Option<(f64, f64, f64, f64)> {
    boxes.reduce(|a, b| (a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3)))
}

/// Runs `job` on a fresh thread set up for COM (multithreaded apartment) and
/// per-monitor-v2 DPI awareness, so callers on any thread (Tauri's main thread is
/// a single-threaded apartment) get physical-pixel results without COM conflicts.
fn on_worker<T: Send + 'static>(
    name: &str,
    timeout: Duration,
    job: impl FnOnce() -> Result<T, PlatformError> + Send + 'static,
) -> Result<T, PlatformError> {
    // Keep the multithreaded apartment alive for the life of the process. Otherwise
    // it is torn down each time the last worker exits, COM unloads the WinRT DLLs,
    // and the factories `windows` caches process-wide (capture, OCR) dangle: the next
    // capture crashed with an access violation.
    static MTA: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    // SAFETY: no arguments; the cookie is deliberately never released.
    MTA.get_or_init(|| unsafe { CoIncrementMTAUsage() }.is_ok());
    let (tx, rx) = mpsc::sync_channel(1);
    std::thread::Builder::new()
        .name(name.to_owned())
        .spawn(move || {
            // SAFETY: plain per-thread initialisation; balanced by CoUninitialize below.
            let com = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            // SAFETY: affects only this thread; the previous context is not needed.
            unsafe { SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };
            let result = if com.is_ok() {
                job()
            } else {
                Err(PlatformError::Unavailable(format!("COM is unavailable: {com:?}")))
            };
            let _ = tx.send(result);
            if com.is_ok() {
                // SAFETY: balances the successful CoInitializeEx on this thread; every
                // COM object created by `job` has been dropped by now.
                unsafe { CoUninitialize() };
            }
        })
        .map_err(|e| PlatformError::Os(format!("could not start {name} thread: {e}")))?;
    rx.recv_timeout(timeout)
        .map_err(|_| PlatformError::Os("the app did not respond in time".into()))?
}

struct TargetWindow {
    hwnd: HWND,
    pid: u32,
    /// Visible frame in desktop physical pixels (DWM extended frame bounds).
    bounds: RECT,
}

/// The window the user is working in that is not GetCko's: the foreground window
/// when it belongs to another app (even if pinned on top), else the topmost normal
/// top-level window in z-order (the Windows analogue of CoreGraphics' on-screen
/// window list at layer 0, used when GetCko itself has focus). Owned windows such
/// as Save As or a message box sit above their owner, so they win, like
/// `AXFocusedWindow` on macOS.
fn topmost_window(own_pid: u32) -> Option<TargetWindow> {
    // SAFETY: plain window-manager queries on handles the system just returned;
    // a window closing mid-walk only makes later calls fail, never UB.
    unsafe {
        let foreground = GetForegroundWindow();
        if !foreground.is_invalid()
            && let Some(target) = eligible(foreground, own_pid, true)
        {
            return Some(target);
        }
        let mut hwnd = GetTopWindow(None).ok()?;
        for _ in 0..4096 {
            if let Some(target) = eligible(hwnd, own_pid, false) {
                return Some(target);
            }
            hwnd = GetWindow(hwnd, GW_HWNDNEXT).ok()?;
            if hwnd.is_invalid() {
                return None;
            }
        }
    }
    None
}

/// The window if it is a visible app window (top-level or an owned dialog) that is
/// not ours. Always-on-top windows count only when `allow_topmost` (the user is
/// working in one).
///
/// # Safety
/// `hwnd` must be a top-level window handle from the system (it may be stale).
unsafe fn eligible(hwnd: HWND, own_pid: u32, allow_topmost: bool) -> Option<TargetWindow> {
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&raw mut pid));
        if pid == 0 || pid == own_pid {
            return None;
        }
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        // Non-activating overlays and (unless focused) always-on-top surfaces are
        // the Windows counterparts of the macOS layers above 0.
        if ex & WS_EX_NOACTIVATE.0 != 0 || (!allow_topmost && ex & WS_EX_TOPMOST.0 != 0) {
            return None;
        }
        // Tool windows (floating palettes, tooltips) are not app windows unless
        // they opt in with WS_EX_APPWINDOW.
        if ex & WS_EX_TOOLWINDOW.0 != 0 && ex & WS_EX_APPWINDOW.0 == 0 {
            return None;
        }
        // Suspended UWP and virtual-desktop windows are "visible" but cloaked.
        let mut cloaked = 0u32;
        let ok = DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            (&raw mut cloaked).cast::<c_void>(),
            size_of::<u32>() as u32,
        );
        if ok.is_ok() && cloaked != 0 {
            return None;
        }
        if SHELL_CLASSES.contains(&class_name(hwnd).as_str()) {
            return None;
        }
        let bounds = frame_bounds(hwnd)?;
        (bounds.right > bounds.left && bounds.bottom > bounds.top).then_some(TargetWindow { hwnd, pid, bounds })
    }
}

/// Visible frame without the invisible resize border, in physical pixels on a
/// per-monitor-aware thread.
unsafe fn frame_bounds(hwnd: HWND) -> Option<RECT> {
    let mut rect = RECT::default();
    // SAFETY: `rect` is a valid, writable RECT of the size passed.
    unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            (&raw mut rect).cast::<c_void>(),
            size_of::<RECT>() as u32,
        )
    }
    .ok()?;
    Some(rect)
}

unsafe fn class_name(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    // SAFETY: `buf` is a valid, writable buffer; the call writes at most its length.
    let len = unsafe { GetClassNameW(hwnd, &mut buf) };
    String::from_utf16_lossy(&buf[..usize::try_from(len).unwrap_or(0)])
}

unsafe fn window_text(hwnd: HWND) -> String {
    let mut buf = [0u16; 512];
    // SAFETY: `buf` is a valid, writable buffer; the call writes at most its length.
    let len = unsafe { GetWindowTextW(hwnd, &mut buf) };
    String::from_utf16_lossy(&buf[..usize::try_from(len).unwrap_or(0)])
}

fn snapshot_window(target: &TargetWindow, max_elements: usize) -> Result<ScreenSnapshot, PlatformError> {
    // SAFETY: COM is initialised on this worker thread (see `on_worker`).
    let uia: IUIAutomation = unsafe { CoCreateInstance(&CUIAutomation8, None, CLSCTX_INPROC_SERVER) }
        .map_err(|e| PlatformError::Unavailable(format!("UI Automation is unavailable: {e}")))?;
    if let Ok(uia2) = uia.cast::<IUIAutomation2>() {
        // SAFETY: plain setters on a valid automation object.
        unsafe {
            let _ = uia2.SetConnectionTimeout(UIA_TIMEOUT_MS);
            let _ = uia2.SetTransactionTimeout(UIA_TIMEOUT_MS);
        }
    }
    // SAFETY: the window title read and all UIA calls below operate on valid COM
    // objects created on this thread; failures surface as `Err` or end the walk.
    let (window_title, root, cache, all_children) = unsafe {
        let title = window_text(target.hwnd);
        if wake_chromium_accessibility(target.hwnd) && first_read(target.pid) {
            // The web tree requested above is built asynchronously.
            std::thread::sleep(WEB_TREE_DELAY);
        }
        let cache = uia.CreateCacheRequest().map_err(uia_error)?;
        for property in CACHED_PROPERTIES {
            cache.AddProperty(property).map_err(uia_error)?;
        }
        let all_children = uia.RawViewCondition().map_err(uia_error)?;
        let root = uia.ElementFromHandleBuildCache(target.hwnd, &cache).map_err(uia_error)?;
        (title, root, cache, all_children)
    };
    // The walk budget starts after the web-tree wait, as in `macos.rs`.
    let started = Instant::now();
    let window = rect_from(target.bounds);
    let own_pid = std::process::id();
    let mut candidates = Vec::new();
    if let Some(element) = describe(&root, window, own_pid) {
        candidates.push(element);
    }
    // Breadth-first within the same budget as `macos.rs`, returning what was read
    // in time. One round trip per expanded element fetches all of its children
    // with their properties. The raw view is walked because Chromium marks plain
    // containers as non-control elements; only control elements are described.
    // Offscreen content (a long web page is tens of thousands of nodes, almost all
    // below the viewport) is not expanded, which keeps the walk within budget.
    let mut visited = 1usize;
    let mut queue: VecDeque<(IUIAutomationElement, usize)> = VecDeque::from([(root, 0)]);
    while let Some((node, depth)) = queue.pop_front() {
        if visited >= MAX_NODES || started.elapsed() >= WALK_BUDGET {
            break;
        }
        if depth >= MAX_DEPTH || !expandable(&node) {
            continue;
        }
        // SAFETY: `node` is a live element (full-mode cache request) on this thread.
        let Ok(children) = (unsafe { node.FindAllBuildCache(TreeScope_Children, &all_children, &cache) }) else {
            continue;
        };
        // SAFETY: reading a valid element array within its reported length.
        let count = unsafe { children.Length() }.unwrap_or(0);
        for index in 0..count {
            // SAFETY: `index` is within the array's reported length.
            let Ok(child) = (unsafe { children.GetElement(index) }) else { continue };
            visited += 1;
            // SAFETY: cached-property read on a valid element.
            if unsafe { cached_bool(&child, UIA_IsControlElementPropertyId) }
                && let Some(element) = describe(&child, window, own_pid)
            {
                candidates.push(element);
            }
            if worth_expanding(&child) {
                queue.push_back((child, depth + 1));
            }
        }
    }
    super::drop_control_captions(&mut candidates);
    let elements = rank_and_assign(candidates, max_elements);
    tracing::debug!(
        pid = target.pid,
        visited,
        kept = elements.len(),
        elapsed_ms = started.elapsed().as_millis(),
        "ui automation snapshot"
    );
    Ok(ScreenSnapshot {
        app_name: app_name(target.pid).unwrap_or_else(|| window_title.clone()),
        window_title: Some(window_title).filter(|t| !t.trim().is_empty()),
        elements,
    })
}

/// Properties fetched with every element (one round trip per expanded parent).
const CACHED_PROPERTIES: [::windows::Win32::UI::Accessibility::UIA_PROPERTY_ID; 19] = [
    UIA_ControlTypePropertyId,
    UIA_IsControlElementPropertyId,
    UIA_NamePropertyId,
    UIA_HelpTextPropertyId,
    UIA_BoundingRectanglePropertyId,
    UIA_IsOffscreenPropertyId,
    UIA_IsPasswordPropertyId,
    UIA_ProcessIdPropertyId,
    UIA_ValueValuePropertyId,
    UIA_ValueIsReadOnlyPropertyId,
    UIA_IsValuePatternAvailablePropertyId,
    UIA_IsTogglePatternAvailablePropertyId,
    UIA_ToggleToggleStatePropertyId,
    UIA_IsSelectionItemPatternAvailablePropertyId,
    UIA_SelectionItemIsSelectedPropertyId,
    UIA_IsRangeValuePatternAvailablePropertyId,
    UIA_RangeValueValuePropertyId,
    UIA_IsGridItemPatternAvailablePropertyId,
    UIA_IsTableItemPatternAvailablePropertyId,
];

/// Whether a child's subtree can hold visible elements: skip offscreen content
/// with a real rect (scrolled out of view), but keep zero-size layout wrappers,
/// whose own offscreen flag says nothing about where their children are.
fn worth_expanding(node: &IUIAutomationElement) -> bool {
    // SAFETY: cached-property reads on a valid element.
    unsafe {
        if !node.CachedIsOffscreen().is_ok_and(BOOL::as_bool) {
            return true;
        }
        node.CachedBoundingRectangle()
            .map_or(true, |r| r.right <= r.left || r.bottom <= r.top)
    }
}

/// Whether the walk looks inside `node`. Leaf controls only hold their own text or
/// icon (a button's label, a link's text), which would repeat the parent's label.
fn expandable(node: &IUIAutomationElement) -> bool {
    // SAFETY: cached-property read on a valid element.
    let Ok(control_type) = (unsafe { node.CachedControlType() }) else { return true };
    ![
        UIA_TextControlTypeId,
        UIA_ImageControlTypeId,
        UIA_HyperlinkControlTypeId,
        UIA_ButtonControlTypeId,
        UIA_CheckBoxControlTypeId,
        UIA_RadioButtonControlTypeId,
        UIA_EditControlTypeId,
        UIA_ProgressBarControlTypeId,
        UIA_SliderControlTypeId,
        UIA_ScrollBarControlTypeId,
        UIA_ThumbControlTypeId,
        UIA_SeparatorControlTypeId,
        // Its Value is the selection; inside are only its edit box, the drop-down
        // button (named "Open" on every combo box) and the closed, offscreen list.
        UIA_ComboBoxControlTypeId,
    ]
    .contains(&control_type)
}

/// Chromium and Electron apps (Chrome, Edge, Teams, Discord, VS Code, ...) only build
/// their web-content accessibility tree once an assistive client asks for it; this is
/// the Windows counterpart of `AXManualAccessibility` in `macos.rs`. An MSAA
/// `WM_GETOBJECT` to each render-widget window is how screen readers ask; other apps
/// have no such window. Returns whether `hwnd` hosts web content; its tree is built
/// asynchronously.
///
/// # Safety
/// `hwnd` must be a top-level window handle from the system (it may be stale).
unsafe fn wake_chromium_accessibility(hwnd: HWND) -> bool {
    unsafe extern "system" fn visit(child: HWND, found: LPARAM) -> BOOL {
        // SAFETY: `child` comes from EnumChildWindows; a hung app makes the send time
        // out, and the returned object (if any) is released through ObjectFromLresult.
        unsafe {
            if class_name(child) == "Chrome_RenderWidgetHostHWND" {
                *(found.0 as *mut bool) = true;
                let mut result = 0usize;
                let sent = SendMessageTimeoutW(
                    child,
                    WM_GETOBJECT,
                    WPARAM(0),
                    LPARAM(OBJID_CLIENT.0 as isize),
                    SMTO_ABORTIFHUNG,
                    200,
                    Some(&raw mut result),
                );
                if sent.0 != 0 && result != 0 {
                    let mut object: *mut c_void = std::ptr::null_mut();
                    if ObjectFromLresult(LRESULT(result as isize), &IAccessible::IID, WPARAM(0), &raw mut object).is_ok()
                        && !object.is_null()
                    {
                        drop(IAccessible::from_raw(object));
                    }
                }
            }
        }
        BOOL::from(true)
    }
    let mut found = false;
    // SAFETY: `visit` only reads the child handles it is given and writes `found`,
    // which outlives the synchronous enumeration.
    unsafe {
        let _ = EnumChildWindows(Some(hwnd), Some(visit), LPARAM((&raw mut found) as isize));
    }
    found
}

/// `true` the first time `pid` is read in this process.
fn first_read(pid: u32) -> bool {
    static SEEN: std::sync::LazyLock<std::sync::Mutex<std::collections::HashSet<u32>>> =
        std::sync::LazyLock::new(Default::default);
    SEEN.lock().map(|mut seen| seen.insert(pid)).unwrap_or(false)
}

fn uia_error(error: ::windows::core::Error) -> PlatformError {
    // UIA_E_ELEMENTNOTAVAILABLE / UIA_E_TIMEOUT: the window closed or the app hung.
    const UIA_E_ELEMENTNOTAVAILABLE: i32 = 0x8004_0201_u32 as i32;
    const UIA_E_TIMEOUT: i32 = 0x8013_1505_u32 as i32;
    match error.code().0 {
        UIA_E_ELEMENTNOTAVAILABLE | UIA_E_TIMEOUT => PlatformError::Os("the app did not respond".into()),
        // E_ACCESSDENIED: an elevated (administrator) window; UIPI blocks reading it.
        code if code == 0x8007_0005_u32 as i32 => {
            PlatformError::Os("can't read apps running as administrator".into())
        }
        _ => PlatformError::Os(format!("UI Automation failed: {error}")),
    }
}

/// Builds an element for `node` if it is worth showing to the model (same rules as
/// `describe` in `macos.rs`).
fn describe(node: &IUIAutomationElement, window: Rect, own_pid: u32) -> Option<ScreenElement> {
    // SAFETY: cached-property reads on a valid, cache-only element.
    unsafe {
        if node.CachedIsOffscreen().is_ok_and(BOOL::as_bool) {
            return None;
        }
        if node.CachedProcessId().ok().and_then(|p| u32::try_from(p).ok()) == Some(own_pid) {
            return None;
        }
        let control_type = node.CachedControlType().ok()?;
        if skipped(control_type) {
            return None;
        }
        let editable = cached_bool(node, UIA_IsValuePatternAvailablePropertyId)
            && !cached_bool(node, UIA_ValueIsReadOnlyPropertyId);
        let grid_item = cached_bool(node, UIA_IsGridItemPatternAvailablePropertyId)
            || cached_bool(node, UIA_IsTableItemPatternAvailablePropertyId);
        let role = map_role(control_type, editable, grid_item);
        let frame = rect_from(node.CachedBoundingRectangle().ok()?);
        if !(frame.width > 0.0 && frame.height > 0.0) {
            return None;
        }
        let outside = frame.x + frame.width <= window.x
            || frame.y + frame.height <= window.y
            || frame.x >= window.x + window.width
            || frame.y >= window.y + window.height;
        if outside {
            return None;
        }
        let password = node.CachedIsPassword().is_ok_and(BOOL::as_bool);
        // A link's or a web page's Value is its URL, not state the user sees.
        let url_valued = role == "link" || (control_type == UIA_DocumentControlTypeId && !editable);
        let raw_value = if password || url_valued {
            None
        } else {
            cached_string(node, UIA_ValueValuePropertyId)
                .filter(|v| !v.trim().is_empty())
                .or_else(|| state_value(node, role))
        };
        // The selected tab is already open: clicking it does nothing, and its name
        // repeats the window title (same rule as `macos.rs`).
        if role == "tab" && raw_value.as_deref() == Some("1") {
            return None;
        }
        let label = [node.CachedName().ok(), node.CachedHelpText().ok()]
            .into_iter()
            .flatten()
            .map(|s| s.to_string())
            .find(|s| !s.trim().is_empty())
            .or_else(|| (role == "text").then(|| raw_value.clone()).flatten())
            .map(|s| clip(super::without_hover_details(&s)))
            .unwrap_or_default();
        let value = if role == "text" { None } else { raw_value.map(|v| clip(&v)) };
        if label.is_empty() && value.is_none() && !actionable(role) {
            return None;
        }
        // Unnamed, unrecognised elements can't be asked about or described; they
        // only lengthen the prompt. Empty table cells and rows are wrappers whose
        // field or text is listed on its own; in a dense grid they alone fill the
        // element cap (same rule as `macos.rs`).
        if label.is_empty() && (role == "other" || (value.is_none() && matches!(role, "cell" | "row"))) {
            return None;
        }
        Some(ScreenElement {
            id: String::new(),
            role: role.to_owned(),
            label,
            value,
            bounds: frame,
        })
    }
}

/// Checkbox/switch, radio/tab and slider state for controls without a Value
/// pattern, encoded like macOS `AXValue`: toggles 0/1/2, selection 1/0, ranges as
/// numbers (integers without a fraction).
///
/// # Safety
/// `node` must carry the [`CACHED_PROPERTIES`].
unsafe fn state_value(node: &IUIAutomationElement, role: &str) -> Option<String> {
    // SAFETY: cached-property reads on a valid element. Each pattern's property is
    // read only when the pattern is available: otherwise UIA returns its
    // "not supported" sentinel, which would convert to a bogus number.
    unsafe {
        if cached_bool(node, UIA_IsTogglePatternAvailablePropertyId)
            && let Some(state) = cached_variant(node, UIA_ToggleToggleStatePropertyId).and_then(|v| i32::try_from(&v).ok())
        {
            return Some(state.to_string());
        }
        if matches!(role, "radio" | "tab")
            && cached_bool(node, UIA_IsSelectionItemPatternAvailablePropertyId)
            && let Some(selected) = cached_variant(node, UIA_SelectionItemIsSelectedPropertyId).and_then(|v| bool::try_from(&v).ok())
        {
            return Some(if selected { "1" } else { "0" }.to_owned());
        }
        if role == "slider" && cached_bool(node, UIA_IsRangeValuePatternAvailablePropertyId) {
            let value = cached_variant(node, UIA_RangeValueValuePropertyId).and_then(|v| f64::try_from(&v).ok())?;
            return Some(format_number(value));
        }
    }
    None
}

/// `3.0` → "3", `0.5` → "0.5".
fn format_number(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e15 {
        format!("{}", value as i64)
    } else {
        value.to_string()
    }
}

unsafe fn cached_variant(node: &IUIAutomationElement, property: ::windows::Win32::UI::Accessibility::UIA_PROPERTY_ID) -> Option<VARIANT> {
    // SAFETY: cached-property read on a valid element.
    unsafe { node.GetCachedPropertyValue(property) }.ok()
}

unsafe fn cached_bool(node: &IUIAutomationElement, property: ::windows::Win32::UI::Accessibility::UIA_PROPERTY_ID) -> bool {
    // SAFETY: forwarded to `cached_variant`.
    unsafe { cached_variant(node, property) }
        .and_then(|v| bool::try_from(&v).ok())
        .unwrap_or(false)
}

unsafe fn cached_string(node: &IUIAutomationElement, property: ::windows::Win32::UI::Accessibility::UIA_PROPERTY_ID) -> Option<String> {
    // SAFETY: forwarded to `cached_variant`.
    let value = unsafe { cached_variant(node, property) }?;
    BSTR::try_from(&value).ok().map(|s| s.to_string())
}

fn rect_from(r: RECT) -> Rect {
    Rect {
        x: f64::from(r.left),
        y: f64::from(r.top),
        width: f64::from(r.right - r.left),
        height: f64::from(r.bottom - r.top),
    }
}

/// Layout-only containers, like the AX roles `macos.rs` skips.
fn skipped(control_type: UIA_CONTROLTYPE_ID) -> bool {
    [
        UIA_GroupControlTypeId,
        UIA_PaneControlTypeId,
        UIA_ScrollBarControlTypeId,
        UIA_ThumbControlTypeId,
        UIA_SeparatorControlTypeId,
        UIA_TitleBarControlTypeId,
    ]
    .contains(&control_type)
}

/// UIA control type → shared role. `editable` is "Value pattern available and not
/// read-only": an editable Document (Notepad, Word) is a text area, while a
/// read-only one (a browser page, the macOS `AXWebArea`) is not. `grid_item` is
/// "GridItem or TableItem pattern available": UIA has no cell type, so Excel and
/// web grid cells (DataItem) and WPF grid cells (Custom) are cells only by that
/// pattern, like `AXCell` on macOS.
fn map_role(control_type: UIA_CONTROLTYPE_ID, editable: bool, grid_item: bool) -> &'static str {
    match control_type {
        t if t == UIA_ButtonControlTypeId || t == UIA_SplitButtonControlTypeId => "button",
        t if t == UIA_CheckBoxControlTypeId => "checkbox",
        t if t == UIA_RadioButtonControlTypeId => "radio",
        t if t == UIA_EditControlTypeId => "textField",
        t if t == UIA_DocumentControlTypeId => {
            if editable {
                "textArea"
            } else {
                "other"
            }
        }
        t if t == UIA_ComboBoxControlTypeId => "comboBox",
        t if t == UIA_ListControlTypeId || t == UIA_TreeControlTypeId => "list",
        t if t == UIA_ListItemControlTypeId || t == UIA_TreeItemControlTypeId => "listItem",
        t if t == UIA_DataItemControlTypeId => {
            if grid_item {
                "cell"
            } else {
                "row"
            }
        }
        t if t == UIA_CustomControlTypeId && grid_item => "cell",
        // Native column headers sort when clicked (macOS: header AXButton).
        t if t == UIA_HeaderItemControlTypeId => "button",
        t if t == UIA_DataGridControlTypeId || t == UIA_TableControlTypeId => "table",
        t if t == UIA_MenuControlTypeId => "menu",
        t if t == UIA_MenuItemControlTypeId => "menuItem",
        t if t == UIA_MenuBarControlTypeId => "menuBar",
        t if t == UIA_TabItemControlTypeId => "tab",
        t if t == UIA_HyperlinkControlTypeId => "link",
        t if t == UIA_ImageControlTypeId => "image",
        t if t == UIA_TextControlTypeId => "text",
        t if t == UIA_SliderControlTypeId || t == UIA_SpinnerControlTypeId => "slider",
        t if t == UIA_ToolBarControlTypeId || t == UIA_AppBarControlTypeId => "toolbar",
        t if t == UIA_WindowControlTypeId => "window",
        _ => "other",
    }
}

/// Same set as `macos.rs`; ranking keeps these first when over budget.
fn actionable(role: &str) -> bool {
    matches!(
        role,
        "button"
            | "checkbox"
            | "radio"
            | "textField"
            | "textArea"
            | "comboBox"
            | "menuItem"
            | "tab"
            | "link"
            | "cell"
            | "slider"
    )
}

/// Trims, collapses whitespace and caps at [`MAX_TEXT`] characters.
fn clip(text: &str) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    match collapsed.char_indices().nth(MAX_TEXT) {
        Some((cut, _)) => format!("{}…", &collapsed[..cut]),
        None => collapsed,
    }
}

/// Drops exact duplicates (tables list each cell under both a row and a column),
/// keeps actionable elements first when over budget, then orders the kept set
/// top-to-bottom, left-to-right and assigns ids `e1..` (identical to `macos.rs`).
fn rank_and_assign(mut elements: Vec<ScreenElement>, max_elements: usize) -> Vec<ScreenElement> {
    let mut seen = std::collections::HashSet::new();
    elements.retain(|e| {
        let b = &e.bounds;
        seen.insert((
            e.role.clone(),
            e.label.clone(),
            e.value.clone(),
            [b.x, b.y, b.width, b.height].map(f64::to_bits),
        ))
    });
    elements.sort_by_key(|e| !actionable(&e.role));
    elements.truncate(max_elements);
    elements.sort_by(|a, b| {
        a.bounds
            .y
            .total_cmp(&b.bounds.y)
            .then_with(|| a.bounds.x.total_cmp(&b.bounds.x))
    });
    for (index, element) in elements.iter_mut().enumerate() {
        element.id = format!("e{}", index + 1);
    }
    elements
}

/// The app's display name ("Google Chrome", "Microsoft Excel"): the executable's
/// version-info FileDescription, else its file stem. UWP frames report no
/// useful exe, so callers fall back to the window title.
fn app_name(pid: u32) -> Option<String> {
    let path = process_path(pid)?;
    let stem = std::path::Path::new(&path).file_stem()?.to_string_lossy().into_owned();
    if stem.eq_ignore_ascii_case("ApplicationFrameHost") {
        return None;
    }
    Some(file_description(&path).unwrap_or(stem))
}

fn process_path(pid: u32) -> Option<String> {
    // SAFETY: the handle is closed below; the buffer outlives the call.
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &raw mut len);
        let _ = CloseHandle(process);
        ok.ok()?;
        Some(String::from_utf16_lossy(&buf[..len as usize]))
    }
}

fn file_description(path: &str) -> Option<String> {
    let path = HSTRING::from(path);
    // SAFETY: `data` is sized by GetFileVersionInfoSizeW; VerQueryValueW returns
    // pointers into `data`, which outlives every read below.
    unsafe {
        let size = GetFileVersionInfoSizeW(&path, None);
        if size == 0 {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        GetFileVersionInfoW(&path, None, size, data.as_mut_ptr().cast()).ok()?;
        let mut ptr: *mut c_void = std::ptr::null_mut();
        let mut len = 0u32;
        if !VerQueryValueW(data.as_ptr().cast(), w!("\\VarFileInfo\\Translation"), &raw mut ptr, &raw mut len)
            .as_bool()
            || len < 4
            || ptr.is_null()
        {
            return None;
        }
        let lang = *ptr.cast::<u16>();
        let codepage = *ptr.cast::<u16>().add(1);
        let key = HSTRING::from(format!("\\StringFileInfo\\{lang:04x}{codepage:04x}\\FileDescription"));
        if !VerQueryValueW(data.as_ptr().cast(), &key, &raw mut ptr, &raw mut len).as_bool() || len == 0 || ptr.is_null() {
            return None;
        }
        let text = std::slice::from_raw_parts(ptr.cast::<u16>(), len as usize);
        let text = String::from_utf16_lossy(text).trim_end_matches('\0').trim().to_owned();
        (!text.is_empty()).then_some(text)
    }
}

/// Captures the target window alone, so GetCko's own windows above it (main window,
/// overlay) never reach the model, like `macos.rs` capturing the target window and
/// those below it. Windows.Graphics.Capture draws just that window's content, without
/// hiding GetCko from screen sharing (BR-3). Cropped to the part on its monitor. Falls
/// back to the monitor image when the window cannot be captured on its own.
fn capture_window(target: &TargetWindow) -> Result<ScreenCapture, PlatformError> {
    if !GraphicsCaptureSession::IsSupported().unwrap_or(false) {
        return Err(PlatformError::Unavailable("screen capture is not supported on this Windows version".into()));
    }
    let (_, monitor_rect, scale) = monitor_of(target.bounds)?;
    let mut outer = RECT::default();
    // SAFETY: plain query on a window handle from the system; `outer` is writable.
    let outer = unsafe { GetWindowRect(target.hwnd, &raw mut outer) }.ok().map(|()| outer);
    let frame = match grab(Source::Window(target.hwnd)) {
        Ok(frame) => frame,
        Err(error) => {
            tracing::debug!(%error, "window capture failed; capturing the monitor");
            return capture_monitor(target.bounds);
        }
    };
    let origin = window_capture_origin(target.bounds, outer, frame.width, frame.height);
    tracing::debug!(
        image = ?(frame.width, frame.height),
        frame = ?(target.bounds.left, target.bounds.top, target.bounds.right, target.bounds.bottom),
        outer = ?outer.map(|r| (r.left, r.top, r.right, r.bottom)),
        ?origin,
        "window capture"
    );
    // The visible frame on its monitor, in the captured image's pixels.
    let visible = intersect(target.bounds, monitor_rect).unwrap_or(target.bounds);
    let image = RECT {
        left: origin.0,
        top: origin.1,
        right: origin.0 + i32::try_from(frame.width).unwrap_or(i32::MAX),
        bottom: origin.1 + i32::try_from(frame.height).unwrap_or(i32::MAX),
    };
    let Some(area) = intersect(visible, image) else {
        return capture_monitor(target.bounds);
    };
    let left = (area.left - image.left) as usize;
    let top = (area.top - image.top) as usize;
    let (width, height) = ((area.right - area.left) as usize, (area.bottom - area.top) as usize);
    let rgba = to_rgba(&frame, left, top, width, height)?;
    let to_u32 = |v: i32| u32::try_from(v).map_err(|e| PlatformError::Os(e.to_string()));
    Ok(ScreenCapture {
        width: to_u32(area.right - area.left)?,
        height: to_u32(area.bottom - area.top)?,
        rgba,
        x: area.left,
        y: area.top,
        monitor: MonitorFrame {
            x: monitor_rect.left,
            y: monitor_rect.top,
            width: to_u32(monitor_rect.right - monitor_rect.left)?,
            height: to_u32(monitor_rect.bottom - monitor_rect.top)?,
            scale_factor: scale,
        },
    })
}

/// The whole primary monitor (the one at the desktop origin).
fn capture_primary_monitor() -> Result<ScreenCapture, PlatformError> {
    if !GraphicsCaptureSession::IsSupported().unwrap_or(false) {
        return Err(PlatformError::Unavailable("screen capture is not supported on this Windows version".into()));
    }
    let (_, primary, _) = monitor_of(RECT { left: 0, top: 0, right: 1, bottom: 1 })?;
    capture_monitor(primary)
}

/// Desktop position of a window capture's top-left pixel. Windows.Graphics.Capture
/// returns the visible frame (`frame`, DWM extended frame bounds) on current Windows
/// and the whole window rectangle (`outer`, invisible resize borders included) on some
/// older builds; whichever matches the image size wins, else the image is centred on
/// the visible frame.
fn window_capture_origin(frame: RECT, outer: Option<RECT>, width: usize, height: usize) -> (i32, i32) {
    let size = |r: RECT| ((r.right - r.left).max(0) as usize, (r.bottom - r.top).max(0) as usize);
    if size(frame) == (width, height) {
        return (frame.left, frame.top);
    }
    if let Some(outer) = outer
        && size(outer) == (width, height)
    {
        return (outer.left, outer.top);
    }
    let (w, h) = size(frame);
    let dx = (i64::try_from(width).unwrap_or(0) - i64::try_from(w).unwrap_or(0)) / 2;
    let dy = (i64::try_from(height).unwrap_or(0) - i64::try_from(h).unwrap_or(0)) / 2;
    (frame.left - dx as i32, frame.top - dy as i32)
}

/// The overlap of two rectangles, if any.
fn intersect(a: RECT, b: RECT) -> Option<RECT> {
    let r = RECT {
        left: a.left.max(b.left),
        top: a.top.max(b.top),
        right: a.right.min(b.right),
        bottom: a.bottom.min(b.bottom),
    };
    (r.right > r.left && r.bottom > r.top).then_some(r)
}

/// The monitor holding the centre of `window` (else the nearest one), its desktop
/// rectangle and its scale factor.
fn monitor_of(window: RECT) -> Result<(::windows::Win32::Graphics::Gdi::HMONITOR, RECT, f64), PlatformError> {
    let center = POINT {
        x: window.left + (window.right - window.left) / 2,
        y: window.top + (window.bottom - window.top) / 2,
    };
    // SAFETY: plain monitor queries; `info` is a valid MONITORINFO with cbSize set.
    unsafe {
        let monitor = MonitorFromPoint(center, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
        if !GetMonitorInfoW(monitor, &raw mut info).as_bool() {
            return Err(PlatformError::Os("could not read the monitor layout".into()));
        }
        let (mut dpi_x, mut dpi_y) = (96u32, 96u32);
        let _ = GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &raw mut dpi_x, &raw mut dpi_y);
        Ok((monitor, info.rcMonitor, f64::from(dpi_x) / 96.0))
    }
}

/// `width`×`height` pixels of `frame` from (`left`, `top`), as opaque RGBA.
fn to_rgba(frame: &Frame, left: usize, top: usize, width: usize, height: usize) -> Result<Vec<u8>, PlatformError> {
    let mut rgba = Vec::with_capacity(width * height * 4);
    for row in frame.bgra.chunks(frame.stride).skip(top).take(height) {
        for pixel in row.as_chunks::<4>().0.iter().skip(left).take(width) {
            rgba.extend_from_slice(&[pixel[2], pixel[1], pixel[0], 255]);
        }
    }
    if rgba.len() == width * height * 4 {
        Ok(rgba)
    } else {
        Err(PlatformError::Os("capture smaller than reported".into()))
    }
}

/// Captures the monitor holding the centre of `window` (else the nearest one),
/// cropped to `window`, as `macos.rs` `capture_display` does without a window id.
fn capture_monitor(window: RECT) -> Result<ScreenCapture, PlatformError> {
    let (monitor, monitor_rect, scale) = monitor_of(window)?;
    let frame = grab(Source::Monitor(monitor)).map_err(|e| PlatformError::Os(format!("screen capture failed: {e}")))?;
    let monitor_width = (monitor_rect.right - monitor_rect.left).max(0) as usize;
    let monitor_height = (monitor_rect.bottom - monitor_rect.top).max(0) as usize;
    if frame.width != monitor_width || frame.height != monitor_height {
        return Err(PlatformError::Os(format!(
            "capture size {}x{} does not match the monitor {monitor_width}x{monitor_height}",
            frame.width, frame.height
        )));
    }
    let (left, top, right, bottom) = crop(window, monitor_rect);
    let (crop_width, crop_height) = (right - left, bottom - top);
    let rgba = to_rgba(&frame, left, top, crop_width, crop_height)?;
    let to_u32 = |v: usize| u32::try_from(v).map_err(|e| PlatformError::Os(e.to_string()));
    let to_i32 = |v: usize| i32::try_from(v).map_err(|e| PlatformError::Os(e.to_string()));
    Ok(ScreenCapture {
        width: to_u32(crop_width)?,
        height: to_u32(crop_height)?,
        rgba,
        x: monitor_rect.left + to_i32(left)?,
        y: monitor_rect.top + to_i32(top)?,
        monitor: MonitorFrame {
            x: monitor_rect.left,
            y: monitor_rect.top,
            width: to_u32(monitor_width)?,
            height: to_u32(monitor_height)?,
            scale_factor: scale,
        },
    })
}

/// `window` clipped to `monitor`, as pixel offsets (left, top, right, bottom)
/// inside the monitor image; the whole monitor when they do not overlap.
fn crop(window: RECT, monitor: RECT) -> (usize, usize, usize, usize) {
    let width = (monitor.right - monitor.left).max(0);
    let height = (monitor.bottom - monitor.top).max(0);
    let clamp = |v: i32, limit: i32| v.clamp(0, limit) as usize;
    let left = clamp(window.left - monitor.left, width);
    let top = clamp(window.top - monitor.top, height);
    let right = clamp(window.right - monitor.left, width);
    let bottom = clamp(window.bottom - monitor.top, height);
    if right > left && bottom > top {
        (left, top, right, bottom)
    } else {
        (0, 0, width as usize, height as usize)
    }
}

/// One captured monitor frame, BGRA with row padding.
struct Frame {
    width: usize,
    height: usize,
    stride: usize,
    bgra: Vec<u8>,
}

/// What Windows.Graphics.Capture draws.
#[derive(Clone, Copy)]
enum Source {
    Monitor(::windows::Win32::Graphics::Gdi::HMONITOR),
    /// That window's content only, even where other windows cover it.
    Window(HWND),
}

/// Grabs one frame of `source` with Windows.Graphics.Capture (cursor and the
/// yellow capture border off where the OS allows it).
fn grab(source: Source) -> ::windows::core::Result<Frame> {
    // SAFETY: D3D11/WinRT interop on objects created and used on this thread; the
    // mapped staging texture is read within its row pitch and unmapped before return.
    unsafe {
        let mut device: Option<ID3D11Device> = None;
        let mut context: Option<ID3D11DeviceContext> = None;
        D3D11CreateDevice(
            None,
            D3D_DRIVER_TYPE_HARDWARE,
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            None,
            D3D11_SDK_VERSION,
            Some(&raw mut device),
            None,
            Some(&raw mut context),
        )?;
        let device = device.ok_or_else(::windows::core::Error::empty)?;
        let context = context.ok_or_else(::windows::core::Error::empty)?;
        let dxgi: IDXGIDevice = device.cast()?;
        let d3d: IDirect3DDevice = CreateDirect3D11DeviceFromDXGIDevice(&dxgi)?.cast()?;
        let interop = ::windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
        let item: GraphicsCaptureItem = match source {
            Source::Monitor(monitor) => interop.CreateForMonitor(monitor)?,
            Source::Window(hwnd) => interop.CreateForWindow(hwnd)?,
        };
        let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
            &d3d,
            DirectXPixelFormat::B8G8R8A8UIntNormalized,
            1,
            item.Size()?,
        )?;
        let session = pool.CreateCaptureSession(&item)?;
        let _ = session.SetIsCursorCaptureEnabled(false);
        let _ = session.SetIsBorderRequired(false);
        session.StartCapture()?;
        let started = Instant::now();
        let frame = loop {
            if let Ok(frame) = pool.TryGetNextFrame() {
                break frame;
            }
            if started.elapsed() > FIRST_FRAME_TIMEOUT {
                let _ = session.Close();
                let _ = pool.Close();
                return Err(::windows::core::Error::new(
                    ::windows::Win32::Foundation::E_FAIL,
                    "no frame arrived",
                ));
            }
            std::thread::sleep(Duration::from_millis(5));
        };
        let access: IDirect3DDxgiInterfaceAccess = frame.Surface()?.cast()?;
        let texture: ID3D11Texture2D = access.GetInterface()?;
        let mut desc = D3D11_TEXTURE2D_DESC::default();
        texture.GetDesc(&raw mut desc);
        let staging_desc = D3D11_TEXTURE2D_DESC {
            Usage: D3D11_USAGE_STAGING,
            BindFlags: D3D11_BIND_FLAG(0).0 as u32,
            CPUAccessFlags: D3D11_CPU_ACCESS_READ.0 as u32,
            MiscFlags: D3D11_RESOURCE_MISC_FLAG(0).0 as u32,
            ..desc
        };
        let mut staging: Option<ID3D11Texture2D> = None;
        device.CreateTexture2D(&raw const staging_desc, None, Some(&raw mut staging))?;
        let staging = staging.ok_or_else(::windows::core::Error::empty)?;
        context.CopyResource(&staging, &texture);
        let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
        context.Map(&staging, 0, D3D11_MAP_READ, 0, Some(&raw mut mapped))?;
        let (width, height, stride) = (desc.Width as usize, desc.Height as usize, mapped.RowPitch as usize);
        let bgra = std::slice::from_raw_parts(mapped.pData.cast::<u8>(), stride * height).to_vec();
        context.Unmap(&staging, 0);
        let _ = frame.Close();
        let _ = session.Close();
        let _ = pool.Close();
        Ok(Frame { width, height, stride, bgra })
    }
}

/// A capability's state in the Windows privacy consent store
/// (Settings → Privacy & security).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Consent {
    Allowed,
    Denied,
    Unset,
}

/// Reads `capability` (e.g. `microphone`) for desktop apps: the device-wide policy,
/// the user's main switch and "Let desktop apps access …". Any `Deny` wins.
fn consent(capability: &str) -> Consent {
    let base = format!(r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\{capability}");
    let values = [
        registry_string(HKEY_LOCAL_MACHINE, &base),
        registry_string(HKEY_CURRENT_USER, &base),
        registry_string(HKEY_CURRENT_USER, &format!(r"{base}\NonPackaged")),
    ];
    combine_consent(&values)
}

fn combine_consent(values: &[Option<String>]) -> Consent {
    if values.iter().flatten().any(|v| v.eq_ignore_ascii_case("Deny")) {
        Consent::Denied
    } else if values.iter().flatten().any(|v| v.eq_ignore_ascii_case("Allow")) {
        Consent::Allowed
    } else {
        Consent::Unset
    }
}

/// The `Value` string under `root\subkey`, if present.
fn registry_string(root: HKEY, subkey: &str) -> Option<String> {
    let subkey = HSTRING::from(subkey);
    let mut buf = [0u16; 64];
    let mut len = (buf.len() * 2) as u32;
    // SAFETY: `buf` is valid and writable for `len` bytes; the call writes a
    // NUL-terminated string of at most that size.
    let status = unsafe {
        RegGetValueW(
            root,
            &subkey,
            w!("Value"),
            RRF_RT_REG_SZ,
            None,
            Some(buf.as_mut_ptr().cast()),
            Some(&raw mut len),
        )
    };
    if status.is_err() {
        return None;
    }
    let chars = (len as usize / 2).min(buf.len());
    Some(String::from_utf16_lossy(&buf[..chars]).trim_end_matches('\0').to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_mapping_normalizes_known_control_types() {
        assert_eq!(map_role(UIA_ButtonControlTypeId, false, false), "button");
        assert_eq!(map_role(UIA_SplitButtonControlTypeId, false, false), "button");
        assert_eq!(map_role(UIA_EditControlTypeId, true, false), "textField");
        assert_eq!(map_role(UIA_DocumentControlTypeId, true, false), "textArea");
        // A browser page is a read-only document, not a text box (macOS AXWebArea).
        assert_eq!(map_role(UIA_DocumentControlTypeId, false, false), "other");
        // Grid cells are cells (Excel/web: DataItem, WPF: Custom); plain items are rows.
        assert_eq!(map_role(UIA_DataItemControlTypeId, false, true), "cell");
        assert_eq!(map_role(UIA_CustomControlTypeId, false, true), "cell");
        assert_eq!(map_role(UIA_DataItemControlTypeId, false, false), "row");
        assert_eq!(map_role(UIA_CustomControlTypeId, false, false), "other");
        assert_eq!(map_role(UIA_HeaderItemControlTypeId, false, false), "button");
        assert_eq!(map_role(UIA_CONTROLTYPE_ID(1), false, false), "other");
        let all = [
            UIA_ButtonControlTypeId, UIA_CheckBoxControlTypeId, UIA_RadioButtonControlTypeId,
            UIA_EditControlTypeId, UIA_ComboBoxControlTypeId, UIA_ListControlTypeId,
            UIA_ListItemControlTypeId, UIA_TreeItemControlTypeId, UIA_DataItemControlTypeId,
            UIA_HeaderItemControlTypeId, UIA_DataGridControlTypeId, UIA_MenuControlTypeId,
            UIA_MenuItemControlTypeId, UIA_MenuBarControlTypeId, UIA_TabItemControlTypeId,
            UIA_HyperlinkControlTypeId, UIA_ImageControlTypeId, UIA_TextControlTypeId,
            UIA_SliderControlTypeId, UIA_ToolBarControlTypeId, UIA_WindowControlTypeId,
        ];
        for control_type in all {
            for editable in [false, true] {
                for grid_item in [false, true] {
                    assert!(super::super::ROLES.contains(&map_role(control_type, editable, grid_item)));
                }
            }
        }
    }

    #[test]
    fn numbers_format_like_ax_values() {
        assert_eq!(format_number(3.0), "3");
        assert_eq!(format_number(-2.0), "-2");
        assert_eq!(format_number(0.5), "0.5");
    }

    #[test]
    fn layout_containers_are_skipped() {
        assert!(skipped(UIA_GroupControlTypeId));
        assert!(skipped(UIA_PaneControlTypeId));
        assert!(!skipped(UIA_ButtonControlTypeId));
    }

    #[test]
    fn ranking_prioritizes_actions_and_assigns_sorted_ids() {
        let make = |role: &str, x: f64, y: f64| ScreenElement {
            id: String::new(),
            role: role.to_owned(),
            label: "x".to_owned(),
            value: None,
            bounds: Rect { x, y, width: 2.0, height: 2.0 },
        };
        let result = rank_and_assign(
            vec![make("text", 0.0, 0.0), make("button", 2.0, 4.0), make("button", 0.0, 4.0)],
            2,
        );
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|e| e.role == "button"));
        // The same cell reached twice (via its row and its column) counts once.
        let cell = make("cell", 0.0, 0.0);
        let deduped = rank_and_assign(vec![cell.clone(), cell.clone(), make("cell", 1.0, 0.0)], 9);
        assert_eq!(deduped.len(), 2);
        assert_eq!((result[0].id.as_str(), result[0].bounds.x), ("e1", 0.0));
        assert_eq!(result[1].id, "e2");
    }

    #[test]
    fn clip_collapses_whitespace_and_caps_length() {
        assert_eq!(clip("  Save \n as  "), "Save as");
        let long = "x".repeat(MAX_TEXT + 5);
        assert_eq!(clip(&long).chars().count(), MAX_TEXT + 1);
    }

    #[test]
    fn window_capture_origin_matches_the_image_size() {
        let rect = |left, top, right, bottom| RECT { left, top, right, bottom };
        let frame = rect(100, 50, 900, 650);
        let outer = Some(rect(93, 50, 907, 657));
        assert_eq!(window_capture_origin(frame, outer, 800, 600), (100, 50));
        assert_eq!(window_capture_origin(frame, outer, 814, 607), (93, 50));
        assert_eq!(window_capture_origin(frame, None, 810, 610), (95, 45));
        assert_eq!(intersect(rect(0, 0, 10, 10), rect(5, 5, 20, 20)), Some(rect(5, 5, 10, 10)));
        assert_eq!(intersect(rect(0, 0, 10, 10), rect(10, 0, 20, 10)), None);
    }

    #[test]
    fn crop_clamps_window_to_monitor() {
        let rect = |left, top, right, bottom| RECT { left, top, right, bottom };
        let monitor = rect(-1920, 0, 0, 1080);
        assert_eq!(crop(rect(-1900, 10, -900, 510), monitor), (20, 10, 1020, 510));
        // Hanging off the left edge is clipped to the monitor.
        assert_eq!(crop(rect(-2000, 0, -1800, 100), monitor), (0, 0, 120, 100));
        // No overlap: whole monitor.
        assert_eq!(crop(rect(10, 10, 20, 20), monitor), (0, 0, 1920, 1080));
    }

    #[test]
    fn ocr_image_is_bgra_and_fits_the_size_limit() {
        let rgba: Vec<u8> = (0..4 * 3).flat_map(|i| [i as u8, 0, 200, 7]).collect();
        let image = OcrImage::from_rgba(4, 3, &rgba);
        assert_eq!(&image.bgra[..4], &[200, 0, 0, 255]);
        let (same, factor) = OcrImage::from_rgba(4, 3, &rgba).fit(4);
        assert_eq!((same.width, same.height, factor), (4, 3, 1));
        // 4x3 into a 2-pixel limit: factor 2, a 2x1 image of 2x2 block averages
        // (red of the first block: pixels 0, 1, 4 and 5).
        let (small, factor) = image.fit(2);
        assert_eq!((small.width, small.height, factor), (2, 1, 2));
        assert_eq!(small.bgra.len(), 2 * 4);
        assert_eq!(small.bgra[2], (1 + 4 + 5) / 4);
        assert_eq!(small.bgra[3], 255);
    }

    #[test]
    fn tilted_text_boxes_are_turned_back_onto_the_image() {
        // Measured: a line drawn from (200, 600) rising at 15 degrees on a 1600x1200
        // image came back with TextAngle -14.7 and its first word at (220, 465).
        let (left, top, ..) = unrotate((220.0, 465.0, 300.0, 498.0), -14.7, (1600.0, 1200.0));
        assert!((left - 205.0).abs() < 3.0 && (top - 597.0).abs() < 25.0, "{left}, {top}");
        let level = (1.0, 2.0, 3.0, 4.0);
        assert_eq!(unrotate(level, 0.0, (10.0, 10.0)), level);
        // Kept within the image.
        let (l, t, r, b) = unrotate((0.0, 0.0, 10.0, 10.0), 45.0, (10.0, 10.0));
        assert!(l >= 0.0 && t >= 0.0 && r <= 10.0 && b <= 10.0);
    }

    #[test]
    fn line_box_spans_its_words() {
        let words = [(10.0, 5.0, 20.0, 15.0), (25.0, 4.0, 40.0, 14.0)];
        assert_eq!(union(words.into_iter()), Some((10.0, 4.0, 40.0, 15.0)));
        assert_eq!(union(std::iter::empty()), None);
    }

    #[test]
    fn consent_deny_wins() {
        let v = |s: &str| Some(s.to_owned());
        assert_eq!(combine_consent(&[v("Allow"), v("Allow"), v("Deny")]), Consent::Denied);
        assert_eq!(combine_consent(&[None, v("Allow"), None]), Consent::Allowed);
        assert_eq!(combine_consent(&[None, None, None]), Consent::Unset);
    }

    #[test]
    fn accessibility_is_never_gated() {
        let platform = WindowsPlatform::new();
        assert_eq!(platform.permission(PermissionKind::Accessibility), PermissionStatus::NotRequired);
        assert_ne!(platform.permission(PermissionKind::ScreenRecording), PermissionStatus::Granted);
    }

    #[test]
    #[ignore = "needs an interactive desktop with an app window open"]
    fn platform_conformance_on_real_desktop() {
        let max = super::super::MAX_SNAPSHOT_ELEMENTS;
        let platform = WindowsPlatform::new();
        // Chromium/Electron build their web tree asynchronously after the first request.
        let started = Instant::now();
        let first = platform.snapshot(max).expect("first desktop snapshot");
        let first_ms = started.elapsed().as_millis();
        std::thread::sleep(Duration::from_millis(700));
        let started = Instant::now();
        let snapshot = platform.snapshot(max).expect("desktop snapshot");
        eprintln!(
            "{} / {:?}: first {} elements in {first_ms} ms, then {} elements in {} ms",
            snapshot.app_name,
            snapshot.window_title,
            first.elements.len(),
            snapshot.elements.len(),
            started.elapsed().as_millis()
        );
        for el in snapshot.elements.iter().take(15) {
            eprintln!("{} {} {:?} {:?} {:?}", el.id, el.role, el.label, el.value, el.bounds);
        }
        super::super::conformance(&snapshot, max).expect("conformance");
        assert!(!snapshot.app_name.is_empty());
    }

    #[test]
    #[ignore = "needs an interactive desktop"]
    fn capture_matches_contract_on_real_desktop() {
        let started = Instant::now();
        let capture = WindowsPlatform::new().capture().expect("capture");
        eprintln!(
            "{}x{} at ({}, {}) on monitor {:?} in {} ms",
            capture.width,
            capture.height,
            capture.x,
            capture.y,
            capture.monitor,
            started.elapsed().as_millis()
        );
        assert_eq!(capture.rgba.len(), capture.width as usize * capture.height as usize * 4);
        let m = &capture.monitor;
        assert!(capture.x >= m.x && capture.y >= m.y);
        assert!(i64::from(capture.x) + i64::from(capture.width) <= i64::from(m.x) + i64::from(m.width));
        assert!(i64::from(capture.y) + i64::from(capture.height) <= i64::from(m.y) + i64::from(m.height));
        assert!(capture.rgba.chunks(4).all(|p| p[3] == 255));
        // The capture is the target window's visible frame (on its monitor), not the
        // monitor: GetCko's own windows above it cannot be in it.
        let target = on_worker("test", WORKER_TIMEOUT, || topmost_window(std::process::id()).map(|t| t.bounds).ok_or(PlatformError::NoFocusedApp))
            .expect("target window");
        let visible = intersect(target, RECT {
            left: m.x,
            top: m.y,
            right: m.x + m.width as i32,
            bottom: m.y + m.height as i32,
        })
        .expect("window on its monitor");
        eprintln!("target frame {:?}", (visible.left, visible.top, visible.right, visible.bottom));
        assert_eq!((capture.x, capture.y), (visible.left, visible.top));
        assert_eq!((capture.width as i32, capture.height as i32), (visible.right - visible.left, visible.bottom - visible.top));
        // Not a black frame (a failed capture often is).
        assert!(capture.rgba.chunks(4).any(|p| p[0] > 16 || p[1] > 16 || p[2] > 16));
    }

    #[test]
    #[ignore = "needs an interactive desktop with text on screen"]
    fn text_recognition_reads_the_captured_window() {
        let platform = WindowsPlatform::new();
        let capture = platform.capture().expect("capture");
        for round in ["cold", "warm"] {
            let started = Instant::now();
            let boxes = platform.recognize_text(&capture).expect("text recognition");
            eprintln!("{round}: {} lines in {} ms", boxes.len(), started.elapsed().as_millis());
            assert!(!boxes.is_empty(), "no text read");
            let (left, top) = (f64::from(capture.x), f64::from(capture.y));
            let (right, bottom) = (left + f64::from(capture.width), top + f64::from(capture.height));
            for b in &boxes {
                let r = &b.bounds;
                assert!(!b.text.trim().is_empty());
                assert!(r.width > 0.0 && r.height > 0.0);
                assert!(r.x >= left - 1.0 && r.y >= top - 1.0, "{b:?} outside the capture");
                assert!(r.x + r.width <= right + 1.0 && r.y + r.height <= bottom + 1.0, "{b:?} outside the capture");
            }
            if round == "warm" {
                for b in boxes.iter().take(12) {
                    let r = &b.bounds;
                    eprintln!("  {:?} @{:.0},{:.0} {:.0}x{:.0}", b.text, r.x, r.y, r.width, r.height);
                }
            }
        }
    }
}
