import { describe, it, expect, afterEach } from 'vite-plus/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import en from '../en.json';
import tr from '../tr.json';
import it_ from '../it.json';
import {
  LANGUAGES, STORAGE_KEY, currentLanguage, formatLocale, matchLanguage, setLanguage, text, toolText, translate,
  translateRich,
} from '..';
import { TOOLS } from '../../toolkit/tools';

const PLURAL = ['zero', 'one', 'two', 'few', 'many', 'other'];
const isPlural = (node) => node && typeof node === 'object' && !Array.isArray(node)
  && Object.keys(node).length > 0 && Object.keys(node).every((key) => PLURAL.includes(key));

/** Every string in a dictionary by its dotted key, plural forms kept together. */
function entries(node, prefix = '') {
  if (typeof node === 'string' || isPlural(node)) return [[prefix, node]];
  return Object.entries(node).flatMap(([key, value]) => entries(value, prefix ? `${prefix}.${key}` : key));
}

const placeholders = (value) =>
  [...new Set(JSON.stringify(value).match(/\{\w+\}/g) ?? [])].sort();

afterEach(() => {
  setLanguage('en');
  localStorage.clear();
});

describe('the dictionaries', () => {
  const english = new Map(entries(en));

  for (const [name, dictionary] of [['tr', tr], ['it', it_]]) {
    it(`${name} has every English string, and nothing English does not`, () => {
      const own = new Map(entries(dictionary).filter(([key]) => !key.startsWith('tools.')));
      expect([...english.keys()].filter((key) => !own.has(key))).toEqual([]);
      expect([...own.keys()].filter((key) => !english.has(key))).toEqual([]);
    });

    it(`${name} keeps every placeholder the English has`, () => {
      const own = new Map(entries(dictionary));
      const mismatched = [...english].filter(([key, value]) =>
        own.has(key) && placeholders(value).join() !== placeholders(own.get(key)).join());
      expect(mismatched.map(([key]) => key)).toEqual([]);
    });

    it(`${name} only translates tools that exist`, () => {
      const ids = new Set(TOOLS.map((tool) => tool.id));
      expect(Object.keys(dictionary.tools ?? {}).filter((id) => !ids.has(id))).toEqual([]);
    });
  }

  it('has as many Dream It prompts in every language', () => {
    expect(tr.dreamIt.prompts).toHaveLength(en.dreamIt.prompts.length);
    expect(it_.dreamIt.prompts).toHaveLength(en.dreamIt.prompts.length);
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
