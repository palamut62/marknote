import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

/**
 * Thin wrapper around tauri-plugin-autostart so the rest of the app can
 * import a stable surface without dragging the plugin module into multiple
 * files. Each call talks to the OS:
 *   - Windows: HKCU\Software\Microsoft\Windows\CurrentVersion\Run
 *   - macOS:   LaunchAgent .plist in ~/Library/LaunchAgents
 *   - Linux:   ~/.config/autostart/.desktop entry
 */

export async function getAutostartEnabled(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch (err) {
    console.error("marknote: autostart isEnabled failed", err);
    return false;
  }
}

export async function setAutostartEnabled(next: boolean): Promise<boolean> {
  try {
    if (next) {
      await enable();
    } else {
      await disable();
    }
    return await isEnabled();
  } catch (err) {
    console.error("marknote: autostart toggle failed", err);
    throw err;
  }
}
