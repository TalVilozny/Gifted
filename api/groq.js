/**
 * Vercel: Groq chat completions proxy (server-only API key).
 * Set GROQ_API_KEY (preferred) or VITE_GROQ_API_KEY in project env.
 * Client: set VITE_GROQ_PROXY=1 and call from the browser — no key in the bundle.
 *
 * POST /api/groq  JSON body: { model, messages, temperature?, max_tokens? }
 * GET  /api/groq  → { configured: boolean }
 */
import {
  groqOpenAIChatCompletion,
  resolveGroqApiBaseFromEnv,
  resolveGroqApiKeyFromEnv,
} from "../lib/groqApiForward.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          resolve(null);
          return;
        }
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const apiKey = resolveGroqApiKeyFromEnv(process.env);
  const apiBase = resolveGroqApiBaseFromEnv(process.env);

  if (req.method === "GET") {
    sendJson(res, 200, { configured: Boolean(apiKey) });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!apiKey) {
    sendJson(res, 503, { error: "Groq API key not configured (set GROQ_API_KEY)" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "Expected JSON object" });
    return;
  }

  const { model, messages, temperature, max_tokens } = body;
  if (typeof model !== "string" || !Array.isArray(messages)) {
    sendJson(res, 400, { error: "Body must include model (string) and messages (array)" });
    return;
  }

  try {
    const data = await groqOpenAIChatCompletion(
      {
        model,
        messages,
        ...(typeof temperature === "number" ? { temperature } : {}),
        ...(typeof max_tokens === "number" ? { max_tokens } : {}),
      },
      apiKey,
      apiBase,
    );
    sendJson(res, 200, data);
  } catch (e) {
    const status = e && typeof e.status === "number" ? e.status : 502;
    const msg = e instanceof Error ? e.message : "Groq request failed";
    sendJson(res, status >= 400 && status < 600 ? status : 502, { error: msg });
  }
}
