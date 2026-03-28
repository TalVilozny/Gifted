/** Stock photos via Pexels API — https://www.pexels.com/api/ */

import { resolvePexelsImageUrlForQuery } from "./pexelsSearchLogic.js";

const cache = new Map();

function pexelsProxyPathEnabled() {
  if (import.meta.env.VITE_PEXELS_API_KEY?.trim()) return false;
  if (import.meta.env.VITE_PEXELS_USE_PROXY === "true") return true;
  if (import.meta.env.PROD) return true;
  return false;
}

export function isPexelsConfigured() {
  return Boolean(
    import.meta.env.VITE_PEXELS_API_KEY?.trim() || pexelsProxyPathEnabled(),
  );
}

async function fetchPexelsViaProxy(query) {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!q) return null;
  const res = await fetch(`/api/pexels?q=${encodeURIComponent(q)}`, {
    headers: { "X-GiftPicker-Images": "pexels-proxy" },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return typeof data.url === "string" && data.url ? data.url : null;
}

/**
 * @param {string} query
 * @returns {Promise<string | null>}
 */
export async function fetchPexelsImageUrl(query) {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!q) return null;

  const cached = cache.get(q);
  if (cached) return cached;

  let src = null;
  const clientKey = import.meta.env.VITE_PEXELS_API_KEY?.trim();
  if (clientKey) {
    src = await resolvePexelsImageUrlForQuery(q, clientKey);
  } else if (pexelsProxyPathEnabled()) {
    src = await fetchPexelsViaProxy(q);
  } else {
    return null;
  }

  if (src) cache.set(q, src);
  return src;
}
