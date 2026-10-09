//! The app menu: Tauri's default, except "Close Window" (Cmd+W / Ctrl+W) hides the
//! main window. The default item asks the key window to close itself, which is often
//! the borderless overlay (it had focus for the composer) and cannot close, so Cmd+W
//! did nothing.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Runtime};

/// Menu id of GetCko's "Close Window".
pub const CLOSE_WINDOW: &str = "close-window";

/// Builds the app menu.
///
/// # Errors
/// The OS refused to create a menu item.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let close = MenuItem::with_id(app, CLOSE_WINDOW, "Close Window", true, Some("CmdOrCtrl+W"))?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;
    #[cfg(target_os = "macos")]
    {
        let name = app.package_info().name.clone();
        let app_menu = Submenu::with_items(
            app,
            name,
            true,
            &[
                &PredefinedMenuItem::about(app, None, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?;
        let file = Submenu::with_items(app, "File", true, &[&close])?;
        let view = Submenu::with_items(
            app,
            "View",
            true,
            &[&PredefinedMenuItem::fullscreen(app, None)?],
        )?;
        Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
    }
    #[cfg(not(target_os = "macos"))]
    {
        let file = Submenu::with_items(
            app,
            "File",
            true,
            &[&close, &PredefinedMenuItem::quit(app, None)?],
        )?;
        Menu::with_items(app, &[&file, &edit, &window])
    }
}

/// Hides the main window (the overlay's session bar stays).
pub fn hide_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(main) = app.get_webview_window("main")
        && let Err(error) = main.hide()
    {
        tracing::warn!("could not hide main window: {error}");
    }
}
