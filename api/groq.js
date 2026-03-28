/**
 * Vercel Serverless Function — calls Groq with a server-only API key.
 *
 * `.env` is not uploaded to Vercel (gitignored). You must add the same key in:
 * Vercel → Project → Settings → Environment Variables → `GROQ_API_KEY`
 * Enable it for Production (and Preview if you test preview URLs), then Redeploy.
 *
 * GET /api/groq → `{ configured: true|false }` — open in a browser to verify.
 *
 * Uses raw Node response methods for compatibility (res.json is not always present).
 */
import { callGroqChat } from "../lib/groqProxyCore.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString();
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function resolveKey() {
  const tryKey = (v) => {
    if (typeof v !== "string") return "";
    let t = v.replace(/\r/g, "").trim();
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      t = t.slice(1, -1).trim();
    }
    return t;
  };
  return (
    tryKey(process.env.GROQ_API_KEY) ||
    tryKey(process.env.VITE_GROQ_API_KEY) ||
    ""
  );
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.end();
    return;
  }

  if (req.method === "GET") {
    const ok = Boolean(resolveKey());
    res.setHeader("X-GiftPicker-AI", "groq-proxy-health");
    sendJson(res, 200, {
      configured: ok,
      ...(ok
        ? {}
        : {
            hint:
              "Server still sees no key: (1) Redeploy after adding the variable. (2) Enable it for the environment you use (Production vs Preview). (3) Name must be exactly GROQ_API_KEY. (4) In production the app always uses /api/groq — remove VITE_GROQ_API_KEY from Vercel if you rely on the server key only.",
          }),
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = resolveKey();
  if (!apiKey) {
    sendJson(res, 503, {
      error: "Groq API key not configured on server (set GROQ_API_KEY)",
    });
    return;
  }

  let body = req.body;
  if (body == null || body === "") {
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
  } else if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString() || "{}");
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
  }

  const { prompt, options = {} } = body || {};
  if (typeof prompt !== "string") {
    sendJson(res, 400, { error: "Missing prompt" });
    return;
  }

  const baseUrl =
    typeof options.baseUrl === "string" && options.baseUrl.trim()
      ? options.baseUrl.trim()
      : process.env.GROQ_API_BASE?.trim() ||
        process.env.VITE_GROQ_API_BASE?.trim() ||
        undefined;

  try {
    const content = await callGroqChat(apiKey, {
      prompt,
      model: options.model,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      baseUrl,
    });
    res.setHeader("X-GiftPicker-AI", "groq-proxy-response");
    sendJson(res, 200, { content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Groq request failed";
    const upstream =
      typeof e?.statusCode === "number" ? e.statusCode : null;
    const status =
      upstream === 429
        ? 429
        : upstream === 401 || upstream === 403
          ? upstream
          : 502;
    if (upstream) {
      res.setHeader("X-GiftPicker-AI-Upstream-Status", String(upstream));
    }
    sendJson(res, status, { error: msg });
  }
}
