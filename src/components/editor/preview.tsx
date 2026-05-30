import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Languages, Loader2, Undo2 } from "lucide-react";
import { Icon } from "@/components/primitives";
import { ensureMarkdownReady, renderMarkdown, useTheme } from "@/lib";
import previewIconUrl from "@/assets/brand/marka-file-icon.png";
import { renderMermaidBlocks } from "@/lib/mermaid";
import { detectSecretsIn, hasSecrets, setSecretsHidden } from "@/lib/secret-mask";

type PreviewProps = {
  source: string;
  /** when set, an icon button appears at the top-right of the preview */
  onTranslate?: () => void;
  /** when set, clicking the icon reverts back to the original source */
  onRevertTranslation?: () => void;
  translating?: boolean;
  /** true → preview is showing translated content; icon flips to revert */
  translated?: boolean;
  /** disabled state for the translate button (e.g. no api key / no model) */
  translateDisabled?: boolean;
  translateTooltip?: string;
  /** when true, detected api keys/tokens render as dots */
  secretsHidden?: boolean;
  onToggleSecrets?: () => void;
};

// hand-written lucide copy + check icons so we don't drag in react-dom/server
const COPY_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const COPY_DEFAULT_HTML = `<span class="mdv-copy__icon mdv-copy__icon--default">${COPY_ICON_SVG}copy</span>`;
const COPY_DONE_HTML = `<span class="mdv-copy__icon mdv-copy__icon--done">${CHECK_ICON_SVG}copied</span>`;

function decorateCodeBlocks(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const blocks = Array.from(root.querySelectorAll("pre.shiki")) as HTMLPreElement[];

  blocks.forEach((pre) => {
    if (pre.parentElement?.classList.contains("mdv-codeblock")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "mdv-codeblock";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mdv-copy";
    btn.setAttribute("aria-label", "copy code");
    btn.innerHTML = `${COPY_DEFAULT_HTML}${COPY_DONE_HTML}`;
    wrapper.appendChild(btn);

    const onClick = async (e: MouseEvent) => {
      e.preventDefault();
      const text = pre.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          // give up
        }
        document.body.removeChild(ta);
      }
      btn.classList.add("is-done");
      window.setTimeout(() => btn.classList.remove("is-done"), 1400);
    };

    btn.addEventListener("click", onClick);
    cleanups.push(() => btn.removeEventListener("click", onClick));
  });

  return () => cleanups.forEach((fn) => fn());
}

export function Preview({
  source,
  onTranslate,
  onRevertTranslation,
  translating = false,
  translated = false,
  translateDisabled = false,
  translateTooltip,
  secretsHidden = true,
  onToggleSecrets,
}: PreviewProps) {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureMarkdownReady().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [html, setHtml] = useState("");

  // renderMarkdown is async (lazy-loads shiki themes + langs on demand).
  // Cancelled flag guards against stale renders on rapid file/theme switches.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void renderMarkdown(source, theme).then((h) => {
      if (!cancelled) setHtml(h);
    });
    return () => {
      cancelled = true;
    };
  }, [source, theme, ready]);

  // Imperatively set innerHTML — React's dangerouslySetInnerHTML re-applies the
  // string on each parent re-render even when the value is unchanged, which
  // wipes mermaid's post-render DOM mutations (and shiki's decorate-codeblock
  // wrappers). Setting innerHTML in a useEffect that only fires when `html`
  // actually changes preserves mermaid SVGs across save / saveStatus updates.
  useEffect(() => {
    if (!articleRef.current) return;
    articleRef.current.innerHTML = html;
  }, [html]);

  useEffect(() => {
    if (!articleRef.current) return;
    return decorateCodeBlocks(articleRef.current);
  }, [html]);

  useEffect(() => {
    if (!articleRef.current) return;
    const mermaidTheme = theme === "latte" || theme === "matcha" ? "default" : "dark";
    void renderMermaidBlocks(articleRef.current, mermaidTheme);
  }, [html, theme]);

  // detect api keys/tokens after render, then apply current visibility
  const [secretsPresent, setSecretsPresent] = useState(false);

  useEffect(() => {
    if (!articleRef.current) return;
    detectSecretsIn(articleRef.current);
    setSecretsHidden(articleRef.current, secretsHidden);
    setSecretsPresent(hasSecrets(articleRef.current));
  }, [html, secretsHidden]);

  const secretsBtn = secretsPresent && onToggleSecrets ? (
    <button
      type="button"
      className={`mdv-preview__secrets${secretsHidden ? "" : " is-revealed"}`}
      data-tooltip={secretsHidden ? "show api keys / tokens" : "hide api keys / tokens"}
      aria-label={secretsHidden ? "show secrets" : "hide secrets"}
      aria-pressed={!secretsHidden}
      onClick={onToggleSecrets}
    >
      <Icon icon={secretsHidden ? EyeOff : Eye} size={13} strokeWidth={1.6} />
    </button>
  ) : null;

  const translateBtn = onTranslate ? (
    <button
      type="button"
      className={`mdv-preview__translate${translated ? " is-translated" : ""}${translating ? " is-busy" : ""}`}
      data-tooltip={
        translateTooltip ??
        (translated ? "show original" : translating ? "translating…" : "translate preview")
      }
      aria-label={translated ? "show original" : "translate preview"}
      onClick={translated && onRevertTranslation ? onRevertTranslation : onTranslate}
      disabled={translateDisabled || translating}
    >
      <Icon
        icon={translating ? Loader2 : translated ? Undo2 : Languages}
        size={13}
        strokeWidth={1.6}
      />
    </button>
  ) : null;

  if (source.trim().length === 0) {
    return (
      <div className="mdv-preview" data-theme={theme}>
        {secretsBtn}
        {translateBtn}
        <div className="mdv-preview__empty">
          <img
            src={previewIconUrl}
            alt=""
            aria-hidden
            width={120}
            height={120}
            draggable={false}
            className="mdv-preview__empty-art"
          />
          <span className="mdv-preview__empty-title">nothing to preview</span>
          <span className="mdv-preview__empty-hint">start typing on the left</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mdv-preview" data-theme={theme}>
      {secretsBtn}
      {translateBtn}
      <article
        ref={articleRef}
        className="mdv-prose"
        data-theme={theme}
      />
    </div>
  );
}
