/**
 * Vercel Serverless Function — calls Groq with a server-only API key.
 * Set GROQ_API_KEY in Project → Environment Variables (no VITE_ prefix).
 */
import { callGroqChat } from "../server/groqProxyCore.js";

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
  return (
    process.env.GROQ_API_KEY?.trim() ||
    process.env.VITE_GROQ_API_KEY?.trim() ||
    ""
  );
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    const ok = Boolean(resolveKey());
    res.status(200).json({ configured: ok });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = resolveKey();
  if (!apiKey) {
    res
      .status(503)
      .json({
        error: "Groq API key not configured on server (set GROQ_API_KEY)",
      });
    return;
  }

  let body = req.body;
  if (body == null || body === "") {
    try {
      body = await readJsonBody(req);
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  } else if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString() || "{}");
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  const { prompt, options = {} } = body || {};
  if (typeof prompt !== "string") {
    res.status(400).json({ error: "Missing prompt" });
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
    res.status(200).json({ content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Groq request failed";
    res.status(502).json({ error: msg });
  }
}
