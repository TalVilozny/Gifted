/**
 * Groq (OpenAI-compatible chat completions) — fast inference for JSON tasks.
 *
 * **Local / client key:** `VITE_GROQ_API_KEY` in `.env` (browser; OK for dev).
 * **Production (Vercel):** set `GROQ_API_KEY` for **Runtime** (and Build if you want).
 * The app calls `/api/groq` in production when no `VITE_GROQ_API_KEY` is set.
 * Keys: https://console.groq.com/
 */

const DEFAULT_BASE = "https://api.groq.com/openai/v1";

/**
 * Dev-only: use Vite dev proxy when GROQ_API_KEY exists without VITE_GROQ_API_KEY.
 * Production: always use `/api/groq` — Groq does not support browser calls with API keys
 * (CORS), and `VITE_GROQ_API_KEY` in Vercel must not override the server-only key.
 */
function useGroqProxyPath() {
  if (import.meta.env.VITE_GROQ_API_KEY?.trim()) return false;
  if (import.meta.env.VITE_GROQ_USE_PROXY === "true") return true;
  return false;
}

export function isGroqConfigured() {
  if (import.meta.env.PROD) return true;
  return Boolean(
    import.meta.env.VITE_GROQ_API_KEY?.trim() || useGroqProxyPath(),
  );
}

export function getGroqModelName() {
  return import.meta.env.VITE_GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}

function apiBase() {
  return import.meta.env.VITE_GROQ_API_BASE?.trim() || DEFAULT_BASE;
}

/** Same-origin absolute URL for the serverless Groq proxy (respects Vite `base`). */
function groqProxyUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  const path = `${root}api/groq`.replace(/\/{2,}/g, "/");
  const rel = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(rel, `${window.location.origin}/`).href;
  }
  return rel;
}

/**
 * @param {string} prompt
 * @param {{ model?: string, temperature?: number, max_tokens?: number }} [options]
 */
async function completeGroqDirect(prompt, options = {}) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing VITE_GROQ_API_KEY");

  const model = options.model ?? getGroqModelName();
  const res = await fetch(`${apiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.35,
      max_tokens: options.max_tokens ?? 8192,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Groq API error (${res.status})`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("No text content in Groq response");
  }
  return content;
}

/**
 * One in-flight `/api/groq` at a time so bursts of Groq work (ideas + price chunks)
 * do not overlap and trip Groq rate limits (HTTP 429).
 */
let groqProxyChain = Promise.resolve();

/**
 * Server proxy (`/api/groq` on Vercel or Vite dev middleware) — uses `GROQ_API_KEY`.
 */
async function completeGroqProxy(prompt, options = {}) {
  const run = async () => {
    const model = options.model ?? getGroqModelName();
    const payload = {
      prompt,
      options: {
        model,
        temperature: options.temperature ?? 0.35,
        max_tokens: options.max_tokens ?? 8192,
        baseUrl: import.meta.env.VITE_GROQ_API_BASE?.trim() || undefined,
      },
    };

    const res = await fetch(groqProxyUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GiftPicker-AI": "groq-proxy",
      },
      body: JSON.stringify(payload),
    });

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text().then((t) => ({ _raw: t }));

    if (!res.ok) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : typeof data._raw === "string" && data._raw.includes("<!DOCTYPE")
            ? `Groq proxy returned HTML (${res.status}) — check /api/groq on your host`
            : `Groq proxy error (${res.status})`;
      throw new Error(msg);
    }
    if (typeof data.content !== "string") {
      throw new Error("Invalid response from Groq proxy");
    }
    return data.content;
  };

  const next = groqProxyChain.then(run, run);
  groqProxyChain = next.catch(() => {}).then(() => {});
  return next;
}

/**
 * @param {string} prompt
 * @param {{ model?: string, temperature?: number, max_tokens?: number }} [options]
 */
export async function completeGroq(prompt, options = {}) {
  const merged = { ...options, model: options.model ?? getGroqModelName() };
  if (import.meta.env.PROD) {
    return completeGroqProxy(prompt, merged);
  }
  if (import.meta.env.VITE_GROQ_API_KEY?.trim()) {
    return completeGroqDirect(prompt, merged);
  }
  if (useGroqProxyPath()) {
    return completeGroqProxy(prompt, merged);
  }
  throw new Error("Groq is not configured");
}

export function extractJsonObject(text) {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : t;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(raw.slice(start, end + 1));
}
