// GradeINT Local Exam Server — Tauri Core

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            spawn_sidecar();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Spawns the Node.js sidecar.
/// - In DEBUG/dev builds: uses `npx tsx server.ts` from the local sidecar folder.
/// - In RELEASE/production builds: spawns the compiled sidecar .exe from the resources dir.
fn spawn_sidecar() {
    #[cfg(debug_assertions)]
    {
        std::thread::spawn(|| {
            println!("[Sidecar] DEV: Spawning via npx tsx...");
            let mut child = std::process::Command::new("cmd")
                .args(["/C", "npx", "tsx", "server.ts"])
                .current_dir("../sidecar")
                .spawn()
                .expect("Failed to spawn sidecar dev server");
            let _ = child.wait();
        });
    }

    #[cfg(not(debug_assertions))]
    {
        std::thread::spawn(|| {
            println!("[Sidecar] RELEASE: Spawning compiled sidecar binary...");

            // The sidecar binary is placed next to the main exe by the Tauri bundler
            // because it's listed in `bundle.externalBin` in tauri.conf.json.
            let exe_path = std::env::current_exe()
                .expect("Could not resolve current exe path");
            let sidecar_path = exe_path
                .parent()
                .expect("Could not get exe dir")
                .join("sidecar-x86_64-pc-windows-msvc.exe");

            println!("[Sidecar] Path: {:?}", sidecar_path);

            let mut child = std::process::Command::new(&sidecar_path)
                .spawn()
                .unwrap_or_else(|e| panic!("Failed to spawn sidecar binary: {}", e));

            let _ = child.wait();
        });
    }
}
