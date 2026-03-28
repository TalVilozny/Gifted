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

function tokenize(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scorePhotoForQuery(photo, query) {
  const q = tokenize(query);
  const alt = tokenize(photo?.alt ?? "");
  if (q.length === 0) return 0;

  let score = 0;
  const altSet = new Set(alt);
  for (const token of q) {
    if (altSet.has(token)) score += 3;
  }
  const altText = String(photo?.alt ?? "").toLowerCase();
  const qBlob = q.join(" ");
  // Penalize obvious category mismatches (stock photos often mis-tagged).
  const mismatchPairs = [
    [/coffee|espresso|latte|brew|barista|moka|french\s*press/, /\bwatch|wristwatch|clock|jewelry|ring\b/],
    [/watch|timepiece|wristwatch/, /\bcoffee|espresso|brew|barista\b/],
    [/keyboard|mouse|gpu|monitor|laptop|pc\b/, /\bwatch|coffee|wine|flower\b/],
    [/headphone|earbud|speaker/, /\bwatch|coffee|knife|kitchen\b/],
  ];
  for (const [wantRe, badRe] of mismatchPairs) {
    if (wantRe.test(qBlob) && badRe.test(altText)) score -= 8;
  }
  // Small penalty for clearly generic stock/desk shots when query is specific.
  if (q.length >= 3 && /\bdesk|workspace|office|laptop\b/.test(altText)) {
    score -= 2;
  }
  if (q.length >= 4 && /\bgift\b|present\b|celebration\b/.test(altText) && !qBlob.includes("gift")) {
    score -= 2;
  }
  return score;
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

  const params = new URLSearchParams({ query: q, per_page: "15" });
  if (orientation) params.set("orientation", orientation);

  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const photos = Array.isArray(data.photos) ? data.photos : [];
  photos.sort((a, b) => scorePhotoForQuery(b, q) - scorePhotoForQuery(a, q));
  const bestScore =
    photos.length > 0 ? scorePhotoForQuery(photos[0], q) : -999;
  const minOk = tokenize(q).length >= 4 ? 2 : 1;
  if (bestScore < minOk) return null;
  for (const photo of photos) {
    if (scorePhotoForQuery(photo, q) < minOk) continue;
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
      (await searchPexelsOnce(short, "landscape", apiKey)) ||
      (await searchPexelsOnce(short, null, apiKey));

    if (src) cache.set(q, src);
    return src;
  } catch {
    return null;
  }
}
