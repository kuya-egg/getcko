//! macOS screen reading through the Accessibility (AX) API, plus OS permissions.
//!
//! Reads the topmost on-screen app that is not GetCko, walks its focused window's
//! AX tree within a fixed budget, and returns labelled/actionable elements with
//! bounds in desktop physical pixels (the space Tauri's `PhysicalPosition` uses).

use std::collections::VecDeque;
use std::ffi::c_void;
use std::time::{Duration, Instant};

use accessibility_sys::{
    AXIsProcessTrusted, AXIsProcessTrustedWithOptions, AXUIElementCopyAttributeValue,
    AXUIElementCreateApplication, AXUIElementGetTypeID, AXUIElementRef,
    AXUIElementSetAttributeValue, AXUIElementSetMessagingTimeout, AXValueGetType, AXValueGetTypeID,
    AXValueGetValue, AXValueRef, kAXErrorSuccess, kAXTrustedCheckOptionPrompt, kAXValueTypeCGPoint,
    kAXValueTypeCGSize,
};
use core_foundation::array::CFArray;
use core_foundation::base::{CFType, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::display::CGDisplay;
use core_graphics::geometry::{CGPoint, CGRect, CGSize};
use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowBounds, kCGWindowImageBestResolution,
    kCGWindowLayer, kCGWindowListExcludeDesktopElements, kCGWindowListOptionIncludingWindow,
    kCGWindowListOptionOnScreenBelowWindow, kCGWindowListOptionOnScreenOnly, kCGWindowNumber,
    kCGWindowOwnerName, kCGWindowOwnerPID,
};
use foreign_types::ForeignType;

use super::{Platform, PlatformError, ScreenCapture, TextBox};
use crate::model::{
    MonitorFrame, PermissionKind, PermissionStatus, Rect, ScreenElement, ScreenSnapshot,
};

/// AX calls to a hung app give up after this long.
const AX_TIMEOUT_SECS: f32 = 0.25;
const MAX_DEPTH: usize = 30;
const MAX_NODES: usize = 4000;
const WALK_BUDGET: Duration = Duration::from_millis(300);
const MAX_TEXT: usize = 120;

/// macOS Accessibility-backed screen reader. Stateless, so `Send + Sync`.
#[derive(Debug, Default)]
pub(super) struct MacPlatform;

impl MacPlatform {
    /// Creates the platform adapter.
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl Platform for MacPlatform {
    fn permission(&self, kind: PermissionKind) -> PermissionStatus {
        match kind {
            PermissionKind::Accessibility => {
                // SAFETY: no arguments; reads this process's trust state.
                if unsafe { AXIsProcessTrusted() } {
                    PermissionStatus::Granted
                } else {
                    PermissionStatus::NotAsked
                }
            }
            PermissionKind::ScreenRecording => {
                if core_graphics::access::ScreenCaptureAccess.preflight() {
                    PermissionStatus::Granted
                } else {
                    PermissionStatus::NotAsked
                }
            }
            PermissionKind::Microphone => microphone_status(),
        }
    }

    fn request_permission(&self, kind: PermissionKind) -> PermissionStatus {
        match kind {
            PermissionKind::Accessibility => {
                // SAFETY: `kAXTrustedCheckOptionPrompt` is a static CFString owned by the
                // framework; the get rule retains it for our wrapper's lifetime.
                let key = unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt) };
                let options = CFDictionary::from_CFType_pairs(&[(key, CFBoolean::true_value())]);
                // SAFETY: `options` is a valid CFDictionary for the duration of the call.
                if unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef()) } {
                    PermissionStatus::Granted
                } else {
                    PermissionStatus::Denied
                }
            }
            PermissionKind::ScreenRecording => {
                if core_graphics::access::ScreenCaptureAccess.request() {
                    PermissionStatus::Granted
                } else {
                    PermissionStatus::Denied
                }
            }
            PermissionKind::Microphone => request_microphone(),
        }
    }

    fn snapshot(&self, max_elements: usize) -> Result<ScreenSnapshot, PlatformError> {
        let own_pid = std::process::id();
        let target = topmost_window_owner(|pid, _| u32::try_from(pid).is_ok_and(|p| p != own_pid))?;
        snapshot_app(target, max_elements)
    }

    fn capture(&self) -> Result<ScreenCapture, PlatformError> {
        let own_pid = std::process::id();
        let target = topmost_window_owner(|pid, _| u32::try_from(pid).is_ok_and(|p| p != own_pid))?;
        // Crop to the window the snapshot reads, so the screenshot and the element
        // list describe the same window; fall back to the topmost CG window.
        let window = Ax::application(target.pid)
            .as_ref()
            .and_then(focused_window)
            .and_then(|w| w.frame())
            .map(|f| CGRect::new(&CGPoint::new(f.x, f.y), &CGSize::new(f.width, f.height)))
            .or(target.bounds);
        capture_display(window, target.window_id)
    }

    fn recognize_text(&self, capture: &ScreenCapture) -> Result<Vec<TextBox>, PlatformError> {
        recognize_text(capture)
    }
}

