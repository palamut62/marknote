import { Check, ChevronRight, Copy, Eye, EyeOff, FilePlus2, FileText, FolderOpen, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Save, ScanText, Sparkles, WandSparkles } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { shortcutLabel, startWindowDrag } from "@/lib";
import savedIconUrl from "@/assets/brand/marka-ai-icon.png";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved";

type BreadcrumbProps = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  rootPath: string | null;
  activePath: string | null;
  saveStatus: SaveStatus;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onCopyMarkdown?: () => void;
  copyPulse?: boolean;
  onCorrectMarkdown?: () => void;
  correcting?: boolean;
  correctDisabled?: boolean;
  correctTooltip?: string;
  onPromptifyMarkdown?: () => void;
  promptifying?: boolean;
  promptifyDisabled?: boolean;
  promptifyTooltip?: string;
  aiSelectionAvailable?: boolean;
  aiSelectionActive?: boolean;
  aiSelectionLabel?: string;
  onToggleAiSelection?: () => void;
  onSave?: () => void;
  /** disable save button when there's nothing to write (clean buffer with a path) */
  saveDisabled?: boolean;
  /** click a folder segment in the path → switch sidebar root to that folder */
  onNavigateToFolder?: (path: string) => void;
  /** pane visibility — when both are true the splitter is shown */
  editorVisible?: boolean;
  previewVisible?: boolean;
  onToggleEditor?: () => void;
  onTogglePreview?: () => void;
  /** global secret-mask toggle — visible when the document contains detectable api keys/tokens */
  secretsPresent?: boolean;
  secretsHidden?: boolean;
  onToggleSecrets?: () => void;
};

const MAX_SEGMENTS = 4;

type Segment = {
  label: string;
  /** full filesystem path up to and including this segment; null for the "…" truncation marker */
  fullPath: string | null;
  /** false when this is the leaf file (last seg of an activePath) — not navigable as a folder */
  isDir: boolean;
};

function pathSegments(path: string, hasLeafFile: boolean): Segment[] {
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(/[\\/]/).filter(Boolean);
  // windows drive root ("C:") needs the separator restored when rejoining
  const prefix = /^[a-zA-Z]:$/.test(parts[0] ?? "") ? "" : sep;

  const fullFor = (i: number) => prefix + parts.slice(0, i + 1).join(sep);

  const segs: Segment[] = parts.map((label, i) => ({
    label,
    fullPath: fullFor(i),
    isDir: !(hasLeafFile && i === parts.length - 1),
  }));

  if (segs.length <= MAX_SEGMENTS) return segs;
  return [{ label: "…", fullPath: null, isDir: false }, ...segs.slice(-MAX_SEGMENTS)];
}

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "saving…";
    case "dirty":
      return "unsaved";
    case "saved":
      return "saved";
    default:
      return "";
  }
}

