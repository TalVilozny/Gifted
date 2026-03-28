import {
  buildPickContext,
  finalizeGiftRow,
  inferHobbyIdsFromCustomLabels,
  sortFinalizedGiftsForDisplay,
  tokenizeLabelWords,
} from "../data/giftCatalog.js";
import {
  completeGroq,
  extractJsonObject,
  isGroqConfigured,
} from "./groqClient.js";

const MAX_AI_GIFTS = 18;

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Plausible marketplace-style reviews (deterministic per variant). */
function realisticReviewsForVariant(productName, variantKey) {
  const seed = hashString(`${variantKey}|${productName}`);
  const short =
    productName.length > 52 ? `${productName.slice(0, 50)}…` : productName;
  const authors = [
    "Marcus L.",
    "Emily R.",
    "Priya S.",
    "Tyler W.",
    "Jordan K.",
    "Alex M.",
    "Sam H.",
    "Casey D.",
    "Riley T.",
    "Chris P.",
    "Morgan D.",
    "Jamie F.",
  ];
  const lines = [
    () =>
      `Exactly what I was looking for. ${short} feels solid—arrived a day early too.`,
    () =>
      `Five stars. Matches the listing; packaging was careful and the item had no defects.`,
    () =>
      `Better than expected for the price. Would buy again from a seller with this kind of quality.`,
    () =>
      `Got it as a gift—recipient was thrilled. ${short} looks more premium in person.`,
    () =>
      `Quick shipping, honest photos. Only nit is the manual could be clearer, but setup was still easy.`,
    () =>
      `Took a chance based on reviews and they were right. No regrets.`,
    () =>
      `Customer support answered my question in hours. Product itself is great.`,
    () =>
      `Comparable to what I tried in-store. Saved money ordering online.`,
  ];
  const pick = (i) => lines[(seed + i) % lines.length]();
  const star = (i) => 4 + ((seed >> (i * 3)) % 2);
  const a1 = authors[seed % authors.length];
  const a2 = authors[(seed + 5) % authors.length];
  const a3 = authors[(seed + 11) % authors.length];
  return [
    { text: pick(0), author: a1, stars: star(0) },
    { text: pick(1), author: a2, stars: star(1) },
    { text: pick(2), author: a3, stars: star(2) },
  ];
}

function slugId(s) {
  const t = String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return t || "idea";
}

/** Interests that legitimately include dining/spa/travel gift cards. */
function interestsSoundFoodSpaOrTravel(customLabels) {
  const blob = (customLabels || []).join(" ").toLowerCase();
  return /\b(food|wine|dine|dining|restaurant|chef|gourmet|cooking|eat|brunch|coffee|tea|spa|wellness|massage|facial|travel|hotel|vacation|getaway|trip|resort)\b/.test(
    blob,
  );
}

/**
 * Drop only **obvious** generic dining/spa/multi-venue “experience gift card” rows.
 * Kept intentionally narrow: broad matching removed valid products whose blurbs
 * mentioned “travel” etc. alongside unrelated “gift” wording, which emptied lists.
 */