/// Reads text in `capture` with the Vision framework (on device).
fn recognize_text(capture: &ScreenCapture) -> Result<Vec<TextBox>, PlatformError> {
    use objc2::AllocAnyThread;
    use objc2_foundation::{NSArray, NSDictionary};
    use objc2_vision::{
        VNImageRequestHandler, VNRecognizeTextRequest, VNRequest, VNRequestTextRecognitionLevel,
    };

    let (width, height) = (capture.width as usize, capture.height as usize);
    if width == 0 || height == 0 {
        return Ok(Vec::new());
    }
    let provider = core_graphics::data_provider::CGDataProvider::from_buffer(std::sync::Arc::new(
        capture.rgba.clone(),
    ));
    let image = core_graphics::image::CGImage::new(
        width,
        height,
        8,
        32,
        width * 4,
        &core_graphics::color_space::CGColorSpace::create_device_rgb(),
        core_graphics::base::kCGImageAlphaNoneSkipLast,
        &provider,
        false,
        core_graphics::base::kCGRenderingIntentDefault,
    );
    // SAFETY: both crates wrap the same CoreGraphics `CGImageRef`; `image` outlives
    // the borrow, which ends with this function.
    let image: &objc2_core_graphics::CGImage = unsafe { &*image.as_ptr().cast() };
    let request = VNRecognizeTextRequest::new();
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    // UI labels are names and single words; correction would "fix" them.
    request.setUsesLanguageCorrection(false);
    // SAFETY: `image` is a valid CGImage and the options dictionary is empty.
    let handler = unsafe {
        VNImageRequestHandler::initWithCGImage_options(
            VNImageRequestHandler::alloc(),
            image,
            &NSDictionary::new(),
        )
    };
    let requests: objc2::rc::Retained<NSArray<VNRequest>> =
        NSArray::from_retained_slice(&[objc2::rc::Retained::into_super(
            objc2::rc::Retained::into_super(request.clone()),
        )]);
    handler
        .performRequests_error(&requests)
        .map_err(|error| PlatformError::Os(format!("text recognition failed: {error}")))?;
    let (w, h) = (width as f64, height as f64);
    let mut boxes = Vec::new();
    for observation in request.results().iter().flatten() {
        let Some(best) = observation.topCandidates(1).firstObject() else {
            continue;
        };
        let text = best.string().to_string();
        if text.trim().is_empty() {
            continue;
        }
        // SAFETY: plain getter; the box is normalized with a lower-left origin.
        let b = unsafe { observation.boundingBox() };
        boxes.push(TextBox {
            text,
            bounds: Rect {
                x: f64::from(capture.x) + b.origin.x * w,
                y: f64::from(capture.y) + (1.0 - b.origin.y - b.size.height) * h,
                width: b.size.width * w,
                height: b.size.height * h,
            },
        });
    }
    Ok(boxes)
}

/// The window an app's accessibility tree treats as current.
fn focused_window(app: &Ax) -> Option<Ax> {
    app.element("AXFocusedWindow")
        .or_else(|| app.element("AXMainWindow"))
        .or_else(|| app.elements("AXWindows").into_iter().next())
}

