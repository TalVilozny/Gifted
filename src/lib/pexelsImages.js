/** Stock photos via Pexels API — https://www.pexels.com/api/ */

const cache = new Map();

export function isPexelsConfigured() {
  return Boolean(import.meta.env.VITE_PEXELS_API_KEY?.trim());
}

/**
 * @param {string} query
 * @returns {Promise<string | null>}
 */
export async function fetchPexelsImageUrl(query) {
  const key = import.meta.env.VITE_PEXELS_API_KEY?.trim();
  if (!key) return null;

  const q = query.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!q) return null;

  const cached = cache.get(q);
  if (cached) return cached;

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: key },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const photo = data.photos?.[0];
  const src =
    photo?.src?.large2x ||
    photo?.src?.large ||
    photo?.src?.medium ||
    null;

  if (src) cache.set(q, src);
  return src;
}
