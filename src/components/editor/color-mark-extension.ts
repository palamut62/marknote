import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";

class HiddenTagWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-color-tag-hidden";
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

type ColorRange = {
  openFrom: number;
  openTo: number;
  contentFrom: number;
  contentTo: number;
  closeFrom: number;
  closeTo: number;
  style: string;
};

const COLOR_VALUE = "(#[0-9a-fA-F]{6}|var\\(--mdv-user-text-color\\))";
const HIGHLIGHT_VALUE = "(#[0-9a-fA-F]{6}|var\\(--mdv-user-highlight-color\\))";
const SPAN_RE = new RegExp(`<span style="color: ${COLOR_VALUE}">([\\s\\S]*?)<\\/span>`, "g");
const MARK_RE = new RegExp(`<mark style="background: ${HIGHLIGHT_VALUE}">([\\s\\S]*?)<\\/mark>`, "g");

function collectRanges(text: string): ColorRange[] {
  const ranges: ColorRange[] = [];

  SPAN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPAN_RE.exec(text)) !== null) {
    const color = match[1];
    const full = match[0];
    const content = match[2];
    const open = full.indexOf(">") + 1;
    const contentFrom = match.index + open;
    const contentTo = contentFrom + content.length;
    ranges.push({
      openFrom: match.index,
      openTo: contentFrom,
      contentFrom,
      contentTo,
      closeFrom: contentTo,
      closeTo: match.index + full.length,
      style: `color: ${color};`,
    });
  }

  MARK_RE.lastIndex = 0;
  while ((match = MARK_RE.exec(text)) !== null) {
    const background = match[1];
    const full = match[0];
    const content = match[2];
    const open = full.indexOf(">") + 1;
    const contentFrom = match.index + open;
    const contentTo = contentFrom + content.length;
    ranges.push({
      openFrom: match.index,
      openTo: contentFrom,
      contentFrom,
      contentTo,
      closeFrom: contentTo,
      closeTo: match.index + full.length,
      style: `background: ${background}; color: var(--fg); border-radius: 3px; padding: 0 1px;`,
    });
  }

  return ranges.sort((a, b) => a.openFrom - b.openFrom);
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const hiddenTag = Decoration.replace({ widget: new HiddenTagWidget() });

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const range of collectRanges(text)) {
      builder.add(from + range.openFrom, from + range.openTo, hiddenTag);
      builder.add(from + range.contentFrom, from + range.contentTo, Decoration.mark({ attributes: { style: range.style } }));
      builder.add(from + range.closeFrom, from + range.closeTo, hiddenTag);
    }
  }

  return builder.finish();
}

export function colorMarkExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
