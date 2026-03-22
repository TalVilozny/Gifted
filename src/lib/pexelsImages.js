/** Stock photos via Pexels API — https://www.pexels.com/api/ */

const cache = new Map();

export function isPexelsConfigured() {
  return Boolean(import.meta.env.VITE_PEXELS_API_KEY?.trim());
}

function pickPhotoSrc(photo) {
  if (!photo?.src) return null;
  const s = photo.src;
  return (
    s.large2x ||
    s.large ||
    s.medium ||
    s.small ||
    s.tiny ||
    s.portrait ||
    s.landscape ||
    null
  );
}

/**
 * @param {string} query
 * @param {string | null} orientation landscape | portrait | square | null (any)
 * @param {string} apiKey
 * @returns {Promise<string | null>}
 */
async function searchPexelsOnce(query, orientation, apiKey) {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!q) return null;

  const params = new URLSearchParams({ query: q, per_page: "8" });
  if (orientation) params.set("orientation", orientation);

  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) return null;

  const data = await res.json();
  for (const photo of data.photos ?? []) {
    const src = pickPhotoSrc(photo);
    if (src) return src;
  }
  return null;
}

/**
 * @param {string} query
 * @returns {Promise<string | null>}
 */
export async function fetchPexelsImageUrl(query) {
  const apiKey = import.meta.env.VITE_PEXELS_API_KEY?.trim();
  if (!apiKey) return null;

  const q = query.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!q) return null;

  const cached = cache.get(q);
  if (cached) return cached;

  const words = q.split(/\s+/).filter(Boolean);
  const short =
    words.slice(0, 3).join(" ") || "gift";

  try {
    let src =
      (await searchPexelsOnce(q, "landscape", apiKey)) ||
      (await searchPexelsOnce(q, null, apiKey)) ||
      (await searchPexelsOnce(`${short} gift`, "landscape", apiKey)) ||
      (await searchPexelsOnce(short, null, apiKey)) ||
      (await searchPexelsOnce("gift present celebration", "landscape", apiKey));

    if (src) cache.set(q, src);
    return src;
  } catch {
    return null;
  }
}
