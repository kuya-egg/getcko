mod overlay;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            overlay::init(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            overlay::show_overlay,
            overlay::hide_overlay,
            overlay::point_at,
            overlay::clear_target,
            overlay::current_target,
            overlay::overlay_work_area,
            overlay::set_overlay_hit_regions,
            overlay::set_overlay_interactive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
