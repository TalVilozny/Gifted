import { useEffect, useMemo, useRef, useState } from "react";
import GiftedIcon from "./Icons/GiftedIcon.png";
import GiftedLogo from "./Icons/GiftedLogo.png";
import {
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

const RECIPIENT_RELATIONS = [
  { id: "boyfriend", label: "Boyfriend", hint: "Partner", emoji: "💙" },
  { id: "girlfriend", label: "Girlfriend", hint: "Partner", emoji: "💜" },
  { id: "mom", label: "Mom", hint: "Mother figure", emoji: "🌷" },
  { id: "dad", label: "Dad", hint: "Father figure", emoji: "🌿" },
  { id: "friend", label: "Friend", hint: "Any gender", emoji: "🤝" },
];

const GENDER_OPTIONS = [
  { id: "male", label: "Male", hint: "He / him", emoji: "♂" },
  { id: "female", label: "Female", hint: "She / her", emoji: "♀" },
  { id: "nonbinary", label: "Nonbinary", hint: "They / them", emoji: "⚧" },
  { id: "other", label: "Other", hint: "Any / all", emoji: "♥" },
];

const AGE_RANGES = [
  { id: "0-12", label: "Child", hint: "12 & under" },
  { id: "13-17", label: "Teen", hint: "13–17" },
  { id: "18-25", label: "Young adult", hint: "18–25" },
  { id: "26-40", label: "Adult", hint: "26–40" },
  { id: "41-60", label: "Mature", hint: "41–60" },
  { id: "60+", label: "Senior", hint: "60+" },
];

/** Age bands shown for “who” — parents aren’t children/teens; partners aren’t children. */
function ageRangesForRecipient(recipientId) {
  if (!recipientId) return AGE_RANGES;
  if (recipientId === "mom" || recipientId === "dad") {
    return AGE_RANGES.filter((a) => a.id !== "0-12" && a.id !== "13-17");
  }
  if (recipientId === "boyfriend" || recipientId === "girlfriend") {
    return AGE_RANGES.filter((a) => a.id !== "0-12");
  }
  return AGE_RANGES;
}

/** @param {string | null} id */
function recipientIdToGender(id) {
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
      return "nonbinary";
    case "other":
      return "other";
    default:
      return "other";
  }
}

