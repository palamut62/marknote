export const CHANGELOG_URL = "https://github.com/palamut62/marknote/releases";

const WHATS_NEW_TOAST_BY_MINOR: Record<string, string> = {
  "1.5": "context tray is here - stage files, copy one AI-ready bundle",
};

export function getWhatsNewToastMessage(version: string): string {
  const minor = version.split(".").slice(0, 2).join(".");
  const message = WHATS_NEW_TOAST_BY_MINOR[minor];

  if (message) {
    return `v${version}: ${message}`;
  }

  return `updated to v${version}`;
}
