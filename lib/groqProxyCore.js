/**
 * Shared Groq chat call (Vercel serverless + Vite dev middleware).
 * Lives under /lib so api/groq.js can import a sibling path Vercel always bundles.
 *
 * Retries: gift flows fire several sequential /api/groq calls (ideas + price chunks).
 * Groq may return 429 or transient 5xx; short backoff avoids user-visible 502s.
 */
const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 529]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGroqChatOnce(apiKey, opts) {
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

  const errText = res.ok ? "" : await res.text();
  if (!res.ok) {
    const err = new Error(errText || `Groq API error (${res.status})`);
    err.statusCode = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("No text content in Groq response");
  }
  return content;
}

export async function callGroqChat(apiKey, opts) {
  const maxAttempts = 4;
  const backoffMs = [0, 350, 900, 2000];
  let lastErr;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (backoffMs[attempt] > 0) {
      await sleep(backoffMs[attempt]);
    }
    try {
      return await callGroqChatOnce(apiKey, opts);
    } catch (e) {
      lastErr = e;
      const status =
        typeof e?.statusCode === "number"
          ? e.statusCode
          : Number(
              /"status":\s*(\d+)/.exec(String(e?.message ?? ""))?.[1] ?? NaN,
            );
      const code = Number.isFinite(status) ? status : undefined;
      const msg = String(e?.message ?? "");
      const retryable =
        (typeof code === "number" && RETRY_STATUSES.has(code)) ||
        /rate|limit|too many|529|overloaded|timeout/i.test(msg);
      const networkBlip =
        e instanceof TypeError ||
        /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(msg);
      if (attempt < maxAttempts - 1 && (retryable || networkBlip)) {
        console.warn(
          `[groq] attempt ${attempt + 1}/${maxAttempts} failed (${code ?? msg.slice(0, 80)}), retrying…`,
        );
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("Groq request failed");
}
