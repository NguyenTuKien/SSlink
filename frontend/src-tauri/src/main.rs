// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use bluer::{adv::Advertisement, Uuid, Session};
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::State;
use tokio::sync::oneshot;

// Tauri State lưu trữ Sender để cancel BLE advertising task đang chạy.
struct BleAdvertisingState(Mutex<Option<oneshot::Sender<()>>>);

/// Bắt đầu phát BLE với UUID cho trước.
/// Nếu đang có session cũ, tự động dừng trước khi bắt đầu session mới.
#[tauri::command]
async fn start_ble_advertising(
    uuid: String,
    state: State<'_, BleAdvertisingState>,
) -> Result<(), String> {
    // Dừng session BLE cũ nếu đang chạy
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(sender) = guard.take() {
            let _ = sender.send(());
        }
    }

    let session = Session::new().await.map_err(|e| e.to_string())?;
    let adapter = session
        .default_adapter()
        .await
        .map_err(|e| e.to_string())?;
    adapter
        .set_powered(true)
        .await
        .map_err(|e| e.to_string())?;

    let le_uuid: Uuid = uuid.parse().map_err(|_| "UUID không hợp lệ".to_string())?;
    let mut service_uuids = HashSet::new();
    service_uuids.insert(le_uuid);

    let adv = Advertisement {
        service_uuids,
        discoverable: Some(true),
        local_name: Some("PTIT_Teacher_PC".to_string()),
        ..Default::default()
    };

    // Bắt đầu advertising — handle phải được giữ sống
    let _adv_handle = adapter.advertise(adv).await.map_err(|e| e.to_string())?;

    println!("✅ Bắt đầu phát BLE với UUID: {}", uuid);

    // Tạo oneshot channel để có thể cancel từ stop_ble_advertising
    let (tx, rx) = oneshot::channel::<()>();
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        *guard = Some(tx);
    }

    // Giữ advertising handle sống cho đến khi nhận tín hiệu cancel
    // hoặc tự động dừng sau 30 phút (safety timeout)
    tokio::select! {
        _ = rx => {
            println!("🛑 BLE advertising bị dừng theo lệnh.");
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(1800)) => {
            println!("⏱️ BLE advertising tự động dừng sau 30 phút.");
        }
    }

    // _adv_handle bị drop ở đây → advertising dừng
    Ok(())
}

/// Dừng BLE advertising đang chạy (nếu có).
#[tauri::command]
async fn stop_ble_advertising(state: State<'_, BleAdvertisingState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = guard.take() {
        let _ = sender.send(());
        println!("🛑 Đã gửi tín hiệu dừng BLE advertising.");
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(BleAdvertisingState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_ble_advertising,
            stop_ble_advertising
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}