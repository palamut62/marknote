import { Mark, mergeAttributes } from "@tiptap/core";

export type RichTextStyleAttrs = {
  color?: string | null;
  fontFamily?: string | null;
  fontSize?: string | null;
};

function pickStyle(value: string, name: string): string | null {
  const match = value.match(new RegExp(`${name}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function buildStyle(attrs: RichTextStyleAttrs): string {
  const parts: string[] = [];
  if (attrs.color) parts.push(`color: ${attrs.color}`);
  if (attrs.fontFamily) parts.push(`font-family: ${attrs.fontFamily}`);
  if (attrs.fontSize) parts.push(`font-size: ${attrs.fontSize}`);
  return parts.join("; ");
}

/**
 * Minimal inline style mark for the rich editor. It intentionally supports only
 * the user-facing formatting controls we expose in the toolbar.
 */
export const RichTextStyle = Mark.create({
  name: "richTextStyle",
  inclusive: true,

  addAttributes() {
    return {
      // NB: when an attribute defines renderHTML, tiptap uses ITS return value
      // and drops the raw attr — so returning {} here would strip color/font
      // before the mark-level renderHTML (below) can build the style string.
      // Pass the value through under its own key so buildStyle() can read it.
      color: {
        default: null,
        parseHTML: (element) => pickStyle(element.getAttribute("style") ?? "", "color"),
        renderHTML: (attrs) => (attrs.color ? { color: attrs.color } : {}),
      },
      fontFamily: {
        default: null,
        parseHTML: (element) => pickStyle(element.getAttribute("style") ?? "", "font-family"),
        renderHTML: (attrs) => (attrs.fontFamily ? { fontFamily: attrs.fontFamily } : {}),
      },
      fontSize: {
        default: null,
        parseHTML: (element) => pickStyle(element.getAttribute("style") ?? "", "font-size"),
        renderHTML: (attrs) => (attrs.fontSize ? { fontSize: attrs.fontSize } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[style]",
        getAttrs: (node) => {
          const style = (node as HTMLElement).getAttribute("style") ?? "";
          return pickStyle(style, "color") || pickStyle(style, "font-family") || pickStyle(style, "font-size")
            ? {}
            : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const style = buildStyle({
      color: HTMLAttributes.color,
      fontFamily: HTMLAttributes.fontFamily,
      fontSize: HTMLAttributes.fontSize,
    });
    return ["span", mergeAttributes({ style }), 0];
  },
});