fn snapshot_app(target: TargetApp, max_elements: usize) -> Result<ScreenSnapshot, PlatformError> {
    // SAFETY: no arguments; reads this process's trust state.
    if !unsafe { AXIsProcessTrusted() } {
        return Err(PlatformError::PermissionDenied(
            PermissionKind::Accessibility,
        ));
    }
    let app = Ax::application(target.pid)
        .ok_or_else(|| PlatformError::Os("could not open the app's accessibility tree".into()))?;
    if first_read(target.pid) {
        // The web tree requested in `Ax::application` is built asynchronously.
        std::thread::sleep(WEB_TREE_DELAY);
    }
    // The walk budget starts after that wait.
    let started = Instant::now();
    let window = focused_window(&app).ok_or(PlatformError::NoFocusedApp)?;
    let window_title = window.string("AXTitle").filter(|t| !t.is_empty());
    let window_rect = window.frame();
    let displays = displays();

    let mut candidates = Vec::new();
    let mut visited = 0usize;
    let mut queue: VecDeque<(Ax, usize)> = VecDeque::new();
    // Menu bar items first: "where is the X menu" is a common question.
    if let Some(menu_bar) = app.element("AXMenuBar") {
        for item in menu_bar.elements("AXChildren") {
            visited += 1;
            if let Some(el) = describe(&item, None, &displays) {
                candidates.push(el);
            }
        }
    }
    queue.push_back((window, 0));
    while let Some((node, depth)) = queue.pop_front() {
        if visited >= MAX_NODES || started.elapsed() >= WALK_BUDGET {
            break;
        }
        visited += 1;
        if let Some(el) = describe(&node, window_rect, &displays) {
            candidates.push(el);
        }
        if depth < MAX_DEPTH {
            queue.extend(children(&node).into_iter().map(|child| (child, depth + 1)));
        }
    }
    super::drop_control_captions(&mut candidates);
    let elements = rank_and_assign(candidates, max_elements);
    tracing::debug!(
        pid = target.pid,
        visited,
        kept = elements.len(),
        elapsed_ms = started.elapsed().as_millis(),
        "accessibility snapshot"
    );
    Ok(ScreenSnapshot {
        app_name: target.name,
        window_title,
        elements,
    })
}

/// Containers whose `AXChildren` include every row, scrolled out of view or not.
const SCROLLING_ROLES: &[&str] = &["AXList", "AXOutline", "AXTable", "AXBrowser", "AXGrid"];

/// Children to walk. `AXChildren` in general: some containers report only part of
/// their content as visible (Safari's tab group lists only its tabs, hiding the page).
/// Long lists use `AXVisibleChildren`/`AXVisibleRows` so off-screen rows don't use up
/// the walk budget.
fn children(node: &Ax) -> Vec<Ax> {
    let role = node.string("AXRole").unwrap_or_default();
    if SCROLLING_ROLES.contains(&role.as_str()) {
        for attribute in ["AXVisibleChildren", "AXVisibleRows"] {
            let visible = node.elements(attribute);
            if !visible.is_empty() {
                return visible;
            }
        }
    }
    let all = node.elements("AXChildren");
    if all.is_empty() {
        node.elements("AXVisibleChildren")
    } else {
        all
    }
}

/// How long a Chromium/Electron app gets to build its web tree after the first request.
const WEB_TREE_DELAY: Duration = Duration::from_millis(250);

/// `true` the first time `pid` is read in this process.
fn first_read(pid: i32) -> bool {
    static SEEN: std::sync::LazyLock<std::sync::Mutex<std::collections::HashSet<i32>>> =
        std::sync::LazyLock::new(Default::default);
    SEEN.lock()
        .map(|mut seen| seen.insert(pid))
        .unwrap_or(false)
}

struct TargetApp {
    pid: i32,
    name: String,
    /// CoreGraphics number of the app's topmost on-screen window.
    window_id: Option<u32>,
    /// Window frame in global points, when CoreGraphics reports it.
    bounds: Option<CGRect>,
}

/// Topmost normal-layer on-screen window whose owner passes `accept(pid, app name)`.
fn topmost_window_owner(accept: impl Fn(i32, &str) -> bool) -> Result<TargetApp, PlatformError> {
    let windows = copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    )
    .ok_or(PlatformError::NoFocusedApp)?;
    // SAFETY: the window-info keys are static CFStrings exported by CoreGraphics.
    let (layer_key, pid_key, name_key, bounds_key, number_key) = unsafe {
        (
            CFString::wrap_under_get_rule(kCGWindowLayer),
            CFString::wrap_under_get_rule(kCGWindowOwnerPID),
            CFString::wrap_under_get_rule(kCGWindowOwnerName),
            CFString::wrap_under_get_rule(kCGWindowBounds),
            CFString::wrap_under_get_rule(kCGWindowNumber),
        )
    };
    for entry in windows.iter() {
        let ptr = *entry;
        if ptr.is_null() {
            continue;
        }
        // SAFETY: every item of the window-info array is a CFDictionary owned by the
        // array; the get rule retains it while we read it.
        let dict: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_get_rule(ptr.cast()) };
        let number = |key: &CFString| {
            dict.find(key)
                .and_then(|v| v.downcast::<CFNumber>())
                .and_then(|n| n.to_i64())
        };
        if number(&layer_key) != Some(0) {
            continue;
        }
        let Some(pid) = number(&pid_key).and_then(|p| i32::try_from(p).ok()) else {
            continue;
        };
        let name = dict
            .find(&name_key)
            .and_then(|v| v.downcast::<CFString>())
            .map(|s| s.to_string())
            .unwrap_or_default();
        if accept(pid, &name) {
            let bounds = dict
                .find(&bounds_key)
                .and_then(|v| v.downcast::<CFDictionary>())
                .and_then(|d| window_rect(&d));
            let window_id = number(&number_key).and_then(|n| u32::try_from(n).ok());
            return Ok(TargetApp {
                pid,
                name,
                window_id,
                bounds,
            });
        }
    }
    Err(PlatformError::NoFocusedApp)
}