function shouldDropLazyExperienceGiftCardRow(item, giftPreference, customLabels) {
  if (giftPreference === "experience") return false;
  const vars = Array.isArray(item?.variants) ? item.variants : [];
  const text = [
    item?.category,
    item?.stableId,
    ...vars.map((v) => `${v?.name ?? ""} ${v?.blurb ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!/\b(gift\s*card|e-?gift|gift\s*voucher)\b/.test(text)) return false;
  if (
    /\b(steam|playstation|ps5|xbox|nintendo|switch|epic|battlenet|fanatec|iracing|assetto|sim\s*racing|amazon|best\s*buy|target)\b/.test(
      text,
    )
  ) {
    return false;
  }
  if (interestsSoundFoodSpaOrTravel(customLabels)) return false;
  if (
    /\bexperience\s+gift\s+card\b/.test(text) ||
    /\b(local\s+dining|dining\s*\/\s*spa|spa\s*\/\s*dining)\b/.test(text) ||
    /\bgift\s+card\s*\([^)]*(dining|spa|restaurant|hotel)/.test(text) ||
    /\b(visa|mastercard|amex|american\s+express)\s+gift\s+card\b/.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Keep model-estimated prices in a sane range vs. the user’s soft budget.
 * @param {number} [minBudgetUSD=0] when &gt; 0, never clamp below this (honors minimum-budget).
 */
export function clampRetailPriceUSD(
  n,
  budgetUSD,
  budgetUnlimited,
  minBudgetUSD = 0,
) {
  const x = Number(n);
  const minOk = Math.max(0, Number(minBudgetUSD) || 0);
  const cap =
    typeof budgetUSD === "number" && Number.isFinite(budgetUSD) ? budgetUSD : 75;
  const softLow = minOk > 0 ? minOk : budgetUnlimited ? 10 : 15;

  if (!Number.isFinite(x) || x < 0) {
    if (budgetUnlimited) {
      return Math.max(minOk > 0 ? minOk : 120, 120);
    }
    return Math.max(minOk > 0 ? minOk : 25, Math.min(cap, 500));
  }
  if (budgetUnlimited) {
    return Math.min(Math.max(x, softLow), 50_000);
  }
  const hi = Math.max(cap * 2.5, 400);
  return Math.min(Math.max(x, softLow), hi);
}

function primaryHobbyKey(selectedHobbyIds, customLabels) {
  if (selectedHobbyIds?.length) return selectedHobbyIds[0];
  const inf = inferHobbyIdsFromCustomLabels(customLabels);
  if (inf.length) return inf[0];
  return "general";
}

function formatRecipientMeta(recipientId, recipientAgeRange, recipientGroupSize = null) {
  const rel =
    typeof recipientId === "string" && recipientId.trim()
      ? recipientId.trim()
      : "";
  const age =
    typeof recipientAgeRange === "string" && recipientAgeRange.trim()
      ? recipientAgeRange.trim()
      : "";
  if (!rel && !age) return "";
  const bits = [];

  if (rel.startsWith("group-")) {
    // Format: group-{groupKind}-{composition}
    const parts = rel.split("-");
    const kindId = parts[1] ?? "group";
    const composition = parts[2] ?? "mixed";

    const kindLabel =
      kindId === "workmates"
        ? "workmates"
        : kindId === "party"
          ? "party guests"
          : kindId === "family"
            ? "family"
            : kindId === "friends"
              ? "friends"
              : kindId === "team"
                ? "team"
                : kindId === "class"
                  ? "class"
                  : kindId;

    const compLabel =
      composition === "male"
        ? "all men"
        : composition === "female"
          ? "all women"
          : "mixed group";

    bits.push(`Who: ${kindLabel} (${compLabel})`);
  } else if (rel) {
    bits.push(`Who: ${rel}`);
  }
  if (age) {
    const n = Number(age);
    bits.push(
      Number.isFinite(n) && String(n) === age.trim()
        ? `Age: ${n} years`
        : `Age: ${age}`,
    );
  }
  if (typeof recipientGroupSize === "number" && Number.isFinite(recipientGroupSize)) {
    bits.push(`Group size: ${Math.max(2, Math.round(recipientGroupSize))}`);
  }
  return `- ${bits.join(" | ")}\n`;
}

/**
 * Reorder gift rows by best fit for hobbies + budget (uses Groq).
 * @param {{
 *   gifts: object[],
 *   hobbyTitles: string[],
 *   customLabels: string[],
 *   selectedHobbyIds?: string[],
 *   gender: string,
 *   budgetUSD: number | null,
 *   minBudgetUSD?: number,
 *   wantDIY?: boolean,
 *   giftPreference?: 'diy' | 'experience' | 'premade',
 *   budgetUnlimited?: boolean,
 *   recipientId?: string | null,
 *   recipientAgeRange?: string | null,
 *   recipientGroupSize?: number | null,
 * }} params
 */
export async function rankGiftsWithGroq({
  gifts,
  hobbyTitles,
  customLabels,
  selectedHobbyIds = [],
  gender,
  budgetUSD,
  minBudgetUSD = 0,
  wantDIY = false,
  giftPreference = null,
  budgetUnlimited = false,
  recipientId = null,
  recipientAgeRange = null,
  recipientGroupSize = null,
}) {
  if (!isGroqConfigured() || !gifts.length) return null;

  const isGroup = typeof recipientId === "string" && recipientId.startsWith("group-");
  const reorderTarget = isGroup ? "this group" : "this person";

  let pool = gifts;
  if (budgetUnlimited) {
    const premium = gifts.filter(
      (g) =>
        g._sourceHobbyId === "luxury" ||
        g.selectedProduct.priceUSD >= 200,
    );
    if (premium.length > 0) pool = premium;
  }

  const options = pool.map((g) => {
    const p = g.selectedProduct;
    return {
      id: g.id,
      productName: p.name,
      priceUSD: p.priceUSD,
      rating: p.rating,
      blurb: (p.blurb || "").slice(0, 220),
      hobby: g._sourceHobbyId,
    };
  });

  if (options.length === 0) return null;

  const groupComposition = isGroup ? String(recipientId).split("-").at(-1) : null;
  const genderLabel = isGroup
    ? groupComposition === "male"
      ? "a group of men"
      : groupComposition === "female"
        ? "a group of women"
        : "a mixed group of people"
    : gender === "male"
      ? "a man"
      : gender === "female"
        ? "a woman"
        : gender === "nonbinary"
          ? "a nonbinary person"
          : "a person";

  const budgetLine = budgetUnlimited
    ? `- Budget: **UNLIMITED / endless**. Prioritize the most impressive, premium, and memorable gifts in the list. Favor higher-priced options when they clearly deliver more joy, status, or longevity (watches, fine jewelry, designer goods, flagship cameras, pro PC parts, car experiences, etc.). Luxury-oriented rows are expected.\n`
    : `- Budget (USD, soft cap): ${Number(budgetUSD ?? 0).toFixed(2)}\n`;

  const pref =
    giftPreference === "diy" ||
    giftPreference === "experience" ||
    giftPreference === "premade"
      ? giftPreference
      : wantDIY
        ? "diy"
        : "premade";
  const prefLine =
    pref === "diy"
      ? "- Gift preference: **Handmade & personal** — origami, custom bouquets, love letters / calligraphy, paper crafts, sentimental DIY—not only electronics or tool kits.\n"
      : pref === "experience"
        ? "- Gift preference: **Experiences & memories** — tickets, classes, spa, trips, workshops, vouchers, memberships—prioritize things they *do*, not only objects.\n"
        : "- Gift preference: **Ready-made products** — finished, shoppable items they unwrap.\n";

  const recipientMeta = formatRecipientMeta(
    recipientId,
    recipientAgeRange,
    recipientGroupSize,
  );

  const prompt = `You are an expert gift advisor.

User context:
- Gifts for: ${genderLabel}
${recipientMeta}- Interests (hobbies): ${JSON.stringify([...hobbyTitles, ...customLabels])}
${budgetLine}${prefLine}
Reorder the gift options from **best overall fit** to weaker fit for ${reorderTarget}. Use a **stable, rule-based** ordering (no random tie-breaking).

Priorities (in order):
1) **Hobby fit** — stronger match to the listed interests; **prefer** items that clearly touch **two or more** interests when that is genuine (not forced).
2) **Budget** — list **every** gift with price at or under the soft budget **before** any gift priced above it (in-budget ideas must come first in orderedIds).
3) **Ratings** — when (1) and (2) are close, favor higher customer ratings among same-tier items.

