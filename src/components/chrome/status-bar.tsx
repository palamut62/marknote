import { CircleHelp, Layers } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { formatTokens } from "@/lib";

type StatusBarProps = {
  fileName?: string;
  words: number;
  minutes: number;
  selectedCount: number;
  tokenEstimate: number;
  onShowHelp: () => void;
};

export function StatusBar({
  fileName,
  words,
  minutes,
  selectedCount,
  tokenEstimate,
  onShowHelp,
}: StatusBarProps) {
  return (
    <footer className="mdv-statusbar" data-tauri-drag-region>
      <div className="mdv-statusbar__group" data-tauri-drag-region>
        <span data-tauri-drag-region>{fileName ?? "untitled"}</span>
        {selectedCount > 0 ? (
          <span className="mdv-statusbar__bundle" title="files queued for ⌘⇧C bundle">
            <Icon icon={Layers} size={11} strokeWidth={1.5} />
            <span>{selectedCount} selected</span>
            <span className="mdv-statusbar__bundle-sep">·</span>
            <span>~{formatTokens(tokenEstimate)} tokens</span>
          </span>
        ) : null}
      </div>
      <div className="mdv-statusbar__group" data-tauri-drag-region>
        <span>
          {words} {words === 1 ? "word" : "words"}
        </span>
        <span>·</span>
        <span>{minutes} min read</span>
        <Button
          className="mdv-statusbar__help"
          title="how to use (⌘/)"
          aria-label="how to use"
          onClick={onShowHelp}
          icon={<Icon icon={CircleHelp} size={12} strokeWidth={1.5} />}
        />
      </div>
    </footer>
  );
}