/// Reads a `kCGWindowBounds` dictionary (`X`, `Y`, `Width`, `Height` in points).
fn window_rect(dict: &CFDictionary) -> Option<CGRect> {
    // SAFETY: the window-bounds dictionary maps CFString keys to CFNumber values.
    let dict: CFDictionary<CFString, CFType> =
        unsafe { CFDictionary::wrap_under_get_rule(dict.as_concrete_TypeRef().cast()) };
    let get = |key: &str| {
        dict.find(CFString::new(key))
            .and_then(|v| v.downcast::<CFNumber>())
            .and_then(|n| n.to_f64())
    };
    Some(CGRect::new(
        &CGPoint::new(get("X")?, get("Y")?),
        &CGSize::new(get("Width")?, get("Height")?),
    ))
}

unsafe extern "C" {
    fn CGImageGetBitmapInfo(image: core_graphics::sys::CGImageRef) -> u32;
}

/// Captures the display holding the centre of `window` (else the main display),
/// cropped to `window`. With `window_id`, only that window and those below it are
/// drawn: GetCko's own windows (main window, overlay) above the target app never
/// reach the model, even when they overlap it.
fn capture_display(
    window: Option<CGRect>,
    window_id: Option<u32>,
) -> Result<ScreenCapture, PlatformError> {
    if !core_graphics::access::ScreenCaptureAccess.preflight() {
        return Err(PlatformError::PermissionDenied(
            PermissionKind::ScreenRecording,
        ));
    }
    let center = window.map(|w| {
        (
            w.origin.x + w.size.width / 2.0,
            w.origin.y + w.size.height / 2.0,
        )
    });
    let display = center
        .and_then(|(cx, cy)| {
            CGDisplay::active_displays()
                .ok()?
                .into_iter()
                .map(CGDisplay::new)
                .find(|d| {
                    let b = d.bounds();
                    cx >= b.origin.x
                        && cx < b.origin.x + b.size.width
                        && cy >= b.origin.y
                        && cy < b.origin.y + b.size.height
                })
        })
        .unwrap_or_else(CGDisplay::main);
    let image = window_id
        .and_then(|id| {
            CGDisplay::screenshot(
                display.bounds(),
                kCGWindowListOptionOnScreenBelowWindow | kCGWindowListOptionIncludingWindow,
                id,
                kCGWindowImageBestResolution,
            )
        })
        .or_else(|| display.image())
        .ok_or_else(|| PlatformError::Os("display capture returned no image".into()))?;
    if image.bits_per_pixel() != 32 || image.bits_per_component() != 8 {
        return Err(PlatformError::Os(format!(
            "unexpected capture format: {} bits per pixel",
            image.bits_per_pixel()
        )));
    }
    let (width, height, stride) = (image.width(), image.height(), image.bytes_per_row());
    // SAFETY: `image` is a valid CGImage for the duration of the call.
    let info = unsafe { CGImageGetBitmapInfo(image.as_ptr()) };
    let alpha_first = matches!(info & 0x1F, 2 | 4 | 6); // premultiplied/plain/none-skip first
    let little = info & 0x7000 == 0x2000; // kCGBitmapByteOrder32Little
    // Byte offsets of R, G, B within a pixel in memory.
    let (r, g, b) = match (little, alpha_first) {
        (true, true) => (2, 1, 0),   // BGRA
        (true, false) => (3, 2, 1),  // ABGR
        (false, true) => (1, 2, 3),  // ARGB
        (false, false) => (0, 1, 2), // RGBA
    };
    let points = display.bounds();
    let scale = if points.size.width > 0.0 {
        width as f64 / points.size.width
    } else {
        1.0
    };
    // Crop to the target window (clamped to this display): more of the model's
    // image budget goes to the app the user asked about.
    let to_px = |v: f64, limit: usize| ((v * scale).round().max(0.0) as usize).min(limit);
    let (left, top, right, bottom) = window
        .map(|w| {
            (
                to_px(w.origin.x - points.origin.x, width),
                to_px(w.origin.y - points.origin.y, height),
                to_px(w.origin.x + w.size.width - points.origin.x, width),
                to_px(w.origin.y + w.size.height - points.origin.y, height),
            )
        })
        .filter(|(l, t, r, b)| r > l && b > t)
        .unwrap_or((0, 0, width, height));
    let (crop_width, crop_height) = (right - left, bottom - top);
    let data = image.data();
    let bytes = data.bytes();
    let mut rgba = Vec::with_capacity(crop_width * crop_height * 4);
    for row in bytes.chunks(stride).skip(top).take(crop_height) {
        for pixel in row.as_chunks::<4>().0.iter().skip(left).take(crop_width) {
            rgba.extend_from_slice(&[pixel[r], pixel[g], pixel[b], 255]);
        }
    }
    if rgba.len() != crop_width * crop_height * 4 {
        return Err(PlatformError::Os("capture smaller than reported".into()));
    }
    let to_u32 = |v: usize| u32::try_from(v).map_err(|e| PlatformError::Os(e.to_string()));
    let to_i32 = |v: usize| i32::try_from(v).map_err(|e| PlatformError::Os(e.to_string()));
    // Display origins are whole physical pixels; rounding removes float noise.
    let monitor_x = (points.origin.x * scale).round() as i32;
    let monitor_y = (points.origin.y * scale).round() as i32;
    Ok(ScreenCapture {
        width: to_u32(crop_width)?,
        height: to_u32(crop_height)?,
        rgba,
        x: monitor_x + to_i32(left)?,
        y: monitor_y + to_i32(top)?,
        monitor: MonitorFrame {
            x: monitor_x,
            y: monitor_y,
            width: to_u32(width)?,
            height: to_u32(height)?,
            scale_factor: scale,
        },
    })
}