Guidance:
- Prefer **variety**: do not rank five similar small accessories at the top when the list includes bigger or more distinctive gifts for the same hobby.
- For **PC / gaming / tech** interests: prioritize flagship or high-impact items when present (e.g. prebuilt PCs, GPUs, premium monitors, core components) over minor desk clutter—unless DIY mode is on.
- For **unlimited budget**: lead with the most impressive, premium, or "main event" gifts in the list before accessories.

Rules:
- Return ONLY valid JSON with keys orderedIds (array of strings) and shortReason (one sentence).
- orderedIds must contain every "id" from options exactly once, no extras or duplicates.

options:
${JSON.stringify(options, null, 2)}`;

  const text = await completeGroq(prompt, { temperature: 0.12 });
  const parsed = extractJsonObject(text);
  const ids = parsed.orderedIds;
  if (!Array.isArray(ids) || ids.length === 0) return null;

  const byId = new Map(pool.map((g) => [g.id, g]));
  const ordered = [];
  const seen = new Set();
  for (const id of ids) {
    const g = byId.get(id);
    if (g && !seen.has(id)) {
      ordered.push(g);
      seen.add(id);
    }
  }
  for (const g of pool) {
    if (!seen.has(g.id)) ordered.push(g);
  }
  const pickCtx = buildPickContext(selectedHobbyIds, customLabels);
  const sorted = sortFinalizedGiftsForDisplay(
    ordered,
    budgetUSD ?? 0,
    budgetUnlimited,
    pickCtx,
    minBudgetUSD,
  );
  return {
    gifts: sorted,
    reason: typeof parsed.shortReason === "string" ? parsed.shortReason : "",
  };
}

/**
 * Invent fresh gift ideas via Groq (not limited to the static catalog).
 * giftPreference: diy | experience | premade shapes the catalog-style ideas.
 */
/** Ensures custom hobby words appear in tags so UI filters and search text match. */
function enrichVariantTagsForCustomHobbies(rawVariants, customLabels) {
  if (!customLabels?.length || !Array.isArray(rawVariants)) return rawVariants;
  return rawVariants.map((v) => {
    const tags = Array.isArray(v.tags) ? [...v.tags.map(String)] : [];
    const blob = `${v.name ?? ""} ${v.blurb ?? ""} ${tags.join(" ")}`.toLowerCase();
    for (const label of customLabels) {
      const lab = String(label).trim();
      if (!lab) continue;
      const low = lab.toLowerCase();
      const words = tokenizeLabelWords(lab, { minLen: 2 });
      const hit =
        blob.includes(low) ||
        (words.length > 0
          ? words.some((w) => w.length >= 2 && blob.includes(w))
          : false);
      if (!hit) {
        tags.push(lab.length > 42 ? `${lab.slice(0, 39)}…` : lab);
      }
    }
    return { ...v, tags: tags.slice(0, 8) };
  });
}

export async function generateGiftIdeasWithGroq({
  hobbyTitles,
  customLabels,
  excludedProductNames = [],
  gender,
  budgetUSD,
  wantDIY = false,
  giftPreference = null,
  budgetUnlimited = false,
  selectedHobbyIds = [],
  recipientId = null,
  recipientAgeRange = null,
  recipientGroupSize = null,
  relaxedCustom = false,
  minBudgetUSD = 0,
}) {
  if (!isGroqConfigured()) return null;

  const isGroup = typeof recipientId === "string" && recipientId.startsWith("group-");
  const groupComposition = isGroup ? recipientId.split("-").at(-1) : null;

  const genderLabel = isGroup
    ? groupComposition === "male"
      ? "a group of men"
      : groupComposition === "female"
        ? "a group of women"
        : "a mixed group of people"
    : gender === "male"
      ? "a man"
      : gender === "female"
        ? "a woman"
        : gender === "nonbinary"
          ? "a nonbinary person"
          : "a person";

  const hobbyKey = primaryHobbyKey(selectedHobbyIds, customLabels);
  const customOnlyNoMapped =
    (selectedHobbyIds?.length ?? 0) === 0 &&
    (customLabels?.length ?? 0) > 0 &&
    inferHobbyIdsFromCustomLabels(customLabels).length === 0;

  const minUsd = Math.max(0, Number(minBudgetUSD) || 0);
  const minInstruction =
    !budgetUnlimited && minUsd > 0
      ? ` Each variant’s priceUSD should be at least ~$${Math.round(minUsd)} USD when a realistic product exists at that level (user’s minimum floor).`
      : "";
  const budgetInstruction = budgetUnlimited
    ? `Budget: UNLIMITED — include impressive premium ideas when they fit (flagship GPUs, prebuilt workstations, pro tools, luxury experiences). Use realistic US retail ballparks in priceUSD.`
    : `Soft budget ~$${Number(budgetUSD).toFixed(0)} USD — most variants should fall near or under this; one slightly higher tier is OK if the blurb explains it.${minInstruction}`;

  const pref =
    giftPreference === "diy" ||
    giftPreference === "experience" ||
    giftPreference === "premade"
      ? giftPreference
      : wantDIY
        ? "diy"
        : "premade";

  const preferenceSection =
    pref === "diy"
      ? `
