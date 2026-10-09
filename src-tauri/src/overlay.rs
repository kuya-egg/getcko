//! Screen Help overlay (PRD S3): a transparent, frameless, always-on-top,
//! click-through window that covers the primary monitor and draws the gecko
//! pointer next to a target element.
//!
//! Coordinates: `point_at` takes a rect in global screen points (macOS AX
//! units; on Windows, physical pixels divided by the monitor scale). Pass
//! `physical: true` for raw physical pixels (e.g. Windows UI Automation).
//! The overlay receives the rect already converted to its own CSS pixels.
//!
//! Click-through: the window ignores the mouse, except while the cursor is
//! over one of the hit regions the overlay reports (its answer card), or
//! while `set_overlay_interactive(true)` forces it (text input). A click-through
//! window gets no mouse events at all, so Rust polls the cursor instead.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{
    App, AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, State, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub const LABEL: &str = "overlay";

/// Events sent to the overlay window.
pub const EVENT_POINT_AT: &str = "overlay:point-at";
pub const EVENT_CLEAR_TARGET: &str = "overlay:clear-target";
pub const EVENT_SHOWN: &str = "overlay:shown";
pub const EVENT_HIDDEN: &str = "overlay:hidden";

/// A target rect in the overlay's CSS pixels (origin = overlay top-left).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayTarget {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub label: Option<String>,
    /// Which side GetCko stands on: "left" | "right". None = auto. The screen
    /// reader knows the neighbours, so it can keep the gecko off useful content.
    pub side: Option<String>,
    /// Overlay viewport size in CSS pixels, so the frontend can place the
    /// gecko and answer card without waiting for a resize.
    pub viewport_w: f64,
    pub viewport_h: f64,
    pub scale_factor: f64,
    /// False when the rect does not intersect the primary monitor.
    pub on_screen: bool,
}

/// A rect in the overlay's CSS pixels.
#[derive(Clone, Copy, Serialize, Deserialize)]
pub struct HitRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Default)]
pub struct OverlayState {
    /// The last target, so an overlay webview that loads late can catch up.
    target: Mutex<Option<OverlayTarget>>,
    /// Areas that take the mouse (answer card, dev panel).
    regions: Mutex<Vec<HitRect>>,
    /// Forced interactive (e.g. while a text field has focus).
    forced: AtomicBool,
    /// What we last told the OS, to avoid redundant calls.
    ignoring: AtomicBool,
}

const POLL: Duration = Duration::from_millis(40);

/// Alt+Space on macOS, Ctrl+Space elsewhere (design system, "Platform adaptations").
fn toggle_shortcut() -> Shortcut {
    #[cfg(target_os = "macos")]
    let mods = Modifiers::ALT;
    #[cfg(not(target_os = "macos"))]
    let mods = Modifiers::CONTROL;
    Shortcut::new(Some(mods), Code::Space)
}

/// Creates the hidden overlay window and registers the global hotkey.
/// Call once from the app's `setup`.
pub fn init<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    app.manage(OverlayState::default());

    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("overlay.html".into()))
        .title("GetcKo Screen Help")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .build()?;
    fit_to_primary_monitor(&window)?;
    set_ignore(app.handle(), &window, true)?;
    spawn_hit_test(app.handle().clone());

    let toggle = toggle_shortcut();
    let plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, shortcut, event| {
            if shortcut == &toggle && event.state() == ShortcutState::Pressed {
                if let Err(e) = toggle_overlay(app) {
                    eprintln!("[overlay] toggle failed: {e}");
                }
            }
        })
        .build();
    app.handle().plugin(plugin)?;
    // Another app may own the hotkey already; the overlay still works via commands.
    if let Err(e) = app.global_shortcut().register(toggle) {
        eprintln!("[overlay] could not register {toggle:?}: {e}");
    }
    Ok(())
}

fn set_ignore<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    ignore: bool,
) -> tauri::Result<()> {
    window.set_ignore_cursor_events(ignore)?;
    app.state::<OverlayState>()
        .ignoring
        .store(ignore, Ordering::Relaxed);
    Ok(())
}

/// Turns click-through off while the cursor is over a hit region.
fn spawn_hit_test<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(POLL);
        let state = app.state::<OverlayState>();
        let forced = state.forced.load(Ordering::Relaxed);
        let regions = state.regions.lock().unwrap().clone();
        if !forced && regions.is_empty() && state.ignoring.load(Ordering::Relaxed) {
            continue;
        }
        let Some(window) = app.get_webview_window(LABEL) else {
            continue;
        };
        if !window.is_visible().unwrap_or(false) {
            continue;
        }
        let over = forced || cursor_in_regions(&app, &window, &regions).unwrap_or(false);
        if over == state.ignoring.load(Ordering::Relaxed) {
            if let Err(e) = set_ignore(&app, &window, !over) {
                eprintln!("[overlay] set_ignore_cursor_events failed: {e}");
            }
        }
    });
}

fn cursor_in_regions<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    regions: &[HitRect],
) -> tauri::Result<bool> {
    let cursor = app.cursor_position()?;
    let origin = window.outer_position()?;
    let scale = window.scale_factor()?;
    let cx = (cursor.x - origin.x as f64) / scale;
    let cy = (cursor.y - origin.y as f64) / scale;
    Ok(regions
        .iter()
        .any(|r| cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h))
}

fn overlay_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window(LABEL)
        .ok_or_else(|| "overlay window not found".to_string())
}

