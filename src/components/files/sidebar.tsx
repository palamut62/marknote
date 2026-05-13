import { useCallback, useEffect, useRef } from "react";
import { Copy, FolderOpen, X } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { basename } from "@/lib";
import emptyTowerUrl from "@/assets/mascot/empty-m.png";
import { FileTree } from "./file-tree";

type SidebarProps = {
  open: boolean;
  rootPath: string | null;
  activePath: string | null;
  selectedPaths: ReadonlySet<string>;
  width: number;
  onWidthChange: (next: number) => void;
  onOpenFolder: () => void;
  onSelectFile: (path: string) => void;
  onToggleSelection: (path: string) => void;
  onClearSelection: () => void;
  onCopyBundle: () => void;
};

const MIN_WIDTH = 180;
const MAX_WIDTH = 420;

export function Sidebar({
  open,
  rootPath,
  activePath,
  selectedPaths,
  width,
  onWidthChange,
  onOpenFolder,
  onSelectFile,
  onToggleSelection,
  onClearSelection,
  onCopyBundle,
}: SidebarProps) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      onWidthChange(next);
    },
    [onWidthChange],
  );

  const stopResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
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

  const selectedCount = selectedPaths.size;

  return (
    <aside
      className={`mdv-sidebar${open ? " is-open" : ""}`}
      style={{ width: open ? `${width}px` : "0px" }}
      aria-hidden={!open}
    >
      <div className="mdv-sidebar__inner" style={{ width: `${width}px` }}>
        <header className="mdv-sidebar__header">
          <span className="mdv-sidebar__title">
            {rootPath ? basename(rootPath) : "no folder"}
          </span>
          <Button
            title="open folder (⌘⇧O)"
            aria-label="open folder"
            onClick={onOpenFolder}
            icon={<Icon icon={FolderOpen} size={13} strokeWidth={1.5} />}
          />
        </header>
        <div className="mdv-sidebar__body">
          {rootPath ? (
            <FileTree
              rootPath={rootPath}
              activePath={activePath}
              selectedPaths={selectedPaths}
              onSelect={onSelectFile}
              onToggleSelection={onToggleSelection}
            />
          ) : (
            <button type="button" className="mdv-sidebar__empty" onClick={onOpenFolder}>
              <img
                src={emptyTowerUrl}
                alt=""
                aria-hidden
                width={72}
                height={68}
                draggable={false}
                className="mdv-sidebar__empty-art"
              />
              <span>open a folder</span>
              <span className="mdv-sidebar__hint">browse your markdown notes</span>
            </button>
          )}
        </div>
        {selectedCount > 0 ? (
          <footer className="mdv-sidebar__bundle">
            <div className="mdv-sidebar__bundle-info">
              <span className="mdv-sidebar__bundle-count">{selectedCount}</span>
              <span className="mdv-sidebar__bundle-label">
                {selectedCount === 1 ? "file selected" : "files selected"}
              </span>
            </div>
            <div className="mdv-sidebar__bundle-actions">
              <Button
                title="copy bundle to clipboard (⌘⇧C)"
                aria-label="copy bundle"
                onClick={onCopyBundle}
                icon={<Icon icon={Copy} size={12} strokeWidth={1.5} />}
              />
              <Button
                title="clear selection"
                aria-label="clear selection"
                onClick={onClearSelection}
                icon={<Icon icon={X} size={12} strokeWidth={1.5} />}
              />
            </div>
          </footer>
        ) : null}
      </div>

      <div
        className="mdv-sidebar__resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="resize sidebar"
      />
    </aside>
  );
}
