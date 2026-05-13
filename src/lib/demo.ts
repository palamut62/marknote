export const DEMO_MARKDOWN = `# welcome to marka.md

> local markdown, live. type on the left, see it render on the right.

## what works
- live preview with **bold**, _italic_, ~~strike~~, and \`inline code\`
- syntax-highlighted code blocks via shiki
- drag the divider to resize · ratio is remembered

## a code block

\`\`\`ts
type Note = { title: string; body: string; createdAt: Date };

function wordCount(text: string): number {
  return text.trim().split(/\\s+/).filter(Boolean).length;
}
\`\`\`

## a list
1. open a markdown file (coming in phase 3)
2. type or edit on the left
3. preview updates ~50ms later

## a quote
> "the best way to predict the future is to invent it."

## a link
visit [github](https://github.com/) — or try a relative one.

---

_phase 3 wires ⌘O / ⌘S and drag-drop so you can open .md files directly._
`;
