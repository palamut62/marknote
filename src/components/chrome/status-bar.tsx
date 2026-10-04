import { CircleHelp, Lock } from "lucide-react";
import { Icon } from "@/components/primitives";
import { shortcutLabel, startWindowDrag } from "@/lib";

export type VimMode = "normal" | "insert" | "visual" | "replace";

type StatusBarProps = {
  fileName?: string;
  words: number;
  minutes: number;
  /** kept for callers that compute it; only shown through `tokensLabel` */
  docTokens: number;
  /** technical counter (advanced setting); null hides it */
  tokensLabel?: string | null;
  onShowHelp: () => void;
  onShowAbout: () => void;
  /** when set, renders a vim-mode pill (markdown view only) */
  vimMode?: VimMode | null;
};

export function StatusBar({ fileName, words, minutes, tokensLabel, onShowHelp, onShowAbout, vimMode }: StatusBarProps) {
  return (
    <footer className="mdv-statusbar" data-tauri-drag-region onMouseDown={startWindowDrag}>
      <div className="mdv-statusbar__group" data-tauri-drag-region>
        <span className="mdv-statusbar__local" title="Notlar yalnız bu bilgisayardaki dosyalarda durur">
          <Icon icon={Lock} size={12} /> Yerel notlar
        </span>
        {vimMode ? <span className={`mdv-vim-pill mdv-vim-pill--${vimMode}`}>{vimMode.toUpperCase()}</span> : null}
      </div>
      <div className="mdv-statusbar__group mdv-statusbar__center" data-tauri-drag-region>
        <span>{fileName ?? "Yeni not"}</span>
        <span aria-hidden>·</span>
        <span>{words.toLocaleString("tr-TR")} kelime</span>
        <span aria-hidden>·</span>
        <span>{minutes} dk okuma</span>
        {tokensLabel ? (
          <>
            <span aria-hidden>·</span>
            <span>{tokensLabel}</span>
          </>
        ) : null}
      </div>
      <div className="mdv-statusbar__group">
        <button type="button" className="mdv-statusbar__link" onClick={onShowHelp} data-tooltip={shortcutLabel("Yardım ve kısayollar (⌘/)")}>
          <Icon icon={CircleHelp} size={12} /> Yardım
        </button>
        <button type="button" className="mdv-statusbar__link" onClick={onShowAbout}>Hakkında</button>
      </div>
    </footer>
  );
}
