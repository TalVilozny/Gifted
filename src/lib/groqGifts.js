import {
  finalizeGiftRow,
  inferHobbyIdsFromCustomLabels,
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

function clampPriceUSD(n, budgetUSD, budgetUnlimited) {
  const x = Number(n);
  const cap =
    typeof budgetUSD === "number" && Number.isFinite(budgetUSD) ? budgetUSD : 75;
  if (!Number.isFinite(x) || x < 0) {
    return budgetUnlimited ? 120 : Math.max(25, Math.min(cap, 500));
  }
  if (budgetUnlimited) return Math.min(Math.max(x, 10), 50_000);
  return Math.min(Math.max(x, 15), Math.max(cap * 2.5, 400));
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
 *   gender: string,
 *   budgetUSD: number | null,
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
  gender,
  budgetUSD,
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
Reorder the gift options from MOST exciting and memorable to still-good, best overall fit for ${reorderTarget}.

Guidance:
- Prefer **variety**: do not rank five similar small accessories at the top when the list includes bigger or more distinctive gifts for the same hobby.
- For **PC / gaming / tech** interests: prioritize flagship or high-impact items when present (e.g. prebuilt PCs, GPUs, premium monitors, core components) over minor desk clutter—unless DIY mode is on.
- For **unlimited budget**: lead with the most impressive, premium, or "main event" gifts in the list before accessories.

Rules:
- Return ONLY valid JSON with keys orderedIds (array of strings) and shortReason (one sentence).
- orderedIds must contain every "id" from options exactly once, no extras or duplicates.

options:
${JSON.stringify(options, null, 2)}`;

  const text = await completeGroq(prompt, { temperature: 0.45 });
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
  return {
    gifts: ordered,
    reason: typeof parsed.shortReason === "string" ? parsed.shortReason : "",
  };
}

/**
 * Invent fresh gift ideas via Groq (not limited to the static catalog).
 * giftPreference: diy | experience | premade shapes the catalog-style ideas.
 */
export async function generateGiftIdeasWithGroq({
  hobbyTitles,
  customLabels,
  gender,
  budgetUSD,
  wantDIY = false,
  giftPreference = null,
  budgetUnlimited = false,
  selectedHobbyIds = [],
  recipientId = null,
  recipientAgeRange = null,
  recipientGroupSize = null,
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

  const budgetInstruction = budgetUnlimited
    ? `Budget: UNLIMITED — include impressive premium ideas when they fit (flagship GPUs, prebuilt workstations, pro tools, luxury experiences). Use realistic US retail ballparks in priceUSD.`
    : `Soft budget ~$${Number(budgetUSD).toFixed(0)} USD — most variants should fall near or under this; one slightly higher tier is OK if the blurb explains it.`;

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
- At least 14 of 18 rows must be clearly handmade/personal-DIY. Set "diy": true on those rows.
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
- Set "diy": false unless the product is explicitly a commercial kit they assemble at home.
`;

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

Rules:
- Return exactly 18 objects in "gifts" (fewer only if impossible—prefer 18).
- Each gift: "stableId" (short slug), "category" (section title), "diy" (boolean), "variants" array with 1–3 items (different price tiers or configurations)—use 2–3 when possible.
- Each variant: "name", "blurb" (one sentence), "priceUSD" (number), "tags" (2–6 strings).
- Ideas must feel unique and well-matched—avoid repeating the same product type across rows.

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

  const text = await completeGroq(prompt, { temperature: 0.55, max_tokens: 8192 });
  const parsed = extractJsonObject(text);
  const rawList = parsed.gifts;
  if (!Array.isArray(rawList) || rawList.length === 0) return null;

  const intro = typeof parsed.intro === "string" ? parsed.intro : "";

  const out = [];
  for (let i = 0; i < Math.min(rawList.length, MAX_AI_GIFTS); i++) {
    const item = rawList[i];
    const vars = Array.isArray(item.variants) ? item.variants : [];
    if (vars.length === 0) continue;

    const base = slugId(item.stableId ?? item.category ?? `g${i}`);
    const rowId = `gq-${base}-${i}`;

    const variants = vars.slice(0, 3).map((v, j) => ({
      id: `${rowId}-v${j}`,
      name: typeof v.name === "string" ? v.name : `Option ${j + 1}`,
      priceUSD: clampPriceUSD(v.priceUSD, budgetUSD, budgetUnlimited),
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

    out.push(finalizeGiftRow(row, budgetUSD, hobbyKey, budgetUnlimited));
  }

  if (out.length === 0) return null;
  return { gifts: out, intro };
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
