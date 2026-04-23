/**
 * Utility to send native notifications via Browser API or Tauri Plugin.
 * @param {string} title - The notification title.
 * @param {string} body - The notification message body.
 */
export async function sendNativeNotification(title, body) {
  // 1. Try Tauri Notification Plugin first if running in Tauri
  if (window.__TAURI_INTERNALS__) {
    try {
      const { isPermissionGranted, sendNotification } = await import(/* @vite-ignore */ '@tauri-apps/plugin-notification');
      
      if (await isPermissionGranted()) {
        sendNotification({ title, body });
        return;
      }
    } catch (err) {
      console.warn('Tauri notification send failed, falling back to browser API:', err);
    }
  }

  // 2. Fallback to Browser Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch (err) {
      console.error('Browser Notification failed:', err);
    }
  }
}
