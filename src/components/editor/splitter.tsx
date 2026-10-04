import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePersistedState } from "@/hooks";
import { STORAGE_KEYS } from "@/lib/storage";

type SplitterProps = {
  left: ReactNode;
  right: ReactNode;
  /**
   * which panes are visible. Hidden panes stay mounted (display: none) so
   * switching views never destroys an editor instance or its selection (F02).
   */
  show?: "both" | "left" | "right";
  storageKey?: string;
  minRatio?: number;
  maxRatio?: number;
  defaultRatio?: number;
};

export function Splitter({
  left,
  right,
  show = "both",
  storageKey = STORAGE_KEYS.splitterRatio,
  minRatio = 0.2,
  maxRatio = 0.8,
  defaultRatio = 0.5,
}: SplitterProps) {
  const [ratio, setRatio] = usePersistedState<number>(storageKey, defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = (e.clientX - rect.left) / rect.width;
      const clamped = Math.min(maxRatio, Math.max(minRatio, next));
      setRatio(clamped);
    },
    [maxRatio, minRatio, setRatio],
  );

  const stopDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const leftPct = `${ratio * 100}%`;
  const rightPct = `${(1 - ratio) * 100}%`;
  const columns = show === "both" ? `${leftPct} 1px ${rightPct}` : show === "left" ? "1fr 0 0" : "0 0 1fr";

  return (
    <div
      ref={containerRef}
      className={`mdv-splitter mdv-splitter--${show}`}
      style={{ gridTemplateColumns: columns }}
    >
      <div className="mdv-splitter__pane" hidden={show === "right"}>{left}</div>
      <div
        hidden={show !== "both"}
        className="mdv-splitter__handle"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      />
      <div className="mdv-splitter__pane" hidden={show === "left"}>{right}</div>
    </div>
  );
}
