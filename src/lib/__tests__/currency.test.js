import { describe, it, expect } from 'vite-plus/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CURRENCY_CODES, currencyForLocale, currencyForPlace, currencyForTimeZone, suggestCurrency,
} from '../currency';

const CHECK = /project_budgets_currency_known\s+check \(currency in \(([^)]*)\)\)/;
const checkedIn = (sql) => [...sql.match(CHECK)[1].matchAll(/'([A-Z]{3})'/g)].map((match) => match[1]);

describe('the currencies', () => {
  it('are the ones the database lets a budget be saved in', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/project-budget.sql'), 'utf8');
    expect(checkedIn(sql)).toEqual(CURRENCY_CODES);
  });

  it('are the ones the latest migration checks', () => {
    const dir = join(process.cwd(), 'supabase/migrations');
    const latest = readdirSync(dir).sort().reverse()
      .map((name) => readFileSync(join(dir, name), 'utf8'))
      .find((sql) => CHECK.test(sql));
    expect(checkedIn(latest)).toEqual(CURRENCY_CODES);
  });
});

const OFFERED = ['EUR', 'SEK', 'GBP', 'USD', 'TRY'];

describe('currencyForPlace', () => {
  it('reads the country at the end of a place', () => {
    expect(currencyForPlace('Malmö, Sweden')).toBe('SEK');
    expect(currencyForPlace('Kadıköy, Istanbul, Türkiye')).toBe('TRY');
    expect(currencyForPlace('Ankara, Turkey')).toBe('TRY');
    expect(currencyForPlace('Lyon, France')).toBe('EUR');
  });

  it('knows nothing of a place without a country it knows', () => {
    expect(currencyForPlace('Folkets Park')).toBeNull();
    expect(currencyForPlace('Tokyo, Japan')).toBeNull();
    expect(currencyForPlace('')).toBeNull();
    expect(currencyForPlace(undefined)).toBeNull();
  });
});

describe('currencyForLocale', () => {
  it('goes by the region of a language tag', () => {
    expect(currencyForLocale('tr-TR')).toBe('TRY');
    expect(currencyForLocale('en-GB')).toBe('GBP');
    expect(currencyForLocale('de-AT')).toBe('EUR');
  });

  it('passes over a tag with no region, or no tag at all', () => {
    expect(currencyForLocale('en')).toBeNull();
    expect(currencyForLocale('not a tag')).toBeNull();
  });
});

describe('currencyForTimeZone', () => {
  it('knows a zone only one country uses', () => {
    expect(currencyForTimeZone('Europe/Istanbul')).toBe('TRY');
    expect(currencyForTimeZone('Europe/Stockholm')).toBe('SEK');
    expect(currencyForTimeZone('Europe/Paris')).toBe('EUR');
    expect(currencyForTimeZone('America/Chicago')).toBe('USD');
    expect(currencyForTimeZone('Asia/Tokyo')).toBeNull();
    expect(currencyForTimeZone('')).toBeNull();
  });
});

describe('suggestCurrency', () => {
  it('goes on the time zone before the language', () => {
    expect(suggestCurrency({ offered: OFFERED, fallback: 'EUR', timeZone: 'Europe/Istanbul', locales: ['en-US'] }))
      .toBe('TRY');
    expect(suggestCurrency({ places: ['Malmö, Sweden'], offered: OFFERED, fallback: 'EUR', timeZone: 'Europe/Istanbul' }))
      .toBe('SEK');
  });

  it('prefers the first place, then the next, then the browser', () => {
    expect(suggestCurrency({ places: ['Izmir, Türkiye', 'Malmö, Sweden'], offered: OFFERED, fallback: 'EUR', timeZone: '', locales: ['en-GB'] }))
      .toBe('TRY');
    expect(suggestCurrency({ places: ['Somewhere', 'Malmö, Sweden'], offered: OFFERED, fallback: 'EUR', timeZone: '', locales: ['en-GB'] }))
      .toBe('SEK');
    expect(suggestCurrency({ places: [], offered: OFFERED, fallback: 'EUR', timeZone: '', locales: ['en', 'tr-TR'] })).toBe('TRY');
  });

  it('only suggests one that is offered', () => {
    expect(suggestCurrency({ places: ['Bern, Switzerland'], offered: OFFERED, fallback: 'EUR', timeZone: '', locales: ['en-US'] }))
      .toBe('USD');
    expect(suggestCurrency({ places: ['Bern, Switzerland'], offered: OFFERED, fallback: 'EUR', timeZone: '', locales: [] })).toBe('EUR');
  });
});
