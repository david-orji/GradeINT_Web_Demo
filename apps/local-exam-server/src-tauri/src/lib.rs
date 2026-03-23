// GradeINT Local Exam Server — Tauri Core
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::ShellExt;

struct SidecarState(Arc<Mutex<String>>);

#[tauri::command]
fn get_lan_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}

#[tauri::command]
fn get_sidecar_status(state: tauri::State<'_, SidecarState>) -> String {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
async fn call_sidecar(
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:4000{}", path);

    let mut request = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    if let Some(b) = body {
        request = request.json(&b);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Failed to send request to sidecar: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Failed to read sidecar response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Sidecar returned error {}: {}", status, text));
    }

    // Try to parse as JSON, if it fails, return the text as a JSON string
    match serde_json::from_str(&text) {
        Ok(json) => Ok(json),
        Err(_) => Ok(serde_json::Value::String(text)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar_status = Arc::new(Mutex::new("starting".to_string()));
    let status_for_setup = sidecar_status.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(sidecar_status))
        .setup(move |app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                spawn_sidecar_and_notify(handle, status_for_setup);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_sidecar_status, call_sidecar, get_lan_ip])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn spawn_sidecar_and_notify<R: Runtime>(app: AppHandle<R>, status_lock: Arc<Mutex<String>>) {
    // In Tauri, the sidecar name is defined in tauri.conf.json.
    // Tauri automatically handles the -x86_64-pc-windows-msvc suffix.
    let sidecar_name = "sidecar";

    #[cfg(debug_assertions)]
    let sidecar = app.shell().sidecar(sidecar_name).unwrap()
        .args(["server.ts"]) // in dev, we might still want to pass args? 
        // Note: sidecar() usually targets the compiled binary even in dev.
        // For dev, if we want npx tsx, we handle it differently or just use the compiled one.
        .current_dir("../sidecar");

    #[cfg(not(debug_assertions))]
    let sidecar = {
        let binding_path = app.path().resource_dir().unwrap().join("resources/better_sqlite3.node");
        let binding_arg = format!("--binding-path={}", binding_path.to_string_lossy());
        
        println!("[Sidecar] RELEASE: Using binding arg: {}", binding_arg);
        
        app.shell().sidecar(sidecar_name).unwrap()
            .args([&binding_arg])
    };

    let (mut _rx, _child) = match sidecar.spawn() {
        Ok(res) => res,
        Err(e) => {
            let err_msg = format!("error: failed to spawn sidecar: {}", e);
            eprintln!("{}", err_msg);
            *status_lock.lock().unwrap() = err_msg.clone();
            let _ = app.emit("sidecar-status", err_msg);
            return;
        }
    };

    // Poll port 4000
    for attempt in 1..=20 {
        std::thread::sleep(Duration::from_millis(500));
        if std::net::TcpStream::connect("127.0.0.1:4000").is_ok() {
            println!("[Sidecar] Ready on port 4000 (attempt {attempt})");
            *status_lock.lock().unwrap() = "ready".to_string();
            let _ = app.emit("sidecar-status", "ready");
            return;
        }
    }

    let err_msg = "error: timed out waiting for sidecar".to_string();
    *status_lock.lock().unwrap() = err_msg.clone();
    let _ = app.emit("sidecar-status", err_msg);
}
