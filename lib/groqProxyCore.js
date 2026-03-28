/**
 * Shared Groq chat call (Vercel serverless + Vite dev middleware).
 * Lives under /lib so api/groq.js can import a sibling path Vercel always bundles.
 *
 * Retries: gift flows fire several sequential /api/groq calls (ideas + price chunks).
 * Groq may return 429 or transient 5xx; short backoff avoids user-visible 502s.
 *
 * **Vercel / Node outbound:** Prefer IPv4 when resolving `api.groq.com`. Some serverless
 * environments have broken or slow IPv6 routes, which looks like “fetch never completes”
 * even though Groq is fast once the TCP path works.
 */
import dns from "node:dns";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 529]);

/** After a non-429 failure, short gaps. 429 uses longer waits below. */
const BACKOFF_GENERAL_MS = [400, 1000, 2200];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterMs(res) {
  const ra = res.headers?.get?.("retry-after");
  if (!ra) return null;
  const sec = Number(ra);
  if (Number.isFinite(sec) && sec >= 0) return Math.min(sec * 1000, 120_000);
  return null;
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
    const fromHeader = parseRetryAfterMs(res);
    if (fromHeader != null) err.retryAfterMs = fromHeader;
    throw err;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("No text content in Groq response");
  }
  return content;
}

function waitMsAfter429Failure(attemptIndex, err) {
  const header = typeof err?.retryAfterMs === "number" ? err.retryAfterMs : 0;
  const tier = [2000, 5000, 10_000, 15_000][attemptIndex] ?? 15_000;
  return Math.min(Math.max(header, tier), 60_000);
}

function waitMsAfterOtherFailure(attemptIndex) {
  return BACKOFF_GENERAL_MS[attemptIndex] ?? 2500;
}

export async function callGroqChat(apiKey, opts) {
  const maxAttempts = 5;
  let lastErr;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
      if (attempt >= maxAttempts - 1 || (!retryable && !networkBlip)) {
        throw e;
      }
      const waitMs =
        code === 429
          ? waitMsAfter429Failure(attempt, e)
          : waitMsAfterOtherFailure(attempt);
      console.warn(
        `[groq] attempt ${attempt + 1}/${maxAttempts} failed (${code ?? msg.slice(0, 60)}), waiting ${waitMs}ms…`,
      );
      await sleep(waitMs);
    }
  }
  throw lastErr ?? new Error("Groq request failed");
}
