/** Country-aware shopping links (search URLs — user picks a listing and reads verified reviews there). */

export const SHOP_COUNTRIES = [
  {
    code: "US",
    label: "United States",
    amazonHost: "www.amazon.com",
    sheinHost: "www.shein.com",
  },
  {
    code: "GB",
    label: "United Kingdom",
    amazonHost: "www.amazon.co.uk",
    sheinHost: "uk.shein.com",
  },
  {
    code: "DE",
    label: "Germany",
    amazonHost: "www.amazon.de",
    sheinHost: "eu.shein.com",
  },
  {
    code: "FR",
    label: "France",
    amazonHost: "www.amazon.fr",
    sheinHost: "fr.shein.com",
  },
  {
    code: "IL",
    label: "Israel",
    amazonHost: "www.amazon.com",
    sheinHost: "il.shein.com",
  },
  {
    code: "CA",
    label: "Canada",
    amazonHost: "www.amazon.ca",
    sheinHost: "ca.shein.com",
  },
  {
    code: "AU",
    label: "Australia",
    amazonHost: "www.amazon.com.au",
    sheinHost: "au.shein.com",
  },
  {
    code: "ES",
    label: "Spain",
    amazonHost: "www.amazon.es",
    sheinHost: "es.shein.com",
  },
  {
    code: "IT",
    label: "Italy",
    amazonHost: "www.amazon.it",
    sheinHost: "it.shein.com",
  },
  {
    code: "NL",
    label: "Netherlands",
    amazonHost: "www.amazon.nl",
    sheinHost: "eu.shein.com",
  },
  {
    code: "BR",
    label: "Brazil",
    amazonHost: "www.amazon.com.br",
    sheinHost: "br.shein.com",
  },
  {
    code: "IN",
    label: "India",
    amazonHost: "www.amazon.in",
    sheinHost: "in.shein.com",
  },
  {
    code: "JP",
    label: "Japan",
    amazonHost: "www.amazon.co.jp",
    sheinHost: "jp.shein.com",
  },
];

/**
 * @param {string} productName
 * @param {string} countryCode
 * @returns {{ id: string, label: string, url: string }[]}
 */
export function getRetailerLinks(productName, countryCode) {
  const c =
    SHOP_COUNTRIES.find((x) => x.code === countryCode) ?? SHOP_COUNTRIES[0];
  const q = productName.trim();
  const enc = encodeURIComponent(q);
  const mapsQuery = encodeURIComponent(`${q} gift store ${c.label}`);

  return [
    {
      id: "amazon",
      label: `Amazon (${c.label})`,
      url: `https://${c.amazonHost}/s?k=${enc}`,
    },
    {
      id: "aliexpress",
      label: "AliExpress",
      url: `https://www.aliexpress.com/wholesale?SearchText=${enc}`,
    },
    {
      id: "etsy",
      label: "Etsy",
      url: `https://www.etsy.com/search?q=${enc}`,
    },
    {
      id: "facebook",
      label: "Facebook Marketplace",
      url: `https://www.facebook.com/marketplace/search/?query=${enc}`,
    },
    {
      id: "shein",
      label: "SHEIN",
      url: `https://${c.sheinHost}/pdsearch/${enc}`,
    },
    {
      id: "asos",
      label: "ASOS (fashion)",
      url: `https://www.asos.com/search/?q=${enc}`,
    },
    {
      id: "shopping",
      label: "Google Shopping",
      url: `https://www.google.com/search?tbm=shop&q=${enc}`,
    },
    {
      id: "local",
      label: `Stores near you (${c.label})`,
      url: `https://www.google.com/maps/search/${mapsQuery}`,
    },
  ];
}
