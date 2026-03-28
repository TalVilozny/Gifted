/**
 * Vercel: Pexels image search proxy (server-only API key).
 * Set PEXELS_API_KEY in env — https://www.pexels.com/api/
 *
 * GET /api/pexels?q=search+terms  → { url: string | null }
 * GET /api/pexels                 → { configured: boolean } (no query)
 */
import { resolvePexelsImageUrlForQuery } from "../src/lib/pexelsSearchLogic.js";

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
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = resolveKey();
  const qRaw = queryFromReq(req).trim();

  if (!qRaw) {
    res.setHeader("X-GiftPicker-Images", "pexels-health");
    res.status(200).json({ configured: Boolean(apiKey) });
    return;
  }

  if (!apiKey) {
    res.status(503).json({ url: null, error: "Pexels API key not configured" });
    return;
  }

  try {
    const url = await resolvePexelsImageUrlForQuery(qRaw, apiKey);
    res.setHeader("X-GiftPicker-Images", "pexels-proxy-response");
    res.status(200).json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pexels request failed";
    res.status(502).json({ url: null, error: msg });
  }
}
