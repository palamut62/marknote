import { useRef, useState } from "react";
import {
  Check,
  Coffee,
  Leaf,
  Monitor,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button, Icon, Popover } from "@/components/primitives";
import { useThemeMode, useTransparency, type ThemeMode } from "@/lib";
import { Logo } from "./logo";

type TitleBarProps = {
  fileName?: string;
  dirty?: boolean;
};

type ThemeChoice = { value: ThemeMode; label: string; icon: typeof Sun };

const THEME_CHOICES: ThemeChoice[] = [
  { value: "system", label: "system", icon: Monitor },
  { value: "latte", label: "latte", icon: Sun },
  { value: "matcha", label: "matcha", icon: Leaf },
  { value: "frappe", label: "frappé", icon: Coffee },
  { value: "macchiato", label: "macchiato", icon: Coffee },
  { value: "mocha", label: "mocha", icon: Moon },
];

export function TitleBar({ fileName, dirty = false }: TitleBarProps) {
  const { mode, resolved, setMode } = useThemeMode();
  const { on: transparent, set: setTransparent } = useTransparency();
  const [menuOpen, setMenuOpen] = useState(false);
  const themeAnchorRef = useRef<HTMLDivElement>(null);

  const ActiveIcon =
    mode === "system"
      ? Monitor
      : resolved === "latte"
        ? Sun
        : resolved === "matcha"
          ? Leaf
          : resolved === "mocha"
            ? Moon
            : Coffee;

  return (
    <header className="mdv-titlebar" data-tauri-drag-region>
      <div className="mdv-titlebar__lead" data-tauri-drag-region />

      <div className="mdv-titlebar__brand" data-tauri-drag-region title="marka.md">
        <span data-tauri-drag-region style={{ display: "inline-flex", pointerEvents: "none" }}>
          <Logo size={28} />
        </span>
        {fileName ? (
          <span className="mdv-titlebar__filename" data-tauri-drag-region>
            {fileName}
            {dirty ? <span className="mdv-titlebar__dot" aria-label="unsaved changes" data-tauri-drag-region /> : null}
          </span>
        ) : null}
      </div>

      <div className="mdv-titlebar__actions">
        <div className="mdv-titlebar__theme" ref={themeAnchorRef}>
          <Button
            title="theme & transparency"
            aria-label="theme"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            icon={<Icon icon={ActiveIcon} size={14} strokeWidth={1.5} />}
          />
          <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={themeAnchorRef}>
            <div className="mdv-menu">
              <div className="mdv-menu__label">theme</div>
              {THEME_CHOICES.map((c) => {
                const active = mode === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    className={`mdv-menu__item${active ? " is-active" : ""}`}
                    onClick={() => {
                      setMode(c.value);
                      setMenuOpen(false);
                    }}
                    role="menuitemradio"
                    aria-checked={active}
                  >
                    <span className="mdv-menu__item-icon">
                      <Icon icon={c.icon} size={14} strokeWidth={1.5} />
                    </span>
                    <span className="mdv-menu__item-label">{c.label}</span>
                    {active ? (
                      <span className="mdv-menu__item-check">
                        <Icon icon={Check} size={13} strokeWidth={2} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
              <div className="mdv-menu__divider" aria-hidden />
              <button
                type="button"
                className={`mdv-menu__item${transparent ? " is-active" : ""}`}
                onClick={() => setTransparent(!transparent)}
                role="menuitemcheckbox"
                aria-checked={transparent}
              >
                <span className="mdv-menu__item-icon">
                  <Icon icon={Sparkles} size={14} strokeWidth={1.5} />
                </span>
                <span className="mdv-menu__item-label">transparency</span>
                <span className={`mdv-menu__switch${transparent ? " is-on" : ""}`} aria-hidden />
              </button>
            </div>
          </Popover>
        </div>
      </div>
    </header>
  );
}
