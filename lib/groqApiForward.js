/**
 * Shared Groq OpenAI-compatible chat completion (used by Vite dev middleware + Vercel api/groq).
 */

const DEFAULT_BASE = "https://api.groq.com/openai/v1";

/**
 * @param {Record<string, string | undefined>} env
 */
export function resolveGroqApiKeyFromEnv(env) {
  return (
    env.GROQ_API_KEY?.trim() ||
    env.VITE_GROQ_API_KEY?.trim() ||
    ""
  );
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function resolveGroqApiBaseFromEnv(env) {
  return env.VITE_GROQ_API_BASE?.trim() || DEFAULT_BASE;
}

/**
 * @param {object} body — { model, messages, temperature?, max_tokens? }
 * @param {string} apiKey
 * @param {string} [apiBase]
 * @returns {Promise<object>} Groq JSON response
 */
export async function groqOpenAIChatCompletion(body, apiKey, apiBase) {
  const base = (apiBase || DEFAULT_BASE).replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text || `Groq API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}
