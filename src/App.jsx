import { useEffect, useMemo, useRef, useState } from "react";
import GiftedLight from "./Icons/GiftedLight.png";
import GiftedLogo from "./Icons/GiftedLogo.png";
import {
  buildPickContext,
  CURRENCIES,
  DEFAULT_GIFT_IMAGE_URL,
  getRecommendations,
  hobbies,
  inferHobbyIdsFromCustomLabels,
  resolveGiftImage,
  usdToCurrency,
} from "./data/giftCatalog.js";
import {
  pickNextAlternate,
  pickVariantFromRefinement,
} from "./data/productEngine.js";
import { getRetailerLinks, SHOP_COUNTRIES } from "./data/retailers.js";
import {
  enrichResultWithRetailPriceEstimates,
  generateGiftIdeasWithGroq,
  pickBestRetailerWithGroq,
  rankGiftsWithGroq,
} from "./lib/groqGifts.js";
import { fetchPexelsImageUrl, isPexelsConfigured } from "./lib/pexelsImages.js";
import { isGroqConfigured, refineWithGroq } from "./lib/groqRefine.js";
import "./App.css";

function formatMoney(amount, code) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "ILS" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function formatApproxGiftPrice(amount, code) {
  return `~${formatMoney(amount, code)}`;
}

/**
 * Each fetch of recommendations can reuse the same underlying gift ids (e.g. Groq
 * uses `gq-{slug}-{index}`). Prefix a per-load stamp so likes from an earlier batch
 * do not mark a different product as liked when the list refreshes.
 */
function stampGiftIdsForResult(rec) {
  if (!rec?.gifts?.length) return rec;
  const stamp =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return {
    ...rec,
    gifts: rec.gifts.map((g) => {
      const oldId = g.id;
      const newId = `rid-${stamp}::${oldId}`;
      const variants = Array.isArray(g.variants)
        ? g.variants.map((v) => ({
            ...v,
            id:
              typeof v.id === "string" && v.id.startsWith(oldId)
                ? newId + v.id.slice(oldId.length)
                : v.id,
          }))
        : g.variants;
      return { ...g, id: newId, variants };
    }),
  };
}

function Stars({ value, max = 5 }) {
  const full = Math.round(value);
  return (
    <span className="Stars" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < full ? "Stars__on" : "Stars__off"}>
          ★
        </span>
      ))}
    </span>
  );
}

