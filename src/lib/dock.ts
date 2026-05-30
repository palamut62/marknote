/**
 * Edge-dock mode. The main window is pinned to the chosen screen edge as a
 * thin 24px "tab" strip (always-on-top). Clicking the tab slides it open to
 * ~70% of the screen width. Focus loss collapses it back to the tab. Toggling
 * the mode "off" restores the previously saved window bounds.
 *
 * All positioning is done in logical pixels via @tauri-apps/api/window.
 */

import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";

export type DockMode = "off" | "left" | "right";

export const DOCK_TAB_WIDTH = 18;
export const DOCK_TAB_HEIGHT = 72;
const PANEL_RATIO = 0.78;
const ANIM_MS = 200;

type Bounds = { x: number; y: number; width: number; height: number };
type Screen = { x: number; y: number; width: number; height: number };

let savedBounds: Bounds | null = null;
let animating = false;

function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

async function getScreenBounds(): Promise<Screen> {
  // Prefer the browser-reported work area — it already excludes the OS
  // taskbar/dock, so the expanded window doesn't slide under it (which was
  // hiding the footer/settings row on Windows).
  try {
    const s = window.screen as unknown as Screen & {
      availLeft?: number;
      availTop?: number;
      availWidth?: number;
      availHeight?: number;
    };
    if (s && s.availWidth && s.availHeight) {
      return {
        x: s.availLeft ?? 0,
        y: s.availTop ?? 0,
        width: s.availWidth,
        height: s.availHeight,
      };
    }
  } catch {
    /* fall through to monitor-based fallback */
  }
  const mon = await currentMonitor();
  if (!mon) return { x: 0, y: 0, width: 1920, height: 1080 };
  return {
    x: mon.position.x / mon.scaleFactor,
    y: mon.position.y / mon.scaleFactor,
    width: mon.size.width / mon.scaleFactor,
    height: mon.size.height / mon.scaleFactor,
  };
}

async function snapshotBounds(): Promise<Bounds> {
  const w = getCurrentWindow();
  const [size, pos, scale] = await Promise.all([
    w.outerSize(),
    w.outerPosition(),
    w.scaleFactor(),
  ]);
  return {
    x: pos.x / scale,
    y: pos.y / scale,
    width: size.width / scale,
    height: size.height / scale,
  };
}

async function animateTo(target: Bounds): Promise<void> {
  if (animating) return;
  animating = true;
  const w = getCurrentWindow();
  const start = await snapshotBounds();
  const t0 = performance.now();

  await new Promise<void>((resolve) => {
    const tick = async () => {
      const t = Math.min(1, (performance.now() - t0) / ANIM_MS);
      const e = ease(t);
      const nx = start.x + (target.x - start.x) * e;
      const ny = start.y + (target.y - start.y) * e;
      const nw = start.width + (target.width - start.width) * e;
      const nh = start.height + (target.height - start.height) * e;
      try {
        await w.setSize(new LogicalSize(nw, nh));
        await w.setPosition(new LogicalPosition(nx, ny));
      } catch (err) {
        console.warn("marknote: dock animate frame failed", err);
      }
      if (t < 1) requestAnimationFrame(() => void tick());
      else resolve();
    };
    requestAnimationFrame(() => void tick());
  });

  animating = false;
}

function collapsedBounds(mode: Exclude<DockMode, "off">, screen: Screen): Bounds {
  // small vertically-centered pill — outer edge flush with the screen edge,
  // inner edge rounded outward (handled by CSS border-radius on the rail).
  const y = screen.y + Math.max(0, Math.round((screen.height - DOCK_TAB_HEIGHT) / 2));
  return mode === "left"
    ? { x: screen.x, y, width: DOCK_TAB_WIDTH, height: DOCK_TAB_HEIGHT }
    : { x: screen.x + screen.width - DOCK_TAB_WIDTH, y, width: DOCK_TAB_WIDTH, height: DOCK_TAB_HEIGHT };
}

function expandedBounds(mode: Exclude<DockMode, "off">, screen: Screen): Bounds {
  const w = Math.round(screen.width * PANEL_RATIO);
  return mode === "left"
    ? { x: screen.x, y: screen.y, width: w, height: screen.height }
    : { x: screen.x + screen.width - w, y: screen.y, width: w, height: screen.height };
}

/** Apply a fresh dock mode. Called on settings change. */
export async function applyDockMode(mode: DockMode, opts: { open?: boolean } = {}): Promise<void> {
  const w = getCurrentWindow();
  if (mode === "off") {
    try {
      await w.setAlwaysOnTop(false);
      await w.setDecorations(true);
      await w.setSkipTaskbar(false);
      // restore the config minSize so user can't shrink the window into oblivion
      await w.setMinSize(new LogicalSize(640, 420));
    } catch (err) {
      console.warn("marknote: dock unset failed", err);
    }
    if (savedBounds) {
      const restore = savedBounds;
      await animateTo(restore);
      savedBounds = null;
    }
    return;
  }
  if (!savedBounds) {
    savedBounds = await snapshotBounds();
  }
  try {
    await w.setAlwaysOnTop(true);
    // strip OS chrome — title bar + app-icon would otherwise show in the tab
    await w.setDecorations(false);
    await w.setSkipTaskbar(true);
    // lift the config minSize so we can shrink down to the 18×72 tab
    await w.setMinSize(new LogicalSize(1, 1));
  } catch (err) {
    console.warn("marknote: dock set failed", err);
  }
  const screen = await getScreenBounds();
  await animateTo(
    (opts.open ? expandedBounds : collapsedBounds)(mode, screen),
  );
}

export async function expandDock(mode: Exclude<DockMode, "off">): Promise<void> {
  const w = getCurrentWindow();
  // restore decorations + taskbar entry before growing the window so the
  // expanded panel has proper OS chrome
  try {
    await w.setDecorations(true);
    await w.setSkipTaskbar(false);
  } catch {
    /* ignore */
  }
  const screen = await getScreenBounds();
  await animateTo(expandedBounds(mode, screen));
  try {
    await w.setFocus();
  } catch {
    /* ignore */
  }
  // nudge any ResizeObserver-less layouts (CodeMirror, Splitter) to relayout
  try {
    window.dispatchEvent(new Event("resize"));
  } catch {
    /* ignore */
  }
}

export async function collapseDock(mode: Exclude<DockMode, "off">): Promise<void> {
  const w = getCurrentWindow();
  const screen = await getScreenBounds();
  await animateTo(collapsedBounds(mode, screen));
  // strip decorations + taskbar after shrinking so the tab looks like a pill
  try {
    await w.setDecorations(false);
    await w.setSkipTaskbar(true);
  } catch {
    /* ignore */
  }
}
