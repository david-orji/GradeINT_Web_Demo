// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            // Bypass Tauri's sidecar to natively boot the SQLite WASM Node server directly 
            // from the filesystem to avoid vercel/pkg native dependency crashes!
            std::thread::spawn(|| {
                println!("Spawning Local Sidecar via npx tsx...");
                let mut child = std::process::Command::new("cmd")
                    .args(["/C", "npx", "tsx", "server.ts"])
                    .current_dir("../sidecar")
                    .spawn()
                    .expect("Failed to spawn sidecar dev server");
                child.wait().unwrap();
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