/// Active displays as (bounds in global points, backing scale).
fn displays() -> Vec<(CGRect, f64)> {
    let ids = CGDisplay::active_displays().unwrap_or_default();
    ids.into_iter()
        .map(|id| {
            let display = CGDisplay::new(id);
            let bounds = display.bounds();
            let scale = display
                .display_mode()
                .map(|mode| mode.pixel_width() as f64)
                .filter(|_| bounds.size.width > 0.0)
                .map_or(1.0, |px| px / bounds.size.width);
            (bounds, scale)
        })
        .collect()
}

/// One retained AX element.
struct Ax(CFType);

impl Ax {
    fn application(pid: i32) -> Option<Self> {
        // SAFETY: creates a new AXUIElement (create rule) for `pid`; null on failure.
        let raw = unsafe { AXUIElementCreateApplication(pid) };
        if raw.is_null() {
            return None;
        }
        // SAFETY: `raw` is a non-null, +1 retained CFTypeRef we now own.
        let app = Self(unsafe { CFType::wrap_under_create_rule(raw as CFTypeRef) });
        // SAFETY: `app` is a valid AXUIElement; the timeout applies to calls on it.
        unsafe { AXUIElementSetMessagingTimeout(app.raw(), AX_TIMEOUT_SECS) };
        // Chromium and Electron apps (Chrome, Edge, Slack, VS Code, ...) only build their
        // web-content accessibility tree when an assistive client asks for it. Electron
        // listens for AXManualAccessibility, Chrome for AXEnhancedUserInterface (what
        // VoiceOver sets); apps that know neither return an error, which is ignored.
        for attribute in ["AXManualAccessibility", "AXEnhancedUserInterface"] {
            let key = CFString::new(attribute);
            // SAFETY: valid AXUIElement, CFString key and CFBoolean value for the call.
            unsafe {
                AXUIElementSetAttributeValue(
                    app.raw(),
                    key.as_concrete_TypeRef(),
                    CFBoolean::true_value().as_CFTypeRef(),
                )
            };
        }
        Some(app)
    }

    fn raw(&self) -> AXUIElementRef {
        self.0.as_CFTypeRef() as AXUIElementRef
    }