/** Short label for budget recap */
function recipientRecapLabel(id) {
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
  travel: [
    "carry-on size only",
    "packing cubes set",
    "TSA-friendly lock",
    "RFID passport wallet",
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
  const seed = hashString(`${gift.id}|${product.name ?? ""}|${gift.categoryTitle ?? ""}`);
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

function ProductImage({ searchQuery, fallbackSrc }) {
  const safeFallback = fallbackSrc || DEFAULT_GIFT_IMAGE_URL;
  const fallbackRef = useRef(safeFallback);
  fallbackRef.current = safeFallback;

  const [src, setSrc] = useState(safeFallback);
  const loadGenRef = useRef(0);

  useEffect(() => {
    const gen = ++loadGenRef.current;
    setSrc(safeFallback);
    if (!isPexelsConfigured()) return;
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
  }, [searchQuery, safeFallback]);

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
  const [step, setStep] = useState("who");
  const [recipientId, setRecipientId] = useState(null);
  const [recipientAgeRange, setRecipientAgeRange] = useState(null);
  const [wantDIY, setWantDIY] = useState(false);
  const [selectedHobbyIds, setSelectedHobbyIds] = useState([]);
  const [customHobbies, setCustomHobbies] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [budgetSlider, setBudgetSlider] = useState(75);
  const [budgetUnlimited, setBudgetUnlimited] = useState(false);
  const [result, setResult] = useState(null);
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

  const BUDGET_MIN_USD = 15;
  /** Slider cap in USD; use “endless budget” for spends above this. */
  const BUDGET_MAX_USD = 2500;

  const budgetUsd = useMemo(() => {
    const rate = 1 / (usdToCurrency(1, currency) || 1);
    return budgetSlider * rate;
  }, [budgetSlider, currency]);

  const effectiveBudgetUsd = useMemo(
    () => (budgetUnlimited ? Infinity : budgetUsd),
    [budgetUnlimited, budgetUsd],
  );

  const budgetInCurrency = budgetSlider;

  const minDisplay = useMemo(
    () => usdToCurrency(BUDGET_MIN_USD, currency),
    [currency],
  );
  const maxDisplay = useMemo(
    () => usdToCurrency(BUDGET_MAX_USD, currency),
    [currency],
  );

  const sliderPct = useMemo(() => {
    if (budgetUnlimited) return 100;
    const span = maxDisplay - minDisplay;
    if (span <= 0) return 0;
    return ((budgetInCurrency - minDisplay) / span) * 100;
  }, [budgetUnlimited, budgetInCurrency, minDisplay, maxDisplay]);

  const hasPassions = selectedHobbyIds.length > 0 || customHobbies.length > 0;

  useEffect(() => {
    if (budgetUnlimited) return;
    setBudgetSlider((prev) => {
      let next = prev;
      if (next > maxDisplay) next = maxDisplay;
      if (next < minDisplay) next = minDisplay;
      return next;
    });
  }, [budgetUnlimited, maxDisplay, minDisplay]);

  useEffect(() => {
    return () => {
      if (budgetAnimateRafRef.current != null) {
        cancelAnimationFrame(budgetAnimateRafRef.current);
      }
    };
  }, []);

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
    setRecipientAgeRange(null);
    setStep("age");
  }

  const ageRangeChoices = useMemo(
    () => ageRangesForRecipient(recipientId),
    [recipientId],
  );

  function goAge(ageId) {
    setRecipientAgeRange(ageId);
    setStep("passion");
  }

  async function goBudget() {
    if (!hasPassions) return;
    setVariantByGiftId({});
    setRefineByGiftId({});
    setGroqNoteByGiftId({});
    setRefineErrorByGiftId({});
    setWantThisErrorByGiftId({});
    setStep("thinking");
    setResult(null);

    await new Promise((r) => setTimeout(r, 500));

    const hobbyTitles = selectedHobbyIds
      .map((id) => hobbies.find((h) => h.id === id)?.title)
      .filter(Boolean);

    let rec = null;

    if (groqReady) {
      try {
        const ai = await generateGiftIdeasWithGroq({
          hobbyTitles,
          customLabels: customHobbies,
          gender,
          budgetUSD: budgetUsd,
          wantDIY,
          budgetUnlimited,
          selectedHobbyIds,
          recipientId,
          recipientAgeRange,
        });
        if (ai?.gifts?.length) {
          rec = { gifts: ai.gifts, mode: "in", source: "groq" };
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
        budgetUSD: budgetUsd,
        wantDIY,
        budgetUnlimited,
      });
      rec = { ...catalogRec, source: "catalog" };

      if (groqReady && rec.gifts.length > 0) {
        try {
          const ranked = await rankGiftsWithGroq({
            gifts: rec.gifts,
            hobbyTitles,
            customLabels: customHobbies,
            gender,
            budgetUSD: budgetUnlimited ? null : budgetUsd,
            wantDIY,
            budgetUnlimited,
            recipientId,
            recipientAgeRange,
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
            rec = { ...rec, gifts: ordered };
          }
        } catch {
          /* keep catalog order */
        }
      }
    }

    setResult(rec);
    setStep("results");
  }

  function restart() {
    setStep("who");
    setRecipientId(null);
    setRecipientAgeRange(null);
    setWantDIY(false);
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
    const next = pickNextAlternate(gift.variants, p.id, effectiveBudgetUsd);
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
      );
      setVariantByGiftId((prev) => ({ ...prev, [gift.id]: picked.id }));
    };

    try {
      const ai = await refineWithGroq({
        variants: gift.variants,
        userQuery: text,
        budgetUSD: budgetUnlimited ? Infinity : budgetUsd,
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
    let url = fallbackUrl;
    try {
      if (groqReady) {
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
    <div className="Shell">
      <div className="Shell__glow" aria-hidden />
      <header className="Header">
        <button
          type="button"
          className="GiftedLogo GiftedLogo--home"
          onClick={restart}
          aria-label="Start over"
        >
          <img src={GiftedIcon} alt="" className="GiftedIcon" />
          <div className="GiftedText">
            <img src={GiftedLogo} alt="Gifted" />
            <h3>Gifting, made effortless</h3>
          </div>
        </button>
        {step !== "who" && step !== "thinking" && (
          <button type="button" className="Btn Btn--ghost" onClick={restart}>
            Start over
          </button>
        )}
      </header>

      <main className="Main">
        {step === "who" && (
          <section className="Panel fade-in" aria-labelledby="who-title">
            <p className="Eyebrow">Step 1</p>
            <h2 id="who-title" className="Panel__title">
              Who you&rsquo;re gifting
            </h2>
            <p className="Panel__lead">
              Pick a relationship, <strong>or</strong> describe them by
              gender—then we&rsquo;ll ask their age so ideas fit their stage of
              life.
            </p>
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
          </section>
        )}

        {step === "age" && (
          <section className="Panel fade-in" aria-labelledby="age-title">
            <p className="Eyebrow">Step 2</p>
            <h2 id="age-title" className="Panel__title">
              How old are they?
            </h2>
            <p className="Panel__lead">
              Rough age helps GiftPicker match tone, hobbies, and price—pick the
              closest band.
            </p>
            <div className="ChoiceRow ChoiceRow--age">
              {ageRangeChoices.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="ChoiceCard"
                  onClick={() => goAge(a.id)}
                >
                  <span className="ChoiceCard__emoji" aria-hidden>
                    🎂
                  </span>
                  <span className="ChoiceCard__label">{a.label}</span>
                  <span className="ChoiceCard__hint">{a.hint}</span>
                </button>
              ))}
            </div>
            <div className="Panel__actions">
              <button
                type="button"
                className="Btn Btn--ghost"
                onClick={() => setStep("who")}
              >
                Back
              </button>
            </div>
          </section>
        )}

        {step === "passion" && (
          <section className="Panel fade-in" aria-labelledby="passion-title">
            <p className="Eyebrow">Step 3</p>
            <h2 id="passion-title" className="Panel__title">
              What makes them light up?
            </h2>
            <p className="Panel__lead">
              Select several vibes, and add your own (for example <em>Cars</em>
              )—we blend ideas across everything you pick.
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
                      setSelectedHobbyIds((prev) => toggleInList(prev, h.id))
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

            <div className="DIYToggle">
              <label className="DIYToggle__label">
                <input
                  type="checkbox"
                  className="DIYToggle__checkbox"
                  checked={wantDIY}
                  onChange={(e) => setWantDIY(e.target.checked)}
                />
                <span>I want to make it myself</span>
              </label>
              {wantDIY && (
                <p className="DIYToggle__hint">
                  We’ll prioritize things they create or personalize: origami
                  sets, custom or build-your-own bouquets, handwritten or
                  calligraphy love letters, paper crafts, keepsakes—sentimental
                  handmade gifts, not just tool kits.
                </p>
              )}
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
                disabled={!hasPassions}
                onClick={() => setStep("budget")}
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
                    const lo = usdToCurrency(BUDGET_MIN_USD, next);
                    const hi = usdToCurrency(BUDGET_MAX_USD, next);
                    nextVal = Math.min(hi, Math.max(lo, nextVal));
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
                onChange={(e) => handleBudgetUnlimitedToggle(e.target.checked)}
              />
              <span>
                <strong>Endless budget</strong> — no cap on spend (above the ~
                {BUDGET_MAX_USD.toLocaleString()} USD slider max). Use this for
                premium or high-ticket gifts; suggestions skew toward higher-end
                picks.
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
              <div className="RangeWrap" style={{ "--pct": `${sliderPct}%` }}>
                <input
                  type="range"
                  className="Range"
                  min={minDisplay}
                  max={maxDisplay}
                  step={
                    currency === "ILS"
                      ? 20
                      : maxDisplay - minDisplay > 5000
                        ? 25
                        : 10
                  }
                  value={budgetInCurrency}
                  onChange={(e) => setBudgetSlider(Number(e.target.value))}
                  disabled={budgetUnlimited}
                  aria-valuemin={minDisplay}
                  aria-valuemax={maxDisplay}
                  aria-valuenow={budgetInCurrency}
                />
              </div>
              <div className="SliderBlock__ticks">
                <span>{formatMoney(minDisplay, currency)}</span>
                <span>{formatMoney(maxDisplay, currency)}</span>
              </div>
            </div>

            {recapParts.length > 0 && recipientId && (
              <p className="Recap">
                Gifting <strong>{recipientRecapLabel(recipientId)}</strong>
                {recipientAgeRange && (
                  <>
                    {" "}
                    (
                    <strong>
                      {
                        AGE_RANGES.find((a) => a.id === recipientAgeRange)
                          ?.label
                      }
                    </strong>
                    )
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
                    with <strong>no budget cap</strong> (luxury picks enabled).
                  </>
                ) : (
                  <>
                    {" "}
                    around{" "}
                    <strong>{formatMoney(budgetInCurrency, currency)}</strong>.
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
                ? "Creating personalized gift ideas from your hobbies"
                : "Scoring gifts from our catalog for your hobbies and budget"}{" "}
              in{" "}
              {CURRENCIES.find((c) => c.code === currency)?.label ?? currency}.
            </p>
          </section>
        )}

        {step === "results" && result && (
          <section className="Results fade-in" aria-labelledby="results-title">
            <h2 id="results-title" className="Panel__title">
              Your shortlist
            </h2>
            {result.mode === "stretch" &&
              result.gifts.length > 0 &&
              !budgetUnlimited && (
                <p className="Banner Banner--warn" role="status">
                  Nothing fit under {formatMoney(budgetInCurrency, currency)}.
                  Here are the closest options—consider nudging the budget.
                </p>
              )}

            {result.gifts.length === 0 && (
              <p className="Banner" role="status">
                No matches for this combination—try another hobby or adjust the
                budget.
              </p>
            )}

            <ul className="GiftList">
              {result.gifts.map((gift, index) => {
                const product = displayProduct(gift);
                const priceLocal = usdToCurrency(product.priceUSD, currency);
                const top = index === 0;
                const fallbackImage = resolveGiftImage(
                  { id: gift.id, image: product.image },
                  gift._sourceHobbyId,
                );
                const imageSearchQuery =
                  `${product.name} ${gift.categoryTitle || ""} ${gift._sourceHobbyId} gift`.trim();
                const links = getRetailerLinks(product.name, countryCode);
                const multi = gift.variants.length > 1;
                const refining = refiningId === gift.id;
                const refineLabel = "Refine";
                return (
                  <li
                    key={gift.id}
                    className={`GiftCard${top ? " GiftCard--top" : ""}${refining ? " GiftCard--refining" : ""}`}
                  >
                    <div className="GiftCard__media">
                      {top && <div className="GiftCard__ribbon">Top pick</div>}
                      <ProductImage
                        searchQuery={imageSearchQuery}
                        fallbackSrc={fallbackImage}
                      />
                    </div>
                    <div className="GiftCard__body">
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
                        <div className="GiftCard__score">
                          <span className="GiftCard__price">
                            {formatMoney(priceLocal, currency)}
                          </span>
                          <span className="GiftCard__rating">
                            {product.rating.toFixed(1)}{" "}
                            <Stars value={product.rating} />
                          </span>
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
                              placeholder={refinePlaceholderForGift(gift, product)}
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
                              <strong>Note:</strong> {groqNoteByGiftId[gift.id]}
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

            <div className="Panel__actions Panel__actions--solo">
              <button
                type="button"
                className="Btn Btn--primary"
                onClick={restart}
              >
                Pick another gift
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="Footer">
        <p>
          Illustrative prices and images; retailer links are searches, not
          endorsements. Always read verified reviews on the listing you choose.
        </p>
      </footer>
    </div>
  );
}
