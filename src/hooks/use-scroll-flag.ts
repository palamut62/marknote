import { useEffect, useRef } from "react";

/**
 * Toggle an `is-scrolling` class on a scroll container during active scroll.
 * Pairs with `.mdv-scroll` CSS to show the scrollbar thumb while scrolling
 * and fade it away after a short idle window — like macOS overlay scrollbars.
 */
export function useScrollFlag<T extends HTMLElement>(idleMs = 800) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: number | undefined;
    const onScroll = () => {
      el.classList.add("is-scrolling");
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.classList.remove("is-scrolling");
      }, idleMs);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer != null) window.clearTimeout(timer);
      el.classList.remove("is-scrolling");
    };
  }, [idleMs]);

  return ref;
}
