/** Base prices in USD; UI converts for display. */

import {
  expandGiftRow,
  pickBestVariantForBudget,
  pickBestVariantForBudgetScored,
} from "./productEngine.js";

export const CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "ILS", label: "Israeli Shekel", symbol: "₪" },
];

/** Multiply USD amount by this to get amount in selected currency (approximate). */
export const USD_TO = {
  USD: 1,
  EUR: 0.93,
  GBP: 0.79,
  ILS: 3.65,
};

export function usdToCurrency(usd, code) {
  const rate = USD_TO[code] ?? 1;
  return usd * rate;
}

export const hobbies = [
  {
    id: "gaming",
    title: "Video Games",
    subtitle: "Controllers, consoles, and late-night raids",
    cardGradient:
      "linear-gradient(145deg, rgba(139, 92, 246, 0.18), rgba(217, 70, 239, 0.1))",
    emoji: "🎮",
    forGender: "male",
  },
  {
    id: "fitness",
    title: "Motion & muscle",
    subtitle: "Sweat, recovery, and personal bests",
    cardGradient:
      "linear-gradient(145deg, rgba(16, 185, 129, 0.18), rgba(20, 184, 166, 0.1))",
    emoji: "💪",
  },
  {
    id: "reading",
    title: "Paper & ink",
    subtitle: "Stories that follow you home",
    cardGradient:
      "linear-gradient(145deg, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.1))",
    emoji: "📚",
  },
  {
    id: "coffee",
    title: "Brew rituals",
    subtitle: "Grinders, beans, and the perfect pour",
    cardGradient:
      "linear-gradient(145deg, rgba(120, 113, 108, 0.2), rgba(180, 83, 9, 0.12))",
    emoji: "☕",
  },
  {
    id: "music",
    title: "Sound & soul",
    subtitle: "Vinyl, headphones, and live-room magic",
    cardGradient:
      "linear-gradient(145deg, rgba(244, 63, 94, 0.16), rgba(99, 102, 241, 0.12))",
    emoji: "🎧",
  },
  {
    id: "crafts",
    title: "Hands & heart",
    subtitle: "Tools, textures, and made-by-me pride",
    cardGradient:
      "linear-gradient(145deg, rgba(236, 72, 153, 0.16), rgba(168, 85, 247, 0.12))",
    emoji: "🧵",
    forGender: "female",
  },
  {
    id: "photo",
    title: "Photography",
    subtitle: "Cameras, lenses, lighting, and creative shots",
    cardGradient:
      "linear-gradient(145deg, rgba(14, 165, 233, 0.18), rgba(37, 99, 235, 0.1))",
    emoji: "📷",
  },
  {
    id: "cooking",
    title: "Kitchen alchemy",
    subtitle: "Knives, heat, and flavor experiments",
    cardGradient:
      "linear-gradient(145deg, rgba(239, 68, 68, 0.16), rgba(245, 158, 11, 0.12))",
    emoji: "🍳",
  },
  {
    id: "design",
    title: "Form & function",
    subtitle: "Typography, objects, and quiet taste",
    cardGradient:
      "linear-gradient(145deg, rgba(115, 115, 115, 0.18), rgba(63, 63, 70, 0.12))",
    emoji: "✏️",
  },
  {
    id: "garden",
    title: "Soil & sun",
    subtitle: "Seeds, shears, and slow growth",
    cardGradient:
      "linear-gradient(145deg, rgba(34, 197, 94, 0.18), rgba(163, 230, 53, 0.1))",
    emoji: "🌿",
  },
  {
    id: "style",
    title: "Silhouette",
    subtitle: "Fabric, scent, and confident details",
    cardGradient:
      "linear-gradient(145deg, rgba(217, 70, 239, 0.16), rgba(124, 58, 237, 0.12))",
    emoji: "✨",
    forGender: "female",
  },
  {
    id: "cars",
    title: "Asphalt & chrome",
    subtitle: "Detailing, dash cams, and weekend drives",
    cardGradient:
      "linear-gradient(145deg, rgba(71, 85, 105, 0.25), rgba(234, 88, 12, 0.14))",
    emoji: "🏎️",
    forGender: "male",
  },
  {
    id: "makeup",
    title: "Jewelry",
    subtitle: "Necklaces, rings, and pieces they’ll wear on repeat",
    cardGradient:
      "linear-gradient(145deg, rgba(236, 72, 153, 0.22), rgba(244, 114, 182, 0.12))",
    emoji: "💎",
    forGender: "female",
  },
  {
    id: "pcbuilding",
    title: "PC",
    subtitle: "Steam, builds, RGB, GPUs, and desk upgrades",
    cardGradient:
      "linear-gradient(145deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.14))",
    emoji: "🖥️",
    forGender: "male",
  },
  {
    id: "kids",
    title: "Kids & play",
    subtitle: "Toys, games, creativity, and wonder",
    cardGradient:
      "linear-gradient(145deg, rgba(251, 191, 36, 0.22), rgba(244, 114, 182, 0.14))",
    emoji: "🧸",
    forGender: null,
  },
];

function R(text, author, stars = 5) {
  return { text, author, stars };
}

