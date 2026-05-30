import { openrouterChat } from "./openrouter";

export type Language = {
  code: string;
  /** localized display name */
  label: string;
};

export const LANGUAGES: ReadonlyArray<Language> = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
];

export const DEFAULT_TRANSLATE_PROMPT = `You are a translation engine.
- Translate the user message into the target language.
- Preserve all markdown formatting exactly: headings, lists, code fences, links, tables, emphasis, blockquotes.
- Do NOT translate code blocks, inline code, URLs, file paths, or HTML/markdown attribute names.
- Do NOT add commentary, prefaces, or notes. Output ONLY the translated markdown, nothing else.
- If the source is already in the target language, return it unchanged.`;

const SYSTEM_PROMPT = (lang: Language, customPrompt?: string) =>
  `${customPrompt?.trim() || DEFAULT_TRANSLATE_PROMPT}

Target language: ${lang.label} (ISO code: ${lang.code}).`;

const LEGACY_SYSTEM_PROMPT = (lang: Language) =>
  `You are a translation engine. Translate the user message into ${lang.label} (ISO code: ${lang.code}).
- Preserve all markdown formatting exactly: headings, lists, code fences, links, tables, emphasis, blockquotes.
- Do NOT translate code blocks, inline code, URLs, file paths, or HTML/markdown attribute names.
- Do NOT add commentary, prefaces, or notes. Output ONLY the translated markdown, nothing else.
- If the source is already in ${lang.label}, return it unchanged.`;

/** accepts either a Language object or just its ISO code (e.g. "tr") */
function resolveLanguage(input: Language | string): Language {
  if (typeof input !== "string") return input;
  const found = LANGUAGES.find((l) => l.code === input);
  if (found) return found;
  // unknown code → still pass through so the model can try
  return { code: input, label: input };
}

export async function translateMarkdown(args: {
  apiKey: string;
  model: string;
  targetLang: Language | string;
  source: string;
  systemPrompt?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, model, targetLang, source, systemPrompt, signal } = args;
  if (!source.trim()) return source;
  const lang = resolveLanguage(targetLang);
  const prompt = systemPrompt?.trim()
    ? SYSTEM_PROMPT(lang, systemPrompt)
    : LEGACY_SYSTEM_PROMPT(lang);
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
