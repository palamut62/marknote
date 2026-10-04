/**
 * Privacy preference: notes may reference images on the internet, and simply
 * opening the note would make a network request. When remote images are off,
 * their URL is moved out of `src` before the HTML reaches the DOM.
 */

const REMOTE_URL = /^(?:https?:)?\/\//i;

export function isRemoteImageUrl(src: string | null | undefined): boolean {
  return !!src && REMOTE_URL.test(src.trim());
}

export function remoteImagesAllowed(): boolean {
  return (window as unknown as { __marknoteRemoteImages?: boolean }).__marknoteRemoteImages === true;
}

/** markdown-it emits `<img src="…" alt="…">`; replace remote ones with an inert placeholder. */
export function blockRemoteImages(html: string): string {
  return html.replace(/<img\b([^>]*?)\ssrc="([^"]*)"([^>]*)>/gi, (match, before: string, src: string, after: string) => {
    if (!isRemoteImageUrl(src)) return match;
    const alt = `${before} ${after}`.match(/\salt="([^"]*)"/)?.[1] ?? "";
    // src and alt are already HTML-escaped by markdown-it
    return `<span class="mdv-remote-blocked" title="${src}">İnternet görseli gösterilmiyor${alt ? `: ${alt}` : ""} (Ayarlar - Gizlilik)</span>`;
  });
}
