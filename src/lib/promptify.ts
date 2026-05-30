import { openrouterChat } from "./openrouter";

export const DEFAULT_PROMPTIFY_PROMPT = `You convert markdown notes into a clear, ready-to-use AI prompt.
- Preserve the user's intent and important constraints.
- Turn scattered notes into a structured prompt with a clear task, context, requirements, and expected output.
- Keep code blocks, URLs, file paths, commands, and quoted source text accurate.
- Do NOT invent facts or requirements that are not present.
- If the source is already a good prompt, improve clarity and structure without changing the goal.
- Output ONLY the final prompt text in markdown. Do not add commentary, prefaces, or explanations.`;

export async function promptifyMarkdown(args: {
  apiKey: string;
  model: string;
  source: string;
  systemPrompt?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, model, source, systemPrompt, signal } = args;
  if (!source.trim()) return source;
  const prompt = systemPrompt?.trim() || DEFAULT_PROMPTIFY_PROMPT;
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