CRITICAL — **Handmade & personal** (NOT mainly PC/electronics toolkits):
- The user wants **gifts they create or deeply personalize**: origami, custom bouquets, love letters / calligraphy, scrapbooks, memory boxes, candle-making, soap-making for beginners, watercolor for cards, couples’ workshops to make something together, etc.
- Include **sentimental, tactile, paper/floral/letter** angles. Electronics soldering / PC building **at most 1–2 ideas** if hobbies demand it.
- **Do not** suggest generic dining/spa/travel **gift cards**—those are not handmade DIY. At least 14 of 18 rows must be clearly handmade/personal-DIY. Set "diy": true on those rows.
`
      : pref === "experience"
        ? `
CRITICAL — **Experiences & memories** (things they *do*):
- Prioritize **tickets, classes, spa days, trips, tours, workshops, memberships, hot-air balloons, driving experiences, concert VIP, cooking schools, wine tastings, escape rooms, national-park passes**, and **gift cards toward travel/dining/spa** when they fit the hobbies.
- Physical objects should be secondary; when included, tie them to an experience (e.g. nice luggage for a trip you describe as part of the blurb).
- Set "diy": false on most rows unless the experience is explicitly a make-it-together workshop.
`
        : `
CRITICAL — **Ready-made products** they unwrap:
- Prioritize **finished, shippable gifts**: gear, accessories, decor, consumables, boxed sets—not open-ended “plan a trip” unless paired with a concrete voucher or pass product.
- **Do not** use generic **dining / spa / hotel / travel “experience gift card”** rows as filler. Those are **forbidden** unless the user’s interests explicitly mention food, wine, dining, spa, wellness, travel, or hotels.
- For **sim racing, gaming, PC, cars, music, crafts, fitness, photography**, etc.: suggest **concrete hardware or gear** (e.g. wheel base, pedals, cockpit, GPU, games, tools)—not multi-venue gift cards.
- Set "diy": false unless the product is explicitly a commercial kit they assemble at home.
`;

  const customCoverageSection =
    (customLabels?.length ?? 0) > 0
      ? `