function toggleInList(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

const CUSTOM_HOBBY_FILTER_PREFIX = "__cf:";

function customHobbyFilterId(label) {
  return `${CUSTOM_HOBBY_FILTER_PREFIX}${encodeURIComponent(label)}`;
}

function parseCustomHobbyFilterId(id) {
  if (typeof id !== "string" || !id.startsWith(CUSTOM_HOBBY_FILTER_PREFIX))
    return null;
  try {
    return decodeURIComponent(id.slice(CUSTOM_HOBBY_FILTER_PREFIX.length));
  } catch {
    return null;
  }
}

/** Lowercased text blob for matching result rows to a free-text hobby filter. */
function giftSearchTextForHobbyFilter(gift) {
  const parts = [];
  if (typeof gift.categoryTitle === "string") parts.push(gift.categoryTitle);
  if (gift.variants?.length) {
    for (const v of gift.variants) {
      if (v.name) parts.push(v.name);
      if (v.blurb) parts.push(v.blurb);
      if (v.tags?.length) parts.push(v.tags.join(" "));
    }
  }
  return parts.join(" ").toLowerCase();
}

const RECIPIENT_RELATIONS = [
  { id: "boyfriend", label: "Boyfriend", hint: "Partner", emoji: "💙" },
  { id: "girlfriend", label: "Girlfriend", hint: "Partner", emoji: "💜" },
  { id: "mom", label: "Mom", hint: "Parent", emoji: "🌷" },
  { id: "dad", label: "Dad", hint: "Parent", emoji: "🌿" },
  { id: "kid", label: "Kid", hint: "Child or teen", emoji: "🧒" },
];

/** Slider bounds for age in years (who you’re gifting). */
function ageLimitsForRecipient(recipientId) {
  if (!recipientId) return { min: 0, max: 100 };
  if (typeof recipientId === "string" && recipientId.startsWith("group-")) {
    // For group gifting we treat age as a broad range; users can still tune
    // the slider and the prompt will include the exact age they pick.
    return { min: 0, max: 100 };
  }
  if (recipientId === "mom" || recipientId === "dad")
    return { min: 20, max: 100 };
  if (recipientId === "boyfriend" || recipientId === "girlfriend") {
    return { min: 15, max: 100 };
  }
  if (recipientId === "kid") return { min: 0, max: 17 };
  return { min: 0, max: 100 };
}

const GENDER_OPTIONS = [
  { id: "male", label: "Male", hint: "He / him", emoji: "♂" },
  { id: "female", label: "Female", hint: "She / her", emoji: "♀" },
  { id: "nonbinary", label: "Nonbinary", hint: "They / them", emoji: "⚧" },
  { id: "other", label: "Other", hint: "Any / all", emoji: "♥" },
];

const GROUP_KIND_OPTIONS = [
  {
    id: "workmates",
    label: "Workmates",
    hint: "Co-workers",
    emoji: "🧑‍💼",
  },
  { id: "party", label: "Party", hint: "Celebration group", emoji: "🎉" },
  { id: "family", label: "Family", hint: "Relatives & home", emoji: "🏡" },
  { id: "friends", label: "Friends", hint: "Friend group", emoji: "🍻" },
  { id: "class", label: "Class", hint: "School or class group", emoji: "🎓" },
];

/** @param {string | null} id */
function recipientIdToGender(id) {
  if (typeof id === "string" && id.startsWith("group-")) {
    // Format: group-{groupKind}-{composition}
    const composition = id.split("-").at(-1);
    if (composition === "male") return "male";
    if (composition === "female") return "female";
    return "nonbinary";
  }
  switch (id) {
    case "male":
    case "boyfriend":
    case "dad":
      return "male";
    case "female":
    case "girlfriend":
    case "mom":
      return "female";
    case "nonbinary":
      return "nonbinary";
    case "friend":
    case "kid":
      return "nonbinary";
    case "other":
      return "other";
    default:
      return "other";
  }
}

/** Short label for budget recap */
function recipientRecapLabel(id) {
  if (typeof id === "string" && id.startsWith("group-")) {
    const groupKind = id.split("-")[1] ?? "group";
    const pretty =
      groupKind === "workmates"
        ? "workmates"
        : groupKind === "party"
          ? "party"
          : groupKind === "family"
            ? "family"
            : groupKind === "friends"
              ? "friends"
              : groupKind === "team"
                ? "team"
                : groupKind;
    return `your ${pretty}`;
  }
  switch (id) {
    case "boyfriend":
      return "your boyfriend";
    case "girlfriend":
      return "your girlfriend";
    case "mom":
      return "your mom";
    case "dad":
      return "your dad";
    case "friend":
      return "your friend";
    case "kid":
      return "your kid";
    case "male":
      return "a man";
    case "female":
      return "a woman";
    case "nonbinary":
      return "a nonbinary person";
    case "other":
      return "someone";
    default:
      return "them";
  }
}

/** @param {string} s */
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const REFINE_STOP = new Set([
  "the",
  "a",
  "an",
  "for",
  "and",
  "with",
  "from",
  "new",
  "pro",
  "plus",
  "mini",
  "set",
  "pack",
  "gift",
  "edition",
]);

const REFINE_PLACEHOLDER_BY_HOBBY = {
  gaming: [
    "physical edition, not digital only",
    "matching controller color",
    "collector's art or standard box",
    "gift wrap or digital code",
  ],
  fitness: [
    "foam roller — firm density",
    "resistance bands full set",
    "extra thick yoga mat",
    "adjustable dumbbells pair",
  ],
  reading: [
    "hardcover gift edition",
    "large print if available",
    "audiobook add-on",
    "boxed set or single volume",
  ],
  coffee: [
    "dark roast whole bean",
    "electric burr grinder",
    "pour-over dripper size 2",
    "travel mug leakproof",
  ],
  music: [
    "noise cancelling over-ear",
    "open-back for home listening",
    "wired studio use",
    "limited vinyl colorway",
  ],
  crafts: [
    "beginner-friendly kit",
    "natural fiber yarn",
    "left-handed scissors",
    "gift box add-on",
  ],
  photo: [
    "50mm prime lens",
    "carbon fiber tripod",
    "SD card 128GB+",
    "mirrorless not DSLR",
  ],
  cooking: [
    "oven-safe nonstick",
    "carbon steel wok",
    "chef's knife 8 inch",
    "cast iron preseasoned",
  ],
  design: [
    "A5 grid notebook",
    "minimal desk mat",
    "font pack for print",
    "matte not glossy paper",
  ],
  garden: [
    "indoor herb starter",
    "ceramic planters medium",
    "ergonomic pruning shears",
    "heirloom seed mix",
  ],
  style: [
    "wool blend, neutral tone",
    "travel size set",
    "silver-tone hardware",
    "unscented option",
  ],
  cars: [
    "front + rear dash cam",
    "microfiber detailing kit",
    "OBD2 Bluetooth reader",
    "all-weather floor mats",
  ],
  makeup: [
    "warm undertone shades",
    "matte not dewy finish",
    "travel minis",
    "vegan or cruelty-free",
  ],
  pcbuilding: [
    "750W gold PSU",
    "32GB RAM kit",
    "mesh case airflow",
    "RGB off, minimal lighting",
  ],
  luxury: [
    "engraving or monogram",
    "appointment or experience",
    "signature scent notes",
    "presentation gift box",
  ],
  general: [
    "smaller size if available",
    "under $X budget",
    "gift receipt friendly",
    "eco packaging",
  ],
  kids: [
    "age range on the box",
    "favorite character or theme",
    "indoor vs outdoor play",
    "no small parts / choking safe",
  ],
};

/** First distinctive word from a product title to personalize refine hints. */
function firstSignificantProductWord(name) {
  if (!name || typeof name !== "string") return "";
  const parts = name.split(/\s+/);
  for (const raw of parts) {
    const word = raw.replace(/[^\w]/g, "");
    if (word.length > 2 && !REFINE_STOP.has(word.toLowerCase())) {
      return word.length > 22 ? `${word.slice(0, 22)}…` : word;
    }
  }
  return "";
}

/**
 * Placeholder for “Be more specific” — varies by hobby, product, and gift id.
 * @param {{ id: string, _sourceHobbyId?: string, categoryTitle?: string }} gift
 * @param {{ name?: string }} product
 */
function refinePlaceholderForGift(gift, product) {
  const hid = gift._sourceHobbyId;
  const pool =
    REFINE_PLACEHOLDER_BY_HOBBY[hid] ?? REFINE_PLACEHOLDER_BY_HOBBY.general;
  const seed = hashString(
    `${gift.id}|${product.name ?? ""}|${gift.categoryTitle ?? ""}`,
  );
  const line = pool[seed % pool.length];

  const word = firstSignificantProductWord(product.name ?? "");
  const useWord = word && seed % 3 !== 0;
  if (useWord) {
    const combined = `${word} — ${line}`;
    if (combined.length <= 58) {
      return `e.g. "${combined}"`;
    }
  }

  const cat = (gift.categoryTitle || "").trim();
  if (cat && seed % 3 === 0 && cat.length <= 28) {
    const withCat = `${cat}: ${line}`;
    if (withCat.length <= 58) {
      return `e.g. "${withCat}"`;
    }
  }

  return `e.g. "${line}"`;
}

/** Horizontal picker strip — item width in px (must match CSS). */
const CASE_ITEM_PX = 152;
const CASE_CYCLES = 52;
/** Slightly longer than CSS transition (4.6s) so `transitionend` can win. */
const CASE_TRANSITION_FALLBACK_MS = 5600;
/**
 * When the chosen variant is above this multiple of the soft recommendation budget,
 * show an in-card note. Small overages stay unlabeled; large jumps (e.g. ~2×) are flagged.
 */
const BUDGET_OVER_NOTICE_RATIO = 1.28;
const APP_PATH = "/Gifted";
const PRIVACY_PATH = "/Gifted/privacy-policy";
const DIY_TUTORIAL_BUDGET_MAX_USD = 60;
const DIY_TUTORIALS = [
  {
    id: "ribbon-bouquet",
    title: "Satin ribbon roses bouquet",
    note: "A handmade bouquet you can craft with ribbon and basic supplies.",
    url: "https://www.youtube.com/watch?v=Aq86i-Qt1AQ&pp=ygURZGl5IHJvc2VzIGJvdXF1ZXQ%3D",
  },
  {
    id: "love-letter-ideas",
    title: "Custom love letter ideas and format",
    note: "Turn simple paper and a pen into a personal keepsake gift.",
    url: "https://www.youtube.com/results?search_query=custom+love+letter+ideas+gift",
  },
  {
    id: "love-letter-calligraphy",
    title: "Calligraphy-style love letter tutorial",
    note: "Make your letter look premium with simple calligraphy tips.",
    url: "https://www.youtube.com/results?search_query=love+letter+calligraphy+tutorial",
  },
  {
    id: "memory-jar",
    title: "DIY memory jar gift",
    note: "Low-cost and personal: notes, memories, and small keepsakes.",
    url: "https://www.youtube.com/results?search_query=diy+memory+jar+gift",
  },
  {
    id: "origami-flowers",
    title: "Origami flower gift tutorial",
    note: "Budget-friendly paper craft that still feels thoughtful.",
    url: "https://www.youtube.com/results?search_query=origami+flower+gift+tutorial",
  },
  {
    id: "handmade-card",
    title: "Handmade pop-up card",
    note: "A custom card with a pop-up element for birthdays or anniversaries.",
    url: "https://www.youtube.com/results?search_query=handmade+pop+up+card+tutorial",
  },
  {
    id: "photo-collage-box",
    title: "Explosion box photo collage gift",
    note: "A memorable DIY box filled with photos and short messages.",
    url: "https://www.youtube.com/results?search_query=explosion+box+photo+gift+tutorial",
  },
  {
    id: "coupon-book",
    title: "DIY romantic coupon book",
    note: "Create personalized coupons for dates, favors, and fun moments.",
    url: "https://www.youtube.com/results?search_query=diy+coupon+book+gift",
  },
  {
    id: "paper-bouquet",
    title: "DIY paper flower bouquet",
    note: "A handmade bouquet with colored paper and basic craft tools.",
    url: "https://www.youtube.com/results?search_query=diy+paper+flower+bouquet",
  },
  {
    id: "scrapbook-mini",
    title: "Mini scrapbook gift tutorial",
    note: "A compact scrapbook with photos, captions, and keepsake pages.",
    url: "https://www.youtube.com/results?search_query=mini+scrapbook+gift+tutorial",
  },
  {
    id: "bracelet-handmade",
    title: "Handmade bracelet gift",
    note: "Simple DIY jewelry idea with thread or beads.",
    url: "https://www.youtube.com/results?search_query=handmade+bracelet+gift+tutorial",
  },
  {
    id: "candle-diy",
    title: "DIY scented candle gift",
    note: "Budget candle-making gift with custom scents and jar labels.",
    url: "https://www.youtube.com/results?search_query=diy+scented+candle+gift",
  },
  {
    id: "gift-box-assembly",
    title: "How to make a handmade gift box",
    note: "Build a custom gift box and presentation from craft paper.",
    url: "https://www.youtube.com/results?search_query=handmade+gift+box+tutorial",
  },
];

function pickRandomTutorialIds(allItems, count, previousIds = []) {
  if (!Array.isArray(allItems) || allItems.length === 0) return [];
  const n = Math.max(1, Math.min(count, allItems.length));
  const prev = new Set(previousIds);

  const fresh = allItems.filter((x) => !prev.has(x.id));
  const pool = fresh.length >= n ? fresh : allItems;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map((x) => x.id);
}

function getPageFromLocation() {
  if (typeof window === "undefined") return "app";
  const p = window.location.pathname.replace(/\/+$/, "") || "/";
  return p === PRIVACY_PATH ? "privacy" : "app";
}

function isSubscriptionLikeGift(gift, product) {
  const chunks = [
    product?.name,
    product?.blurb,
    gift?.categoryTitle,
    ...(Array.isArray(product?.tags) ? product.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(subscription|subscribed|membership|monthly|annual|plan|pass|credits?|gift card|voucher|box)\b/.test(
    chunks,
  );
}

function buildImageSearchQuery(product, gift) {
  const base = `${product?.name ?? ""} ${gift?.categoryTitle ?? ""}`.trim();
  const normalized = base
    .replace(/\bmousepad\b/gi, "mouse pad")
    .replace(/\bheadset\b/gi, "headphones")
    .replace(/\bkeycap\b/gi, "keyboard keycap");
  return `${normalized} product photo`.trim();
}

function ProductImage({ searchQuery, fallbackSrc, usePexels = true }) {
  const safeFallback = fallbackSrc || DEFAULT_GIFT_IMAGE_URL;
  const fallbackRef = useRef(safeFallback);
  fallbackRef.current = safeFallback;

  const [src, setSrc] = useState(safeFallback);
  const loadGenRef = useRef(0);

  useEffect(() => {
    const gen = ++loadGenRef.current;
    setSrc(safeFallback);
    if (!usePexels || !isPexelsConfigured()) return;
    let cancelled = false;
    fetchPexelsImageUrl(searchQuery)
      .then((url) => {
        if (!cancelled && gen === loadGenRef.current && url) setSrc(url);
      })
      .catch(() => {
        /* keep catalog fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery, safeFallback, usePexels]);

  function handleImgError() {
    setSrc((prev) => {
      const fb = fallbackRef.current;
      if (prev !== fb) return fb;
      if (fb !== DEFAULT_GIFT_IMAGE_URL) return DEFAULT_GIFT_IMAGE_URL;
      return prev;
    });
  }

  return (
    <img
      className="GiftCard__img"
      src={src || DEFAULT_GIFT_IMAGE_URL}
      alt=""
      loading="lazy"
      decoding="async"
      onError={handleImgError}
    />
  );
}

export default function App() {
  const [pageMode, setPageMode] = useState(getPageFromLocation);
  const [step, setStep] = useState("who");
  const [audienceMode, setAudienceMode] = useState(null);
  const [recipientId, setRecipientId] = useState(null);
  /** Age in years (constrained by relationship — see `ageLimits`). */
  const [recipientAgeYears, setRecipientAgeYears] = useState(25);
  /** Group gifting selections (only used when `audienceMode === "group"`). */
  const [groupKindId, setGroupKindId] = useState(null);
  const [groupGenderMode, setGroupGenderMode] = useState(null); // 'male' | 'female' | 'mixed'
  const [groupSize, setGroupSize] = useState(4);
  const [groupSizeText, setGroupSizeText] = useState("");
  const [isGroupSizeEditing, setIsGroupSizeEditing] = useState(false);
  const [diyTutorialIds, setDiyTutorialIds] = useState([]);
  /** @type {'diy' | 'experience' | 'premade' | null} */
  const [giftPreference, setGiftPreference] = useState(null);
  /** @type {{ key: string, gift: object }[]} */
  const [likedEntries, setLikedEntries] = useState([]);
  /** @type {{ key: string, gift: object, nameKey: string, sourceId: string }[]} */
  const [dislikedEntries, setDislikedEntries] = useState([]);
  const [dislikedIds, setDislikedIds] = useState([]);
  const [isReloading, setIsReloading] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [caseTranslateX, setCaseTranslateX] = useState(0);
  const [caseTransitionOn, setCaseTransitionOn] = useState(false);
  const [caseRunning, setCaseRunning] = useState(false);
  /** @type {{ key: string, gift: object } | null} */
  const [caseWinner, setCaseWinner] = useState(null);
  const caseViewportRef = useRef(null);
  const casePendingRef = useRef(null);
  const caseFallbackTimerRef = useRef(null);
  const [selectedHobbyIds, setSelectedHobbyIds] = useState([]);
  const [customHobbies, setCustomHobbies] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [budgetSlider, setBudgetSlider] = useState(75);
  const [budgetUnlimited, setBudgetUnlimited] = useState(false);
  const [budgetAmountText, setBudgetAmountText] = useState("");
  const [isBudgetAmountEditing, setIsBudgetAmountEditing] = useState(false);
  const [result, setResult] = useState(null);
  const [activeHobbyFilterId, setActiveHobbyFilterId] = useState(null);
  /** @type {Record<string, string>} */
  const [variantByGiftId, setVariantByGiftId] = useState({});
  /** @type {Record<string, string>} */
  const [refineByGiftId, setRefineByGiftId] = useState({});
  const [refiningId, setRefiningId] = useState(null);
  /** @type {Record<string, string>} */
  const [groqNoteByGiftId, setGroqNoteByGiftId] = useState({});
  /** @type {Record<string, string>} */
  const [refineErrorByGiftId, setRefineErrorByGiftId] = useState({});
  const [openingGiftId, setOpeningGiftId] = useState(null);
  const [wantThisErrorByGiftId, setWantThisErrorByGiftId] = useState({});

  const budgetAnimateRafRef = useRef(null);

  const groqReady = useMemo(() => isGroqConfigured(), []);
  const pexelsReady = useMemo(() => isPexelsConfigured(), []);

  const gender = useMemo(
    () => (recipientId ? recipientIdToGender(recipientId) : null),
    [recipientId],
  );

  /** Slider cap in USD; use “endless budget” for spends above this. */
  const BUDGET_MAX_USD = 2500;
  /** Minimum budget in display currency (slider + input floor). */
  const budgetMinDisplay = 0;

  const budgetUsd = useMemo(() => {
    const rate = 1 / (usdToCurrency(1, currency) || 1);
    return budgetSlider * rate;
  }, [budgetSlider, currency]);

  const isGroupRecipient = useMemo(
    () => typeof recipientId === "string" && recipientId.startsWith("group-"),
    [recipientId],
  );
  const safeGroupSize = useMemo(
    () => Math.max(2, Number.isFinite(groupSize) ? Math.round(groupSize) : 2),
    [groupSize],
  );
  const groupSizeInputValid = useMemo(() => {
    const raw = groupSizeText.trim();
    if (raw === "") return false;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 2;
  }, [groupSizeText]);
  const recommendationBudgetUsd = useMemo(() => {
    if (budgetUnlimited) return budgetUsd;
    if (!isGroupRecipient) return budgetUsd;
    return budgetUsd / safeGroupSize;
  }, [budgetUnlimited, budgetUsd, isGroupRecipient, safeGroupSize]);

  const effectiveBudgetUsd = useMemo(
    () => (budgetUnlimited ? Infinity : recommendationBudgetUsd),
    [budgetUnlimited, recommendationBudgetUsd],
  );

  const budgetInCurrency = budgetSlider;

  useEffect(() => {
    if (budgetUnlimited) {
      setBudgetAmountText("");
      return;
    }
    if (isBudgetAmountEditing) return;
    setBudgetAmountText(String(Math.round(budgetInCurrency)));
  }, [budgetUnlimited, isBudgetAmountEditing, budgetInCurrency]);

  useEffect(() => {
    if (isGroupSizeEditing) return;
    setGroupSizeText(String(safeGroupSize));
  }, [isGroupSizeEditing, safeGroupSize]);

  const maxDisplay = useMemo(
    () => usdToCurrency(BUDGET_MAX_USD, currency),
    [currency],
  );

  const sliderPct = useMemo(() => {
    if (budgetUnlimited) return 100;
    if (maxDisplay <= 0) return 0;
    return (budgetInCurrency / maxDisplay) * 100;
  }, [budgetUnlimited, budgetInCurrency, maxDisplay]);

  const hasPassions = selectedHobbyIds.length > 0 || customHobbies.length > 0;

  const giftPickContext = useMemo(
    () => buildPickContext(selectedHobbyIds, customHobbies),
    [selectedHobbyIds, customHobbies],
  );

  useEffect(() => {
    if (budgetUnlimited) return;
    setBudgetSlider((prev) => {
      let next = prev;
      if (next > maxDisplay) next = maxDisplay;
      if (next < budgetMinDisplay) next = budgetMinDisplay;
      return next;
    });
  }, [budgetUnlimited, maxDisplay]);

  useEffect(() => {
    return () => {
      if (budgetAnimateRafRef.current != null) {
        cancelAnimationFrame(budgetAnimateRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function syncPageFromLocation() {
      setPageMode(getPageFromLocation());
    }
    // Backward compatibility: if someone lands on old hash routes, normalize once.
    if (window.location.hash === "#Gifted/privacy-policy") {
      window.history.replaceState(null, "", PRIVACY_PATH);
    } else if (window.location.hash === "#Gifted") {
      window.history.replaceState(null, "", APP_PATH);
    }
    window.addEventListener("popstate", syncPageFromLocation);
    syncPageFromLocation();
    return () => window.removeEventListener("popstate", syncPageFromLocation);
  }, []);

  useEffect(() => {
    // Keep each step/page transition starting at the top.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, pageMode]);

  function cancelBudgetRangeAnimation() {
    if (budgetAnimateRafRef.current != null) {
      cancelAnimationFrame(budgetAnimateRafRef.current);
      budgetAnimateRafRef.current = null;
    }
  }

  function handleBudgetUnlimitedToggle(nextChecked) {
    if (!nextChecked) {
      cancelBudgetRangeAnimation();
      setBudgetUnlimited(false);
      return;
    }
    cancelBudgetRangeAnimation();
    const from = budgetSlider;
    const to = maxDisplay;
    if (from >= to - 1) {
      setBudgetSlider(to);
      setBudgetUnlimited(true);
      return;
    }
    const durationMs = 520;
    const t0 = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      const val = from + (to - from) * eased;
      setBudgetSlider(Math.round(val));
      if (t < 1) {
        budgetAnimateRafRef.current = requestAnimationFrame(frame);
      } else {
        budgetAnimateRafRef.current = null;
        setBudgetSlider(to);
        setBudgetUnlimited(true);
      }
    }
    budgetAnimateRafRef.current = requestAnimationFrame(frame);
  }

  function pickRecipient(id) {
    setRecipientId(id);
    const lim = ageLimitsForRecipient(id);
    setRecipientAgeYears(Math.min(lim.max, Math.max(lim.min, 25)));
    setStep("age");
  }

  function scrollToTopNow() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pickGroup(kindId, composition) {
    setGroupKindId(kindId);
    setGroupGenderMode(composition);
    const recipient = `group-${kindId}-${composition}`;
    setRecipientId(recipient);
    const lim = ageLimitsForRecipient(recipient);
    setRecipientAgeYears(Math.min(lim.max, Math.max(lim.min, 25)));
    scrollToTopNow();
    setStep("age");
  }

  const ageLimits = useMemo(
    () => ageLimitsForRecipient(recipientId),
    [recipientId],
  );

  useEffect(() => {
    setRecipientAgeYears((a) =>
      Math.min(ageLimits.max, Math.max(ageLimits.min, a)),
    );
  }, [ageLimits.min, ageLimits.max]);

  const giftPref = giftPreference ?? "premade";

  const ageSliderPct = useMemo(() => {
    const span = ageLimits.max - ageLimits.min;
    if (span <= 0) return 0;
    return ((recipientAgeYears - ageLimits.min) / span) * 100;
  }, [recipientAgeYears, ageLimits.min, ageLimits.max]);

  function continueFromAge() {
    scrollToTopNow();
    setStep("passion");
  }

  function continueFromPassion() {
    scrollToTopNow();
    setStep("budget");
  }

  async function fetchRecommendationsCore() {
    const normalizeGiftName = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const blockedNames = new Set(
      dislikedEntries.map((e) => normalizeGiftName(e?.gift?.selectedProduct?.name)),
    );
    const applyDislikeExclusions = (recIn) => {
      if (!recIn?.gifts?.length || blockedNames.size === 0) return recIn;
      const kept = recIn.gifts.filter((g) => {
        const name = normalizeGiftName(g?.selectedProduct?.name);
        return !name || !blockedNames.has(name);
      });
      return { ...recIn, gifts: kept };
    };

    const inferredIds = inferHobbyIdsFromCustomLabels(customHobbies);
    const hobbyTitles = [...new Set([...selectedHobbyIds, ...inferredIds])]
      .map((id) => hobbies.find((h) => h.id === id)?.title)
      .filter(Boolean);

    let rec = null;

    if (groqReady) {
      try {
        const ai = await generateGiftIdeasWithGroq({
          hobbyTitles,
          customLabels: customHobbies,
          excludedProductNames: [...blockedNames],
          gender,
          budgetUSD: recommendationBudgetUsd,
          wantDIY: giftPref === "diy",
          giftPreference: giftPref,
          budgetUnlimited,
          selectedHobbyIds,
          recipientId,
          recipientAgeRange: String(recipientAgeYears),
          recipientGroupSize: isGroupRecipient ? safeGroupSize : null,
        });
        if (ai?.gifts?.length) {
          rec = applyDislikeExclusions({
            gifts: ai.gifts,
            mode: "in",
            source: "groq",
          });
        }
      } catch {
        /* fall through to catalog */
      }
    }

    if (!rec?.gifts?.length) {
      const catalogRec = getRecommendations({
        selectedHobbyIds,
        customLabels: customHobbies,
        gender,
        budgetUSD: recommendationBudgetUsd,
        wantDIY: giftPref === "diy",
        giftPreference: giftPref,
        budgetUnlimited,
      });
      rec = applyDislikeExclusions({ ...catalogRec, source: "catalog" });

      if (groqReady && rec.gifts.length > 0) {
        try {
          const ranked = await rankGiftsWithGroq({
            gifts: rec.gifts,
            hobbyTitles,
            customLabels: customHobbies,
            gender,
            budgetUSD: budgetUnlimited ? null : recommendationBudgetUsd,
            wantDIY: giftPref === "diy",
            giftPreference: giftPref,
            budgetUnlimited,
            recipientId,
            recipientAgeRange: String(recipientAgeYears),
            recipientGroupSize: isGroupRecipient ? safeGroupSize : null,
          });
          if (ranked?.gifts?.length) {
            let ordered = ranked.gifts;
            if (budgetUnlimited) {
              const pr = ordered.filter(
                (g) =>
                  g._sourceHobbyId === "luxury" ||
                  g.selectedProduct.priceUSD >= 200,
              );
              if (pr.length > 0) ordered = pr;
            }
            rec = applyDislikeExclusions({ ...rec, gifts: ordered });
          }
        } catch {
          /* keep catalog order */
        }
      }
    }

    return rec;
  }

  async function goBudget() {
    if (!hasPassions || !giftPreference) return;
    setVariantByGiftId({});
    setRefineByGiftId({});
    setGroqNoteByGiftId({});
    setRefineErrorByGiftId({});
    setWantThisErrorByGiftId({});
    setDislikedIds([]);
    setStep("thinking");
    setResult(null);

    await new Promise((r) => setTimeout(r, 500));

    const rec = await fetchRecommendationsCore();
    const stamped = stampGiftIdsForResult(rec);
    const priced = groqReady
      ? await enrichResultWithRetailPriceEstimates(
          stamped,
          recommendationBudgetUsd,
          budgetUnlimited,
          giftPickContext,
        )
      : stamped;
    setResult(priced);
    if (giftPref === "diy") {
      setDiyTutorialIds((prev) =>
        pickRandomTutorialIds(DIY_TUTORIALS, 3, prev),
      );
    }
    setStep("results");
  }

  async function reloadSuggestions() {
    setIsReloading(true);
    setVariantByGiftId({});
    setRefineByGiftId({});
    setGroqNoteByGiftId({});
    setRefineErrorByGiftId({});
    setWantThisErrorByGiftId({});
    setDislikedIds([]);
    try {
      const rec = await fetchRecommendationsCore();
      const stamped = stampGiftIdsForResult(rec);
      const priced = groqReady
        ? await enrichResultWithRetailPriceEstimates(
            stamped,
            recommendationBudgetUsd,
            budgetUnlimited,
            giftPickContext,
          )
        : stamped;
      setResult(priced);
      if (giftPref === "diy") {
        setDiyTutorialIds((prev) =>
          pickRandomTutorialIds(DIY_TUTORIALS, 3, prev),
        );
      }
    } finally {
      setIsReloading(false);
    }
  }

  useEffect(() => {
    // When a new gift list arrives (initial results, More ideas, etc.),
    // return the filter to "All hobbies" so nothing is hidden unexpectedly.
    if (!result?.gifts?.length) return;
    setActiveHobbyFilterId(null);
  }, [result?.gifts?.length]);

  function toggleLikeGift(gift) {
    setLikedEntries((prev) => {
      const i = prev.findIndex((e) => e.gift.id === gift.id);
      if (i >= 0) return prev.filter((_, j) => j !== i);
      const clone = JSON.parse(JSON.stringify(gift));
      return [...prev, { key: `like-${gift.id}-${Date.now()}`, gift: clone }];
    });
  }

  function removeLikedEntry(key) {
    setLikedEntries((prev) => prev.filter((e) => e.key !== key));
  }

  function dislikeGift(giftId) {
    setDislikedIds((prev) =>
      prev.includes(giftId) ? prev : [...prev, giftId],
    );
    const gift = result?.gifts?.find((g) => g.id === giftId);
    if (!gift) return;
    const clone = JSON.parse(JSON.stringify(gift));
    const nameKey = String(clone.selectedProduct?.name || clone.id || "")
      .toLowerCase()
      .trim();
    if (!nameKey) return;
    setDislikedEntries((prev) => {
      const existingIdx = prev.findIndex((e) => e.nameKey === nameKey);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          gift: clone,
          sourceId: giftId,
        };
        return next;
      }
      return [
        ...prev,
        {
          key: `dislike-${giftId}-${Date.now()}`,
          gift: clone,
          nameKey,
          sourceId: giftId,
        },
      ];
    });
  }

  const caseStripItems = useMemo(() => {
    if (likedEntries.length === 0) return [];
    const out = [];
    for (let c = 0; c < CASE_CYCLES; c++) {
      for (let k = 0; k < likedEntries.length; k++) {
        out.push(likedEntries[k]);
      }
    }
    return out;
  }, [likedEntries]);

  function clearCaseFallbackTimer() {
    if (caseFallbackTimerRef.current != null) {
      clearTimeout(caseFallbackTimerRef.current);
      caseFallbackTimerRef.current = null;
    }
  }

  function finalizeCaseOpening() {
    const pending = casePendingRef.current;
    if (!pending) return;
    clearCaseFallbackTimer();
    casePendingRef.current = null;
    setCaseWinner(pending);
    setCaseRunning(false);
  }

  useEffect(() => () => clearCaseFallbackTimer(), []);

  function startCaseOpening() {
    if (likedEntries.length < 2) return;
    const L = likedEntries.length;
    const winIdx = Math.floor(Math.random() * L);
    const picked = likedEntries[winIdx];
    const stopSlot = Math.floor(CASE_CYCLES / 2) * L + winIdx;

    clearCaseFallbackTimer();
    casePendingRef.current = picked;
    setCaseWinner(null);
    setCaseRunning(true);
    setCaseTransitionOn(false);
    setCaseTranslateX(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const vw = caseViewportRef.current?.clientWidth ?? 360;
        const finalX = vw / 2 - CASE_ITEM_PX / 2 - stopSlot * CASE_ITEM_PX;
        setCaseTransitionOn(true);
        setCaseTranslateX(finalX);
        clearCaseFallbackTimer();
        caseFallbackTimerRef.current = setTimeout(() => {
          caseFallbackTimerRef.current = null;
          finalizeCaseOpening();
        }, CASE_TRANSITION_FALLBACK_MS);
      });
    });
  }

  function handleCaseTransitionEnd(e) {
    if (e.propertyName !== "transform") return;
    finalizeCaseOpening();
  }

  function restart() {
    setStep("who");
    setAudienceMode(null);
    setRecipientId(null);
    setRecipientAgeYears(25);
    setGroupKindId(null);
    setGroupGenderMode(null);
    setGroupSize(4);
    setGroupSizeText("");
    setIsGroupSizeEditing(false);
    setDiyTutorialIds([]);
    setGiftPreference(null);
    setLikedEntries([]);
    setDislikedEntries([]);
    setDislikedIds([]);
    setCaseOpen(false);
    clearCaseFallbackTimer();
    casePendingRef.current = null;
    setCaseTranslateX(0);
    setCaseTransitionOn(false);
    setCaseRunning(false);
    setCaseWinner(null);
    setSelectedHobbyIds([]);
    setCustomHobbies([]);
    setCustomInput("");
    setCountryCode("US");
    setBudgetSlider(75);
    setCurrency("USD");
    setBudgetUnlimited(false);
    setResult(null);
    setVariantByGiftId({});
    setRefineByGiftId({});
    setRefiningId(null);
    setGroqNoteByGiftId({});
    setRefineErrorByGiftId({});
    setWantThisErrorByGiftId({});
    setOpeningGiftId(null);
    cancelBudgetRangeAnimation();
  }

  function openPrivacyPolicy() {
    window.history.pushState(null, "", PRIVACY_PATH);
    setPageMode("privacy");
  }

  function openGiftPickerHome() {
    window.history.pushState(null, "", APP_PATH);
    setPageMode("app");
  }

  function addCustomHobby() {
    const t = customInput.trim();
    if (!t) return;
    if (customHobbies.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setCustomInput("");
      return;
    }
    setCustomHobbies((prev) => [...prev, t]);
    setCustomInput("");
  }

  function removeCustomHobby(label) {
    setCustomHobbies((prev) => prev.filter((x) => x !== label));
  }

  const visibleHobbies = useMemo(() => {
    const g = gender ?? "nonbinary";
    if (g === "nonbinary" || g === "other") return hobbies;
    return hobbies.filter((h) => !h.forGender || h.forGender === g);
  }, [gender]);

  const selectedHobbyLabels = useMemo(
    () =>
      selectedHobbyIds
        .map((id) => hobbies.find((h) => h.id === id)?.title)
        .filter(Boolean),
    [selectedHobbyIds],
  );

  const chosenHobbyFilterOptions = useMemo(() => {
    const catalogIds = [...new Set(selectedHobbyIds)];
    const options = catalogIds
      .map((id) => hobbies.find((h) => h.id === id))
      .filter(Boolean)
      .map((h) => ({ id: h.id, title: h.title, emoji: h.emoji }));

    for (const label of customHobbies) {
      options.push({
        id: customHobbyFilterId(label),
        title: label,
        emoji: "✎",
      });
    }
    return options;
  }, [selectedHobbyIds, customHobbies]);

  const visibleShortlistGifts = useMemo(() => {
    if (!result?.gifts?.length) return [];
    const customFilterLabel = parseCustomHobbyFilterId(activeHobbyFilterId);
    const customNeedle =
      customFilterLabel != null ? customFilterLabel.toLowerCase() : null;
    const customTokens =
      customNeedle == null
        ? []
        : customNeedle
            .split(/[^a-z0-9+]+/i)
            .map((t) => t.trim())
            .filter((t) => t.length >= 3);
    const inferredCustomIds =
      customFilterLabel == null
        ? []
        : inferHobbyIdsFromCustomLabels([customFilterLabel]);
    const available = result.gifts.filter((g) => !dislikedIds.includes(g.id));
    const stemToken = (t) =>
      String(t || "")
        .toLowerCase()
        .replace(/(?:ing|ers|ies|es|s)$/i, "");
    const customScoreForGift = (g) => {
      if (customNeedle == null) return 0;
      const hay = giftSearchTextForHobbyFilter(g);
      const hayWords = hay.split(/[^a-z0-9+]+/i).filter((w) => w.length >= 3);
      let score = 0;
      if (inferredCustomIds.includes(g._sourceHobbyId)) score += 8;
      if (hay.includes(customNeedle)) score += 10;
      if (customTokens.length > 0) {
        for (const tok of customTokens) {
          if (hay.includes(tok)) score += 4;
          const tokStem = stemToken(tok);
          if (!tokStem) continue;
          if (hayWords.some((w) => stemToken(w) === tokStem)) score += 3;
          if (
            hayWords.some(
              (w) =>
                w.startsWith(tokStem) ||
                tokStem.startsWith(w) ||
                w.includes(tokStem),
            )
          ) {
            score += 2;
          }
        }
      }
      return score;
    };

    const filtered = available.filter((g) => {
      if (activeHobbyFilterId == null) return true;
      if (g._sourceHobbyId === activeHobbyFilterId) return true;
      if (customNeedle != null) {
        return customScoreForGift(g) > 0;
      }
      return false;
    });
    if (customNeedle != null && filtered.length === 0) {
      const closest = available
        .map((g) => ({ g, score: customScoreForGift(g) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.g)
        .slice(0, 8);
      if (closest.length > 0) return closest;
      if (selectedHobbyIds.length === 0 && customHobbies.length > 0) {
        return available;
      }
    }
    return filtered;
  }, [
    result,
    dislikedIds,
    activeHobbyFilterId,
    selectedHobbyIds.length,
    customHobbies.length,
  ]);

  const showCustomOnlyFallbackBanner = useMemo(() => {
    if (!result?.gifts?.length) return false;
    if (selectedHobbyIds.length > 0 || customHobbies.length === 0) return false;
    const label = parseCustomHobbyFilterId(activeHobbyFilterId);
    if (!label) return false;
    const available = result.gifts.filter((g) => !dislikedIds.includes(g.id));
    if (available.length === 0) return false;
    const inferred = inferHobbyIdsFromCustomLabels([label]);
    const needle = label.toLowerCase();
    const tokens = needle
      .split(/[^a-z0-9+]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    const stemToken = (t) =>
      String(t || "")
        .toLowerCase()
        .replace(/(?:ing|ers|ies|es|s)$/i, "");
    const hasMatch = available.some((g) => {
      if (inferred.includes(g._sourceHobbyId)) return true;
      const hay = giftSearchTextForHobbyFilter(g);
      if (hay.includes(needle)) return true;
      const hayWords = hay.split(/[^a-z0-9+]+/i).filter((w) => w.length >= 3);
      return tokens.some((tok) => {
        if (hay.includes(tok)) return true;
        const tokStem = stemToken(tok);
        if (!tokStem) return false;
        return hayWords.some(
          (w) =>
            stemToken(w) === tokStem ||
            w.startsWith(tokStem) ||
            tokStem.startsWith(w) ||
            w.includes(tokStem),
        );
      });
    });
    if (hasMatch) return false;
    return visibleShortlistGifts.length > 0;
  }, [
    result,
    dislikedIds,
    activeHobbyFilterId,
    selectedHobbyIds.length,
    customHobbies.length,
    visibleShortlistGifts.length,
  ]);

  const customFilterNoMatchMessage = useMemo(() => {
    const label = parseCustomHobbyFilterId(activeHobbyFilterId);
    if (!label || !result?.gifts?.length) return null;

    const available = result.gifts.filter((g) => !dislikedIds.includes(g.id));
    if (available.length === 0) {
      return "You have disliked all current gifts. Remove a dislike or click More ideas.";
    }

    const inferred = inferHobbyIdsFromCustomLabels([label]);
    const needle = label.toLowerCase();
    const tokens = needle
      .split(/[^a-z0-9+]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    const hasMatch = available.some((g) => {
      if (inferred.includes(g._sourceHobbyId)) return true;
      const hay = giftSearchTextForHobbyFilter(g);
      if (hay.includes(needle)) return true;
      return tokens.some((tok) => hay.includes(tok));
    });
    if (hasMatch) return null;

    if (!budgetUnlimited && result.mode === "stretch") {
      return `No strong matches for "${label}" at this budget yet. Try increasing budget or click More ideas.`;
    }
    return `No current gifts strongly match "${label}" yet. Try broader wording for this hobby or click More ideas for a fresh Groq set.`;
  }, [activeHobbyFilterId, result, dislikedIds, budgetUnlimited]);

  const dislikedGiftRows = dislikedEntries;

  const showDiyTutorials = useMemo(
    () =>
      giftPref === "diy" &&
      !budgetUnlimited &&
      Number.isFinite(budgetUsd) &&
      budgetUsd <= DIY_TUTORIAL_BUDGET_MAX_USD,
    [giftPref, budgetUnlimited, budgetUsd],
  );

  const visibleDiyTutorials = useMemo(() => {
    const byId = new Map(DIY_TUTORIALS.map((x) => [x.id, x]));
    const picked = diyTutorialIds.map((id) => byId.get(id)).filter(Boolean);
    if (picked.length > 0) return picked;
    return DIY_TUTORIALS.slice(0, 3);
  }, [diyTutorialIds]);

  const recapParts = [...selectedHobbyLabels, ...customHobbies];

  function displayProduct(gift) {
    const vid = variantByGiftId[gift.id];
    if (vid) {
      const v = gift.variants.find((x) => x.id === vid);
      if (v) return v;
    }
    return gift.selectedProduct;
  }

  function handleAlternate(gift) {
    const p = displayProduct(gift);
    const next = pickNextAlternate(
      gift.variants,
      p.id,
      effectiveBudgetUsd,
      giftPickContext,
    );
    setVariantByGiftId((prev) => ({ ...prev, [gift.id]: next.id }));
  }

  async function handleRefine(gift) {
    const text = refineByGiftId[gift.id]?.trim() ?? "";
    if (!text) return;
    setRefiningId(gift.id);
    setGroqNoteByGiftId((prev) => {
      const next = { ...prev };
      delete next[gift.id];
      return next;
    });
    setRefineErrorByGiftId((prev) => {
      const next = { ...prev };
      delete next[gift.id];
      return next;
    });

    const applyLocal = () => {
      const picked = pickVariantFromRefinement(
        gift.variants,
        text,
        effectiveBudgetUsd,
        giftPickContext,
      );
      setVariantByGiftId((prev) => ({ ...prev, [gift.id]: picked.id }));
    };

    try {
      const ai = await refineWithGroq({
        variants: gift.variants,
        userQuery: text,
        budgetUSD: budgetUnlimited ? Infinity : recommendationBudgetUsd,
        categoryTitle: gift.categoryTitle,
        budgetUnlimited,
      });
      if (ai) {
        const match = gift.variants.find((v) => v.id === ai.chosenId);
        if (match) {
          setVariantByGiftId((prev) => ({ ...prev, [gift.id]: match.id }));
          if (ai.reason) {
            setGroqNoteByGiftId((prev) => ({
              ...prev,
              [gift.id]: ai.reason,
            }));
          }
        } else {
          applyLocal();
          setRefineErrorByGiftId((prev) => ({
            ...prev,
            [gift.id]:
              "That response didn’t match a product on this card; used on-device matching instead.",
          }));
        }
      } else {
        applyLocal();
      }
    } catch (err) {
      applyLocal();
      const detail = err?.message ? ` (${err.message})` : "";
      setRefineErrorByGiftId((prev) => ({
        ...prev,
        [gift.id]: `Refine didn’t complete${detail} — used on-device matching instead.`,
      }));
    } finally {
      setRefiningId(null);
    }
  }

  async function handleWantThis(gift) {
    const product = displayProduct(gift);
    const isSubscription = isSubscriptionLikeGift(gift, product);
    const subscriptionSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `${product.name} subscription`,
    )}`;
    const links = getRetailerLinks(product.name, countryCode);
    const countryLabel =
      SHOP_COUNTRIES.find((c) => c.code === countryCode)?.label ?? "";
    const fallbackUrl =
      links.find((l) => l.id === "shopping")?.url ?? links[0]?.url;

    setWantThisErrorByGiftId((prev) => {
      const next = { ...prev };
      delete next[gift.id];
      return next;
    });

    setOpeningGiftId(gift.id);
    let url = isSubscription ? subscriptionSearchUrl : fallbackUrl;
    try {
      if (!isSubscription && groqReady) {
        try {
          const pick = await pickBestRetailerWithGroq({
            productName: product.name,
            countryLabel,
            retailers: links,
          });
          if (pick?.url) url = pick.url;
        } catch {
          /* keep fallbackUrl */
        }
      }
      if (url) {
        const win = window.open(url, "_blank");
        if (win) {
          try {
            win.opener = null;
          } catch {
            /* ignore */
          }
        } else {
          setWantThisErrorByGiftId((prev) => ({
            ...prev,
            [gift.id]:
              "Pop-up blocked — allow pop-ups for this site, then try again.",
          }));
        }
      }
    } finally {
      setOpeningGiftId(null);
    }
  }

  return (
    <div className="Shell" id="top">
      <div className="Shell__glow" aria-hidden />
      <header className="Header">
        <button
          type="button"
          className="GiftedLogo GiftedLogo--home"
          onClick={() =>
            pageMode === "privacy" ? openGiftPickerHome() : restart()
          }
          aria-label="Start over"
        >
          <img src={GiftedLight} alt="GiftedIcon" className="GiftedIcon" />
          <div className="GiftedText">
            <img src={GiftedLogo} alt="Gifted" />
            <h3>Gifting, made effortless</h3>
          </div>
        </button>
        <div className="Header__actions">
          {pageMode === "privacy" ? (
            <button
              type="button"
              className="Btn Btn--ghost"
              onClick={openGiftPickerHome}
            >
              Back to app
            </button>
          ) : (
            step !== "who" &&
            step !== "thinking" && (
              <button type="button" className="Btn Btn--ghost" onClick={restart}>
                Start over
              </button>
            )
          )}

          {pageMode !== "privacy" &&
            step === "results" &&
            dislikedGiftRows.length > 0 && (
              <div className="DislikesManager" role="region" aria-label="Manage dislikes">
                <div className="DislikesManager__summary">
                  Manage dislikes ({dislikedGiftRows.length})
                </div>
                <ul className="DislikesManager__list">
                  {dislikedGiftRows.map((entry) => {
                    const gift = entry.gift;
                    const product = displayProduct(gift);
                    const totalUsd = isGroupRecipient
                      ? product.priceUSD * safeGroupSize
                      : product.priceUSD;
                    const priceLocal = usdToCurrency(totalUsd, currency);
                    return (
                      <li key={entry.key} className="DislikesManager__item">
                        <div className="DislikesManager__meta">
                          <span className="DislikesManager__name">{product.name}</span>
                          <span className="DislikesManager__price">
                            {formatApproxGiftPrice(priceLocal, currency)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="Btn Btn--ghost Btn--small"
                          onClick={() => {
                            setDislikedIds((prev) =>
                              prev.filter((id) => id !== entry.sourceId),
                            );
                            setDislikedEntries((prev) =>
                              prev.filter((x) => x.key !== entry.key),
                            );
                          }}
                        >
                          Remove dislike
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
        </div>
      </header>

      <main className="Main" id="main-content">
        {pageMode === "privacy" ? (
          <section
            className="Panel fade-in PrivacyPage"
            aria-labelledby="privacy-title"
          >
            <p className="Eyebrow">Privacy policy</p>
            <h2 id="privacy-title" className="Panel__title">
              Privacy Policy
            </h2>
            <p className="Panel__lead">
              Gifted is designed to suggest gift ideas from the options and
              preferences you choose in the app.
            </p>
            <div className="PrivacyPage__content">
              <h3>What data is used</h3>
              <p>
                We use the details you enter during this session, such as
                recipient type, age, interests, budget, and selected options, to
                generate recommendations.
              </p>
              <h3>How it is used</h3>
              <p>
                This data is used only to power gift suggestions and related
                ranking or refinement features while you are using the app.
              </p>
              <h3>External services</h3>
              <p>
                Some features may call third-party services (for example AI or
                image providers). When those features are used, request data
                needed for that feature may be sent to those services.
              </p>
              <h3>Retailer links</h3>
              <p>
                Retailer buttons open external shopping/search pages. Those
                websites have their own privacy policies and terms.
              </p>
              <h3>Contact</h3>
              <p>
                For privacy questions, contact{" "}
                <a href="mailto:TalVilozny@gmail.com">TalVilozny@gmail.com</a>.
              </p>
            </div>
          </section>
        ) : (
          <>
            {step === "who" && (
              <section className="Panel fade-in" aria-labelledby="who-title">
                <p className="Eyebrow">Step 1</p>
                <h2 id="who-title" className="Panel__title">
                  Picking a gift for a person or a group
                </h2>
                <p className="Panel__lead">
                  Choose whether you&rsquo;re gifting one person or a group.
                  Then we&rsquo;ll ask for age so recommendations fit.
                </p>
                {audienceMode == null && (
                  <div className="ChoiceRow ChoiceRow--relations">
                    <button
                      type="button"
                      className="ChoiceCard"
                      onClick={() => setAudienceMode("person")}
                    >
                      <span className="ChoiceCard__emoji" aria-hidden>
                        🎯
                      </span>
                      <span className="ChoiceCard__label">
                        Picking a gift for a person
                      </span>
                      <span className="ChoiceCard__hint">
                        Choose a relative or gender
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ChoiceCard"
                      onClick={() => setAudienceMode("group")}
                    >
                      <span className="ChoiceCard__emoji" aria-hidden>
                        👥
                      </span>
                      <span className="ChoiceCard__label">
                        Picking a gift for a group
                      </span>
                      <span className="ChoiceCard__hint">
                        Pick the group and composition
                      </span>
                    </button>
                  </div>
                )}

                {audienceMode === "person" && (
                  <>
                    <p className="FieldLabel WhoSection__label">Relationship</p>
                    <div className="ChoiceRow ChoiceRow--relations">
                      {RECIPIENT_RELATIONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="ChoiceCard"
                          onClick={() => pickRecipient(r.id)}
                        >
                          <span className="ChoiceCard__emoji" aria-hidden>
                            {r.emoji}
                          </span>
                          <span className="ChoiceCard__label">{r.label}</span>
                          <span className="ChoiceCard__hint">{r.hint}</span>
                        </button>
                      ))}
                    </div>
                    <p className="FieldLabel WhoSection__label WhoSection__label--spaced">
                      Or by gender
                    </p>
                    <div className="ChoiceRow ChoiceRow--gender">
                      {GENDER_OPTIONS.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className="ChoiceCard"
                          onClick={() => pickRecipient(g.id)}
                        >
                          <span className="ChoiceCard__emoji" aria-hidden>
                            {g.emoji}
                          </span>
                          <span className="ChoiceCard__label">{g.label}</span>
                          <span className="ChoiceCard__hint">{g.hint}</span>
                        </button>
                      ))}
                    </div>
                    <div className="Panel__actions">
                      <button
                        type="button"
                        className="Btn Btn--ghost"
                        onClick={() => {
                          setAudienceMode(null);
                          setRecipientId(null);
                        }}
                      >
                        Back
                      </button>
                    </div>
                  </>
                )}

                {audienceMode === "group" && (
                  <>
                    <p className="FieldLabel WhoSection__label">Which group?</p>
                    <div className="ChoiceRow ChoiceRow--relations">
                      {GROUP_KIND_OPTIONS.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className={`ChoiceCard${groupKindId === g.id ? " ChoiceCard--selected" : ""}`}
                          aria-pressed={groupKindId === g.id}
                          onClick={() => setGroupKindId(g.id)}
                        >
                          <span className="ChoiceCard__emoji" aria-hidden>
                            {g.emoji}
                          </span>
                          <span className="ChoiceCard__label">{g.label}</span>
                          <span className="ChoiceCard__hint">{g.hint}</span>
                        </button>
                      ))}
                    </div>

                    <p className="FieldLabel WhoSection__label WhoSection__label--spaced">
                      Group composition
                    </p>
                    <div className="ChoiceRow ChoiceRow--gender">
                      <button
                        type="button"
                        className={`ChoiceCard${groupGenderMode === "male" ? " ChoiceCard--selected" : ""}`}
                        aria-pressed={groupGenderMode === "male"}
                        onClick={() => setGroupGenderMode("male")}
                      >
                        <span className="ChoiceCard__emoji" aria-hidden>
                          ♂️
                        </span>
                        <span className="ChoiceCard__label">All male</span>
                        <span className="ChoiceCard__hint">
                          Same-gender group
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`ChoiceCard${groupGenderMode === "female" ? " ChoiceCard--selected" : ""}`}
                        aria-pressed={groupGenderMode === "female"}
                        onClick={() => setGroupGenderMode("female")}
                      >
                        <span className="ChoiceCard__emoji" aria-hidden>
                          ♀️
                        </span>
                        <span className="ChoiceCard__label">All female</span>
                        <span className="ChoiceCard__hint">
                          Same-gender group
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`ChoiceCard${groupGenderMode === "mixed" ? " ChoiceCard--selected" : ""}`}
                        aria-pressed={groupGenderMode === "mixed"}
                        onClick={() => setGroupGenderMode("mixed")}
                      >
                        <span className="ChoiceCard__emoji" aria-hidden>
                          ⚧
                        </span>
                        <span className="ChoiceCard__label">Mixed group</span>
                        <span className="ChoiceCard__hint">Men and women</span>
                      </button>
                    </div>
                    <div className="GroupSizeRow">
                      <label className="FieldLabel" htmlFor="group-size">
                        How many people are in the group?
                      </label>
                      <input
                        id="group-size"
                        type="number"
                        min={2}
                        step={1}
                        className="Input GroupSizeRow__input"
                        value={groupSizeText}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setGroupSizeText(raw);
                          if (raw === "") return;
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return;
                          setGroupSize(Math.max(2, Math.round(n)));
                        }}
                        onFocus={() => setIsGroupSizeEditing(true)}
                        onBlur={() => {
                          setIsGroupSizeEditing(false);
                          if (groupSizeText.trim() !== "") return;
                          setGroupSizeText(String(safeGroupSize));
                        }}
                      />
                    </div>
                    {(groupKindId || groupGenderMode) && (
                      <p className="Banner Banner--info" role="status">
                        Selected:{" "}
                        <strong>
                          {groupKindId
                            ? GROUP_KIND_OPTIONS.find(
                                (x) => x.id === groupKindId,
                              )?.label
                            : "Choose group"}
                        </strong>{" "}
                        ·{" "}
                        <strong>
                          {groupGenderMode === "male"
                            ? "All male"
                            : groupGenderMode === "female"
                              ? "All female"
                              : groupGenderMode === "mixed"
                                ? "Mixed group"
                                : "Choose composition"}
                        </strong>
                      </p>
                    )}

                    <div className="Panel__actions">
                      <button
                        type="button"
                        className="Btn Btn--ghost"
                        onClick={() => {
                          setAudienceMode(null);
                          setRecipientId(null);
                          setGroupKindId(null);
                          setGroupGenderMode(null);
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="Btn Btn--primary"
                        disabled={
                          !groupKindId ||
                          !groupGenderMode ||
                          safeGroupSize < 2 ||
                          !groupSizeInputValid
                        }
                        onClick={() => pickGroup(groupKindId, groupGenderMode)}
                      >
                        Continue
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            {step === "age" && (
              <section className="Panel fade-in" aria-labelledby="age-title">
                <p className="Eyebrow">Step 2</p>
                <h2 id="age-title" className="Panel__title">
                  How old are they?
                </h2>
                <p className="Panel__lead">
                  Set their age in years — Gifted uses it for tone and gift
                  ideas.
                  {recipientId === "mom" || recipientId === "dad"
                    ? " Parents: ages 20–100."
                    : recipientId === "boyfriend" ||
                        recipientId === "girlfriend"
                      ? " Partners: ages 15–100."
                      : recipientId === "kid"
                        ? " Kids: ages 0–17."
                        : typeof recipientId === "string" &&
                            recipientId.startsWith("group-")
                          ? " Group members: ages 0–100."
                          : " Ages 0–100."}
                </p>
                <div className="AgeSlider">
                  <div
                    className="AgeSlider__readout"
                    aria-live="polite"
                    id="age-slider-readout"
                  >
                    <button
                      type="button"
                      className="AgeSlider__nudge"
                      onClick={() =>
                        setRecipientAgeYears((a) =>
                          Math.max(ageLimits.min, a - 1),
                        )
                      }
                      disabled={recipientAgeYears <= ageLimits.min}
                      aria-label="Decrease age by 1"
                    >
                      ‹
                    </button>
                    <span className="AgeSlider__label">
                      {recipientAgeYears}{" "}
                      <span className="AgeSlider__years">years old</span>
                    </span>
                    <button
                      type="button"
                      className="AgeSlider__nudge"
                      onClick={() =>
                        setRecipientAgeYears((a) =>
                          Math.min(ageLimits.max, a + 1),
                        )
                      }
                      disabled={recipientAgeYears >= ageLimits.max}
                      aria-label="Increase age by 1"
                    >
                      ›
                    </button>
                  </div>
                  <div
                    className="AgeSlider__trackWrap"
                    style={{ "--age-pct": `${ageSliderPct}%` }}
                  >
                    <input
                      type="range"
                      className="AgeSlider__range"
                      min={ageLimits.min}
                      max={ageLimits.max}
                      step={1}
                      value={recipientAgeYears}
                      onChange={(e) =>
                        setRecipientAgeYears(Number(e.target.value))
                      }
                      aria-valuemin={ageLimits.min}
                      aria-valuemax={ageLimits.max}
                      aria-valuenow={recipientAgeYears}
                      aria-valuetext={`${recipientAgeYears} years old`}
                      aria-labelledby="age-title"
                      aria-describedby="age-slider-readout"
                    />
                  </div>
                  <div className="AgeSlider__ticks AgeSlider__ticks--numeric">
                    <span>{ageLimits.min}</span>
                    <span>{ageLimits.max}</span>
                  </div>
                </div>
                <div className="Panel__actions">
                  <button
                    type="button"
                    className="Btn Btn--ghost"
                    onClick={() => setStep("who")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="Btn Btn--primary"
                    onClick={continueFromAge}
                  >
                    Continue
                  </button>
                </div>
              </section>
            )}

            {step === "passion" && (
              <section
                className="Panel fade-in"
                aria-labelledby="passion-title"
              >
                <p className="Eyebrow">Step 3</p>
                <h2 id="passion-title" className="Panel__title">
                  What makes them light up?
                </h2>
                <p className="Panel__lead">
                  Select several hobbies, or add your own — we blend ideas
                  across everything you pick.
                </p>

                {hasPassions && (
                  <div className="ChipStrip" aria-label="Selected interests">
                    {selectedHobbyIds.map((id) => {
                      const h = hobbies.find((x) => x.id === id);
                      if (!h) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          className="Chip Chip--preset"
                          onClick={() =>
                            setSelectedHobbyIds((prev) =>
                              prev.filter((x) => x !== id),
                            )
                          }
                        >
                          {h.emoji} {h.title}
                          <span className="Chip__x" aria-hidden>
                            ×
                          </span>
                        </button>
                      );
                    })}
                    {customHobbies.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className="Chip Chip--custom"
                        onClick={() => removeCustomHobby(label)}
                      >
                        + {label}
                        <span className="Chip__x" aria-hidden>
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="HobbyGrid">
                  {visibleHobbies.map((h) => {
                    const on = selectedHobbyIds.includes(h.id);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        className={`HobbyCard${on ? " HobbyCard--selected" : ""}`}
                        style={{ "--hobby-bg": h.cardGradient }}
                        onClick={() =>
                          setSelectedHobbyIds((prev) =>
                            toggleInList(prev, h.id),
                          )
                        }
                      >
                        <span className="HobbyCard__emoji" aria-hidden>
                          {h.emoji}
                        </span>
                        <span className="HobbyCard__title">{h.title}</span>
                        <span className="HobbyCard__sub">{h.subtitle}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="AddHobby">
                  <label className="FieldLabel" htmlFor="custom-hobby">
                    Add a hobby
                  </label>
                  <div className="AddHobby__row">
                    <input
                      id="custom-hobby"
                      className="Input"
                      placeholder="e.g. Cars, Ceramics, Chess…"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomHobby();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="Btn Btn--secondary"
                      onClick={addCustomHobby}
                    >
                      Add
                    </button>
                  </div>
                  {customInput.trim() &&
                    inferHobbyIdsFromCustomLabels([customInput.trim()]).length >
                      0 && (
                      <p className="AddHobby__hint">
                        We’ll include matching catalog picks (e.g.{" "}
                        <strong>Cars</strong> → automotive ideas).
                      </p>
                    )}
                </div>

                <p className="FieldLabel GiftPref__label">Gift style</p>
                <p className="GiftPref__intro">
                  Choose one — we’ll match ideas to how you want to give.
                </p>
                <div
                  className="GiftPrefGrid"
                  role="radiogroup"
                  aria-label="Gift style"
                >
                  <button
                    type="button"
                    className={`GiftPrefCard${giftPreference === "diy" ? " GiftPrefCard--selected" : ""}`}
                    role="radio"
                    aria-checked={giftPreference === "diy"}
                    onClick={() => setGiftPreference("diy")}
                  >
                    <span className="GiftPrefCard__emoji" aria-hidden>
                      ✂️
                    </span>
                    <span className="GiftPrefCard__title">
                      I want to make it myself
                    </span>
                    <span className="GiftPrefCard__sub">
                      Handmade, kits, and deeply personal touches
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`GiftPrefCard${giftPreference === "experience" ? " GiftPrefCard--selected" : ""}`}
                    role="radio"
                    aria-checked={giftPreference === "experience"}
                    onClick={() => setGiftPreference("experience")}
                  >
                    <span className="GiftPrefCard__emoji" aria-hidden>
                      🎟️
                    </span>
                    <span className="GiftPrefCard__title">
                      I want to give an experience
                    </span>
                    <span className="GiftPrefCard__sub">
                      Tickets, classes, trips, spa days, memberships
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`GiftPrefCard${giftPreference === "premade" ? " GiftPrefCard--selected" : ""}`}
                    role="radio"
                    aria-checked={giftPreference === "premade"}
                    onClick={() => setGiftPreference("premade")}
                  >
                    <span className="GiftPrefCard__emoji" aria-hidden>
                      🎁
                    </span>
                    <span className="GiftPrefCard__title">
                      I want to buy something premade
                    </span>
                    <span className="GiftPrefCard__sub">
                      Finished, ready-to-wrap products
                    </span>
                  </button>
                </div>

                <div className="Panel__actions">
                  <button
                    type="button"
                    className="Btn Btn--ghost"
                    onClick={() => setStep("age")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="Btn Btn--primary"
                    disabled={!hasPassions || !giftPreference}
                    onClick={continueFromPassion}
                  >
                    Continue
                  </button>
                </div>
              </section>
            )}

            {step === "budget" && (
              <section className="Panel fade-in" aria-labelledby="budget-title">
                <p className="Eyebrow">Step 4</p>
                <h2 id="budget-title" className="Panel__title">
                  Budget & region
                </h2>
                <p className="Panel__lead">
                  Dial in spend up to ~{BUDGET_MAX_USD.toLocaleString()} USD
                  equivalent. For anything above that, use{" "}
                  <strong>endless budget</strong> for uncapped ideas (luxury,
                  travel, big tech, etc.).
                </p>

                <div className="FormGrid">
                  <div className="CurrencyRow">
                    <label className="FieldLabel" htmlFor="country">
                      Shopping country
                    </label>
                    <select
                      id="country"
                      className="Select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {SHOP_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="CurrencyRow">
                    <label className="FieldLabel" htmlFor="currency">
                      Display currency
                    </label>
                    <select
                      id="currency"
                      className="Select"
                      value={currency}
                      onChange={(e) => {
                        const next = e.target.value;
                        const prevPerUsd = usdToCurrency(1, currency);
                        const nextPerUsd = usdToCurrency(1, next);
                        const usd = budgetSlider / prevPerUsd;
                        let nextVal = Math.round(usd * nextPerUsd);
                        const hi = usdToCurrency(BUDGET_MAX_USD, next);
                        nextVal = Math.min(hi, Math.max(0, nextVal));
                        setCurrency(next);
                        setBudgetSlider(nextVal);
                      }}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.symbol} {c.label} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="BudgetUnlimited">
                  <input
                    type="checkbox"
                    className="BudgetUnlimited__checkbox"
                    checked={budgetUnlimited}
                    onChange={(e) =>
                      handleBudgetUnlimitedToggle(e.target.checked)
                    }
                  />
                  <span>
                    <strong>Endless budget</strong> — no cap on spend (above the
                    ~{BUDGET_MAX_USD.toLocaleString()} USD slider max). Use this
                    for premium or high-ticket gifts; suggestions skew toward
                    higher-end picks.
                  </span>
                </label>

                <div className="SliderBlock">
                  <div className="SliderBlock__top">
                    <span className="FieldLabel">Budget</span>
                    <span className="SliderBlock__value">
                      {budgetUnlimited ? (
                        <span className="SliderBlock__infinity">No limit</span>
                      ) : (
                        formatMoney(budgetInCurrency, currency)
                      )}
                    </span>
                  </div>
                  <div
                    className="RangeWrap"
                    style={{ "--pct": `${sliderPct}%` }}
                  >
                    <input
                      type="range"
                      className="Range"
                      min={budgetMinDisplay}
                      max={maxDisplay}
                      step={
                        currency === "ILS" ? 20 : maxDisplay > 5000 ? 25 : 10
                      }
                      value={budgetInCurrency}
                      onChange={(e) => setBudgetSlider(Number(e.target.value))}
                      disabled={budgetUnlimited}
                      aria-valuemin={budgetMinDisplay}
                      aria-valuemax={maxDisplay}
                      aria-valuenow={budgetInCurrency}
                    />
                  </div>
                  <div className="SliderBlock__ticks">
                    <span>{formatMoney(0, currency)}</span>
                    <span>{formatMoney(maxDisplay, currency)}</span>
                  </div>
                </div>

                <div className="BudgetInputRow">
                  <label className="FieldLabel" htmlFor="budget-amount">
                    Exact amount (
                    {CURRENCIES.find((c) => c.code === currency)?.symbol ?? ""})
                  </label>
                  <input
                    id="budget-amount"
                    type="number"
                    inputMode="decimal"
                    className="Input BudgetInputRow__input"
                    min={0}
                    max={maxDisplay}
                    step={currency === "ILS" ? 20 : maxDisplay > 5000 ? 25 : 10}
                    disabled={budgetUnlimited}
                    value={budgetUnlimited ? "" : budgetAmountText}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setBudgetAmountText(raw);
                      if (raw === "") return;
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      setBudgetSlider(
                        Math.min(maxDisplay, Math.max(0, Math.round(n))),
                      );
                    }}
                    onFocus={() => setIsBudgetAmountEditing(true)}
                    onBlur={() => {
                      setIsBudgetAmountEditing(false);
                      if (budgetUnlimited) return;
                      if (budgetAmountText !== "") return;
                      setBudgetAmountText(String(Math.round(budgetInCurrency)));
                    }}
                  />
                </div>

                {recapParts.length > 0 && recipientId && (
                  <p className="Recap">
                    Gifting <strong>{recipientRecapLabel(recipientId)}</strong>
                    {recipientId && (
                      <>
                        {" "}
                        (<strong>{recipientAgeYears} years old</strong>)
                      </>
                    )}{" "}
                    into{" "}
                    <strong>
                      {recapParts.length === 1
                        ? recapParts[0].toLowerCase()
                        : `${recapParts.slice(0, -1).join(", ")} and ${recapParts.at(-1)}`.toLowerCase()}
                    </strong>
                    {budgetUnlimited ? (
                      <>
                        {" "}
                        with <strong>no budget cap</strong> (luxury picks
                        enabled).
                      </>
                    ) : (
                      <>
                        {" "}
                        around{" "}
                        <strong>
                          {formatMoney(budgetInCurrency, currency)}
                        </strong>
                        {isGroupRecipient && (
                          <>
                            {" "}
                            total for <strong>{safeGroupSize}</strong> people (
                            ~
                            <strong>
                              {formatMoney(
                                usdToCurrency(
                                  recommendationBudgetUsd,
                                  currency,
                                ),
                                currency,
                              )}
                            </strong>{" "}
                            each)
                          </>
                        )}
                        .
                      </>
                    )}
                  </p>
                )}

                <div className="Panel__actions">
                  <button
                    type="button"
                    className="Btn Btn--ghost"
                    onClick={() => setStep("passion")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="Btn Btn--primary"
                    disabled={!giftPreference}
                    onClick={() => void goBudget()}
                  >
                    Find gifts
                  </button>
                </div>
              </section>
            )}

            {step === "thinking" && (
              <section className="Thinking fade-in" aria-live="polite">
                <div className="Thinking__orb" aria-hidden />
                <h2 className="Thinking__title">Finding the best fit…</h2>
                <p className="Thinking__text">
                  {groqReady
                    ? "Creating personalized gift ideas and estimating typical prices and ratings"
                    : "Scoring gifts from our catalog for your hobbies and budget"}{" "}
                  in{" "}
                  {CURRENCIES.find((c) => c.code === currency)?.label ??
                    currency}
                  .
                </p>
              </section>
            )}

            {step === "results" && result && (
              <section
                className="Results fade-in"
                aria-labelledby="results-title"
              >
                <h2 id="results-title" className="Panel__title">
                  Your gift ideas
                </h2>
                {chosenHobbyFilterOptions.length > 0 && (
                  <div className="HobbyFilter">
                    <p className="HobbyFilter__label">Hobbies you chose</p>
                    <div className="ChipStrip HobbyFilter__strip">
                      <button
                        type="button"
                        className={`Chip HobbyFilter__chip${activeHobbyFilterId == null ? " HobbyFilter__chip--active" : ""}`}
                        aria-pressed={activeHobbyFilterId == null}
                        onClick={() => setActiveHobbyFilterId(null)}
                      >
                        All
                      </button>
                      {chosenHobbyFilterOptions.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          className={`Chip HobbyFilter__chip${activeHobbyFilterId === h.id ? " HobbyFilter__chip--active" : ""}`}
                          aria-pressed={activeHobbyFilterId === h.id}
                          onClick={() => setActiveHobbyFilterId(h.id)}
                        >
                          {h.emoji} {h.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="ResultsToolbar">
                  <button
                    type="button"
                    className="Btn Btn--secondary"
                    onClick={() => void reloadSuggestions()}
                    disabled={isReloading}
                  >
                    {isReloading ? "Loading…" : "More ideas"}
                  </button>
                  <button
                    type="button"
                    className="Btn Btn--ghost"
                    onClick={() => {
                      clearCaseFallbackTimer();
                      casePendingRef.current = null;
                      setCaseWinner(null);
                      setCaseTranslateX(0);
                      setCaseTransitionOn(false);
                      setCaseRunning(false);
                      setCaseOpen(true);
                    }}
                    disabled={likedEntries.length < 2}
                    title={
                      likedEntries.length < 2
                        ? "Like at least two gifts to pick between them"
                        : undefined
                    }
                  >
                    Pick for me
                  </button>
                </div>
                {showDiyTutorials && (
                  <section
                    className="DiyTutorials"
                    aria-labelledby="diy-tutorials-title"
                  >
                    <h3
                      id="diy-tutorials-title"
                      className="DiyTutorials__title"
                    >
                      DIY ideas you can make without buying a kit
                    </h3>
                    <p className="DiyTutorials__lead">
                      Since you picked “I want to make it myself” with a lower
                      budget, here are tutorials for handmade gifts.
                    </p>
                    <ul className="DiyTutorials__list">
                      {visibleDiyTutorials.map((item) => (
                        <li key={item.id} className="DiyTutorials__item">
                          <a
                            className="DiyTutorials__link"
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.title}
                          </a>
                          <p className="DiyTutorials__note">{item.note}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {result.mode === "stretch" &&
                  result.gifts.length > 0 &&
                  !budgetUnlimited && (
                    <p className="Banner Banner--warn" role="status">
                      Nothing fit under{" "}
                      {formatMoney(budgetInCurrency, currency)}. Here are the
                      closest options—consider nudging the budget.
                    </p>
                  )}

                {result.gifts.length === 0 && (
                  <p className="Banner" role="status">
                    No matches for this combination—try another hobby or adjust
                    the budget.
                  </p>
                )}

                {likedEntries.length > 0 && (
                  <section
                    className="LikedSection"
                    aria-labelledby="liked-section-title"
                  >
                    <h3
                      id="liked-section-title"
                      className="LikedSection__title"
                    >
                      Saved likes
                    </h3>
                    <ul className="LikedSection__list">
                      {likedEntries.map((entry) => {
                        const lg = entry.gift;
                        const lp = lg.selectedProduct;
                        const lpTotalUsd = isGroupRecipient
                          ? lp.priceUSD * safeGroupSize
                          : lp.priceUSD;
                        const lpLocal = usdToCurrency(lpTotalUsd, currency);
                        return (
                          <li key={entry.key} className="LikedSection__item">
                            <div>
                              <span className="LikedSection__name">
                                {lp.name}
                              </span>
                              <span className="LikedSection__price">
                                {formatApproxGiftPrice(lpLocal, currency)}
                                {isGroupRecipient && (
                                  <> total for {safeGroupSize} people</>
                                )}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="Btn Btn--ghost Btn--small"
                              onClick={() => removeLikedEntry(entry.key)}
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {activeHobbyFilterId == null &&
                  result.gifts.length > 0 &&
                  result.gifts.every((g) => dislikedIds.includes(g.id)) && (
                    <p className="Banner" role="status">
                      Nothing left in this list—use <strong>More ideas</strong>{" "}
                      for a fresh batch (your saved likes stay below).
                    </p>
                  )}

                {visibleShortlistGifts.length === 0 &&
                  activeHobbyFilterId != null &&
                  dislikedIds.length > 0 &&
                  result.gifts.length > 0 && (
                    <p className="Banner" role="status">
                      No gifts match this hobby after your dislikes.
                    </p>
                  )}
                {visibleShortlistGifts.length === 0 &&
                  customFilterNoMatchMessage && (
                    <p className="Banner Banner--info" role="status">
                      {customFilterNoMatchMessage}
                    </p>
                  )}
                {showCustomOnlyFallbackBanner && (
                  <p className="Banner Banner--info" role="status">
                    No gift suggestions matched the selected hobbies, so
                    showing other available gifts.
                  </p>
                )}

                <ul className="GiftList">
                  {visibleShortlistGifts.map((gift, index) => {
                    const product = displayProduct(gift);
                    const giftTotalUsd = isGroupRecipient
                      ? product.priceUSD * safeGroupSize
                      : product.priceUSD;
                    const priceLocal = usdToCurrency(giftTotalUsd, currency);
                    const eachLocal = usdToCurrency(product.priceUSD, currency);
                    const top = index === 0;
                    // When Pexels isn't configured, avoid the catalog's illustrative images
                    // (they can be mismatched). When it is configured, Pexels will replace
                    // the fallback quickly anyway.
                    const fallbackImage = pexelsReady
                      ? resolveGiftImage(
                          { id: gift.id, image: product.image },
                          gift._sourceHobbyId,
                        )
                      : resolveGiftImage({ id: gift.id }, gift._sourceHobbyId);

                    // Prefer vendor/catalog image when available; only use stock photo
                    // lookup for items that don't provide a concrete image.
                    const hasProductImage = Boolean(product.image);
                    const imageSearchQuery = buildImageSearchQuery(
                      product,
                      gift,
                    );
                    const links = getRetailerLinks(product.name, countryCode);
                    const multi = gift.variants.length > 1;
                    const refining = refiningId === gift.id;
                    const refineLabel = "Refine";
                    const isLiked = likedEntries.some(
                      (e) => e.gift.id === gift.id,
                    );
                    const showOverBudgetNotice =
                      !budgetUnlimited &&
                      Number.isFinite(recommendationBudgetUsd) &&
                      recommendationBudgetUsd > 0 &&
                      product.priceUSD >
                        recommendationBudgetUsd * BUDGET_OVER_NOTICE_RATIO;
                    return (
                      <li
                        key={gift.id}
                        className={`GiftCard${top ? " GiftCard--top" : ""}${refining ? " GiftCard--refining" : ""}`}
                      >
                        <div className="GiftCard__media">
                          {top && (
                            <div className="GiftCard__ribbon">Top pick</div>
                          )}
                          <ProductImage
                            key={`${gift.id}-${product.id}`}
                            searchQuery={imageSearchQuery}
                            fallbackSrc={fallbackImage}
                            usePexels={pexelsReady && !hasProductImage}
                          />
                        </div>
                        <div className="GiftCard__body">
                          {showOverBudgetNotice && (
                            <p className="GiftCard__budgetNote" role="status">
                              This item is relevant, but above your budget.
                            </p>
                          )}
                          {gift.categoryTitle && (
                            <p className="GiftCard__category">
                              {gift.categoryTitle}
                            </p>
                          )}
                          <div className="GiftCard__head">
                            <div>
                              <h3 className="GiftCard__name">{product.name}</h3>
                              <p className="GiftCard__blurb">{product.blurb}</p>
                            </div>
                            <div className="GiftCard__scoreCol">
                              <div className="GiftCard__votes">
                                <button
                                  type="button"
                                  className={`VoteBtn VoteBtn--like${isLiked ? " VoteBtn--on" : ""}`}
                                  onClick={() => toggleLikeGift(gift)}
                                  aria-pressed={isLiked}
                                  aria-label={isLiked ? "Unlike" : "Like"}
                                >
                                  <span className="VoteBtn__icon" aria-hidden>
                                    👍
                                  </span>
                                  <span>{isLiked ? "Liked" : "Like"}</span>
                                </button>
                                <button
                                  type="button"
                                  className="VoteBtn VoteBtn--dislike"
                                  onClick={() => dislikeGift(gift.id)}
                                  aria-label="Dislike — hide this idea"
                                >
                                  <span className="VoteBtn__icon" aria-hidden>
                                    👎
                                  </span>
                                  <span>Dislike</span>
                                </button>
                              </div>
                              <div className="GiftCard__score">
                                <span className="GiftCard__price">
                                  {formatApproxGiftPrice(priceLocal, currency)}
                                </span>
                                {isGroupRecipient && (
                                  <span className="GiftCard__priceMeta">
                                    total for {safeGroupSize} people (
                                    {formatApproxGiftPrice(eachLocal, currency)}{" "}
                                    each)
                                  </span>
                                )}
                                <span className="GiftCard__rating">
                                  {product.rating.toFixed(1)}{" "}
                                  <Stars value={product.rating} />
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="GiftCard__want">
                            <button
                              type="button"
                              className="Btn Btn--want"
                              onClick={() => void handleWantThis(gift)}
                              disabled={openingGiftId === gift.id}
                            >
                              {openingGiftId === gift.id
                                ? "Finding best store…"
                                : "I want this"}
                            </button>
                            <p className="GiftCard__wantHint">
                              {groqReady
                                ? "Opens a shopping search picked for your region (smart routing when available)."
                                : "Opens Google Shopping to compare prices across stores."}
                            </p>
                            {wantThisErrorByGiftId[gift.id] && (
                              <p className="RefineBlock__error" role="status">
                                {wantThisErrorByGiftId[gift.id]}
                              </p>
                            )}
                          </div>

                          <div className="GiftCard__controls">
                            {multi && (
                              <button
                                type="button"
                                className="Btn Btn--ghost Btn--small"
                                onClick={() => handleAlternate(gift)}
                                disabled={refining}
                              >
                                Show another option in this category
                              </button>
                            )}
                            <div className="RefineBlock">
                              <label
                                className="FieldLabel"
                                htmlFor={`refine-${gift.id}`}
                              >
                                Be more specific
                              </label>
                              <div className="RefineBlock__row">
                                <input
                                  id={`refine-${gift.id}`}
                                  className="Input Input--compact"
                                  placeholder={refinePlaceholderForGift(
                                    gift,
                                    product,
                                  )}
                                  value={refineByGiftId[gift.id] ?? ""}
                                  onChange={(e) =>
                                    setRefineByGiftId((prev) => ({
                                      ...prev,
                                      [gift.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void handleRefine(gift);
                                    }
                                  }}
                                  disabled={refining}
                                />
                                <button
                                  type="button"
                                  className="Btn Btn--secondary Btn--small"
                                  onClick={() => void handleRefine(gift)}
                                  disabled={
                                    refining || !refineByGiftId[gift.id]?.trim()
                                  }
                                >
                                  {refining ? "Thinking…" : refineLabel}
                                </button>
                              </div>
                              <p className="RefineBlock__hint">
                                {groqReady
                                  ? result.source === "groq"
                                    ? "Picks the variant on this card that best matches your note (or keyword matching if smart refine isn’t available)."
                                    : "Reads your note and chooses the best option from this card’s catalog list."
                                  : "On-device keyword matching picks a variant from this list."}
                              </p>
                              {groqNoteByGiftId[gift.id] && (
                                <p className="RefineBlock__aiNote">
                                  <strong>Note:</strong>{" "}
                                  {groqNoteByGiftId[gift.id]}
                                </p>
                              )}
                              {refineErrorByGiftId[gift.id] && (
                                <p className="RefineBlock__error" role="status">
                                  {refineErrorByGiftId[gift.id]}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="Retailers">
                            <h4 className="Retailers__title">
                              Shop this product (search)
                            </h4>
                            <div className="Retailers__grid">
                              {links.map((link) => (
                                <a
                                  key={link.id}
                                  className="RetailerLink"
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {link.label}
                                </a>
                              ))}
                            </div>
                          </div>

                          <div className="Reviews">
                            <h4 className="Reviews__title">
                              {gift._aiGenerated
                                ? "Buyer-style reviews"
                                : "What buyers often say"}
                            </h4>
                            <p className="Reviews__disclaimer">
                              {gift._aiGenerated
                                ? "Sample reviews typical of marketplace listings—always open the seller’s page to read verified feedback before you buy."
                                : "Representative comments for this product type—each store shows real, verified reviews on the listing."}
                            </p>
                            <ul className="Reviews__list">
                              {product.reviews.map((rev, i) => (
                                <li key={i} className="Review">
                                  <div className="Review__meta">
                                    <Stars value={rev.stars} />
                                    <span className="Review__author">
                                      {rev.author}
                                    </span>
                                  </div>
                                  <p className="Review__text">{rev.text}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {caseOpen && (
                  <div
                    className="CaseModal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pick-for-me-modal-title"
                  >
                    <button
                      type="button"
                      className="CaseModal__backdrop"
                      aria-label="Close"
                      onClick={() => !caseRunning && setCaseOpen(false)}
                    />
                    <div className="CaseModal__panel">
                      <h3
                        id="pick-for-me-modal-title"
                        className="CaseModal__title"
                      >
                        Picking an option for you
                      </h3>
                      <p className="CaseModal__lede">
                        Your liked ideas scroll past the marker, then we land on
                        one gift to suggest.
                      </p>
                      <div className="CaseViewport" ref={caseViewportRef}>
                        <div
                          className="CaseViewport__glow CaseViewport__glow--left"
                          aria-hidden
                        />
                        <div
                          className="CaseViewport__glow CaseViewport__glow--right"
                          aria-hidden
                        />
                        <div className="CaseViewport__inner">
                          <div
                            className={`CaseStrip${caseTransitionOn ? " CaseStrip--moving" : ""}`}
                            style={{
                              transform: `translate3d(${caseTranslateX}px,0,0)`,
                            }}
                            onTransitionEnd={handleCaseTransitionEnd}
                          >
                            {caseStripItems.map((entry, i) => (
                              <div
                                key={`${entry.key}-${i}`}
                                className="CaseStrip__item"
                                style={{
                                  width: CASE_ITEM_PX,
                                  minWidth: CASE_ITEM_PX,
                                }}
                              >
                                <span className="CaseStrip__name">
                                  {displayProduct(entry.gift).name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="CaseViewport__marker" aria-hidden />
                      </div>
                      <div className="CaseModal__actions">
                        <button
                          type="button"
                          className="Btn Btn--primary"
                          onClick={startCaseOpening}
                          disabled={caseRunning || likedEntries.length < 2}
                        >
                          {caseRunning ? "Choosing…" : "Choose for me"}
                        </button>
                        {caseWinner && (
                          <p className="CaseModal__winner" role="status">
                            <span className="CaseModal__winnerLabel">
                              You should gift:
                            </span>
                            <strong>
                              {displayProduct(caseWinner.gift).name}
                            </strong>
                          </p>
                        )}
                        <button
                          type="button"
                          className="Btn Btn--ghost"
                          onClick={() => !caseRunning && setCaseOpen(false)}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="Panel__actions Panel__actions--solo">
                  <button
                    type="button"
                    className="Btn Btn--primary"
                    onClick={restart}
                  >
                    Pick gift for someone else
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="Footer">
        <section className="Footer__section">
          <h4 className="Footer__title">Made by Tal Vilozny</h4>
          <p className="Footer__line">
            Frontend Developer crafting beautiful, performant web experiences
          </p>
          <a className="Footer__link" href="mailto:TalVilozny@gmail.com">
            TalVilozny@gmail.com
          </a>
        </section>
        <p className="Footer__copyright">
          © 2026 Tal Vilozny. All rights reserved. •{" "}
          <a className="Footer__link" href={PRIVACY_PATH}>
            Privacy Policy
          </a>
        </p>
      </footer>
    </div>
  );
}