export function Breadcrumb({
  sidebarOpen,
  onToggleSidebar,
  rootPath,
  activePath,
  saveStatus,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onCopyMarkdown,
  copyPulse = false,
  onCorrectMarkdown,
  correcting = false,
  correctDisabled = false,
  correctTooltip,
  onPromptifyMarkdown,
  promptifying = false,
  promptifyDisabled = false,
  promptifyTooltip,
  aiSelectionAvailable = false,
  aiSelectionActive = false,
  aiSelectionLabel,
  onToggleAiSelection,
  onSave,
  saveDisabled = false,
  onNavigateToFolder,
  editorVisible = true,
  previewVisible = true,
  onToggleEditor,
  onTogglePreview,
  secretsPresent = false,
  secretsHidden = true,
  onToggleSecrets,
}: BreadcrumbProps) {
  const path = activePath ?? rootPath;
  const segments = path ? pathSegments(path, activePath != null) : [];
  const label = statusLabel(saveStatus);

  return (
    <div className="mdv-breadcrumb" data-tauri-drag-region onMouseDown={startWindowDrag}>
      <Button
        data-tooltip={shortcutLabel(sidebarOpen ? "hide sidebar (⌘B)" : "show sidebar (⌘B)")}
        aria-label={sidebarOpen ? "hide sidebar" : "show sidebar"}
        onClick={onToggleSidebar}
        icon={
          <Icon
            icon={sidebarOpen ? PanelLeftClose : PanelLeftOpen}
            size={14}
            strokeWidth={1.5}
          />
        }
      />

      <nav className="mdv-breadcrumb__path" aria-label="path" data-tauri-drag-region>
        {segments.length === 0 ? (
          <span className="mdv-breadcrumb__placeholder">no file open</span>
        ) : (
          segments.map((seg, i) => {
            const isLeaf = i === segments.length - 1;
            const canNav = seg.isDir && seg.fullPath != null && !!onNavigateToFolder && !isLeaf;
            return (
              <span key={`${seg.label}-${i}`} className="mdv-breadcrumb__seg-row">
                {i > 0 ? (
                  <Icon
                    icon={ChevronRight}
                    size={11}
                    strokeWidth={1.5}
                    title="separator"
                  />
                ) : null}
                {canNav ? (
                  <button
                    type="button"
                    className="mdv-breadcrumb__seg mdv-breadcrumb__seg--nav"
                    onClick={() => onNavigateToFolder!(seg.fullPath!)}
                    data-tooltip={`open ${seg.label}`}
                  >
                    {seg.label}
                  </button>
                ) : (
                  <span className={`mdv-breadcrumb__seg${isLeaf ? " is-leaf" : ""}`}>
                    {seg.label}
                  </span>
                )}
              </span>
            );
          })
        )}
      </nav>

      <div className="mdv-breadcrumb__status" data-status={saveStatus}>
        {saveStatus !== "idle" ? (
          <>
            {saveStatus === "saved" ? (
              <img
                src={savedIconUrl}
                alt=""
                aria-hidden
                width={16}
                height={16}
                draggable={false}
                className="mdv-breadcrumb__excite"
              />
            ) : (
              <span className="mdv-breadcrumb__dot" aria-hidden />
            )}
            <span className="mdv-breadcrumb__status-label">{label}</span>
          </>
        ) : null}
      </div>

      <div className="mdv-breadcrumb__actions" data-tauri-drag-region>
        {onCopyMarkdown ? (
          <button
            type="button"
            className={`mdv-copybtn${copyPulse ? " is-copied" : ""}`}
            data-tooltip={copyPulse ? "copied!" : shortcutLabel("copy markdown (⌘⇧C)")}
            aria-label={copyPulse ? "copied" : "copy markdown"}
            onClick={onCopyMarkdown}
          >
            <span className="mdv-copybtn__icon mdv-copybtn__icon--copy" aria-hidden>
              <Icon icon={Copy} size={12} strokeWidth={1.5} />
            </span>
            <span className="mdv-copybtn__icon mdv-copybtn__icon--check" aria-hidden>
              <Icon icon={Check} size={13} strokeWidth={2} />
            </span>
          </button>
        ) : null}
        {aiSelectionAvailable && onToggleAiSelection ? (
          <button
            type="button"
            className={`mdv-ai-scope${aiSelectionActive ? " is-active" : ""}`}
            data-tooltip={
              aiSelectionActive
                ? `ai applies to selected text${aiSelectionLabel ? ` · ${aiSelectionLabel}` : ""}`
                : "ai applies to the whole file"
            }
            aria-label={aiSelectionActive ? "ai scope selected text" : "ai scope whole file"}
            aria-pressed={aiSelectionActive}
            onClick={onToggleAiSelection}
          >
            <Icon icon={ScanText} size={12} strokeWidth={1.5} />
            <span className="mdv-ai-scope__label">selection</span>
          </button>
        ) : null}
        {onCorrectMarkdown ? (
          <Button
            data-tooltip={correctTooltip ?? (correcting ? "correcting..." : "correct spelling and grammar with ai")}
            aria-label="correct spelling and grammar"
            onClick={onCorrectMarkdown}
            disabled={correctDisabled || correcting}
            icon={
              <Icon
                icon={correcting ? Loader2 : Sparkles}
                size={13}
                strokeWidth={1.5}
              />
            }
          />
        ) : null}
        {onPromptifyMarkdown ? (
          <Button
            data-tooltip={promptifyTooltip ?? (promptifying ? "turning into prompt..." : "turn markdown into an ai prompt")}
            aria-label="turn markdown into prompt"
            onClick={onPromptifyMarkdown}
            disabled={promptifyDisabled || promptifying}
            icon={
              <Icon
                icon={promptifying ? Loader2 : WandSparkles}
                size={13}
                strokeWidth={1.5}
              />
            }
          />
        ) : null}
        {onToggleEditor ? (
          <Button
            data-tooltip={editorVisible ? "hide editor pane" : "show editor pane"}
            aria-label={editorVisible ? "hide editor" : "show editor"}
            aria-pressed={!editorVisible}
            onClick={onToggleEditor}
            // can't hide both panes — disable when this is the only one visible
            disabled={editorVisible && !previewVisible}
            icon={
              <Icon
                icon={editorVisible ? PanelLeftClose : PanelLeftOpen}
                size={13}
                strokeWidth={1.5}
              />
            }
          />
        ) : null}
        {onTogglePreview ? (
          <Button
            data-tooltip={previewVisible ? "hide preview pane" : "show preview pane"}
            aria-label={previewVisible ? "hide preview" : "show preview"}
            aria-pressed={!previewVisible}
            onClick={onTogglePreview}
            disabled={previewVisible && !editorVisible}
            icon={
              <Icon
                icon={previewVisible ? PanelRightClose : PanelRightOpen}
                size={13}
                strokeWidth={1.5}
              />
            }
          />
        ) : null}
        {secretsPresent && onToggleSecrets ? (
          <Button
            data-tooltip={secretsHidden ? "show api keys / tokens" : "hide api keys / tokens"}
            aria-label={secretsHidden ? "show secrets" : "hide secrets"}
            aria-pressed={!secretsHidden}
            onClick={onToggleSecrets}
            icon={<Icon icon={secretsHidden ? EyeOff : Eye} size={13} strokeWidth={1.5} />}
          />
        ) : null}
        {onSave ? (
          <Button
            data-tooltip={shortcutLabel("save (⌘S)")}
            aria-label="save"
            onClick={onSave}
            disabled={saveDisabled}
            icon={<Icon icon={Save} size={13} strokeWidth={1.5} />}
          />
        ) : null}
        <Button
          data-tooltip={shortcutLabel("new file (⌘N)")}
          aria-label="new file"
          onClick={onNewFile}
          icon={<Icon icon={FilePlus2} size={13} strokeWidth={1.5} />}
        />
        <Button
          data-tooltip={shortcutLabel("open file (⌘O)")}
          aria-label="open file"
          onClick={onOpenFile}
          icon={<Icon icon={FileText} size={13} strokeWidth={1.5} />}
        />
        <Button
          data-tooltip={shortcutLabel("open folder (⌘⇧O)")}
          aria-label="open folder"
          onClick={onOpenFolder}
          icon={<Icon icon={FolderOpen} size={13} strokeWidth={1.5} />}
        />
      </div>
    </div>
  );
}