COVERAGE — **User-added custom interests** (mandatory; honor every string): ${JSON.stringify(customLabels)}.
- For **each** string, include **at least 2 gift rows** where the variant name, blurb, or tags clearly reflect that interest (synonyms OK; repeat keywords is fine).
- Examples: "Sim racing" → racing wheel, pedals, cockpit/frame, direct-drive wheel base; include tags like "sim racing", "racing wheel", or words from the user’s string.
- **Never** substitute a generic dining/spa/travel **gift card** for a hobby that calls for **gear or equipment** (sim racing, gaming, music, sports, crafts, tech, etc.).
- Do **not** output a curation where **none** of the ideas relate to these custom strings when they are listed alongside presets—the custom text must appear across several rows.
`
      : "";

  const customOnlySection =
    customOnlyNoMapped && !relaxedCustom
      ? `
FOCUS — **Custom hobbies** (user-typed; may not match preset categories): ${JSON.stringify(customLabels)}.
- Each gift row must connect to at least one of these interests in the variant name, blurb, or tags (use recognizable keywords).
- Prefer specific, shoppable products; put hobby words in "tags" when possible.
`
      : customOnlyNoMapped && relaxedCustom
        ? `
The user’s main interests are these custom hobbies: ${JSON.stringify(customLabels)}.
- At least 14 of 18 rows must include a clear reference in name, blurb, or tags (repeat keywords is OK).
- Concrete products only; avoid empty “gift card” rows unless the card is for a store/activity tied to those hobbies.
`
        : "";

  const excludedSection =
    excludedProductNames.length > 0
      ? `
CRITICAL — **Avoid disliked repeats**:
- Do NOT suggest gifts with the same/similar product names as these previously disliked items:
${JSON.stringify(excludedProductNames.slice(0, 60))}
`
      : "";

  const recipientMeta = formatRecipientMeta(
    recipientId,
    recipientAgeRange,
    recipientGroupSize,
  );

  const prompt = `You are a creative gift curator. Invent concrete, shoppable gift ideas (specific product styles, not vague categories).

Recipient: ${genderLabel}
${recipientMeta}Interests: ${JSON.stringify([...hobbyTitles, ...customLabels])}
Primary hobby bucket (for theming): ${hobbyKey}

${budgetInstruction}
${preferenceSection}
${customCoverageSection}
${customOnlySection}
${excludedSection}