/// Covers the primary monitor exactly. We size the window instead of using
/// real fullscreen, which on macOS would move it to its own Space.
fn fit_to_primary_monitor<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    if let Some(monitor) = window.primary_monitor()? {
        let pos = monitor.position();
        let size = monitor.size();
        window.set_position(PhysicalPosition::new(pos.x, pos.y))?;
        window.set_size(PhysicalSize::new(size.width, size.height))?;
    }
    Ok(())
}

fn show<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = overlay_window(app)?;
    fit_to_primary_monitor(&window).map_err(|e| e.to_string())?;
    set_ignore(app, &window, true).map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.emit(EVENT_SHOWN, ()).map_err(|e| e.to_string())
}

fn hide<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = overlay_window(app)?;
    window.hide().map_err(|e| e.to_string())?;
    let state = app.state::<OverlayState>();
    state.forced.store(false, Ordering::Relaxed);
    state.regions.lock().unwrap().clear();
    set_ignore(app, &window, true).map_err(|e| e.to_string())?;
    window.emit(EVENT_HIDDEN, ()).map_err(|e| e.to_string())
}

fn toggle_overlay<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if overlay_window(app)?.is_visible().unwrap_or(false) {
        hide(app)
    } else {
        show(app)
    }
}

/// Converts a global screen rect into the overlay's CSS pixels.
fn to_overlay_space<R: Runtime>(
    window: &WebviewWindow<R>,
    (x, y, w, h): (f64, f64, f64, f64),
    physical: bool,
    label: Option<String>,
) -> tauri::Result<OverlayTarget> {
    let scale = window.scale_factor()?;
    let origin = window.outer_position()?;
    let size = window.inner_size()?;
    let (ox, oy) = (origin.x as f64, origin.y as f64);

    let (x, y, w, h) = if physical {
        ((x - ox) / scale, (y - oy) / scale, w / scale, h / scale)
    } else {
        (x - ox / scale, y - oy / scale, w, h)
    };
    let (vw, vh) = (size.width as f64 / scale, size.height as f64 / scale);
    let on_screen = x + w > 0.0 && y + h > 0.0 && x < vw && y < vh;

    Ok(OverlayTarget {
        x,
        y,
        w,
        h,
        label,
        side: None,
        viewport_w: vw,
        viewport_h: vh,
        scale_factor: scale,
        on_screen,
    })
}

#[tauri::command]
pub fn show_overlay<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    show(&app)
}

#[tauri::command]
pub fn hide_overlay<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    hide(&app)
}

/// Shows the overlay if needed and points the gecko at `{x, y, w, h}`.
// Each argument is a named field on the JS side: invoke("point_at", { x, y, w, h, label, ... }).
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn point_at<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, OverlayState>,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    label: Option<String>,
    physical: Option<bool>,
    side: Option<String>,
) -> Result<OverlayTarget, String> {
    let window = overlay_window(&app)?;
    if !window.is_visible().unwrap_or(false) {
        show(&app)?;
    }
    let mut target = to_overlay_space(&window, (x, y, w, h), physical.unwrap_or(false), label)
        .map_err(|e| e.to_string())?;
    target.side = side.filter(|s| s == "left" || s == "right");
    *state.target.lock().unwrap() = Some(target.clone());
    window
        .emit(EVENT_POINT_AT, target.clone())
        .map_err(|e| e.to_string())?;
    Ok(target)
}

#[tauri::command]
pub fn clear_target<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, OverlayState>,
) -> Result<(), String> {
    *state.target.lock().unwrap() = None;
    overlay_window(&app)?
        .emit(EVENT_CLEAR_TARGET, ())
        .map_err(|e| e.to_string())
}

/// The current target, for an overlay webview that mounted after `point_at`.
#[tauri::command]
pub fn current_target(state: State<'_, OverlayState>) -> Option<OverlayTarget> {
    state.target.lock().unwrap().clone()
}

/// The primary monitor minus the taskbar / Dock / menu bar, in overlay CSS
/// pixels. Panels stay inside it; targets may still be anywhere on screen.
#[tauri::command]
pub fn overlay_work_area<R: Runtime>(app: AppHandle<R>) -> Result<Option<HitRect>, String> {
    let window = overlay_window(&app)?;
    let Some(monitor) = window.primary_monitor().map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let origin = window.outer_position().map_err(|e| e.to_string())?;
    let area = monitor.work_area();
    Ok(Some(HitRect {
        x: (area.position.x - origin.x) as f64 / scale,
        y: (area.position.y - origin.y) as f64 / scale,
        w: area.size.width as f64 / scale,
        h: area.size.height as f64 / scale,
    }))
}

/// Areas of the overlay (CSS pixels) that should take the mouse, e.g. the
/// answer card. Replaces the previous list; pass `[]` when nothing is shown.
#[tauri::command]
pub fn set_overlay_hit_regions(state: State<'_, OverlayState>, regions: Vec<HitRect>) {
    *state.regions.lock().unwrap() = regions;
}

/// Forces the whole overlay interactive (`true`, and focuses it, e.g. for a
/// text field) or back to hit-region click-through (`false`).
#[tauri::command]
pub fn set_overlay_interactive<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, OverlayState>,
    interactive: bool,
) -> Result<(), String> {
    state.forced.store(interactive, Ordering::Relaxed);
    let window = overlay_window(&app)?;
    if interactive {
        set_ignore(&app, &window, false).map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