    /// Copies attribute `name`, or `None` if absent or the call fails.
    fn attr(&self, name: &str) -> Option<CFType> {
        let key = CFString::new(name);
        let mut value: CFTypeRef = std::ptr::null();
        // SAFETY: `self` is a valid AXUIElement, `key` a valid CFString, and `value`
        // a valid out-pointer; on success it receives a +1 retained object.
        let err = unsafe {
            AXUIElementCopyAttributeValue(self.raw(), key.as_concrete_TypeRef(), &raw mut value)
        };
        if err != kAXErrorSuccess || value.is_null() {
            return None;
        }
        // SAFETY: success returned a non-null object following the create rule.
        Some(unsafe { CFType::wrap_under_create_rule(value) })
    }

    fn string(&self, name: &str) -> Option<String> {
        let value = self.attr(name)?;
        if let Some(s) = value.downcast::<CFString>() {
            return Some(s.to_string());
        }
        if let Some(b) = value.downcast::<CFBoolean>() {
            return Some(if bool::from(b) { "on" } else { "off" }.to_owned());
        }
        value.downcast::<CFNumber>().and_then(|n| {
            n.to_i64()
                .map(|i| i.to_string())
                .or_else(|| n.to_f64().map(|f| f.to_string()))
        })
    }

    fn element(&self, name: &str) -> Option<Self> {
        let value = self.attr(name)?;
        // SAFETY: plain type-id query, no arguments.
        (value.type_of() == unsafe { AXUIElementGetTypeID() }).then_some(Self(value))
    }

    fn elements(&self, name: &str) -> Vec<Self> {
        let Some(array) = self.attr(name).and_then(|v| v.downcast::<CFArray>()) else {
            return Vec::new();
        };
        // SAFETY: plain type-id query, no arguments.
        let ax_type = unsafe { AXUIElementGetTypeID() };
        array
            .iter()
            .filter_map(|item| {
                let ptr: *const c_void = *item;
                if ptr.is_null() {
                    return None;
                }
                // SAFETY: array items are valid CF objects owned by the array; the get
                // rule retains each one we keep.
                let value = unsafe { CFType::wrap_under_get_rule(ptr) };
                (value.type_of() == ax_type).then_some(Self(value))
            })
            .collect()
    }

    fn ax_value<T: Default>(&self, name: &str, kind: u32) -> Option<T> {
        let value = self.attr(name)?;
        // SAFETY: plain type-id query, no arguments.
        if value.type_of() != unsafe { AXValueGetTypeID() } {
            return None;
        }
        let raw = value.as_CFTypeRef() as AXValueRef;
        // SAFETY: `raw` is a valid AXValue for the lifetime of `value`.
        if unsafe { AXValueGetType(raw) } != kind {
            return None;
        }
        let mut out = T::default();
        // SAFETY: the AXValue holds `kind`, whose C layout matches `T` (CGPoint/CGSize);
        // `out` is a valid, writable destination of that type.
        let ok = unsafe { AXValueGetValue(raw, kind, (&raw mut out).cast::<c_void>()) };
        ok.then_some(out)
    }

    /// Frame in global points.
    fn frame(&self) -> Option<Rect> {
        let origin: CGPoint = self.ax_value("AXPosition", kAXValueTypeCGPoint)?;
        let size: CGSize = self.ax_value("AXSize", kAXValueTypeCGSize)?;
        Some(Rect {
            x: origin.x,
            y: origin.y,
            width: size.width,
            height: size.height,
        })
    }
}

/// Builds an element for `node` if it is worth showing to the model.
fn describe(node: &Ax, window: Option<Rect>, displays: &[(CGRect, f64)]) -> Option<ScreenElement> {
    let ax_role = node.string("AXRole")?;
    if matches!(
        ax_role.as_str(),
        "AXGroup" | "AXScrollArea" | "AXSplitGroup" | "AXLayoutArea" | "AXSplitter" | "AXScrollBar"
    ) {
        return None;
    }
    let subrole = node.string("AXSubrole").unwrap_or_default();
    let role = map_role(&ax_role, &subrole);
    let frame = node.frame()?;
    if frame.width <= 0.0 || frame.height <= 0.0 {
        return None;
    }
    if let Some(w) = window {
        let outside = frame.x + frame.width <= w.x
            || frame.y + frame.height <= w.y
            || frame.x >= w.x + w.width
            || frame.y >= w.y + w.height;
        if outside {
            return None;
        }
    }
    let raw_value = node.string("AXValue").filter(|v| !v.trim().is_empty());
    let label = ["AXTitle", "AXDescription", "AXPlaceholderValue", "AXHelp"]
        .iter()
        .find_map(|attr| node.string(attr).filter(|s| !s.trim().is_empty()))
        .or_else(|| (role == "text").then(|| raw_value.clone()).flatten())
        .map(|s| clip(&s))
        .unwrap_or_default();
    let value = if role == "text" {
        None
    } else {
        raw_value.map(|v| clip(&v))
    };
    if label.is_empty() && value.is_none() && !actionable(role) {
        return None;
    }
    // Unnamed, unrecognised elements (ruler ticks, layout groups carrying a number)
    // can't be asked about or described; they only lengthen the prompt. Empty table
    // cells and rows are wrappers: the field or text inside is listed on its own,
    // and in a dense grid the wrappers alone fill the element cap (a 9x8 grade grid:
    // 90 of 150 slots, 11 of its 72 fields kept).
    if label.is_empty() && (role == "other" || (value.is_none() && matches!(role, "cell" | "row")))
    {
        return None;
    }
    Some(ScreenElement {
        id: String::new(),
        role: role.to_owned(),
        label,
        value,
        bounds: to_physical(frame, displays),
    })
}

