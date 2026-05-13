import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import exciteUrl from "@/assets/mascot/excite.png";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved";

type BreadcrumbProps = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  rootPath: string | null;
  activePath: string | null;
  saveStatus: SaveStatus;
};

const MAX_SEGMENTS = 4;

function pathSegments(path: string): string[] {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= MAX_SEGMENTS) return parts;
  return ["…", ...parts.slice(-MAX_SEGMENTS)];
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
}: BreadcrumbProps) {
  const path = activePath ?? rootPath;
  const segments = path ? pathSegments(path) : [];
  const label = statusLabel(saveStatus);

  return (
    <div className="mdv-breadcrumb">
      <Button
        title={sidebarOpen ? "hide sidebar (⌘B)" : "show sidebar (⌘B)"}
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

      <nav className="mdv-breadcrumb__path" aria-label="path">
        {segments.length === 0 ? (
          <span className="mdv-breadcrumb__placeholder">no file open</span>
        ) : (
          segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="mdv-breadcrumb__seg-row">
              {i > 0 ? (
                <Icon
                  icon={ChevronRight}
                  size={11}
                  strokeWidth={1.5}
                  title="separator"
                />
              ) : null}
              <span
                className={`mdv-breadcrumb__seg${i === segments.length - 1 ? " is-leaf" : ""}`}
              >
                {seg}
              </span>
            </span>
          ))
        )}
      </nav>

      <div className="mdv-breadcrumb__status" data-status={saveStatus}>
        {saveStatus !== "idle" ? (
          <>
            {saveStatus === "saved" ? (
              <img
                src={exciteUrl}
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
    </div>
  );
}
