/* PLACER — which currency somebody is likely counting in.
 *
 * A budget question (ProjectSetupPage) and Co-Budget's setup (BudgetBallotSetup) each
 * offer a short list of currencies. Rather than always starting on euros, they start on
 * the one where the project is, or where its organiser is: a place's country, as the
 * place search writes it ("Malmö, Sweden" — geocode.js asks for English names), or,
 * failing that, the browser's time zone ("Europe/Istanbul") and then the region of its
 * language ("sv-SE"). The time zone goes first: plenty of people in Europe browse in
 * "en-US". Only a suggestion: whatever is picked by hand wins.
 */

/**
 * Every currency an amount can be given in: a project's budget (projects.js's
 * BUDGET_CURRENCIES, which supabase/project-budget.sql checks) and Co-Budget's
 * (budgetBallot.js). One list, so the two never offer different ones.
 */
export const CURRENCIES = [
  { code: 'EUR', name: 'Euro' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'GBP', name: 'British pound' },
  { code: 'USD', name: 'US dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'PLN', name: 'Polish złoty' },
  { code: 'TRY', name: 'Turkish lira' },
];
export const CURRENCY_CODES = CURRENCIES.map(({ code }) => code);
export const DEFAULT_CURRENCY = 'EUR';

// Countries whose currency is one we offer, by ISO 3166 code, with the English names
// the place search gives them (and the names people type by hand).
const COUNTRIES = [
  ...[
    ['AT', 'Austria'], ['BE', 'Belgium'], ['HR', 'Croatia'], ['CY', 'Cyprus'], ['EE', 'Estonia'],
    ['FI', 'Finland'], ['FR', 'France'], ['DE', 'Germany'], ['GR', 'Greece'], ['IE', 'Ireland'],
    ['IT', 'Italy'], ['LV', 'Latvia'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MT', 'Malta'],
    ['NL', 'Netherlands', 'The Netherlands'], ['PT', 'Portugal'], ['SK', 'Slovakia'], ['SI', 'Slovenia'],
    ['ES', 'Spain'], ['AD', 'Andorra'], ['MC', 'Monaco'], ['SM', 'San Marino'], ['VA', 'Vatican City'],
    ['ME', 'Montenegro'], ['XK', 'Kosovo'],
  ].map(([code, ...names]) => [code, 'EUR', names]),
  ['SE', 'SEK', ['Sweden']],
  ['NO', 'NOK', ['Norway']],
  ['DK', 'DKK', ['Denmark']],
  ['GB', 'GBP', ['United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Great Britain']],
  ['US', 'USD', ['United States', 'United States of America', 'USA']],
  ['CH', 'CHF', ['Switzerland']],
  ['LI', 'CHF', ['Liechtenstein']],
  ['PL', 'PLN', ['Poland']],
  ['TR', 'TRY', ['Türkiye', 'Turkey', 'Turkiye']],
];

// Time zones of the countries above, for a browser with no place to go on. Only the
// ones a country has to itself: Europe/Berlin is also Copenhagen's and Oslo's offset,
// but not their name. Each US zone a state uses most of.
const TIME_ZONES = {
  'Europe/Stockholm': 'SEK', 'Europe/Oslo': 'NOK', 'Europe/Copenhagen': 'DKK', 'Europe/London': 'GBP',
  'Europe/Belfast': 'GBP', 'Europe/Zurich': 'CHF', 'Europe/Vaduz': 'CHF', 'Europe/Warsaw': 'PLN',
  'Europe/Istanbul': 'TRY', 'Asia/Istanbul': 'TRY',
  ...Object.fromEntries([
    'Vienna', 'Brussels', 'Zagreb', 'Nicosia', 'Tallinn', 'Helsinki', 'Paris', 'Berlin', 'Busingen',
    'Athens', 'Dublin', 'Rome', 'Riga', 'Vilnius', 'Luxembourg', 'Malta', 'Amsterdam', 'Lisbon',
    'Bratislava', 'Ljubljana', 'Madrid', 'Andorra', 'Monaco', 'San_Marino', 'Vatican', 'Podgorica',
  ].map((city) => [`Europe/${city}`, 'EUR'])),
  'Atlantic/Madeira': 'EUR', 'Atlantic/Azores': 'EUR', 'Atlantic/Canary': 'EUR', 'Africa/Ceuta': 'EUR',
  'Asia/Nicosia': 'EUR', 'Asia/Famagusta': 'EUR',
  ...Object.fromEntries([
    'New_York', 'Chicago', 'Denver', 'Los_Angeles', 'Phoenix', 'Anchorage', 'Detroit', 'Boise', 'Juneau',
    'Indiana/Indianapolis', 'Kentucky/Louisville', 'Adak', 'Nome', 'Sitka', 'Menominee',
  ].map((city) => [`America/${city}`, 'USD'])),
  'Pacific/Honolulu': 'USD',
};

const BY_CODE = new Map(COUNTRIES.map(([code, currency]) => [code, currency]));
const BY_NAME = new Map(COUNTRIES.flatMap(([, currency, names]) => names.map((name) => [name.toLowerCase(), currency])));

/** The currency of the country a place names — its last part, "Malmö, Sweden" — or null. */
export function currencyForPlace(place) {
  const country = (place ?? '').split(',').pop().trim().toLowerCase();
  return BY_NAME.get(country) ?? null;
}

/** The currency of the region in a language tag, "sv-SE" → SEK, or null. */
export function currencyForLocale(locale) {
  try {
    const region = new Intl.Locale(locale).region;
    return BY_CODE.get(region) ?? null;
  } catch {
    return null;
  }
}

/** The currency of an IANA time zone, "Europe/Istanbul" → TRY, or null. */
export function currencyForTimeZone(timeZone) {
  return TIME_ZONES[timeZone] ?? null;
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

function browserLocales() {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}

/**
 * The first of `offered` (all of CURRENCIES unless said) that `places` (best first: the project's, then the person's),
 * the browser's time zone or its languages point at, or `fallback`. A language without
 * a region ("en") says nothing about where somebody is, so it is passed over.
 */
export function suggestCurrency({
  places = [], offered = CURRENCY_CODES, fallback = DEFAULT_CURRENCY, timeZone = browserTimeZone(), locales = browserLocales(),
}) {
  const candidates = [
    ...places.map(currencyForPlace), currencyForTimeZone(timeZone), ...locales.map(currencyForLocale),
  ];
  return candidates.find((currency) => currency && offered.includes(currency)) ?? fallback;
}
