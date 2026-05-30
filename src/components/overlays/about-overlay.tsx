import { useEffect, useState } from "react";
import { Download, Globe, Star, X } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button, Icon, Overlay } from "@/components/primitives";
import logoUrl from "@/assets/brand/marka-app-icon.png";

type AboutOverlayProps = {
  open: boolean;
  onClose: () => void;
  onCheckForUpdates?: () => void | Promise<void>;
};

const REPO_URL = "https://github.com/palamut62/marknote";
const SITE_URL = "https://github.com/palamut62/marknote";
const AUTHOR_PERSONAL_URL = "https://github.com/palamut62";

let cachedVersion: string | null = null;

export function AboutOverlay({ open, onClose, onCheckForUpdates }: AboutOverlayProps) {
  const [checking, setChecking] = useState(false);
  const handleCheck = async () => {
    if (!onCheckForUpdates || checking) return;
    setChecking(true);
    try {
      await onCheckForUpdates();
    } finally {
      setChecking(false);
    }
  };

  const [version, setVersion] = useState<string | null>(cachedVersion);

  useEffect(() => {
    if (!open || cachedVersion) return;
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (cancelled) return;
        cachedVersion = v;
        setVersion(v);
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
      console.error("marknote: openUrl failed", err);
    }
  };

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="about marknote" variant="modal">
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
          src={logoUrl}
          alt=""
          aria-hidden
          width={88}
          height={88}
          loading="eager"
          draggable={false}
          className="mdv-about__art"
        />
        <div className="mdv-about__brand">marknote</div>
        <div className="mdv-about__version">
          <span className="mdv-about__version-num">{version ? `v${version}` : "v…"}</span>
          <span className="mdv-about__dot" aria-hidden> · </span>
          <span>MIT</span>
        </div>
        {onCheckForUpdates ? (
          <button
            type="button"
            className="mdv-about__check"
            onClick={() => void handleCheck()}
            disabled={checking}
          >
            <Icon icon={Download} size={12} strokeWidth={1.5} />
            {checking ? "checking…" : "check for updates"}
          </button>
        ) : null}
        <p className="mdv-about__tagline">
          a local markdown editor, built for the notes you share with ai.
        </p>

        <div className="mdv-about__links">
          <button
            type="button"
            className="mdv-about__link mdv-about__link--star"
            onClick={() => void handleOpen(REPO_URL)}
          >
            <Icon icon={Star} size={13} strokeWidth={1.5} />
            star on github
          </button>
          <button
            type="button"
            className="mdv-about__link"
            onClick={() => void handleOpen(SITE_URL)}
          >
            <Icon icon={Globe} size={13} strokeWidth={1.5} />
            github.com/palamut62/marknote
          </button>
        </div>
      </div>

      <footer className="mdv-about__footer">
        <button
          type="button"
          className="mdv-about__footer-link"
          onClick={() => void handleOpen(AUTHOR_PERSONAL_URL)}
        >
          github.com/palamut62
        </button>
      </footer>
    </Overlay>
  );
}
