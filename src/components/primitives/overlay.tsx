import { useEffect, useRef, type ReactNode } from "react";

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
  /** controls width preset — "palette" = 560px, "modal" = 580px */
  variant?: "palette" | "modal" | "wide" | "dialog";
  /** when false, Escape and backdrop clicks do nothing (decision dialogs) */
  dismissible?: boolean;
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Modal dialog shell: backdrop + centered panel.
 * - focus moves inside on open ([data-autofocus] first, else first control)
 * - Tab / Shift+Tab are trapped inside the panel
 * - focus returns to the previously focused control on close
 * - Escape closes (unless `dismissible` is false); app shortcuts behind the
 *   dialog don't fire because keydown is stopped at the panel.
 */
export function Overlay({ open, onClose, children, ariaLabel, variant = "palette", dismissible = true }: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const id = window.requestAnimationFrame(() => {
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]");
      (preferred ?? focusables(panel)[0] ?? panel).focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      // restore focus to the control that opened the dialog
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (dismissible) onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        const items = focusables(panel);
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = active ? panel.contains(active) : false;
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // capture phase: runs before the app's global shortcut listener
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, dismissible]);

  if (!open) return null;

  return (
    <>
      <div className="mdv-overlay__backdrop" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        className={`mdv-overlay mdv-overlay--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // keep app-level shortcuts (Ctrl+N, Ctrl+K…) from acting behind the dialog
          if (e.ctrlKey || e.metaKey) e.stopPropagation();
        }}
      >
        {children}
      </div>
    </>
  );
}