export const giftsByHobby = {
  gaming: [
    {
      id: "g1",
      categoryTitle: "Game controllers",
      forGender: null,
      variants: [
        {
          id: "g1-xbox",
          name: "Xbox Wireless Controller (latest)",
          priceUSD: 59,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["wireless", "xbox", "console", "comfort"],
          blurb:
            "Official feel, great triggers, works with PC and Xbox—safe crowd-pleaser.",
          reviews: [
            R("Battery life is solid with rechargeable AAs.", "Alex M.", 5),
            R("Textured grip is nicer than my old one.", "Jordan K.", 5),
          ],
        },
        {
          id: "g1-dualsense",
          name: "Sony DualSense (PS5)",
          priceUSD: 69,
          rating: 4.9,
          image:
            "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["wireless", "playstation", "haptic", "console"],
          blurb:
            "Adaptive triggers and haptics—special if they’re on PlayStation.",
          reviews: [
            R(
              "Haptics make racing games feel absurdly immersive.",
              "Riley P.",
              5,
            ),
            R("Check they own a PS5 first.", "Chris L.", 4),
          ],
        },
        {
          id: "g1-8bitdo",
          name: "8BitDo Pro 2 (Bluetooth)",
          priceUSD: 49,
          rating: 4.7,
          image:
            "https://images.unsplash.com/photo-1592840496694-26d035b3b1fb?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["wireless", "bluetooth", "retro", "switch", "pc"],
          blurb: "Deep customization, great D-pad—strong for Switch + PC.",
          reviews: [
            R("Profiles per game changed how I play fighters.", "Morgan D.", 5),
            R("Firmware updates are frequent.", "Casey W.", 5),
          ],
        },
        {
          id: "g1-steam",
          name: "Steam Controller–style pad (third-party)",
          priceUSD: 45,
          rating: 4.4,
          image:
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["pc", "trackpad", "budget"],
          blurb:
            "Trackpads and back paddles for couch PC gaming—niche but loved.",
          reviews: [
            R(
              "Weird at first, then I couldn’t go back for strategy games.",
              "Sam T.",
              4,
            ),
            R("Not for everyone—know their taste.", "Priya N.", 4),
          ],
        },
      ],
    },
    {
      id: "g2",
      name: "Curated indie game bundle",
      blurb: "A code pack of story-rich titles they may have missed.",
      priceUSD: 35,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("Found two new favorites I never would have picked.", "Riley P.", 5),
        R("Great variety; redemption was instant.", "Chris L.", 5),
      ],
    },
    {
      id: "g3",
      name: "RGB desk mat + cable kit",
      blurb: "Clean setup energy with soft lighting and tidy routing.",
      priceUSD: 48,
      rating: 4.6,
      forGender: null,
      reviews: [
        R(
          "Desk looks like a streamer setup now—in a good way.",
          "Morgan D.",
          5,
        ),
        R("Mat is huge; measure their desk first.", "Casey W.", 4),
      ],
    },
    {
      id: "g4",
      name: "Premium headset stand",
      blurb: "Weighted base, USB hub, and a spot that feels intentional.",
      priceUSD: 55,
      rating: 4.8,
      forGender: "male",
      reviews: [
        R("Keeps my headset safe and frees desk space.", "Dan H.", 5),
        R("USB ports are handy for charging controllers.", "Lee R.", 5),
      ],
    },
  ],
  fitness: [
    {
      id: "f1",
      name: "Smart jump rope",
      blurb: "App-connected intervals without gym membership drama.",
      priceUSD: 42,
      rating: 4.8,
      forGender: null,
      reviews: [
        R(
          "Makes cardio feel like a game. Streaks are addictive.",
          "Nina S.",
          5,
        ),
        R("Smooth rotation; counts feel accurate.", "Oren B.", 4),
      ],
    },
    {
      id: "f2",
      name: "Recovery massage gun (compact)",
      blurb: "Quiet motor, travel case, post-leg-day relief.",
      priceUSD: 89,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("Quieter than my old one; still punches deep.", "Priya N.", 5),
        R("Battery life is solid for weekend trips.", "Tom E.", 5),
      ],
    },
    {
      id: "f3",
      name: "Insulated steel water bottle (1L)",
      blurb: "Keeps ice all day; loop cap for hikes and commutes.",
      priceUSD: 38,
      rating: 4.9,
      forGender: "female",
      reviews: [
        R("Fits my bag and still looks elegant.", "Elena V.", 5),
        R("No metallic taste after a week of use.", "Maya F.", 5),
        R("Heavy when full—expected at this size.", "Jules C.", 4),
      ],
    },
    {
      id: "f4",
      name: "Resistance bands set + door anchor",
      blurb: "Full-body sessions at home with printed guide cards.",
      priceUSD: 32,
      rating: 4.6,
      forGender: null,
      diy: true,
      reviews: [
        R("Surprisingly versatile for the price.", "Noah G.", 5),
        R("Bands feel durable after months.", "Iris K.", 4),
      ],
    },
  ],
  reading: [
    {
      id: "r1",
      name: "Weighted reading blanket (throw)",
      blurb: "Cozy weight for long chapters without overheating.",
      priceUSD: 64,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Game changer for evening reading.", "Helen O.", 5),
        R("Evenly distributed weight; stitching held up.", "Ben Y.", 5),
      ],
    },
    {
      id: "r2",
      name: "Clip-on amber book light",
      blurb: "Warm light, rechargeable, no hotel lamp battles.",
      priceUSD: 28,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("Warm enough to feel calm before sleep.", "Sara L.", 5),
        R("Clip is strong on hardcovers.", "Mike P.", 4),
      ],
    },
    {
      id: "r3",
      name: "Leather bookmark + journal set",
      blurb: "Tactile ritual for quotes and stray thoughts.",
      priceUSD: 45,
      rating: 4.9,
      forGender: "female",
      reviews: [
        R("Feels special every time I open a book.", "Dana R.", 5),
        R("Paper quality is excellent for fountain pens.", "Yael M.", 5),
      ],
    },
    {
      id: "r4",
      name: "Audiobook gift credit pack",
      blurb: "Credits for a major store—commute-friendly stories.",
      priceUSD: 40,
      rating: 4.6,
      forGender: null,
      reviews: [
        R("Easy to gift; they picked titles immediately.", "Greg F.", 5),
        R("Check regional availability first.", "Ana K.", 4),
      ],
    },
  ],
  coffee: [
    {
      id: "c1",
      name: "Precision pour-over kettle",
      blurb: "Temperature control for repeatable morning cups.",
      priceUSD: 95,
      rating: 4.9,
      forGender: null,
      reviews: [
        R("My pour-overs taste noticeably more consistent.", "Leo J.", 5),
        R("Worth it if they already own a good grinder.", "Rina S.", 5),
      ],
    },
    {
      id: "c2",
      name: "Single-origin sampler (4 bags)",
      blurb: "Roaster-selected; tasting notes on each sleeve.",
      priceUSD: 52,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Each bag was a small adventure.", "Omar D.", 5),
        R("Great for dialing in grind size on weekends.", "Talia B.", 5),
      ],
    },
    {
      id: "c3",
      name: "Ceramic dripper + filters bundle",
      blurb: "Classic V60-style ritual without the guesswork.",
      priceUSD: 34,
      rating: 4.7,
      forGender: null,
      diy: true,
      reviews: [
        R("Cleanup is fast; coffee is clean and bright.", "Kim W.", 5),
        R("Filters lasted longer than expected.", "Evan C.", 4),
      ],
    },
    {
      id: "c4",
      name: "Travel grinder (burr)",
      blurb: "Quiet enough for shared spaces; consistent grounds.",
      priceUSD: 78,
      rating: 4.8,
      forGender: "male",
      diy: true,
      reviews: [
        R("Finally decent coffee on work trips.", "Ido N.", 5),
        R("A bit bulky but solid build.", "Mark H.", 4),
      ],
    },
  ],
  music: [
    {
      id: "m1",
      categoryTitle: "Headphones & headsets",
      forGender: null,
      variants: [
        {
          id: "m1-hd560s",
          name: "Sennheiser HD 560S",
          priceUSD: 119,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1505740420922-5e560c06d30e?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["open-back", "wired", "studio", "neutral", "reference"],
          blurb:
            "Open-back, easy to drive—detail-forward and comfy for long listening.",
          reviews: [
            R("Soundstage is huge; comfort for hours.", "Ari F.", 5),
            R("Leaks sound—not for open offices.", "Nadav P.", 4),
          ],
        },
        {
          id: "m1-dt990",
          name: "Beyerdynamic DT 990 Pro (250Ω)",
          priceUSD: 169,
          rating: 4.7,
          image:
            "https://images.unsplash.com/photo-1583394838336-acd9778f5553?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["open-back", "wired", "studio", "bright", "bass"],
          blurb:
            "V-shaped fun; needs a decent amp—rewarding if they already have gear.",
          reviews: [
            R("Treble can be spicy—EQ tames it.", "Leo W.", 5),
            R("Built like a tank; pads are replaceable.", "Mina K.", 5),
          ],
        },
        {
          id: "m1-nova7",
          name: "SteelSeries Arctis Nova 7 Wireless",
          priceUSD: 179,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["wireless", "gaming", "rgb", "2.4ghz", "microphone"],
          blurb:
            "Dual wireless, retractable mic, subtle RGB—great for PC + console.",
          reviews: [
            R(
              "Finally a headset that doesn’t squeeze my glasses.",
              "Jake R.",
              5,
            ),
            R("Software EQ is powerful once you dig in.", "Tina S.", 5),
          ],
        },
        {
          id: "m1-cloud3",
          name: "HyperX Cloud III Wireless",
          priceUSD: 169,
          rating: 4.7,
          image:
            "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["wireless", "gaming", "comfort", "microphone"],
          blurb: "Long-session comfort, warm sound—less flashy, very reliable.",
          reviews: [
            R("Mic is clearer than my last wireless set.", "Omar D.", 5),
            R("No RGB—exactly what I wanted.", "Elena V.", 5),
          ],
        },
        {
          id: "m1-barracuda",
          name: "Razer Barracuda X (2022)",
          priceUSD: 99,
          rating: 4.6,
          image:
            "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["wireless", "gaming", "budget", "usb-c", "dongle"],
          blurb:
            "USB-C dongle + Bluetooth—simple, light, great “first wireless” pick.",
          reviews: [
            R("Battery gets me through a work week.", "Chris A.", 5),
            R("Plasticky but sounds better than the price.", "Nina L.", 4),
          ],
        },
      ],
    },
    {
      id: "m2",
      name: "Vinyl record crate + inner sleeves",
      blurb: "Protects sleeves and looks great in a corner.",
      priceUSD: 44,
      rating: 4.6,
      forGender: null,
      reviews: [
        R("Sturdy wood; records slide in smoothly.", "Jess Q.", 5),
        R("Assembly took ten minutes.", "Ron L.", 4),
      ],
    },
    {
      id: "m3",
      name: "Bluetooth receiver for hi-fi",
      blurb: "AptX HD for streaming without replacing their amp.",
      priceUSD: 65,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("Latency is low enough for casual TV too.", "Miriam S.", 5),
        R("Pairing was painless on iOS and Android.", "Dean K.", 5),
      ],
    },
    {
      id: "m4",
      name: "Concert ticket voucher (local venues)",
      blurb: "Let them pick a show—memory beats another gadget.",
      priceUSD: 75,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("We used it for a band we'd never heard—great night.", "Paula G.", 5),
        R("Check expiry dates when purchasing.", "Steve R.", 4),
      ],
    },
  ],
  crafts: [
    {
      id: "cr1",
      name: "Japanese pull saw + magnetic guide",
      blurb: "Satisfying cuts for small wood projects.",
      priceUSD: 58,
      rating: 4.8,
      forGender: null,
      diy: true,
      reviews: [
        R("Cuts straighter than my old saw.", "Hila T.", 5),
        R("Blade is sharp—respect the tool.", "Aaron B.", 5),
      ],
    },
    {
      id: "cr2",
      name: "Embroidery starter kit (premium threads)",
      blurb: "Pattern, hoop, and colors that pop on neutral fabric.",
      priceUSD: 36,
      rating: 4.7,
      forGender: "female",
      diy: true,
      reviews: [
        R("Instructions were clear for a total beginner.", "Noa L.", 5),
        R("Thread quality feels luxe.", "Shira M.", 5),
      ],
    },
    {
      id: "cr3",
      name: "Leather tooling starter set",
      blurb: "Stamps, swivel knife, and a small practice hide.",
      priceUSD: 72,
      rating: 4.6,
      forGender: null,
      diy: true,
      reviews: [
        R("Relaxing weekend hobby; satisfying clicks.", "Uri S.", 5),
        R("Needs a cutting mat you may already have.", "Chen W.", 4),
      ],
    },
    {
      id: "cr4",
      name: "Pottery tool roll + ribs",
      blurb: "Organized tools for classes or home studio days.",
      priceUSD: 41,
      rating: 4.7,
      forGender: null,
      diy: true,
      reviews: [
        R("Fits in my class bag perfectly.", "Liora K.", 5),
        R("Canvas feels durable.", "Matt D.", 4),
      ],
    },
  ],
  photo: [
    {
      id: "p1",
      name: "Portable LED panel (bi-color)",
      blurb: "Soft interview light for portraits and product shots.",
      priceUSD: 85,
      rating: 4.8,
      forGender: null,
      diy: true,
      reviews: [
        R("Color accuracy is excellent for skin tones.", "Dorit E.", 5),
        R("Battery could be bigger—plan for spares.", "Guy F.", 4),
      ],
    },
    {
      id: "p2",
      name: "Peak-design style camera strap",
      blurb: "Quick-release anchors; comfortable for all-day walks.",
      priceUSD: 55,
      rating: 4.9,
      forGender: null,
      reviews: [
        R("Never worried about drops on hikes.", "Amir R.", 5),
        R("A bit of a splurge but zero regrets.", "Lily N.", 5),
      ],
    },
    {
      id: "p3",
      name: "Lens cleaning kit (travel case)",
      blurb: "Rocket blower, pen, microfiber—no scratches drama.",
      priceUSD: 22,
      rating: 4.6,
      forGender: null,
      reviews: [
        R("Small enough for every camera bag.", "Oren L.", 5),
        R("Basic but does the job.", "Kate V.", 4),
      ],
    },
    {
      id: "p4",
      name: "Film rolls variety pack",
      blurb: "Color + B&W for experimenting on weekends.",
      priceUSD: 48,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("Fun to compare stocks side by side.", "Yoni B.", 5),
        R("Check their camera format before buying.", "Ruth A.", 4),
      ],
    },
  ],
  cooking: [
    {
      id: "k1",
      name: "Carbon steel skillet (pre-seasoned)",
      blurb: "Restaurant sear; builds nonstick with use.",
      priceUSD: 68,
      rating: 4.9,
      forGender: null,
      diy: true,
      reviews: [
        R("Best steaks I've made at home.", "Daniel K.", 5),
        R("Heavier than nonstick—expected.", "Alma P.", 5),
      ],
    },
    {
      id: "k2",
      name: 'Japanese chef knife (8")',
      blurb: "Sharp out of the box; saya sheath included.",
      priceUSD: 110,
      rating: 4.8,
      forGender: "male",
      diy: true,
      reviews: [
        R("Glides through veg; handle fits my grip.", "Eitan M.", 5),
        R("Keep it dry—carbon can spot if neglected.", "Roy S.", 4),
      ],
    },
    {
      id: "k3",
      name: "Olive oil flight (3 bottles)",
      blurb: "Single-estate oils for bread dipping and finishing.",
      priceUSD: 54,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("We did a blind taste test—so fun.", "Inbar R.", 5),
        R("Bottles are beautiful on the counter.", "Gili T.", 5),
      ],
    },
    {
      id: "k4",
      name: "Digital probe thermometer",
      blurb: "Fast read; magnet back for oven-door parking.",
      priceUSD: 39,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("No more guessing chicken doneness.", "Maya S.", 5),
        R("Calibration matched my other probe.", "Jon D.", 5),
      ],
    },
  ],
  travel: [
    {
      id: "t1",
      name: "Packing cubes set (compression)",
      blurb: "Squeezes sweaters; color-coded for shared suitcases.",
      priceUSD: 46,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Fit more than I thought in a carry-on.", "Shani B.", 5),
        R("Zippers feel tough after multiple trips.", "Lev G.", 5),
      ],
    },
    {
      id: "t2",
      name: "Universal travel adapter + USB-C",
      blurb: "One brick for most countries; fast phone top-ups.",
      priceUSD: 35,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("Worked in UK and EU without fuss.", "Nir H.", 5),
        R("Gets warm under heavy laptop load.", "Tamar K.", 4),
      ],
    },
    {
      id: "t3",
      name: "Memory foam travel pillow",
      blurb: "Compresses into a small sack; neck saved on redeyes.",
      priceUSD: 42,
      rating: 4.6,
      forGender: null,
      reviews: [
        R("Finally slept on a plane.", "Erez M.", 5),
        R("Cover is removable for washing.", "Linoy P.", 5),
      ],
    },
    {
      id: "t4",
      name: "Scratch-off world map poster",
      blurb: "Wall art that celebrates where they've been.",
      priceUSD: 29,
      rating: 4.5,
      forGender: null,
      reviews: [
        R("Looks great framed in the hallway.", "Aviv L.", 5),
        R("Scratch carefully—thin paper.", "Dana S.", 4),
      ],
    },
  ],
  design: [
    {
      id: "d1",
      name: "Pantone desk book (mini)",
      blurb: "Inspiration for palettes and print nerds.",
      priceUSD: 88,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Gorgeous object even closed.", "Noya F.", 5),
        R("Heavy—it's a statement book.", "Itai R.", 4),
      ],
    },
    {
      id: "d2",
      name: "Architect scale ruler set",
      blurb: "Metal scales for sketches and model-making.",
      priceUSD: 32,
      rating: 4.6,
      forGender: null,
      diy: true,
      reviews: [
        R("Feels professional in the hand.", "Rotem K.", 5),
        R("Comes in a slim case.", "Shai M.", 4),
      ],
    },
    {
      id: "d3",
      name: "Letterpress thank-you card set",
      blurb: "Thick stock; debossed details people notice.",
      priceUSD: 26,
      rating: 4.7,
      forGender: "female",
      reviews: [
        R("People commented on the texture.", "Meital S.", 5),
        R("Envelope quality matches the cards.", "Yarden N.", 5),
      ],
    },
    {
      id: "d4",
      name: "Designer desk mat (felt)",
      blurb: "Soft mouse glide; muted tones for calm desks.",
      priceUSD: 48,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Keyboard sound is softer; looks minimal.", "Barak T.", 5),
        R("Vacuum lint occasionally.", "Hadas L.", 4),
      ],
    },
  ],
  garden: [
    {
      id: "ga1",
      name: "Ergonomic pruner + holster",
      blurb: "Clean cuts; rotating handle reduces wrist strain.",
      priceUSD: 52,
      rating: 4.8,
      forGender: null,
      diy: true,
      reviews: [
        R("Cuts like butter through rose canes.", "Orly M.", 5),
        R("Holster clips to belt—handy.", "Dvir S.", 5),
      ],
    },
    {
      id: "ga2",
      name: "Self-watering herb planter (3 pod)",
      blurb: "Kitchen sill basil without daily panic.",
      priceUSD: 44,
      rating: 4.6,
      forGender: null,
      diy: true,
      reviews: [
        R("Basil survived my vacation week.", "Renana K.", 5),
        R("Refill window is small—use a narrow pitcher.", "Eli B.", 4),
      ],
    },
    {
      id: "ga3",
      name: "Soil test kit + pH meter",
      blurb: "Data-driven compost and lime decisions.",
      priceUSD: 38,
      rating: 4.7,
      forGender: null,
      diy: true,
      reviews: [
        R("Finally understood why tomatoes struggled.", "Yiftach R.", 5),
        R("Instructions are clear for beginners.", "Sigal N.", 5),
      ],
    },
    {
      id: "ga4",
      name: "Heirloom seed vault (regional)",
      blurb: "Curated for their climate; beautiful packaging.",
      priceUSD: 33,
      rating: 4.5,
      forGender: null,
      diy: true,
      reviews: [
        R("Germination rate was high in our beds.", "Adi P.", 5),
        R("Check planting season on the pack.", "Michal G.", 4),
      ],
    },
  ],
  style: [
    {
      id: "s1",
      name: "Niche fragrance discovery set",
      blurb: "Five vials to find a signature without committing.",
      priceUSD: 72,
      rating: 4.9,
      forGender: null,
      reviews: [
        R("Found a scent I now wear daily.", "Liat M.", 5),
        R("Luxurious unboxing.", "Omer K.", 5),
      ],
    },
    {
      id: "s2",
      name: "Cashmere-blend scarf",
      blurb: "Soft drape; neutral tone that layers well.",
      priceUSD: 95,
      rating: 4.8,
      forGender: "female",
      reviews: [
        R("Warm but not bulky.", "Tzipora H.", 5),
        R("Dry clean only—worth it.", "Rachel B.", 4),
      ],
    },
    {
      id: "s3",
      name: "Minimal leather card wallet",
      blurb: "Slim front-pocket carry; ages beautifully.",
      priceUSD: 58,
      rating: 4.7,
      forGender: "male",
      reviews: [
        R("Patina after a month looks intentional.", "Yuval S.", 5),
        R("Holds 6 cards comfortably.", "Elior T.", 5),
      ],
    },
    {
      id: "s4",
      name: "Silk pocket square set",
      blurb: "Two patterns for weddings and elevated weekends.",
      priceUSD: 42,
      rating: 4.6,
      forGender: "male",
      reviews: [
        R("Fabric has a nice hand; folds hold.", "David L.", 5),
        R("Colors matched the photos.", "Amnon R.", 4),
      ],
    },
  ],
  cars: [
    {
      id: "ca1",
      name: "Dual-channel dash cam (front + cabin)",
      blurb: "Parking mode, night vision, and loop recording—peace of mind.",
      priceUSD: 89,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Night footage is crisp; app export is painless.", "Tommy R.", 5),
        R("Wire tuck took an hour but worth it.", "Marcus V.", 4),
        R("Saved me in a parking lot scrape—clear plate read.", "Jake P.", 5),
      ],
    },
    {
      id: "ca2",
      name: "Detailing kit (wash + wax + microfibers)",
      blurb: "pH-safe foam, ceramic spray wax, and plush towels.",
      priceUSD: 54,
      rating: 4.7,
      forGender: null,
      diy: true,
      reviews: [
        R("Bead porn after one coat—neighbor asked what I used.", "Leo S.", 5),
        R("Smells clean, not chemical-heavy.", "Ryan K.", 5),
      ],
    },
    {
      id: "ca3",
      name: "OBD2 Bluetooth scanner + app",
      blurb: "Read/clear codes, live data—great for DIY diagnostics.",
      priceUSD: 32,
      rating: 4.6,
      forGender: "male",
      diy: true,
      reviews: [
        R("Explained a check engine in plain English.", "Dylan M.", 5),
        R("Works on my 2016 and 2021 without drama.", "Chris A.", 4),
      ],
    },
    {
      id: "ca4",
      name: "Leather steering wheel cover (hand-stitched look)",
      blurb: "Breathable grip; hides worn rims without looking cheap.",
      priceUSD: 28,
      rating: 4.5,
      forGender: null,
      reviews: [
        R("Took 20 minutes to lace; feels OEM-plus.", "Andre F.", 5),
        R("Measure wheel diameter before ordering.", "Pat N.", 4),
      ],
    },
    {
      id: "ca5",
      name: "Magnetic phone mount (vent or dash)",
      blurb: "Strong magnets, slim metal plates, no wobble on rough roads.",
      priceUSD: 22,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Holds a Pro Max over cobblestones.", "Samir H.", 5),
        R("Vent clip is tight on thick blades—check fit.", "Owen L.", 4),
      ],
    },
  ],
  makeup: [
    {
      id: "mb1",
      categoryTitle: "Everyday jewelry",
      forGender: "female",
      variants: [
        {
          id: "mb1-warm",
          name: "Layered gold-plated necklace set (3 strands)",
          priceUSD: 42,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["necklace", "gold tone", "layered", "everyday", "jewelry"],
          blurb:
            "Delicate chains that stack without tangling — easy to dress up or down.",
          reviews: [
            R(
              "Looks pricier than it is; clasp feels secure.",
              "Noa R.",
              5,
            ),
            R("She wears all three together or one at a time.", "Shira F.", 5),
          ],
        },
        {
          id: "mb1-cool",
          name: "Sterling silver pendant necklace (minimal bar)",
          priceUSD: 38,
          rating: 4.7,
          image:
            "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["sterling", "silver", "pendant", "minimal", "jewelry"],
          blurb: "Hypoallergenic 925 silver — clean lines that work with any neckline.",
          reviews: [
            R("Shiny but not flashy; perfect daily piece.", "Maya K.", 5),
            R("Chain length was just right on her.", "Dana L.", 4),
          ],
        },
      ],
    },
    {
      id: "mb2",
      name: "Birthstone stud earrings (sterling or gold tone)",
      blurb: "Choose their month — subtle sparkle that still feels personal.",
      priceUSD: 68,
      rating: 4.8,
      forGender: "female",
      reviews: [
        R("The cut catches light without looking costume-y.", "Liat S.", 5),
        R("Backings stayed put; no irritation.", "Talia M.", 5),
      ],
    },
    {
      id: "mb3",
      name: "Adjustable chain bracelet + small charm",
      blurb: "Slim links with a tiny charm — add initials at many jewelers.",
      priceUSD: 45,
      rating: 4.7,
      forGender: "female",
      reviews: [
        R("Clasp is easy one-handed; doesn’t snag sweaters.", "Inbar C.", 5),
        R("Sized up for a gift and it still fit.", "Gal R.", 5),
      ],
    },
    {
      id: "mb4",
      name: "Ultrasonic jewelry cleaner (compact tank)",
      blurb: "Restores sparkle to rings and chains in minutes — safe for most metals.",
      priceUSD: 54,
      rating: 4.6,
      forGender: "female",
      diy: true,
      reviews: [
        R("Even dull earrings came back bright.", "Yael A.", 5),
        R("Quiet enough to run on the counter.", "Michal T.", 4),
      ],
    },
  ],
  pcbuilding: [
    {
      id: "pc1",
      name: "PC builder's toolkit (30-piece)",
      blurb:
        "Magnetic screwdrivers, spudgers, anti-static wrist strap — all in one case.",
      priceUSD: 38,
      rating: 4.9,
      forGender: null,
      diy: true,
      reviews: [
        R("Magnetic tips saved my sanity with standoffs.", "Ariel D.", 5),
        R("Case fits in a drawer beside the build desk.", "Tom B.", 5),
      ],
    },
    {
      id: "pc2",
      categoryTitle: "RGB case fans",
      forGender: null,
      diy: true,
      variants: [
        {
          id: "pc2-120",
          name: "ARGB 120 mm Case Fan 3-Pack",
          priceUSD: 42,
          rating: 4.7,
          image:
            "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["rgb", "120mm", "argb", "cooling", "quiet", "pwm"],
          blurb:
            "Addressable RGB, PWM, daisy-chain headers — clean airflow and clean aesthetics.",
          reviews: [
            R("Static pressure is solid for front intake.", "Niv G.", 5),
            R("Works with my board's ARGB header out of the box.", "Ran P.", 4),
          ],
        },
        {
          id: "pc2-140",
          name: "ARGB 140 mm Case Fan 3-Pack",
          priceUSD: 54,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["rgb", "140mm", "argb", "cooling", "quiet", "pwm"],
          blurb:
            "Larger blades, lower RPM, quieter — check your case supports 140 mm.",
          reviews: [
            R(
              "Near-silent at 800 RPM; temps dropped 4 \u00b0C.",
              "Yuval K.",
              5,
            ),
            R("Verify 140 mm clearance before ordering.", "Ido L.", 5),
          ],
        },
      ],
    },
    {
      id: "pc3",
      name: "Modular PSU cable extension kit (braided)",
      blurb:
        "Sleeved extensions in the builder's chosen color; cable combs included.",
      priceUSD: 34,
      rating: 4.6,
      forGender: null,
      diy: true,
      reviews: [
        R("Transformed my build — looks like a studio rig.", "Eyal S.", 5),
        R("Combs make tight bundled runs effortless.", "Ohad M.", 5),
      ],
    },
    {
      id: "pc4",
      name: "Monitor light bar (USB-powered)",
      blurb: "Asymmetric optics light the desk without screen glare.",
      priceUSD: 55,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Eyes far less fatigued after long sessions.", "Amit H.", 5),
        R("Touch wheel is smooth; warm/cool mix is perfect.", "Liron B.", 5),
      ],
    },
    {
      id: "pc5",
      categoryTitle: "Prebuilt gaming PCs",
      forGender: null,
      variants: [
        {
          id: "pc5-sff",
          name: "Compact prebuilt gaming PC (SFF, current-gen GPU, 32 GB RAM)",
          priceUSD: 1349,
          rating: 4.7,
          image:
            "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: [
            "prebuilt",
            "desktop",
            "gaming",
            "pc",
            "nvidia",
            "rtx",
            "small",
            "sff",
          ],
          blurb:
            "Turn-key rig for desk or living-room gaming—minimal cable hassle, ready for 1440p.",
          reviews: [
            R("Quieter than I expected for the size.", "Noam E.", 5),
            R("Dropped in and was playing the same evening.", "Gilad R.", 5),
          ],
        },
        {
          id: "pc5-tower",
          name: "Mid-tower enthusiast prebuilt (high-end GPU, 64 GB RAM, 2 TB NVMe)",
          priceUSD: 2699,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: [
            "prebuilt",
            "desktop",
            "gaming",
            "pc",
            "nvidia",
            "rtx",
            "ddr5",
            "nvme",
          ],
          blurb:
            "Balanced for AAA gaming and streaming—room for future GPU swaps.",
          reviews: [
            R("Thermals are excellent with the stock fan curve.", "Oren S.", 5),
            R("Windows came clean—no bloatware surprise.", "Tal F.", 5),
          ],
        },
        {
          id: "pc5-flagship",
          name: "Flagship liquid-cooled prebuilt (top-tier GPU, overkill PSU)",
          priceUSD: 4499,
          rating: 4.9,
          image:
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: [
            "prebuilt",
            "desktop",
            "gaming",
            "pc",
            "nvidia",
            "rtx",
            "liquid",
            "aio",
            "enthusiast",
          ],
          blurb:
            "Showpiece build—maxed for 4K / high-refresh and heavy creative workloads.",
          reviews: [
            R(
              "Looks like a boutique builder charged twice as much.",
              "Dean L.",
              5,
            ),
            R("GPU temps under load are ice-cold.", "Priya M.", 5),
          ],
        },
      ],
    },
    {
      id: "pc6",
      categoryTitle: "Graphics cards (GPUs)",
      forGender: null,
      variants: [
        {
          id: "pc6-mainstream",
          name: "Enthusiast GPU (70-class, current gen, factory OC)",
          priceUSD: 599,
          rating: 4.7,
          image:
            "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["gpu", "graphics", "nvidia", "rtx", "pc", "gaming", "upgrade"],
          blurb:
            "Sweet spot for 1440p high settings—big upgrade path from older cards.",
          reviews: [
            R("Huge uplift from my 20-series card.", "Alexei V.", 5),
            R(
              "Fits standard ATX cases; triple-slot check your clearance.",
              "Sam W.",
              4,
            ),
          ],
        },
        {
          id: "pc6-high",
          name: "High-end GPU (80-class, current gen, quiet cooler)",
          priceUSD: 1199,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["gpu", "graphics", "nvidia", "rtx", "pc", "gaming", "4k"],
          blurb:
            "Comfortable 4K gaming and heavy ray tracing—pair with a strong PSU.",
          reviews: [
            R("Whisper-quiet compared to my last blower card.", "Hannah J.", 5),
            R("DLSS makes new titles fly.", "Marco P.", 5),
          ],
        },
        {
          id: "pc6-flagship",
          name: "Flagship GPU (90-class, halo tier)",
          priceUSD: 1999,
          rating: 4.9,
          image:
            "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: [
            "gpu",
            "graphics",
            "nvidia",
            "rtx",
            "pc",
            "gaming",
            "enthusiast",
            "flagship",
          ],
          blurb:
            "Top of the stack for 4K max settings and creative GPU loads—check case length and PSU headroom.",
          reviews: [
            R(
              "Brutal performance; my CPU is the bottleneck now.",
              "Chris T.",
              5,
            ),
            R("Included support bracket saved my PCIe slot.", "Jordan A.", 5),
          ],
        },
      ],
    },
    {
      id: "pc7",
      categoryTitle: "Gaming monitors",
      forGender: null,
      variants: [
        {
          id: "pc7-27qhd",
          name: '27" QHD 165 Hz IPS gaming monitor',
          priceUSD: 329,
          rating: 4.6,
          image:
            "https://images.unsplash.com/photo-1527443224154-c649a890e0a2?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: [
            "monitor",
            "display",
            "1440p",
            "gaming",
            "ips",
            "pc",
            "screen",
          ],
          blurb:
            "Fast, sharp panel for competitive and story games—great first serious upgrade.",
          reviews: [
            R("No dead pixels; stand is surprisingly solid.", "Lee K.", 5),
            R("Overdrive tuned well out of the box.", "Pat R.", 4),
          ],
        },
        {
          id: "pc7-ultrawide",
          name: '34" ultrawide curved 144 Hz (immersive / productivity)',
          priceUSD: 799,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1527443224154-c649a890e0a2?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: [
            "monitor",
            "ultrawide",
            "curved",
            "gaming",
            "pc",
            "productivity",
          ],
          blurb:
            "Racing and sims feel cinematic; split-screen work without dual mounts.",
          reviews: [
            R("Color accuracy good enough for light photo work.", "Nina O.", 5),
            R("Desk depth matters—measure before buying.", "Vik S.", 5),
          ],
        },
        {
          id: "pc7-oled",
          name: '32" 4K OLED gaming monitor (HDR, high refresh)',
          priceUSD: 1299,
          rating: 4.9,
          image:
            "https://images.unsplash.com/photo-1527443224154-c649a890e0a2?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["monitor", "oled", "4k", "hdr", "gaming", "pc", "flagship"],
          blurb:
            "Inky blacks and punchy HDR—premium pairing for a high-end GPU.",
          reviews: [
            R("Burn-in anxiety gone after using pixel shift.", "Omar F.", 5),
            R("Worth it if you live in this screen daily.", "Casey N.", 5),
          ],
        },
      ],
    },
  ],
  /** Shown only when “endless budget” is on — watches, cars, jewelry, designer, flagship gear. */
  luxury: [
    {
      id: "lx1",
      categoryTitle: "Watches & timepieces",
      forGender: null,
      variants: [
        {
          id: "lx1-swiss",
          name: "Swiss automatic watch (entry luxury, 38–40 mm)",
          priceUSD: 2850,
          rating: 4.9,
          image:
            "https://images.unsplash.com/photo-1523170335258-fcded21ff358?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["watch", "swiss", "automatic", "luxury", "gift"],
          blurb:
            "Classic three-hander with exhibition caseback—timeless milestone gift.",
          reviews: [
            R(
              'Wears smaller than the spec sheet—perfect on my 6.5" wrist.',
              "Daniel K.",
              5,
            ),
            R("Authorized dealer card included; peace of mind.", "Sarah M.", 5),
          ],
        },
        {
          id: "lx1-chrono",
          name: "Chronograph sport watch (ceramic bezel)",
          priceUSD: 4200,
          rating: 4.8,
          image:
            "https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["watch", "chronograph", "sport", "luxury"],
          blurb:
            "Tool-watch vibe with serious wrist presence—great for drivers and travelers.",
          reviews: [
            R(
              "Lume is insane at night; chrono pushers feel crisp.",
              "Marcus T.",
              5,
            ),
            R("Heavy—exactly what I wanted.", "James L.", 5),
          ],
        },
      ],
    },
    {
      id: "lx2",
      name: "Lab-grown diamond stud earrings (1 ct tw)",
      blurb:
        "Indistinguishable sparkle, ethical story—comes with grading paperwork.",
      priceUSD: 3200,
      rating: 4.9,
      forGender: "female",
      reviews: [
        R("She wears them daily; settings feel secure.", "David R.", 5),
        R("Appraisal matched what the jeweler quoted.", "Emma P.", 5),
      ],
    },
    {
      id: "lx3",
      name: "Designer leather tote (structured, neutral)",
      blurb: "Full-grain leather, feet on the base, room for laptop + life.",
      priceUSD: 2400,
      rating: 4.8,
      forGender: "female",
      reviews: [
        R("Patina after a month looks intentional.", "Nina S.", 5),
        R("Strap drop is perfect for my frame.", "Leah W.", 5),
      ],
    },
    {
      id: "lx4",
      categoryTitle: "Flagship camera",
      forGender: null,
      variants: [
        {
          id: "lx4-body",
          name: "Full-frame mirrorless body (latest gen)",
          priceUSD: 2800,
          rating: 4.9,
          image:
            "https://images.unsplash.com/photo-1516035069371-29a1b244ccff?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["camera", "full-frame", "photography", "pro"],
          blurb: "IBIS, fast AF, 4K log—upgrade they’ll feel every shoot.",
          reviews: [
            R(
              "Low light is a different world vs my old crop body.",
              "Alex P.",
              5,
            ),
            R("Battery grip worth it for event days.", "Jordan K.", 4),
          ],
        },
        {
          id: "lx4-lens",
          name: "Pro 24–70 mm f/2.8 zoom (stabilized)",
          priceUSD: 2600,
          rating: 4.9,
          image:
            "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&h=750&q=88",
          tags: ["lens", "zoom", "pro", "photography"],
          blurb: "The workhorse lens for weddings, travel, and paid gigs.",
          reviews: [
            R(
              "Sharp wide open; weather sealing saved me in rain.",
              "Chris L.",
              5,
            ),
            R("Heavy but balanced on my grip body.", "Maya F.", 5),
          ],
        },
      ],
    },
    {
      id: "lx5",
      name: "Premium auto detail + ceramic coating (gift certificate)",
      blurb:
        "Multi-day correction + ceramic—showroom gloss for their daily driver.",
      priceUSD: 1200,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Water beads for months; paint looks deeper than new.", "Ryan O.", 5),
        R("Book early—they stay busy for a reason.", "Tom E.", 4),
      ],
    },
    {
      id: "lx6",
      name: "Dual-boiler espresso machine (prosumer)",
      blurb:
        "PID, rotary pump option, steam for latte art—kitchen café energy.",
      priceUSD: 2200,
      rating: 4.9,
      forGender: null,
      reviews: [
        R("Shots rival my favorite café after dialing in.", "Priya N.", 5),
        R("Takes counter space—measure first.", "Sam T.", 4),
      ],
    },
  ],
  kids: [
    {
      id: "kd1",
      categoryTitle: "Creative play",
      forGender: null,
      variants: [
        {
          id: "kd1-lego",
          name: "LEGO Creator 3-in-1 building set (medium)",
          priceUSD: 48,
          rating: 4.9,
          tags: ["building", "creative", "STEM", "kids"],
          blurb:
            "Hours of focused play; they can rebuild into different models.",
          reviews: [
            R(
              "Instructions are clear; we built together on day one.",
              "Sam T.",
              5,
            ),
            R("Box is gift-ready with a fun print.", "Priya L.", 5),
          ],
        },
        {
          id: "kd1-art",
          name: "Washable watercolor set + thick paper pad",
          priceUSD: 32,
          rating: 4.7,
          tags: ["art", "painting", "kids"],
          blurb: "Mess-friendly colors; great for rainy afternoons.",
          reviews: [
            R("Pigments wash out of the table—miracle.", "Alex R.", 5),
            R("Paper is thick enough for wet washes.", "Jordan K.", 4),
          ],
        },
      ],
    },
    {
      id: "kd2",
      categoryTitle: "Outdoor & active",
      forGender: null,
      variants: [
        {
          id: "kd2-scooter",
          name: "Kids’ adjustable kick scooter (LED wheels)",
          priceUSD: 65,
          rating: 4.8,
          tags: ["outdoor", "scooter", "active"],
          blurb: "Grows with them; smooth ride on sidewalks.",
          reviews: [
            R("Assembly took 10 minutes; brakes feel solid.", "Chris P.", 5),
            R("Lights are a hit at dusk.", "Morgan D.", 5),
          ],
        },
        {
          id: "kd2-bubbles",
          name: "Giant bubble wand kit + concentrate",
          priceUSD: 22,
          rating: 4.6,
          tags: ["outdoor", "play"],
          blurb: "Park-day hero—huge bubbles, easy refill.",
          reviews: [
            R("Neighborhood kids all wanted a turn.", "Riley S.", 5),
            R("Sticky hands but worth it.", "Jamie F.", 4),
          ],
        },
      ],
    },
    {
      id: "kd3",
      name: "Storytime chapter book boxed set (age-rated)",
      blurb:
        "A series they can binge—pick the reading level that matches them.",
      priceUSD: 42,
      rating: 4.9,
      forGender: null,
      reviews: [
        R("We read one chapter every night—hooks them fast.", "Emily R.", 5),
        R("Nice paper; spines held up to rereads.", "Tyler W.", 5),
      ],
    },
    {
      id: "kd4",
      name: "Board game night starter (family-friendly)",
      blurb: "Quick rules, laughs in 20 minutes—great for siblings or friends.",
      priceUSD: 28,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Even grandparents joined in.", "Casey D.", 5),
        R("Box is compact for travel.", "Alex M.", 4),
      ],
    },
  ],
  general: [
    {
      id: "gen1",
      name: "Insulated tumbler (engravable)",
      blurb: "Keeps drinks hot or cold; personal touch if you etch a date.",
      priceUSD: 34,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("Daily driver for coffee—no leaks in the bag.", "Taylor B.", 5),
        R("Powder coat still looks new after the dishwasher.", "Jamie C.", 5),
      ],
    },
    {
      id: "gen2",
      name: "Wireless charging pad + night-light",
      blurb: "Soft bedside glow; Qi for phone and earbuds case.",
      priceUSD: 41,
      rating: 4.6,
      forGender: null,
      reviews: [
        R("Charges through my case; light is dimmable.", "Robin F.", 5),
        R("Cable is built-in—wish it were longer.", "Alex Q.", 4),
      ],
    },
    {
      id: "gen3",
      name: "Compact LED desk lamp (dimmer + USB)",
      blurb: "Warm-to-cool light for desk work; charges a phone from the base.",
      priceUSD: 56,
      rating: 4.8,
      forGender: null,
      reviews: [
        R("No flicker at low brightness—easy on the eyes.", "Morgan L.", 5),
        R("Small footprint; arm adjusts without sagging.", "Casey D.", 5),
      ],
    },
    {
      id: "gen4",
      name: "Minimal desk organizer set",
      blurb: "Wood + metal tray for pens, keys, and the little things.",
      priceUSD: 38,
      rating: 4.7,
      forGender: null,
      reviews: [
        R("Finally a home for AirPods and receipts.", "Jordan W.", 5),
        R("Rubber feet prevent sliding.", "Riley S.", 5),
      ],
    },
  ],
};

