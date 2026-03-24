/**
 * Picks concrete product variants per gift row, alternates, and text refinements.
 * @typedef {{
 *   id: string,
 *   name: string,
 *   priceUSD: number,
 *   rating: number,
 *   image?: string,
 *   tags: string[],
 *   blurb: string,
 *   reviews: { text: string, author: string, stars: number }[],
 * }} ProductVariant
 */

const STOPWORDS = new Set([
  "i",
  "want",
  "with",
  "and",
  "the",
  "a",
  "for",
  "to",
  "my",
  "me",
  "that",
  "this",
  "has",
  "have",
  "need",
  "some",
  "more",
  "looking",
  "gift",
  "idea",
  "product",
  "headphones",
  "headphone",
  "earbuds",
  "option",
]);

function tokenizeQuery(q) {
  return q
    .toLowerCase()
    .split(/[^a-z0-9+]+/i)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Map loose words to search tags / synonyms */
const EXPANSIONS = [
  [["rgb", "lighting", "led", "lights"], "rgb"],
  [["wireless", "bluetooth", "bt"], "wireless"],
  [["2.4", "2.4ghz", "dongle"], "wireless"],
  [["open", "openback", "open-back"], "open-back"],
  [["closed", "closed-back"], "closed-back"],
  [["anc", "noise", "cancelling", "canceling"], "noise-cancelling"],
  [["studio", "mixing", "reference"], "studio"],
  [["gaming", "gamer", "esports"], "gaming"],
  [["bass", "bassy"], "bass"],
  [["cheap", "budget", "affordable"], "budget"],
  [["comfort", "comfortable", "light"], "comfort"],
  [
    ["gpu", "graphics", "nvidia", "geforce", "radeon", "rtx"],
    "gpu",
  ],
  [["prebuilt", "desktop", "tower", "workstation", "pc", "computer"], "prebuilt"],
  [["monitor", "display", "screen", "1440", "4k", "ultrawide", "oled"], "monitor"],
  [["nvme", "ssd", "storage", "ddr"], "storage"],
];

/**
 * @param {string} text
 * @returns {string[]}
 */
export function inferTagsFromText(text) {
  const t = text.toLowerCase();
  const tags = new Set();
  if (/wireless|bluetooth|2\.4/.test(t)) tags.add("wireless");
  if (/rgb|lighting|\bled\b/.test(t)) tags.add("rgb");
  if (/open[- ]?back|openback/.test(t)) tags.add("open-back");
  if (/closed|sealed/.test(t)) tags.add("closed-back");
  if (/noise|anc|cancel/.test(t)) tags.add("noise-cancelling");
  if (/studio|mixing|reference/.test(t)) tags.add("studio");
  if (/gaming|gamer/.test(t)) tags.add("gaming");
  if (/car|vehicle|dash/.test(t)) tags.add("automotive");
  if (/gpu|graphics|rtx|nvidia|radeon|geforce/.test(t)) tags.add("gpu");
  if (/prebuilt|desktop(\s+pc)?|tower|workstation/.test(t)) tags.add("prebuilt");
  if (/monitor|display|ultrawide|1440|4k|oled/.test(t)) tags.add("monitor");
  return [...tags];
}

/**
 * @param {object} g
 * @returns {ProductVariant}
 */
function legacyToVariant(g) {
  return {
    id: `${g.id}-legacy`,
    name: g.name,
    priceUSD: g.priceUSD,
    rating: g.rating,
    image: g.image,
    tags: inferTagsFromText(`${g.name} ${g.blurb || ""}`),
    blurb: g.blurb,
    reviews: g.reviews,
  };
}

/** @param {number} budgetUSD */
export function isUnlimitedBudget(budgetUSD) {
  return (
    budgetUSD === Infinity ||
    (typeof budgetUSD === "number" && budgetUSD >= 1e15)
  );
}

/** @param {object} g */
export function expandGiftRow(g) {
  if (g.variants && g.variants.length > 0) {
    return { ...g, variants: g.variants };
  }
  return { ...g, variants: [legacyToVariant(g)] };
}

/**
 * @param {ProductVariant[]} variants
 * @param {number} budgetUSD
 */
export function pickBestVariantForBudget(variants, budgetUSD) {
  if (isUnlimitedBudget(budgetUSD)) {
    return [...variants].sort(
      (a, b) =>
        b.priceUSD - a.priceUSD ||
        b.rating - a.rating ||
        a.name.localeCompare(b.name),
    )[0];
  }
  const inB = variants.filter((v) => v.priceUSD <= budgetUSD);
  const pool = inB.length ? inB : [...variants];
  if (!inB.length) {
    return [...pool].sort((a, b) => a.priceUSD - b.priceUSD)[0];
  }
  return [...pool].sort(
    (a, b) =>
      b.rating - a.rating ||
      b.priceUSD - a.priceUSD ||
      a.name.localeCompare(b.name),
  )[0];
}

const MIN_ACCEPTABLE_RATING = 3.6;

/**
 * Deterministic score: budget fit, aggregate rating, and overlap with hobby term groups
 * (including bonuses when multiple hobby groups match — “multi-hobby” picks).
 * @param {ProductVariant} v
 * @param {number} budgetCap Infinity when unlimited
 * @param {{ groups?: { terms: string[] }[] }} pickContext
 */
export function scoreVariantForGiftPick(v, budgetCap, pickContext) {
  let s = 0;
  const r = Number(v.rating);
  const rating = Number.isFinite(r) ? r : 4;
  if (rating < 3.4) s -= 140;
  else if (rating < MIN_ACCEPTABLE_RATING) s -= 42;
  s += rating * 24;

  const unlimited = isUnlimitedBudget(budgetCap);
  if (unlimited) {
    s += Math.min(24, v.priceUSD / 170);
  } else {
    const cap = Math.max(budgetCap, 1);
    if (v.priceUSD <= budgetCap) {
      s += 72;
      s += 44 * Math.min(1, v.priceUSD / cap);
    } else {
      const over = v.priceUSD - budgetCap;
      s -= 58 + over * 0.11;
    }
  }

  const groups = pickContext?.groups;
  if (groups?.length) {
    const hay = `${v.name} ${v.blurb} ${(v.tags || []).join(" ")}`.toLowerCase();
    let matchedGroups = 0;
    for (const g of groups) {
      const terms = g.terms || [];
      if (!terms.length) continue;
      let any = false;
      for (const t of terms) {
        if (t && hay.includes(String(t).toLowerCase())) {
          any = true;
          s += 4;
        }
      }
      if (any) matchedGroups++;
    }
    if (matchedGroups >= 2) s += 36;
    if (matchedGroups >= 3) s += 22;
  }

  return s;
}

function compareVariantsForGiftPick(a, b, budgetCap, pickContext) {
  const sb = scoreVariantForGiftPick(b, budgetCap, pickContext);
  const sa = scoreVariantForGiftPick(a, budgetCap, pickContext);
  if (sb !== sa) return sb - sa;
  const rb = Number(b.rating) || 0;
  const ra = Number(a.rating) || 0;
  if (rb !== ra) return rb - ra;
  if (isUnlimitedBudget(budgetCap)) {
    if (b.priceUSD !== a.priceUSD) return b.priceUSD - a.priceUSD;
    return a.name.localeCompare(b.name);
  }
  const inB = b.priceUSD <= budgetCap ? 1 : 0;
  const inA = a.priceUSD <= budgetCap ? 1 : 0;
  if (inB !== inA) return inB - inA;
  if (inA) {
    if (b.priceUSD !== a.priceUSD) return b.priceUSD - a.priceUSD;
    return a.name.localeCompare(b.name);
  }
  if (a.priceUSD !== b.priceUSD) return a.priceUSD - b.priceUSD;
  return a.name.localeCompare(b.name);
}

/**
 * @param {ProductVariant[]} variants
 * @param {number} budgetCap
 * @param {{ groups?: { terms: string[] }[] } | null} pickContext
 */
export function sortVariantsForGiftPick(variants, budgetCap, pickContext) {
  if (!pickContext?.groups?.length) {
    const pool = [...variants];
    if (isUnlimitedBudget(budgetCap)) {
      return pool.sort(
        (a, b) =>
          b.priceUSD - a.priceUSD ||
          b.rating - a.rating ||
          a.name.localeCompare(b.name),
      );
    }
    return pool.sort((a, b) => {
      const ab = a.priceUSD <= budgetCap ? 1 : 0;
      const bb = b.priceUSD <= budgetCap ? 1 : 0;
      if (bb !== ab) return bb - ab;
      return (
        b.rating - a.rating ||
        b.priceUSD - a.priceUSD ||
        a.name.localeCompare(b.name)
      );
    });
  }
  return [...variants].sort((a, b) =>
    compareVariantsForGiftPick(a, b, budgetCap, pickContext),
  );
}

/**
 * @param {ProductVariant[]} variants
 * @param {number} budgetCap
 * @param {{ groups?: { terms: string[] }[] }} pickContext
 */
export function pickBestVariantForBudgetScored(variants, budgetCap, pickContext) {
  const sorted = sortVariantsForGiftPick(variants, budgetCap, pickContext);
  return sorted[0] ?? variants[0];
}

/**
 * @param {ProductVariant[]} variants
 * @param {string} currentId
 * @param {number} budgetUSD
 * @param {{ groups?: { terms: string[] }[] } | null} [pickContext]
 */
export function pickNextAlternate(variants, currentId, budgetUSD, pickContext = null) {
  const order = sortVariantsForGiftPick(variants, budgetUSD, pickContext);
  const idx = order.findIndex((v) => v.id === currentId);
  if (idx < 0) return order[0];
  return order[(idx + 1) % order.length];
}

/**
 * Score variants by user text + budget fit.
 * @param {ProductVariant[]} variants
 * @param {string} query
 * @param {number} budgetUSD
 */
export function pickVariantFromRefinement(
  variants,
  query,
  budgetUSD,
  pickContext = null,
) {
  const raw = tokenizeQuery(query);
  if (raw.length === 0) {
    return pickContext?.groups?.length
      ? pickBestVariantForBudgetScored(variants, budgetUSD, pickContext)
      : pickBestVariantForBudget(variants, budgetUSD);
  }
  const wanted = new Set(raw);
  for (const tok of raw) {
    for (const [synonyms, canonical] of EXPANSIONS) {
      if (synonyms.some((s) => tok.includes(s) || s.includes(tok))) {
        wanted.add(canonical);
        for (const s of synonyms) wanted.add(s);
      }
    }
  }

  const scored = variants.map((v) => {
    let score = 0;
    const hay = `${v.name} ${v.blurb} ${v.tags.join(" ")}`.toLowerCase();
    for (const w of wanted) {
      if (!w) continue;
      if (hay.includes(w)) score += 4;
      for (const tag of v.tags) {
        if (tag.includes(w) || w.includes(tag)) score += 6;
      }
    }
    for (const tag of v.tags) {
      for (const w of wanted) {
        if (tag === w) score += 8;
      }
    }
    if (!isUnlimitedBudget(budgetUSD)) {
      if (v.priceUSD <= budgetUSD) score += 3;
      else score -= (v.priceUSD - budgetUSD) * 0.02;
    } else {
      score += Math.min(12, v.priceUSD / 400);
    }
    score += v.rating * 1.2;
    return { v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 1) {
    return pickContext?.groups?.length
      ? pickBestVariantForBudgetScored(variants, budgetUSD, pickContext)
      : pickBestVariantForBudget(variants, budgetUSD);
  }
  return best.v;
}
