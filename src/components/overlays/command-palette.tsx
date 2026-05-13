import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, Overlay } from "@/components/primitives";
import type { Command } from "@/lib/commands";

export type { Command };

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  commands: Command[];
};

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.label} ${c.hint ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) {
          onClose();
          void cmd.action();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, filtered, activeIndex]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="command palette" variant="palette">
      <div className="mdv-palette__search">
        <input
          ref={inputRef}
          className="mdv-palette__input"
          placeholder="type a command…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <ul className="mdv-palette__list" role="listbox" ref={listRef}>
        {filtered.length === 0 ? (
          <li className="mdv-palette__empty">no matches</li>
        ) : (
          filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              data-index={i}
              className={`mdv-palette__item${i === activeIndex ? " is-active" : ""}`}
              onClick={() => {
                onClose();
                void cmd.action();
              }}
              onMouseEnter={() => setActiveIndex(i)}
              role="option"
              aria-selected={i === activeIndex}
            >
              {cmd.icon ? (
                <span className="mdv-palette__icon">
                  <Icon icon={cmd.icon} size={14} strokeWidth={1.5} />
                </span>
              ) : null}
              <span className="mdv-palette__label">
                {cmd.label}
                {cmd.hint ? <span className="mdv-palette__hint"> · {cmd.hint}</span> : null}
              </span>
              {cmd.shortcut ? <Kbd className="mdv-kbd--muted">{cmd.shortcut}</Kbd> : null}
            </li>
          ))
        )}
      </ul>
      <div className="mdv-palette__footer">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
        <span><Kbd>↵</Kbd> run</span>
        <span><Kbd>esc</Kbd> close</span>
      </div>
    </Overlay>
  );
}
