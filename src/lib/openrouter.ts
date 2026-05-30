/**
 * Minimal OpenRouter REST client.
 *
 * Two endpoints used by marknote:
 *   - GET  /api/v1/models                — list available models (free + paid)
 *   - POST /api/v1/chat/completions      — translation / chat
 *
 * The API key is supplied by the user via Settings; we never ship one.
 * Requests run from the Tauri webview; CSP is `null` so cross-origin fetch
 * is allowed. We send the recommended `HTTP-Referer` + `X-Title` headers so
 * usage shows up properly in the OpenRouter dashboard.
 */

const BASE = "https://openrouter.ai/api/v1";
const APP_REFERER = "https://marknote.app";
const APP_TITLE = "marknote";

export type OpenRouterModel = {
  id: string;
  name: string;
  /** prompt+completion price summary string, e.g. "$0.50 / $1.50 per 1M" — may be empty for free models */
  priceLabel?: string;
  /** context window length in tokens */
  contextLength?: number;
};

type RawModel = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
};

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": APP_REFERER,
    "X-Title": APP_TITLE,
    "Content-Type": "application/json",
  };
}

function formatPrice(pricing: RawModel["pricing"]): string {
  if (!pricing) return "";
  const p = Number(pricing.prompt ?? "0");
  const c = Number(pricing.completion ?? "0");
  if (!Number.isFinite(p) || !Number.isFinite(c)) return "";
  if (p === 0 && c === 0) return "free";
  // OpenRouter prices are per-token; ×1e6 for per-million-tokens
  const pp = (p * 1_000_000).toFixed(2).replace(/\.00$/, "");
  const cc = (c * 1_000_000).toFixed(2).replace(/\.00$/, "");
  return `$${pp} / $${cc} per 1M`;
}

export async function listOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  if (!apiKey) throw new Error("missing api key");
  const res = await fetch(`${BASE}/models`, {
    headers: authHeaders(apiKey),
  });
  if (!res.ok) {
    throw new Error(`openrouter /models ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const body = (await res.json()) as { data?: RawModel[] };
  const items = body.data ?? [];
  return items
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      priceLabel: formatPrice(m.pricing),
      contextLength: m.context_length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openrouterChat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  if (!apiKey) throw new Error("missing api key");
  if (!model) throw new Error("missing model");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    // try to pull a human message out of OpenRouter's JSON error envelope
    let inner = raw;
    try {
      const j = JSON.parse(raw) as { error?: { message?: string; code?: number } };
      if (j.error?.message) inner = j.error.message;
    } catch {
      /* leave raw */
    }
    if (res.status === 429) {
      const isFree = /:free$/i.test(model);
      const hint = isFree
        ? "free-tier rate limit hit — try a paid model in settings, or wait a minute"
        : "rate limit hit — wait a moment, or check your openrouter dashboard for tier/rpm caps";
      throw new Error(`${hint} · ${inner}`);
    }
    if (res.status === 402) {
      throw new Error(`insufficient credits — top up at openrouter.ai · ${inner}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`api key rejected (${res.status}) — re-check it in settings · ${inner}`);
    }
    throw new Error(`openrouter chat ${res.status}: ${inner}`);
  }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("empty response from model");
  return text;
}