/** Thematic Unsplash crops — illustrative, not a specific SKU. */
const HOBBY_IMAGES = {
  gaming: [
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  fitness: [
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1434682882778-fd058ab9f217?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  reading: [
    "https://images.unsplash.com/photo-1524997625779-ff43ddc55aae?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  coffee: [
    "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1447933601403-0c6688cb97f2?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  music: [
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1487181975056-3753c7d427c9?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  crafts: [
    "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1513475382583-d06e58bcb0e0?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  photo: [
    "https://images.unsplash.com/photo-1516035069371-29a1b244ccff?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  cooking: [
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  travel: [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1503220317375-aaad6143bdec?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  design: [
    "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  garden: [
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1466692476869-aef1dfb1e735?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  style: [
    "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  cars: [
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1489827904767-e29724dadeb1?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  makeup: [
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  pcbuilding: [
    "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  luxury: [
    "https://images.unsplash.com/photo-1523170335258-fcded21ff358?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  kids: [
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
  general: [
    "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1513885535751-8b9238ae3457?auto=format&fit=crop&w=1200&h=750&q=88",
    "https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&h=750&q=88",
  ],
};

/** Last-resort image when catalog/Pexels URLs fail in the browser. */
export const DEFAULT_GIFT_IMAGE_URL = HOBBY_IMAGES.general[0];

/**
 * @param {{ id: string, image?: string }} gift
 * @param {string} [sourceHobbyId]
 */
export function resolveGiftImage(gift, sourceHobbyId) {
  if (gift?.image) return gift.image;
  const pool = HOBBY_IMAGES[sourceHobbyId] ?? HOBBY_IMAGES.general;
  const list = pool?.length ? pool : [DEFAULT_GIFT_IMAGE_URL];
  const id = gift?.id ?? "";
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return list[h % list.length];
}

/**
 * Map free-text hobbies (e.g. "Cars") onto catalog keys.
 * @param {string[]} labels
 * @returns {string[]}
 */
export function inferHobbyIdsFromCustomLabels(labels) {
  const out = [];
  for (const raw of labels) {
    const low = raw.toLowerCase();
    if (
      /\b(car|cars|auto|automotive|motor|motors|driving|detailing|garage|obd|dash\s*cam)\b/.test(
        low,
      )
    ) {
      out.push("cars");
    }
    if (
      /\b(sim\s*racing|simracing|racing\s*sim|driving\s*sim|wheelbase|force\s*feedback|pedal\s*set|cockpit|bucket\s*seat|assetto|i\s*racing|iracing|gran\s*turismo|f1\s*sim)\b/.test(
        low,
      ) ||
      /sim[-\s]?racing|simracing|racing[-\s]?sim|direct[-\s]?drive|fanatec|thrustmaster|moza\s*racing|logitech\s*g\s*pro/i.test(
        low,
      )
    ) {
      out.push("cars");
      out.push("gaming");
      out.push("pcbuilding");
    }
    if (
      /\b(jewelry|jewellery|jewelery|necklace|bracelet|earrings?|pendant|charm|\bring\b|gem|sterling|925|anklet|brooch|locket)\b/.test(
        low,
      )
    ) {
      out.push("makeup");
    }
    if (
      /\b(makeup|beauty|cosmetic|skincare|nail|palette|lipstick|foundation|blush|glam)\b/.test(
        low,
      )
    ) {
      out.push("makeup");
    }
    if (/\b(chess|shogi|go\s*game)\b/.test(low)) {
      out.push("gaming");
    }
    if (/\b(yoga|pilates|barre|crossfit|marathon|jogging|running|cycling)\b/.test(low)) {
      out.push("fitness");
    }
    if (/\b(knitting|crochet|sewing|quilt|embroidery|needlework)\b/.test(low)) {
      out.push("crafts");
    }
    if (/\b(painting|watercolor|sketch|illustration|pottery)\b/.test(low)) {
      out.push("crafts");
      out.push("design");
    }
    if (/\b(guitar|piano|drums?|violin|synth|djing)\b/.test(low)) {
      out.push("music");
    }
    if (
      /\b(pc|pcs|computer|computers|prebuilt|desktop|workstation|rig|gpu|gpus|graphics|nvidia|geforce|radeon|rtx|build|builds|building|rgb|case|cpu|motherboard|ram|cable|fan|cooling|hardware|steam|video\s*game|videogame|ultrawide|nvme)\b/.test(
        low,
      )
    ) {
      out.push("pcbuilding");
    }
    if (
      /\b(photography|photographer|dslr|mirrorless|lens|shutter|tripod)\b/.test(
        low,
      )
    ) {
      out.push("photo");
    }
    if (
      /\b(kids?|children|child|toddler|tween|playroom|kindergarten|playground|nursery)\b/.test(
        low,
      )
    ) {
      out.push("kids");
    }
    if (
      /\b(ceramic|ceramics|pottery|clay|kiln|glazing|stoneware|porcelain)\b/.test(
        low,
      )
    ) {
      out.push("crafts");
    }
  }
  return [...new Set(out)];
}

/**
 * Words from a hobby label for matching/scoring (Unicode letters & numbers).
 * @param {string} s
 * @param {{ minLen?: number }} [opts]
 * @returns {string[]}
 */
export function tokenizeLabelWords(s, opts = {}) {
  const minLen = opts.minLen ?? 2;
  const raw = String(s || "").trim().toLowerCase();
  if (!raw) return [];
  let parts;
  try {
    parts = raw.split(/[^\p{L}\p{N}+]+/u);
  } catch {
    parts = raw.split(/[^a-z0-9+]+/i);
  }
  const out = parts.map((t) => t.trim()).filter((t) => t.length >= minLen);
  if (out.length === 0 && raw.length >= minLen) return [raw];
  return out;
}

function tokenizePickTerms(s) {
  return tokenizeLabelWords(s, { minLen: 3 });
}

/**
 * Hobby “groups” for deterministic picks: each preset hobby, each custom label,
 * and inferred catalog hobbies from custom text (deduped).
 * @param {string[]} selectedHobbyIds
 * @param {string[]} customLabels
 */
export function buildPickContext(selectedHobbyIds, customLabels) {
  const groups = [];
  const seenKeys = new Set();

  function addGroup(terms) {
    const cleaned = [...new Set(terms.filter(Boolean))].filter(
      (t) => t.length > 1,
    );
    if (!cleaned.length) return;
    const key = [...cleaned].sort().join("\u0001");
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    groups.push({ terms: cleaned });
  }

  for (const id of selectedHobbyIds || []) {
    const h = hobbies.find((x) => x.id === id);
    if (!h) continue;
    addGroup(tokenizePickTerms(`${h.title} ${h.subtitle} ${h.id}`));
  }
  for (const label of customLabels || []) {
    const trimmed = String(label ?? "").trim();
    if (!trimmed) continue;
    const low = trimmed.toLowerCase();
    if (low.length >= 2) {
      addGroup([low]);
    }
    addGroup(tokenizePickTerms(trimmed));
  }
  const inferred = inferHobbyIdsFromCustomLabels(customLabels || []);
  for (const hid of inferred) {
    if ((selectedHobbyIds || []).includes(hid)) continue;
    const h = hobbies.find((x) => x.id === hid);
    if (h) addGroup(tokenizePickTerms(`${h.title} ${h.subtitle} ${h.id}`));
  }
  return { groups };
}

const MAX_RESULTS = 18;

/** Minimum price (USD) for non-luxury rows when "endless budget" is on — avoids $68 skillets. */
const ENDLESS_MIN_PRICE_USD = 200;

/**
 * Hands-on / make-it-yourself: explicit flag, or text/tags on row or variants.
 * Avoids matching "kitchen" via loose "kit" patterns.
 */
export function rowIsDIY(g) {
  if (g.diy === true) return true;
  const chunks = [];
  if (typeof g.name === "string") chunks.push(g.name);
  if (typeof g.blurb === "string") chunks.push(g.blurb);
  if (g.variants?.length) {
    for (const v of g.variants) {
      if (v.name) chunks.push(v.name);
      if (v.blurb) chunks.push(v.blurb);
      if (v.tags?.length) chunks.push(v.tags.join(" "));
      if (v.diy === true) return true;
    }
  }
  const blob = chunks.join(" ").toLowerCase();
  /** Avoid generic “starter kit” / “tool kit” — they match most tech/gaming products. */
  if (
    /\b(diy\b|do[- ]it[- ]yourself|make your own|build your own|handmade|from scratch|origami|papercraft|calligraphy|hand[- ]letter|love letter|bouquet|pressed flower|embroidery|leather tooling|pottery|woodworking|soldering|knitting|weaving|cross[- ]?stitch|soap making|raised bed|seed starter|stamping|macrame|felting|tufting|pyrography|screen print|stained glass|balsa wood|figure painting|terrain building|scale model)\b/.test(
      blob,
    )
  ) {
    return true;
  }
  if (
    /\b(craft kit|model kit|brew kit|bead kit|embroidery kit|soldering kit|resin kit|leather kit|knitting kit|pottery kit|candle kit|soap kit|origami kit|etching kit|weaving loom|seed kit|garden kit|saw kit|pull saw|tooling|kits? for (?:wood|leather|soap|yarn|beads|resin|candles))\b/.test(
      blob,
    )
  ) {
    return true;
  }
  return false;
}

/** Experiences: tickets, classes, trips, vouchers — not only physical SKUs. */
export function rowIsExperience(g) {
  const chunks = [];
  if (typeof g.name === "string") chunks.push(g.name);
  if (typeof g.blurb === "string") chunks.push(g.blurb);
  if (g.categoryTitle) chunks.push(g.categoryTitle);
  if (g.variants?.length) {
    for (const v of g.variants) {
      if (v.name) chunks.push(v.name);
      if (v.blurb) chunks.push(v.blurb);
      if (v.tags?.length) chunks.push(v.tags.join(" "));
    }
  }
  const blob = chunks.join(" ").toLowerCase();
  if (
    /\b(concert|tickets?|festival|vip\b|experience\b|excursion|getaway|retreat|spa day|massage\b|escape room|cooking class|wine tasting|workshop|lesson\b|membership|annual pass|day pass|hot air|skydiving|zipline|rafting|cruise\b|citypass|backstage|meet and greet|masterclass|guided tour|park pass|ski pass|theme park|track day|driving experience|observatory|planetarium)\b/.test(
      blob,
    )
  ) {
    return true;
  }
  if (
    /\b(certificate|voucher|gift card)\b/.test(blob) &&
    /\b(dining|spa|hotel|travel|resort|flight|airline)\b/.test(blob)
  ) {
    return true;
  }
  return false;
}

function rowMaxRating(g) {
  if (g.variants?.length) {
    return Math.max(...g.variants.map((v) => v.rating));
  }
  return g.rating ?? 0;
}

export function finalizeGiftRow(
  g,
  budgetUSD,
  sourceHobbyId,
  budgetUnlimited,
  pickContext = null,
  minBudgetUSD = 0,
) {
  const expanded = expandGiftRow(g);
  const cap = budgetUnlimited ? Infinity : budgetUSD;
  const min = budgetUnlimited ? 0 : Math.max(0, Number(minBudgetUSD) || 0);
  let selected = pickContext?.groups?.length
    ? pickBestVariantForBudgetScored(expanded.variants, cap, pickContext, min)
    : pickBestVariantForBudget(expanded.variants, cap, min);
  if (!selected) {
    selected = pickBestVariantForBudgetScored(
      expanded.variants,
      cap,
      pickContext,
      0,
    );
  }
  if (!selected) {
    selected = pickBestVariantForBudget(expanded.variants, cap, 0);
  }
  if (!selected && expanded.variants?.length) {
    selected = expanded.variants[0];
  }
  if (!selected) {
    return null;
  }
  const inWindow =
    budgetUnlimited ||
    (selected.priceUSD <= budgetUSD && (min <= 0 || selected.priceUSD >= min));
  return {
    ...expanded,
    _sourceHobbyId: sourceHobbyId,
    selectedProduct: selected,
    _inBudget: inWindow,
  };
}

/**
 * @param {{
 *   selectedHobbyIds: string[],
 *   customLabels: string[],
 *   gender: 'male'|'female'|'nonbinary'|'other',
 *   budgetUSD: number,
 *   wantDIY?: boolean,
 *   giftPreference?: 'diy' | 'experience' | 'premade',
 *   budgetUnlimited?: boolean,
 *   minBudgetUSD?: number,
 * }} params
 */
export function getRecommendations({
  selectedHobbyIds,
  customLabels,
  gender,
  budgetUSD,
  wantDIY = false,
  giftPreference,
  budgetUnlimited = false,
  minBudgetUSD = 0,
}) {
  const pref = giftPreference ?? (wantDIY ? "diy" : "premade");
  const pickContext = buildPickContext(selectedHobbyIds, customLabels);
  const inferred = inferHobbyIdsFromCustomLabels(customLabels);
  const hobbyKeys = [...new Set([...selectedHobbyIds, ...inferred])];

  /** @type {object[]} */
  let combined = [];

  for (const hid of hobbyKeys) {
    const list = giftsByHobby[hid] ?? [];
    for (const g of list) {
      combined.push({ ...g, _sourceHobbyId: hid });
    }
  }

  if (budgetUnlimited) {
    const lux = giftsByHobby.luxury ?? [];
    for (const g of lux) {
      combined.push({ ...g, _sourceHobbyId: "luxury" });
    }
  }

  const unmappedCustom = customLabels.filter(
    (l) => inferHobbyIdsFromCustomLabels([l]).length === 0,
  );
  if (unmappedCustom.length > 0) {
    const gen = giftsByHobby.general ?? [];
    for (const g of gen) {
      combined.push({ ...g, _sourceHobbyId: "general" });
    }
  }

  const byId = new Map();
  for (const item of combined) {
    const prev = byId.get(item.id);
    if (!prev || rowMaxRating(item) > rowMaxRating(prev)) {
      byId.set(item.id, item);
    }
  }
  combined = [...byId.values()];

  const genderNeutral = gender === "nonbinary" || gender === "other";
  let eligible = combined.filter(
    (g) => genderNeutral || g.forGender == null || g.forGender === gender,
  );

  if (pref === "diy") {
    const poolBeforeDiy = eligible;
    const diyFromSelected = eligible.filter((g) => rowIsDIY(g));
    if (diyFromSelected.length > 0) {
      eligible = diyFromSelected;
    } else {
      const seen = new Set();
      const allDiy = [];
      for (const [hid, list] of Object.entries(giftsByHobby)) {
        for (const g of list) {
          if (rowIsDIY(g) && !seen.has(g.id)) {
            seen.add(g.id);
            allDiy.push({ ...g, _sourceHobbyId: hid });
          }
        }
      }
      const filteredDiy = allDiy.filter(
        (g) => genderNeutral || g.forGender == null || g.forGender === gender,
      );
      if (filteredDiy.length > 0) {
        eligible = filteredDiy;
      } else {
        eligible = poolBeforeDiy;
      }
    }
  } else if (pref === "experience") {
    const exp = eligible.filter((g) => rowIsExperience(g));
    if (exp.length > 0) eligible = exp;
  }

  let finalized = eligible
    .map((g) =>
      finalizeGiftRow(
        g,
        budgetUSD,
        g._sourceHobbyId,
        budgetUnlimited,
        pickContext,
        minBudgetUSD,
      ),
    )
    .filter(Boolean);

  if (budgetUnlimited) {
    const premium = finalized.filter(
      (f) =>
        f._sourceHobbyId === "luxury" ||
        f.selectedProduct.priceUSD >= ENDLESS_MIN_PRICE_USD,
    );
    if (premium.length > 0) {
      finalized = premium;
    }
  }

  const sorted = sortGiftsByBudgetFit(
    finalized,
    budgetUSD,
    budgetUnlimited,
    pickContext,
    minBudgetUSD,
  );

  const mode = budgetUnlimited
    ? "in"
    : sorted.some((f) => f._inBudget)
      ? "in"
      : "stretch";
  return { gifts: sorted.slice(0, MAX_RESULTS), mode };
}

const LIST_MIN_OK_RATING = 3.6;

/** 0 = within min–max window, 1 = below min, 2 = above soft budget (shown last). */
export function giftBudgetSortTier(
  g,
  budgetUSD,
  budgetUnlimited,
  minBudgetUSD = 0,
) {
  if (budgetUnlimited) return 0;
  const min = Math.max(0, Number(minBudgetUSD) || 0);
  const cap = Number(budgetUSD);
  const p = Number(g.selectedProduct?.priceUSD);
  if (!Number.isFinite(p)) return 2;
  if (!Number.isFinite(cap) || cap < 0) return 0;
  if (p > cap + 0.01) return 2;
  if (min > 0 && p < min - 0.01) return 1;
  return 0;
}

/** True if this row should qualify as an “in budget” top pick (not unlimited). */
export function giftFitsBudgetWindow(
  g,
  budgetUSD,
  budgetUnlimited,
  minBudgetUSD = 0,
) {
  return giftBudgetSortTier(g, budgetUSD, budgetUnlimited, minBudgetUSD) === 0;
}

function multiHobbyHayBonus(hay, pickContext) {
  if (!pickContext?.groups?.length) return 0;
  let mh = 0;
  let matched = 0;
  for (const gr of pickContext.groups) {
    const terms = gr.terms || [];
    if (!terms.some((t) => hay.includes(t))) continue;
    matched++;
    mh += 10;
  }
  if (matched >= 2) mh += 28;
  if (matched >= 3) mh += 18;
  return mh;
}

/**
 * Within the same budget tier: prefer stronger hobby overlap, then rating, then
 * sensible price (use budget when in window).
 */
function scoreForGiftOrder(
  g,
  pickContext,
  budgetUSD,
  budgetUnlimited,
  tier,
) {
  const p = g.selectedProduct;
  const tagBlob = Array.isArray(p.tags) ? p.tags.join(" ") : "";
  const hay =
    `${g.categoryTitle || ""} ${p.name} ${p.blurb || ""} ${tagBlob}`.toLowerCase();
  const mh = multiHobbyHayBonus(hay, pickContext);
  const r = Number(p.rating) || 0;
  let ratingPenalty = 0;
  if (r < 3.5) ratingPenalty = 48;
  else if (r < LIST_MIN_OK_RATING) ratingPenalty = 16;

  if (tier === 0 && budgetUnlimited) {
    return mh * 3 + r * 52 + p.priceUSD * 0.0001 - ratingPenalty;
  }
  if (tier === 0 && !budgetUnlimited && budgetUSD > 0) {
    const cap = Math.max(budgetUSD, 1);
    const ratio = Math.min(1, p.priceUSD / cap);
    return mh * 3 + r * 52 + ratio * 10 - ratingPenalty;
  }
  return mh * 3 + r * 52 - ratingPenalty;
}

/**
 * @param {object[]} pool finalized gifts with selectedProduct
 * @param {number} budgetUSD
 * @param {boolean} budgetUnlimited
 * @param {{ groups?: { terms: string[] }[] } | null} [pickContext]
 * @param {number} [minBudgetUSD]
 */
function sortGiftsByBudgetFit(
  pool,
  budgetUSD,
  budgetUnlimited,
  pickContext = null,
  minBudgetUSD = 0,
) {
  return [...pool].sort((a, b) => {
    const ta = giftBudgetSortTier(a, budgetUSD, budgetUnlimited, minBudgetUSD);
    const tb = giftBudgetSortTier(b, budgetUSD, budgetUnlimited, minBudgetUSD);
    if (ta !== tb) return ta - tb;
    const sa = scoreForGiftOrder(
      a,
      pickContext,
      budgetUSD,
      budgetUnlimited,
      ta,
    );
    const sb = scoreForGiftOrder(
      b,
      pickContext,
      budgetUSD,
      budgetUnlimited,
      tb,
    );
    if (sb !== sa) return sb - sa;
    const ra = Number(a.selectedProduct.rating) || 0;
    const rb = Number(b.selectedProduct.rating) || 0;
    if (rb !== ra) return rb - ra;
    const pa = a.selectedProduct.priceUSD;
    const pb = b.selectedProduct.priceUSD;
    if (budgetUnlimited) return pb - pa;
    if (ta === 2) return pa - pb;
    if (ta === 0) return pb - pa;
    return pb - pa;
  });
}

/**
 * Deterministic ordering for finalized rows (e.g. pure-Groq lists before enrichment).
 * In-budget (and in-window) rows always come first; above soft budget last.
 */
export function sortFinalizedGiftsForDisplay(
  gifts,
  budgetUSD,
  budgetUnlimited,
  pickContext,
  minBudgetUSD = 0,
) {
  return sortGiftsByBudgetFit(
    gifts,
    budgetUSD,
    budgetUnlimited,
    pickContext,
    minBudgetUSD,
  );
}
