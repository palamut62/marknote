/**
 * Detects API keys / tokens / secrets in rendered markdown and lets the
 * preview hide them behind dots until the user toggles them visible.
 *
 * Two flavours of match:
 *   1. KEY=value lines (KEY|TOKEN|SECRET|PASSWORD|PWD)
 *   2. Standalone prefixes used by major providers (sk-, sk-ant-, sk-or-v1-,
 *      gsk_, ghp_/gho_/ghu_/ghs_/ghr_, AIza..., xoxb-/xoxa-/xoxp-).
 *
 * `detectSecretsIn` is idempotent — running it on the same root twice doesn't
 * re-wrap already-wrapped spans. `setSecretsHidden` only toggles the visible
 * text on those spans; the actual value lives in data-secret.
 */

const KV_PATTERN =
  /(\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PWD)\s*[:=]\s*)([^\s"'`]+)/g;

const STANDALONE_PATTERN =
  /\b(sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|gh[opusr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[abp]-[A-Za-z0-9-]{10,})\b/g;

/** Quick string-level check — used by the global breadcrumb toggle to decide
 *  whether to surface the show/hide secrets button at all. */
export function sourceHasSecrets(text: string): boolean {
  if (!text) return false;
  KV_PATTERN.lastIndex = 0;
  STANDALONE_PATTERN.lastIndex = 0;
  return KV_PATTERN.test(text) || STANDALONE_PATTERN.test(text);
}

const MASK_CHAR = "•";
const MASK_MIN = 6;
const MASK_MAX = 24;

type Range = { start: number; end: number; secret: string };

function maskOf(value: string): string {
  const len = Math.max(MASK_MIN, Math.min(MASK_MAX, value.length));
  return MASK_CHAR.repeat(len);
}

function collectRanges(text: string): Range[] {
  const out: Range[] = [];

  KV_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = KV_PATTERN.exec(text)) !== null) {
    const start = m.index + m[1].length;
    out.push({ start, end: start + m[2].length, secret: m[2] });
  }

  STANDALONE_PATTERN.lastIndex = 0;
  while ((m = STANDALONE_PATTERN.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, secret: m[0] });
  }

  if (out.length === 0) return out;
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  // drop overlaps — keep the earliest (and longest if tied)
  const merged: Range[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) continue;
    merged.push(r);
  }
  return merged;
}

/**
 * Walk text nodes inside `root`, wrap detected secrets in <span class="mdv-secret">.
 * Skips nodes inside <a>, <code> attributes, or pre-existing .mdv-secret spans
 * to keep things idempotent.
 */
export function detectSecretsIn(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const targets: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    targets.push(n as Text);
    n = walker.nextNode();
  }

  for (const node of targets) {
    if (!node.parentElement) continue;
    if (node.parentElement.closest(".mdv-secret")) continue;
    const value = node.nodeValue ?? "";
    if (value.length < 8) continue;
    const ranges = collectRanges(value);
    if (ranges.length === 0) continue;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const r of ranges) {
      if (r.start > cursor) {
        frag.appendChild(document.createTextNode(value.slice(cursor, r.start)));
      }
      const span = document.createElement("span");
      span.className = "mdv-secret";
      span.dataset.secret = r.secret;
      span.dataset.mask = maskOf(r.secret);
      span.textContent = span.dataset.mask;
      span.setAttribute("title", "secret (hidden)");
      frag.appendChild(span);
      cursor = r.end;
    }
    if (cursor < value.length) {
      frag.appendChild(document.createTextNode(value.slice(cursor)));
    }
    node.parentNode?.replaceChild(frag, node);
  }
}

/** Flip every wrapped span between dots and its real value. */
export function setSecretsHidden(root: HTMLElement, hidden: boolean): void {
  const spans = root.querySelectorAll<HTMLSpanElement>(".mdv-secret");
  spans.forEach((span) => {
    if (hidden) {
      span.textContent = span.dataset.mask ?? maskOf(span.dataset.secret ?? "");
      span.setAttribute("title", "secret (hidden) — click eye icon to reveal");
      span.classList.add("is-hidden");
    } else {
      span.textContent = span.dataset.secret ?? span.textContent ?? "";
      span.setAttribute("title", "click to copy");
      span.classList.remove("is-hidden");
    }
  });
}

/** Returns true if at least one secret was detected — useful for showing the toggle button. */
export function hasSecrets(root: HTMLElement): boolean {
  return root.querySelector(".mdv-secret") != null;
}
