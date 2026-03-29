/**
 * Groq (OpenAI-compatible chat completions) — fast inference for JSON tasks.
 *
 * Two ways to enable:
 * 1) **Direct (browser → Groq):** `VITE_GROQ_API_KEY` in `.env` / Vercel build env (inlined in bundle).
 * 2) **Proxy (recommended on Vercel):** `VITE_GROQ_PROXY=1` in the **build** env, and set
 *    `GROQ_API_KEY` (server-only, not prefixed with VITE_) on Vercel. The app calls same-origin
 *    `/api/groq` so the key never ships to the client and CORS is not an issue.
 *
 * Keys: https://console.groq.com/
 */

const DEFAULT_BASE = "https://api.groq.com/openai/v1";

function groqProxyEnabled() {
  const v = import.meta.env.VITE_GROQ_PROXY;
  return v === "1" || v === "true";
}

export function isGroqConfigured() {
  return Boolean(
    import.meta.env.VITE_GROQ_API_KEY?.trim() || groqProxyEnabled(),
  );
}

export function getGroqModelName() {
  return import.meta.env.VITE_GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}

function apiBase() {
  return import.meta.env.VITE_GROQ_API_BASE?.trim() || DEFAULT_BASE;
}

/**
 * @param {string} prompt
 * @param {{ model?: string, temperature?: number, max_tokens?: number, system?: string }} [options]
 */
export async function completeGroq(prompt, options = {}) {
  const directKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
  const proxy = groqProxyEnabled();
  if (!directKey && !proxy) {
    throw new Error("Missing VITE_GROQ_API_KEY or VITE_GROQ_PROXY");
  }

  const model = options.model ?? getGroqModelName();
  const system = typeof options.system === "string" && options.system.trim()
    ? options.system.trim()
    : "";
  const messages = system
    ? [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ]
    : [{ role: "user", content: prompt }];

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.35,
    max_tokens: options.max_tokens ?? 8192,
  };

  let data;
  if (proxy) {
    const res = await fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      let msg = errText || `Groq API error (${res.status})`;
      try {
        const j = JSON.parse(errText);
        if (j && typeof j.error === "string") msg = j.error;
      } catch {
        /* keep msg */
      }
      throw new Error(msg);
    }
    data = await res.json();
  } else {
    const res = await fetch(`${apiBase()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${directKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Groq API error (${res.status})`);
    }

    data = await res.json();
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("No text content in Groq response");
  }
  return content;
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
