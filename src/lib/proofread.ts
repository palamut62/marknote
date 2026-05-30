import { openrouterChat } from "./openrouter";

export const DEFAULT_PROOFREAD_PROMPT = `You are a careful markdown proofreading engine.
- Correct spelling, grammar, punctuation, and obvious language mistakes.
- Preserve the original language of each paragraph. Do NOT translate.
- Preserve all markdown structure exactly: headings, lists, code fences, inline code, links, tables, emphasis, blockquotes, frontmatter, and HTML.
- Do NOT change code blocks, inline code, URLs, file paths, identifiers, commands, or markdown attribute names.
- Keep the author's meaning, tone, and formatting. Avoid stylistic rewrites unless needed for correctness.
- Do NOT add commentary, prefaces, explanations, or notes. Output ONLY the corrected markdown.`;

export async function proofreadMarkdown(args: {
  apiKey: string;
  model: string;
  source: string;
  systemPrompt?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, model, source, systemPrompt, signal } = args;
  if (!source.trim()) return source;
  const prompt = systemPrompt?.trim() || DEFAULT_PROOFREAD_PROMPT;
  return openrouterChat(
    apiKey,
    model,
    [
      { role: "system", content: prompt },
      { role: "user", content: source },
    ],
    signal,
  );
}
