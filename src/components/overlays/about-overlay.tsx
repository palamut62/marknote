import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button, Icon, Overlay } from "@/components/primitives";
import mascotUrl from "@/assets/mascot/excite.png";

type AboutOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const REPO_URL = "https://github.com/mattenarle10/markamd";
const SITE_URL = "https://markamd.vercel.app";

export function AboutOverlay({ open, onClose }: AboutOverlayProps) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        if (!cancelled) setVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleOpen = async (url: string) => {
    try {
      await openUrl(url);
    } catch (err) {
      console.error("marka.md: openUrl failed", err);
    }
  };

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="about marka.md" variant="modal">
      <header className="mdv-about__header">
        <span className="mdv-about__eyebrow">about</span>
        <Button
          title="close (esc)"
          aria-label="close"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-about__body">
        <img
          src={mascotUrl}
          alt=""
          aria-hidden
          width={88}
          height={88}
          draggable={false}
          className="mdv-about__art"
        />
        <div className="mdv-about__brand">marka.md</div>
        <div className="mdv-about__version">
          {version ? `v${version}` : "…"}
          <span className="mdv-about__dot" aria-hidden> · </span>
          MIT
        </div>
        <p className="mdv-about__tagline">
          a local markdown editor, built for the notes you share with ai.
        </p>

        <div className="mdv-about__links">
          <button
            type="button"
            className="mdv-about__link"
            onClick={() => void handleOpen(REPO_URL)}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-2.03c-3.2.69-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.95 10.95 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
            </svg>
            github
          </button>
          <button
            type="button"
            className="mdv-about__link"
            onClick={() => void handleOpen(SITE_URL)}
          >
            <Icon icon={Heart} size={13} strokeWidth={1.5} />
            markamd.vercel.app
          </button>
        </div>
      </div>

      <footer className="mdv-about__footer">
        <span>made with care · enarlem10</span>
      </footer>
    </Overlay>
  );
}
