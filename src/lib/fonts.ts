/**
 * Single source for the rich editor's font controls and the preview's safe
 * inline-style whitelist (F10). Anything offered in the toolbar renders in the
 * preview/export; nothing else is let through.
 */
export const RICH_FONT_FAMILIES: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Sans", value: "Inter, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "JetBrains Mono, ui-monospace, monospace" },
];

// offered by marknote 1.6 and earlier — still rendered (exact match only) so
// notes written with them don't suddenly show raw <span> tags
const LEGACY_FONT_FAMILIES = [
  "system-ui, -apple-system, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Helvetica, Arial, sans-serif",
  "'Segoe UI', Tahoma, sans-serif",
  "Verdana, Geneva, sans-serif",
  "Tahoma, Verdana, sans-serif",
  "'Trebuchet MS', sans-serif",
  "Calibri, Candara, sans-serif",
  "'Times New Roman', Times, serif",
  "Georgia, 'Times New Roman', serif",
  "Garamond, 'Times New Roman', serif",
  "'Courier New', Courier, monospace",
  "'JetBrains Mono', ui-monospace, monospace",
  "'Comic Sans MS', 'Comic Sans', cursive",
];

export const RICH_FONT_SIZES: ReadonlyArray<string> = ["12px", "14px", "16px", "18px", "24px", "32px"];

const ALLOWED_FONT_FAMILIES = new Set<string>([
  ...RICH_FONT_FAMILIES.map((f) => f.value),
  ...LEGACY_FONT_FAMILIES,
]);

export function isAllowedFontFamily(value: string): boolean {
  return ALLOWED_FONT_FAMILIES.has(value.trim());
}

export function isAllowedFontSize(value: string): boolean {
  return RICH_FONT_SIZES.includes(value.trim());
}