Rules:
- Return **18** objects in "gifts" whenever possible (never fewer than **16** unless the task is truly impossible).
- Each gift: "stableId" (short slug), "category" (section title), "diy" (boolean), "variants" array with 1–3 items (different price tiers or configurations)—use 2–3 when possible.
- Each variant: "name", "blurb" (one sentence), "priceUSD" (number), "tags" (2–6 strings).
- Ideas must feel unique and well-matched—avoid repeating the same product type across rows.
- **Banned (unless interests are food/wine/dining/spa/travel):** rows whose main idea is a generic **experience / dining / spa / hotel gift card** or open-ended cash card. Use **specific products** instead.
- When several interests are listed, include **several** ideas that intentionally **blend two or more** of them (e.g. gaming + music, coffee + reading), not only single-hobby items.

Return ONLY valid JSON:
{
  "intro": "One sentence summarizing your curation.",
  "gifts": [
    {
      "stableId": "slug",
      "category": "Category title",
      "diy": true,
      "variants": [
        { "name": "Specific product style", "blurb": "Why it fits", "priceUSD": 99, "tags": ["tag1","tag2"] }
      ]
    }
  ]
}`;

  const text = await completeGroq(prompt, {
    temperature: relaxedCustom ? 0.48 : 0.55,
    max_tokens: 8192,
  });
  const parsed = extractJsonObject(text);
  const rawList = parsed.gifts;
  if (!Array.isArray(rawList) || rawList.length === 0) return null;

  const filtered = rawList.filter(
    (row) => !shouldDropLazyExperienceGiftCardRow(row, pref, customLabels),
  );
  const listToUse = filtered.length > 0 ? filtered : rawList;

  const intro = typeof parsed.intro === "string" ? parsed.intro : "";
  const pickContext = buildPickContext(selectedHobbyIds, customLabels);

  const out = [];
  for (let i = 0; i < Math.min(listToUse.length, MAX_AI_GIFTS); i++) {
    const item = listToUse[i];
    const vars = Array.isArray(item.variants) ? item.variants : [];
    if (vars.length === 0) continue;

    const base = slugId(item.stableId ?? item.category ?? `g${i}`);
    const rowId = `gq-${base}-${i}`;

    const varsTagged = enrichVariantTagsForCustomHobbies(
      vars.slice(0, 3),
      customLabels,
    );

    const variants = varsTagged.map((v, j) => ({
      id: `${rowId}-v${j}`,
      name: typeof v.name === "string" ? v.name : `Option ${j + 1}`,
      priceUSD: clampRetailPriceUSD(
        v.priceUSD,
        budgetUSD,
        budgetUnlimited,
        minUsd,
      ),
      rating: 4.65,
      tags: Array.isArray(v.tags) ? v.tags.map(String).slice(0, 8) : [],
      blurb:
        typeof v.blurb === "string"
          ? v.blurb
          : "Thoughtful match for their interests.",
      reviews: realisticReviewsForVariant(
        typeof v.name === "string" ? v.name : "Gift",
        `${rowId}-v${j}`,
      ),
    }));

    const row = {
      id: rowId,
      categoryTitle:
        typeof item.category === "string" ? item.category : "Gift idea",
      forGender: null,
      variants,
      _aiGenerated: true,
    };

    const finalized = finalizeGiftRow(
      row,
      budgetUSD,
      hobbyKey,
      budgetUnlimited,
      pickContext,
      minUsd,
    );
    if (finalized) out.push(finalized);
  }

  if (out.length === 0) return null;
  return {
    gifts: sortFinalizedGiftsForDisplay(
      out,
      budgetUSD,
      budgetUnlimited,
      pickContext,
      minUsd,
    ),
    intro,
  };
}

/** Larger chunks = fewer round trips (helps Groq rate limits). */
const RETAIL_ESTIMATE_CHUNK = 48;

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clampAggregateStarRating(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const r = Math.round(x * 10) / 10;
  return Math.min(5, Math.max(1, r));
}

/**
 * Typical US retail price + plausible aggregate star rating per variant (one Groq round-trip per chunk).
 * @param {{ id: string, name: string, blurb?: string, categoryTitle?: string }[]} items
 * @param {{ softBudgetUSD?: number | null, budgetUnlimited?: boolean }} [ctx]
 * @returns {Promise<{ prices: Record<string, number>, ratings: Record<string, number> }>}
 */
async function estimateRetailPricesAndRatingsWithGroq(items, ctx = {}) {
  if (!isGroqConfigured() || !items.length) return { prices: {}, ratings: {} };

  const { softBudgetUSD = null, budgetUnlimited = false } = ctx;
  const budgetNote = budgetUnlimited
    ? "Context: shopper has a very high / open budget — still quote realistic market averages."
    : typeof softBudgetUSD === "number" && Number.isFinite(softBudgetUSD)
      ? `Context: soft gift budget ~$${Math.round(softBudgetUSD)} USD — still estimate true typical retail averages (do not fake all prices to match the budget).`
      : "";

  const prices = {};
  const ratings = {};

  for (let offset = 0; offset < items.length; offset += RETAIL_ESTIMATE_CHUNK) {
    if (offset > 0) {
      await sleepMs(800);
    }
    const chunk = items.slice(offset, offset + RETAIL_ESTIMATE_CHUNK);
    const prompt = `For each item, estimate:
1) **avgUSD** — typical US retail price for a comparable new product (mid-range SKU on major marketplaces; not the cheapest used deal).
2) **avgStars** — plausible **aggregate** customer star rating (1.0–5.0, one decimal) as if averaged from thousands of reviews on major retailers. Use real-world spread: excellent mainstream items often ~4.3–4.8; niche, finicky, or budget categories can be ~3.5–4.2; rarely above 4.9 or below 3.0 unless the product type clearly warrants it. Do **not** give every item the same score.

${budgetNote}

Return ONLY valid JSON:
{"estimates":[{"id":"<exact id from input>","avgUSD":<number>,"avgStars":<number>}]}

Rules:
- Include every input item once; "id" must match exactly (character-for-character).
- avgUSD: positive number, USD, no symbol.
- avgStars: number from 1.0 to 5.0 (one decimal is fine).
- For experiences (classes, tickets, spa), estimate usual purchase price and typical satisfaction-style aggregate if applicable (~4.0–4.8).

Items:
${JSON.stringify(chunk)}`;

    const text = await completeGroq(prompt, {
      temperature: 0.18,
      max_tokens: 8192,
    });
    const parsed = extractJsonObject(text);
    const rows = Array.isArray(parsed.estimates)
      ? parsed.estimates
      : Array.isArray(parsed.prices)
        ? parsed.prices
        : [];
    for (const row of rows) {
      if (typeof row?.id !== "string") continue;
      if (
        typeof row.avgUSD === "number" &&
        Number.isFinite(row.avgUSD) &&
        row.avgUSD > 0
      ) {
        prices[row.id] = row.avgUSD;
      }
      const stars = clampAggregateStarRating(row.avgStars);
      if (stars != null) ratings[row.id] = stars;
    }
  }

  return { prices, ratings };
}

/**
 * Replace variant priceUSD with Groq-estimated averages and re-pick default variants for budget.
 * @param {{ gifts: object[] } | null} rec
 * @param {number} recommendationBudgetUsd
 * @param {boolean} budgetUnlimited
 * @param {{ groups?: { terms: string[] }[] } | null} [pickContext]
 */
export async function enrichResultWithRetailPriceEstimates(
  rec,
  recommendationBudgetUsd,
  budgetUnlimited,
  pickContext = null,
  minBudgetUSD = 0,
) {
  if (!isGroqConfigured() || !rec?.gifts?.length) return rec;

  const items = [];
  for (const g of rec.gifts) {
    for (const v of g.variants || []) {
      items.push({
        id: v.id,
        name: v.name,
        blurb: typeof v.blurb === "string" ? v.blurb : "",
        categoryTitle:
          typeof g.categoryTitle === "string" ? g.categoryTitle : "",
      });
    }
  }
  if (!items.length) return rec;

  try {
    const { prices: priceMap, ratings: ratingMap } =
      await estimateRetailPricesAndRatingsWithGroq(items, {
        softBudgetUSD: budgetUnlimited ? null : recommendationBudgetUsd,
        budgetUnlimited,
      });
    const cap = budgetUnlimited ? Infinity : recommendationBudgetUsd;
    const minUsd = budgetUnlimited
      ? 0
      : Math.max(0, Number(minBudgetUSD) || 0);
    const nextGifts = rec.gifts
      .map((gift) => {
        const nextVariants = (gift.variants || []).map((v) => {
          let next = v;
          const rawPrice = priceMap[v.id];
          if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) {
            const priceUSD = clampRetailPriceUSD(
              rawPrice,
              recommendationBudgetUsd,
              budgetUnlimited,
              minUsd,
            );
            next = { ...next, priceUSD };
          }
          const r = ratingMap[v.id];
          if (typeof r === "number" && Number.isFinite(r)) {
            next = { ...next, rating: r };
          }
          return next;
        });
        return finalizeGiftRow(
          { ...gift, variants: nextVariants },
          cap,
          gift._sourceHobbyId,
          budgetUnlimited,
          pickContext,
          minUsd,
        );
      })
      .filter(Boolean);
    const sorted = sortFinalizedGiftsForDisplay(
      nextGifts,
      recommendationBudgetUsd,
      budgetUnlimited,
      pickContext,
      minUsd,
    );
    return { ...rec, gifts: sorted };
  } catch {
    return rec;
  }
}

/**
 * Generate luxury / no-budget-limit gift ideas via Groq.
 */
export async function generateLuxuryGiftsWithGroq({
  hobbyTitles,
  customLabels,
  gender,
  wantDIY = false,
}) {
  if (!isGroqConfigured()) return null;

  const genderLabel =
    gender === "male"
      ? "a man"
      : gender === "female"
        ? "a woman"
        : gender === "nonbinary"
          ? "a nonbinary person"
          : "a person";

  const prompt = `You are an expert luxury gift advisor with deep knowledge of premium products worldwide.

