import { useEffect } from 'react';

/**
 * Custom hook to request notification permissions for both Web and Tauri.
 * Requests browser Notification API and Tauri Notification Plugin permissions.
 */
export function useNotificationPermission() {
  useEffect(() => {
    const requestPermission = async () => {
      // 1. Browser Notification API (Mobile/Desktop Web)
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          // Note: On some mobile browsers (like iOS Safari), this must be triggered by a user gesture.
          // However, for Tauri and many Android browsers, this automatic request works.
          await Notification.requestPermission();
        } catch (err) {
          console.error('Browser Notification permission request failed:', err);
        }
      }

      // 2. Tauri Notification Plugin (Tauri App)
      // window.__TAURI_INTERNALS__ is a reliable way to check if running inside a Tauri shell
      if (window.__TAURI_INTERNALS__) {
        try {
          // Dynamic import to avoid bundling issues if plugin is missing or on non-tauri envs
          const { isPermissionGranted, requestPermission: tauriRequestPermission } = await import(/* @vite-ignore */ '@tauri-apps/plugin-notification');
          
          const granted = await isPermissionGranted();
          if (!granted) {
            const permission = await tauriRequestPermission();
            console.log('Tauri notification permission:', permission);
          }
        } catch (err) {
          // This will fail if @tauri-apps/plugin-notification is not installed/configured, which is safe to ignore here
          console.warn('Tauri notification plugin not found or failed to initialize:', err);
        }
      }
    };

    requestPermission();
  }, []);
}
