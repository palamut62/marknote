import type { HeadingItem, MarkdownIssue } from "@/lib";

type MarkdownInspectorProps = {
  headings: HeadingItem[];
  issues: MarkdownIssue[];
  onGoTo: (pos: number) => void;
};

export function MarkdownInspector({ headings, issues, onGoTo }: MarkdownInspectorProps) {
  return (
    <aside className="mdv-mdinspect" aria-label="document outline">
      <section className="mdv-mdinspect__section">
        <h2 className="mdv-mdinspect__title">outline</h2>
        {headings.length ? (
          <div className="mdv-mdinspect__list">
            {headings.map((heading) => (
              <button
                key={`${heading.line}-${heading.text}`}
                type="button"
                className="mdv-mdinspect__item"
                style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }}
                onClick={() => onGoTo(heading.pos)}
              >
                <span className="mdv-mdinspect__line">{heading.line}</span>
                <span className="mdv-mdinspect__text">{heading.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mdv-mdinspect__empty">no headings</p>
        )}
      </section>

      <section className="mdv-mdinspect__section">
        <h2 className="mdv-mdinspect__title">quality</h2>
        {issues.length ? (
          <div className="mdv-mdinspect__list">
            {issues.slice(0, 30).map((issue) => (
              <button
                key={`${issue.line}-${issue.label}-${issue.pos}`}
                type="button"
                className="mdv-mdinspect__issue"
                onClick={() => onGoTo(issue.pos)}
              >
                <span className="mdv-mdinspect__line">{issue.line}</span>
                <span className="mdv-mdinspect__text">{issue.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mdv-mdinspect__empty">no issues found</p>
        )}
      </section>
    </aside>
  );
}