/// Trims, collapses whitespace and caps at [`MAX_TEXT`] characters.
fn clip(text: &str) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    match collapsed.char_indices().nth(MAX_TEXT) {
        Some((cut, _)) => format!("{}…", &collapsed[..cut]),
        None => collapsed,
    }
}

fn microphone_status() -> PermissionStatus {
    use objc2_av_foundation::{AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio};
    // SAFETY: `AVMediaTypeAudio` is a static framework constant; the call only reads
    // the authorization state.
    let status = unsafe {
        AVMediaTypeAudio.map(|media| AVCaptureDevice::authorizationStatusForMediaType(media))
    };
    match status {
        Some(AVAuthorizationStatus::Authorized) => PermissionStatus::Granted,
        Some(AVAuthorizationStatus::NotDetermined) => PermissionStatus::NotAsked,
        _ => PermissionStatus::Denied,
    }
}

fn request_microphone() -> PermissionStatus {
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_av_foundation::{AVCaptureDevice, AVMediaTypeAudio};
    use std::sync::mpsc;
    if microphone_status() != PermissionStatus::NotAsked {
        return microphone_status();
    }
    let (tx, rx) = mpsc::channel();
    let block = RcBlock::new(move |granted: Bool| {
        let _ = tx.send(granted.as_bool());
    });
    // SAFETY: `AVMediaTypeAudio` is a static framework constant and `block` stays alive
    // until the framework copies it during the call.
    unsafe {
        if let Some(media) = AVMediaTypeAudio {
            AVCaptureDevice::requestAccessForMediaType_completionHandler(media, &block);
        }
    }
    match rx.recv_timeout(Duration::from_secs(120)) {
        Ok(true) => PermissionStatus::Granted,
        Ok(false) => PermissionStatus::Denied,
        Err(_) => microphone_status(),
    }
}

fn map_role(role: &str, subrole: &str) -> &'static str {
    if subrole == "AXTabButton" {
        return "tab";
    }
    match role {
        "AXButton" | "AXMenuButton" => "button",
        "AXCheckBox" => "checkbox",
        "AXRadioButton" => "radio",
        "AXTextField" | "AXSearchField" => "textField",
        "AXTextArea" => "textArea",
        "AXComboBox" | "AXPopUpButton" => "comboBox",
        "AXList" | "AXOutline" => "list",
        "AXRow" => "row",
        "AXCell" => "cell",
        "AXTable" | "AXGrid" => "table",
        "AXMenu" => "menu",
        "AXMenuItem" | "AXMenuBarItem" => "menuItem",
        "AXMenuBar" => "menuBar",
        "AXTab" | "AXTabGroup" => "tab",
        "AXLink" => "link",
        "AXImage" => "image",
        "AXStaticText" => "text",
        "AXSlider" | "AXIncrementor" => "slider",
        "AXToolbar" => "toolbar",
        "AXWindow" => "window",
        _ => "other",
    }
}

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

/// Global points → desktop physical pixels, using the scale of the display that
/// contains the rect's center (Tauri on macOS reports a monitor's physical position
/// as its point origin × its scale, so `physical = points × scale`).
fn to_physical(rect: Rect, displays: &[(CGRect, f64)]) -> Rect {
    let (cx, cy) = rect.center();
    let scale = displays
        .iter()
        .find(|(b, _)| {
            cx >= b.origin.x
                && cx <= b.origin.x + b.size.width
                && cy >= b.origin.y
                && cy <= b.origin.y + b.size.height
        })
        .map_or(1.0, |(_, scale)| *scale);
    Rect {
        x: rect.x * scale,
        y: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale,
    }
}

