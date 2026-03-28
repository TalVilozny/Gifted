/**
 * Vercel: Pexels image search proxy (server-only API key).
 * Set PEXELS_API_KEY in env — https://www.pexels.com/api/
 *
 * GET /api/pexels?q=search+terms  → { url: string | null }
 * GET /api/pexels                 → { configured: boolean } (no query)
 */
import { resolvePexelsImageUrlForQuery } from "../lib/pexelsSearchLogic.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function resolveKey() {
  return (
    process.env.PEXELS_API_KEY?.trim() ||
    process.env.VITE_PEXELS_API_KEY?.trim() ||
    ""
  );
}

function queryFromReq(req) {
  if (req.query && typeof req.query.q === "string") return req.query.q;
  try {
    const u = new URL(req.url, "http://localhost");
    return u.searchParams.get("q") || "";
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = resolveKey();
  const qRaw = queryFromReq(req).trim();

  if (!qRaw) {
    res.setHeader("X-GiftPicker-Images", "pexels-health");
    sendJson(res, 200, { configured: Boolean(apiKey) });
    return;
  }

  if (!apiKey) {
    sendJson(res, 503, {
      url: null,
      error: "Pexels API key not configured",
    });
    return;
  }

  try {
    const url = await resolvePexelsImageUrlForQuery(qRaw, apiKey);
    res.setHeader("X-GiftPicker-Images", "pexels-proxy-response");
    sendJson(res, 200, { url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pexels request failed";
    sendJson(res, 502, { url: null, error: msg });
  }
}