User context:
- Recipient: ${genderLabel}
- Interests: ${JSON.stringify([...hobbyTitles, ...customLabels])}
- Budget: No limit — focus on premium, luxury, and high-end gifts
${wantDIY ? "- Preference: bespoke, handcrafted, or experiential gifts\n" : ""}
Suggest 8 exceptional gifts. Think: luxury watches, fine jewellery, premium experiences (private lessons, retreats, tastings), bespoke clothing, high-end tech, collector editions, and rare items.
Choose gifts that genuinely match their interests — a gamer gets a premium gaming chair or limited-edition console, not a generic luxury item.

Return ONLY valid JSON (no markdown fences):
{
  "gifts": [
    {
      "id": "lux-1",
      "name": "Exact product or experience name",
      "category": "E.g. Timepieces / Jewellery / Experience / Tech / Fashion",
      "priceRange": "E.g. \$500\u2013\$2,000 or \$10,000+",
      "blurb": "One compelling sentence: why this is the perfect luxury gift for them.",
      "searchQuery": "Short Google Shopping search string to find this"
    }
  ],
  "curatorNote": "One sentence explaining the overall curation rationale."
}`;

  const text = await completeGroq(prompt);
  const parsed = extractJsonObject(text);
  if (!Array.isArray(parsed.gifts) || parsed.gifts.length === 0) return null;
  return {
    gifts: parsed.gifts,
    curatorNote:
      typeof parsed.curatorNote === "string" ? parsed.curatorNote : "",
  };
}

/**
 * Pick which retailer search is most likely to surface competitive prices.
 */
export async function pickBestRetailerWithGroq({
  productName,
  countryLabel,
  retailers,
}) {
  if (!isGroqConfigured() || !retailers.length) return null;

  const options = retailers.map((r) => ({
    id: r.id,
    label: r.label,
  }));

  const prompt = `You help shoppers find the best place to START a product search for price and availability (not live prices—you choose typical best marketplace).

Product: ${JSON.stringify(productName)}
Country/region: ${JSON.stringify(countryLabel)}

Retailers (pick exactly one id from the list):
${JSON.stringify(options, null, 2)}

Consider: Amazon for fast shipping and wide selection; AliExpress for budget accessories; Etsy for handmade; Facebook Marketplace for local used/neighborhood deals; SHEIN/ASOS for fashion; Google Shopping for comparing prices across stores; local for in-person pickup.

Return ONLY JSON: {"retailerId":"<one id from list>","reason":"one short sentence"}`;

  const text = await completeGroq(prompt);
  const parsed = extractJsonObject(text);
  const rid =
    typeof parsed.retailerId === "string" ? parsed.retailerId.trim() : "";
  if (!rid) return null;
  const hit =
    retailers.find((r) => r.id === rid) ||
    retailers.find((r) => r.id.toLowerCase() === rid.toLowerCase());
  if (!hit) return null;
  return {
    url: hit.url,
    retailerId: hit.id,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}