/// Drops exact duplicates (tables list each cell under both a row and a column),
/// keeps actionable elements first when over budget, then orders the kept set
/// top-to-bottom, left-to-right and assigns ids `e1..`.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_mapping_normalizes_known_ax_roles() {
        assert_eq!(map_role("AXButton", ""), "button");
        assert_eq!(map_role("AXRadioButton", "AXTabButton"), "tab");
        assert_eq!(map_role("AXMystery", ""), "other");
        assert!(super::super::ROLES.contains(&map_role("AXPopUpButton", "")));
    }

    #[test]
    fn ranking_prioritizes_actions_and_assigns_sorted_ids() {
        let make = |role: &str, x: f64, y: f64| ScreenElement {
            id: String::new(),
            role: role.to_owned(),
            label: "x".to_owned(),
            value: None,
            bounds: Rect {
                x,
                y,
                width: 2.0,
                height: 2.0,
            },
        };
        let result = rank_and_assign(
            vec![
                make("text", 0.0, 0.0),
                make("button", 2.0, 4.0),
                make("button", 0.0, 4.0),
            ],
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
    fn physical_scaling_uses_display_containing_center() {
        let displays = [
            (
                CGRect::new(&CGPoint::new(0.0, 0.0), &CGSize::new(100.0, 100.0)),
                2.0,
            ),
            (
                CGRect::new(&CGPoint::new(-100.0, 0.0), &CGSize::new(100.0, 100.0)),
                1.0,
            ),
        ];
        let on_retina = Rect {
            x: 1.0,
            y: 2.0,
            width: 10.0,
            height: 10.0,
        };
        assert_eq!(
            to_physical(on_retina, &displays),
            Rect {
                x: 2.0,
                y: 4.0,
                width: 20.0,
                height: 20.0
            }
        );
        assert_eq!(
            to_physical(
                Rect {
                    x: -90.0,
                    y: 2.0,
                    width: 10.0,
                    height: 10.0
                },
                &displays
            )
            .x,
            -90.0
        );
        // Straddling element: center x = 0 belongs to the first (Retina) display.
        assert_eq!(
            to_physical(
                Rect {
                    x: -5.0,
                    y: 2.0,
                    width: 10.0,
                    height: 10.0
                },
                &displays
            )
            .x,
            -10.0
        );
    }

    #[test]
    fn clip_collapses_whitespace_and_caps_length() {
        assert_eq!(clip("  Save \n as  "), "Save as");
        let long = "x".repeat(MAX_TEXT + 5);
        assert_eq!(clip(&long).chars().count(), MAX_TEXT + 1);
    }

    #[test]
    #[ignore = "needs a desktop session with Accessibility granted"]
    fn platform_conformance_on_real_desktop() {
        let max = super::super::MAX_SNAPSHOT_ELEMENTS;
        let snapshot = MacPlatform::new().snapshot(max).expect("desktop snapshot");
        eprintln!(
            "{} / {:?}: {} elements",
            snapshot.app_name,
            snapshot.window_title,
            snapshot.elements.len()
        );
        for el in snapshot.elements.iter().take(15) {
            eprintln!(
                "{} {} {:?} {:?} {:?}",
                el.id, el.role, el.label, el.value, el.bounds
            );
        }
        super::super::conformance(&snapshot, max).expect("conformance");
    }

    #[test]
    #[ignore = "needs Accessibility granted and Google Chrome open on a web page"]
    fn chromium_exposes_web_content_after_manual_accessibility() {
        let max = super::super::MAX_SNAPSHOT_ELEMENTS;
        let chrome = || {
            topmost_window_owner(|_, name| name == "Google Chrome")
                .expect("Chrome window on screen")
        };
        let first = snapshot_app(chrome(), max).expect("first snapshot");
        // Chromium builds its web tree asynchronously after the first request.
        std::thread::sleep(Duration::from_millis(500));
        let second = snapshot_app(chrome(), max).expect("second snapshot");
        let links = second.elements.iter().filter(|e| e.role == "link").count();
        eprintln!(
            "first {} elements, second {} elements, {links} links",
            first.elements.len(),
            second.elements.len()
        );
        super::super::conformance(&second, max).expect("conformance");
        assert!(
            second.elements.len() > first.elements.len() || links > 0,
            "web content not exposed"
        );
    }
}
