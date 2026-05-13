import { X } from "lucide-react";
import { Button, Icon, Kbd, Overlay } from "@/components/primitives";
import writeUrl from "@/assets/mascot/write.png";

type HelpOverlayProps = {
  open: boolean;
  onClose: () => void;
};

type Row = { keys: string[]; label: string };

const SHORTCUTS: Row[] = [
  { keys: ["⌘", "K"], label: "open command palette" },
  { keys: ["⌘", "N"], label: "new file (untitled buffer)" },
  { keys: ["⌘", "O"], label: "open a .md file" },
  { keys: ["⌘", "⇧", "O"], label: "open a folder in the sidebar" },
  { keys: ["⌘", "S"], label: "save the current file" },
  { keys: ["⌘", "B"], label: "show / hide the sidebar" },
  { keys: ["⌘", "/"], label: "open this help" },
  { keys: ["esc"], label: "close any popup / overlay" },
];

const TIPS = [
  "drag the divider between editor and preview to resize. ratio is remembered.",
  "drag the right edge of the sidebar to resize it (180–420 px).",
  "open a folder, click any .md to load it. edits stay in memory until you press ⌘S.",
  "theme menu (sun/moon/leaf icon) has 5 themes + transparency toggle.",
  "code blocks have a hover-to-show copy button.",
];

export function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  return (
    <Overlay open={open} onClose={onClose} ariaLabel="how to use marka.md" variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title">
          <img
            src={writeUrl}
            alt=""
            aria-hidden
            width={36}
            height={36}
            draggable={false}
            className="mdv-help__art"
          />
          <span className="mdv-help__brand">marka.md</span>
          <span className="mdv-help__subtitle">how to use</span>
        </div>
        <Button
          title="close (esc)"
          aria-label="close"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-help__body">
        <section className="mdv-help__section">
          <h3 className="mdv-help__h">keyboard shortcuts</h3>
          <ul className="mdv-help__list">
            {SHORTCUTS.map((s) => (
              <li key={s.label} className="mdv-help__row">
                <span className="mdv-help__keys">
                  {s.keys.map((k, i) => (
                    <Kbd key={`${s.label}-${i}`}>{k}</Kbd>
                  ))}
                </span>
                <span className="mdv-help__label">{s.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mdv-help__section">
          <h3 className="mdv-help__h">tips</h3>
          <ul className="mdv-help__tips">
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mdv-help__footer">
        <span>marka.md · open source · MIT · github.com/mattenarle10/mdview</span>
      </footer>
    </Overlay>
  );
}
