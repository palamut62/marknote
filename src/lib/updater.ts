import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Master kill-switch for the auto-updater.
 *
 * Set to `true` ONLY after you have:
 *   1) configured your own endpoint(s) in src-tauri/tauri.conf.json (plugins.updater.endpoints)
 *   2) generated a minisign keypair and pasted the public key into plugins.updater.pubkey
 *   3) set plugins.updater.active = true in the same config
 *   4) set bundle.createUpdaterArtifacts = true so `tauri build` produces signed update bundles
 *
 * While this is `false`, both `checkForUpdate` and `applyUpdate` short-circuit:
 * no network requests, no errors, no toasts. Settings/About "check for updates"
 * actions become no-ops that report "up to date".
 */
export const UPDATES_ENABLED = false;

export type UpdateCheckResult =
  | { status: "available"; version: string; notes?: string; date?: string }
  | { status: "none" }
  | { status: "error"; message: string };

/** Checks the configured endpoint via Tauri updater; idempotent. No-op when disabled. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!UPDATES_ENABLED) return { status: "none" };
  try {
    const update = await check();
    if (!update) return { status: "none" };
    return {
      status: "available",
      version: update.version,
      notes: update.body ?? undefined,
      date: update.date ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Tauri reports "could not fetch a valid release JSON" when no
    // signed latest.json exists yet at the endpoint — treat that as
    // "no update available" rather than an error.
    if (/release json|release not found|no release|404/i.test(msg)) {
      return { status: "none" };
    }
    return { status: "error", message: msg };
  }
}

/** Throws on signature mismatch; relaunches on success. No-op when disabled. */
export async function applyUpdate(
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  if (!UPDATES_ENABLED) {
    throw new Error("auto-update is disabled");
  }
  const update: Update | null = await check();
  if (!update) {
    throw new Error("no update available");
  }
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      downloaded = 0;
      total = event.data.contentLength ?? 0;
      onProgress?.(0, total);
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.(downloaded, total);
    }
  });
  await relaunch();
}
