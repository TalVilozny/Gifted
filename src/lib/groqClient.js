/**
 * Groq (OpenAI-compatible chat completions) — fast inference for JSON tasks.
 *
 * **Local / client key:** `VITE_GROQ_API_KEY` in `.env` (browser; OK for dev).
 * **Production (Vercel):** set `GROQ_API_KEY` (server-only). Build sets
 * `VITE_GROQ_USE_PROXY` so the app calls `/api/groq` — key never ships to the client.
 * Keys: https://console.groq.com/
 */

const DEFAULT_BASE = "https://api.groq.com/openai/v1";

export function isGroqConfigured() {
  return Boolean(
    import.meta.env.VITE_GROQ_API_KEY?.trim() ||
    import.meta.env.VITE_GROQ_USE_PROXY === "true",
  );
}

export function getGroqModelName() {
  return (
    import.meta.env.VITE_GROQ_MODEL?.trim() || "llama-3.3-70b-versatile"
  );
}

function apiBase() {
  return import.meta.env.VITE_GROQ_API_BASE?.trim() || DEFAULT_BASE;
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
 * Server proxy (`/api/groq` on Vercel or Vite dev middleware) — uses `GROQ_API_KEY`.
 */
async function completeGroqProxy(prompt, options = {}) {
  const model = options.model ?? getGroqModelName();
  const payload = {
    prompt,
    options: {
      model,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.max_tokens ?? 8192,
      baseUrl:
        import.meta.env.VITE_GROQ_API_BASE?.trim() || undefined,
    },
  };

  const res = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : `Groq proxy error (${res.status})`;
    throw new Error(msg);
  }
  if (typeof data.content !== "string") {
    throw new Error("Invalid response from Groq proxy");
  }
  return data.content;
}

/**
 * @param {string} prompt
 * @param {{ model?: string, temperature?: number, max_tokens?: number }} [options]
 */
export async function completeGroq(prompt, options = {}) {
  const merged = { ...options, model: options.model ?? getGroqModelName() };
  if (import.meta.env.VITE_GROQ_API_KEY?.trim()) {
    return completeGroqDirect(prompt, merged);
  }
  if (import.meta.env.VITE_GROQ_USE_PROXY === "true") {
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
