import { describe, it, expect, afterEach } from 'vite-plus/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import en from '../en.json';
import tr from '../tr.json';
import it_ from '../it.json';
import sources from '../sources.json';
import { drift, fingerprint, flatten } from '../fingerprint';
import {
  LANGUAGES, STORAGE_KEY, currentLanguage, formatLocale, matchLanguage, setLanguage, text, toolText, translate,
  translateRich,
} from '..';
import { TOOLS } from '../../toolkit/tools';

const entries = (dictionary) => flatten(dictionary);

const placeholders = (value) =>
  [...new Set(JSON.stringify(value).match(/\{\w+\}/g) ?? [])].sort();

afterEach(() => {
  setLanguage('en');
  localStorage.clear();
});

// A string missing from a language, or translated from English since reworded, is
// not a failure here: the screen falls back to English, and the translations
// workflow drafts it on the pull request (scripts/i18n.mjs check).
describe('the dictionaries', () => {
  const english = new Map(entries(en));

  for (const [name, dictionary] of [['tr', tr], ['it', it_]]) {
    it(`${name} has nothing the English does not`, () => {
      expect(entries(dictionary).map(([key]) => key).filter((key) => !english.has(key))).toEqual([]);
    });

    it(`${name} records a fingerprint only for strings it has`, () => {
      const own = new Map(entries(dictionary));
      expect(Object.keys(sources[name] ?? {}).filter((key) => !own.has(key) || !english.has(key))).toEqual([]);
    });

    it(`${name} keeps every placeholder the English has`, () => {
      const own = new Map(entries(dictionary));
      const mismatched = [...english].filter(([key, value]) =>
        own.has(key) && placeholders(value).join() !== placeholders(own.get(key)).join());
      expect(mismatched.map(([key]) => key)).toEqual([]);
    });

  }

  // The English of a translated tool is copied from its registry entry, so that
  // rewording the registry makes the translations stale. This keeps the two equal.
  it("has each translated tool's English exactly as the registry has it", () => {
    for (const [id, fields] of Object.entries(en.tools)) {
      const tool = TOOLS.find((entry) => entry.id === id);
      expect(tool, id).toBeTruthy();
      for (const [field, value] of Object.entries(fields)) expect(value, `${id}.${field}`).toBe(tool[field]);
    }
  });

  it('has as many Dream It prompts in every language', () => {
    expect(tr.dreamIt.prompts).toHaveLength(en.dreamIt.prompts.length);
    expect(it_.dreamIt.prompts).toHaveLength(en.dreamIt.prompts.length);
  });
});

describe('fingerprints', () => {
  it('change when the English does, and only then', () => {
    expect(fingerprint('Join a room')).toBe(fingerprint('Join a room'));
    expect(fingerprint('Join a room')).not.toBe(fingerprint('Join a session'));
    expect(fingerprint({ one: '1 person', other: '{count} people' }))
      .not.toBe(fingerprint({ one: '1 person', other: '{count} persons' }));
  });

  it('tell missing strings from reworded ones', () => {
    const english = { a: 'One', b: 'Two', c: { one: '1 thing', other: '{count} things' } };
    const translated = { a: 'Bir', b: 'İki' };
    const recorded = { a: fingerprint('One'), b: fingerprint('Two, before rewording') };
    expect(drift(english, translated, recorded)).toEqual({ missing: ['c'], stale: ['b'] });
  });
});

describe('translate', () => {
  it('fills in the vars', () => {
    expect(translate('en', 'room.opensOn', { date: '1 May 2027' })).toBe('This room opens on 1 May 2027.');
  });

  it('picks the plural form the language asks for', () => {
    expect(translate('en', 'common.people', { count: 1 })).toBe('1 person');
    expect(translate('en', 'common.people', { count: 4 })).toBe('4 people');
    expect(translate('it', 'common.people', { count: 1 })).toBe('1 persona');
    expect(translate('it', 'common.people', { count: 4 })).toBe('4 persone');
    // Turkish keeps a noun singular after a number.
    expect(translate('tr', 'common.people', { count: 4 })).toBe('4 kişi');
  });

  it('falls back to English for a missing key, and to the key when English has none', () => {
    expect(translate('tr', 'nowhere.atAll')).toBe('nowhere.atAll');
    expect(translate('xx', 'join.title')).toBe('Join a room');
  });

  it('sets an element where its placeholder is, wherever the language puts it', () => {
    const bold = createElement('strong', null, 'Malmö');
    const html = (language) => renderToStaticMarkup(
      createElement('p', null, translateRich(language, 'popQuiz.youAnswered', { answer: bold })));
    expect(html('en')).toBe('<p>You answered <strong>Malmö</strong>.</p>');
    expect(html('tr')).toBe('<p>Yanıtın: <strong>Malmö</strong>.</p>');
  });
});

describe('choosing a language', () => {
  it('follows the first of the browser languages PLACER has', () => {
    expect(matchLanguage(['de-DE', 'tr-TR', 'en'])).toBe('tr');
    expect(matchLanguage(['it'])).toBe('it');
    expect(matchLanguage(['fr-FR', 'de'])).toBe('en');
    expect(matchLanguage([])).toBe('en');
  });

  it('switches, remembers it, and sets <html lang> for Turkish casing', () => {
    setLanguage('tr');
    expect(currentLanguage()).toBe('tr');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('tr');
    expect(document.documentElement.lang).toBe('tr');
    expect(text('join.title')).toBe('Bir odaya katıl');
  });

  it('ignores a language it does not have', () => {
    setLanguage('fr');
    expect(currentLanguage()).toBe('en');
  });

  it('formats numbers and dates the way each language writes them', () => {
    expect(LANGUAGES.map(({ code }) => formatLocale(code))).toEqual(['en-GB', 'tr-TR', 'it-IT']);
  });
});

describe('toolText', () => {
  const tool = TOOLS.find((entry) => entry.id === 'word-cloud');

  it('gives the registry text in English, and the translation otherwise', () => {
    expect(toolText(tool, 'name', 'en')).toBe(tool.name);
    expect(toolText(tool, 'name', 'tr')).toBe('Kelime Bulutu');
  });

  it('falls back to the registry for a tool not translated yet', () => {
    const untranslated = TOOLS.find((entry) => !tr.tools[entry.id]);
    expect(toolText(untranslated, 'name', 'tr')).toBe(untranslated.name);
  });
});
