export const DEMO_MARKDOWN = `# welcome to marknote

![](/brand/marka-app-icon.png)

a local markdown editor for the notes you share with ai.
edit on the left. preview on the right. press **⌘.** for reading mode.

---

## diagrams

mermaid renders live:

\`\`\`mermaid
flowchart LR
  Idea --> Draft
  Draft --> Share
  Share --> Claude
  Claude --> Idea
\`\`\`

---

## code

shiki highlights every code block — colors follow the active theme:

\`\`\`ts
function copyContext(files: string[]): string {
  return files
    .map((f) => \`<context file="\${f}">\\n...\\n</context>\`)
    .join("\\n\\n");
}
\`\`\`

---

![](/brand/marka-ai-icon.png)

ready when you are. **⌘N** for a fresh buffer, **⌘⇧O** to open a folder.

_marknote · open source · MIT_
`;
