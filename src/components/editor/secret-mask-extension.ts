/**
 * CodeMirror 6 decoration extension that masks API keys / tokens inside the
 * editor pane with dots until the user toggles them visible. Mirrors the
 * detection rules used by `lib/secret-mask.ts` for the preview side.
 *
 * Usage:
 *   const ext = secretMaskExtension();
 *   // ...later:
 *   view.dispatch({ effects: setEditorSecretsHidden.of(false) });
 */

import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Extension, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";

export const setEditorSecretsHidden = StateEffect.define<boolean>();

const hiddenField = StateField.define<boolean>({
  create: () => true,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setEditorSecretsHidden)) return e.value;
    }
    return value;
  },
});

class DotsWidget extends WidgetType {
  constructor(readonly len: number) {
    super();
  }
  eq(other: DotsWidget) {
    return other.len === this.len;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-secret-mask";
    span.textContent = "•".repeat(Math.max(6, Math.min(24, this.len)));
    span.title = "secret (hidden) — click eye icon in preview to reveal";
    return span;
  }
  // pass clicks through to CM so caret placement still works
  ignoreEvent() {
    return false;
  }
}

const KV_PATTERN =
  /(\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PWD)\s*[:=]\s*)([^\s"'`]+)/g;
const STANDALONE_PATTERN =
  /\b(sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|gh[opusr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[abp]-[A-Za-z0-9-]{10,})\b/g;

type Range = { start: number; end: number };

function buildDecorations(view: EditorView): DecorationSet {
  if (!view.state.field(hiddenField)) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const ranges: Range[] = [];

    KV_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = KV_PATTERN.exec(text)) !== null) {
      const s = m.index + m[1].length;
      ranges.push({ start: s, end: s + m[2].length });
    }

    STANDALONE_PATTERN.lastIndex = 0;
    while ((m = STANDALONE_PATTERN.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }

    if (ranges.length === 0) continue;
    ranges.sort((a, b) => a.start - b.start || b.end - a.end);

    // merge overlaps — RangeSetBuilder requires strictly ordered, non-overlapping ranges
    const merged: Range[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.start < last.end) continue;
      merged.push(r);
    }

    for (const r of merged) {
      builder.add(
        from + r.start,
        from + r.end,
        Decoration.replace({ widget: new DotsWidget(r.end - r.start) }),
      );
    }
  }

  return builder.finish();
}

const maskPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      const hiddenChanged = u.state.field(hiddenField) !== u.startState.field(hiddenField);
      if (u.docChanged || u.viewportChanged || hiddenChanged) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export function secretMaskExtension(): Extension {
  return [hiddenField, maskPlugin];
}
