import {
  completeGroq,
  extractJsonObject,
  isGroqConfigured,
} from "./groqClient.js";

export { isGroqConfigured };

/**
 * Ask Groq to pick one variant id from the list. Returns null if no API key.
 */
export async function refineWithGroq({
  variants,
  userQuery,
  budgetUSD,
  categoryTitle,
  budgetUnlimited = false,
  minBudgetUSD = 0,
}) {
  if (!isGroqConfigured()) return null;

  const min = Math.max(0, Number(minBudgetUSD) || 0);
  const budgetHint =
    budgetUnlimited || !Number.isFinite(budgetUSD)
      ? "User has UNLIMITED budget—prefer the most premium option in the list that fits their request."
      : min > 0
        ? `Prefer ${Number(min).toFixed(2)} <= priceUSD <= ${Number(budgetUSD).toFixed(2)} when possible.`
        : `Prefer priceUSD <= ${Number(budgetUSD).toFixed(2)} when possible.`;

  const catalog = variants.map((v) => ({
    id: v.id,
    name: v.name,
    priceUSD: v.priceUSD,
    rating: v.rating,
    tags: v.tags,
    blurb: (v.blurb || "").slice(0, 240),
  }));

  const prompt = `You choose ONE catalog variant that best matches the user's short request.

Context: These are real SKUs in our gift app—the user is not asking you to redesign products. Your job is to pick the best match from the list and explain it positively.

${budgetHint}

Rules:
- Set chosenId to exactly one "id" from options (copy the string exactly). Never invent ids.
- In "reason" (one short sentence): say what matches their request (features, tier, size, use case).
- NEVER write that something is the "only option", "only choice", "cannot improve", or that you refuse to pick—always choose the closest match. If nothing fits perfectly, pick the nearest variant and briefly note one tradeoff.
- If they ask for a feature no variant has, still pick the best partial match.

category: ${JSON.stringify(categoryTitle || "gift")}
userRequest: ${JSON.stringify(userQuery)}

options:
${JSON.stringify(catalog, null, 2)}

Return ONLY valid JSON: {"chosenId":"...","reason":"..."}`;

  const text = await completeGroq(prompt, { temperature: 0.25 });
  const parsed = extractJsonObject(text);
  if (!parsed.chosenId || typeof parsed.chosenId !== "string") {
    throw new Error("Missing chosenId in model JSON");
  }
  return {
    chosenId: parsed.chosenId.trim(),
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}
