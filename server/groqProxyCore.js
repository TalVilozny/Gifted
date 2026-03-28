/**
 * Shared Groq chat call for Vercel serverless + Vite dev middleware (Node).
 * @param {string} apiKey
 * @param {{ prompt: string, model?: string, temperature?: number, max_tokens?: number, baseUrl?: string }} opts
 */
export async function callGroqChat(apiKey, opts) {
  const {
    prompt,
    model = "llama-3.3-70b-versatile",
    temperature = 0.35,
    max_tokens = 8192,
    baseUrl,
  } = opts;
  const base = (baseUrl || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens,
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
