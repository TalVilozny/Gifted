import { LOCALE_STORAGE_KEY, STRINGS } from "./translations.js";

export { LOCALE_STORAGE_KEY };

/**
 * @param {string} template
 * @param {Record<string, string | number>} [vars]
 */
function interpolate(template, vars) {
  if (!vars || typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

/**
 * @param {'en' | 'he'} locale
 * @returns {(key: string, vars?: Record<string, string | number>) => string}
 */
export function makeT(locale) {
  const table = STRINGS[locale] || STRINGS.en;
  const fallback = STRINGS.en;
  return function t(key, vars) {
    const raw = table[key] ?? fallback[key] ?? key;
    return interpolate(raw, vars);
  };
}

export function hobbyTitleSubtitle(locale, hobbyId) {
  const t = makeT(locale);
  const title = t(`hobby_${hobbyId}_title`);
  const sub = t(`hobby_${hobbyId}_sub`);
  const fb = STRINGS.en;
  const titleOk =
    title !== `hobby_${hobbyId}_title` ? title : fb[`hobby_${hobbyId}_title`];
  const subOk =
    sub !== `hobby_${hobbyId}_sub` ? sub : fb[`hobby_${hobbyId}_sub`];
  return { title: titleOk, subtitle: subOk };
}
