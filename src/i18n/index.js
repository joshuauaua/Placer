/* PLACER — the language the participant side of the app is shown in.
 *
 * The participant side only, so far: joining a room, a tool's cover and header, the
 * room bar and the tools that run in rooms. The organiser side is still written in
 * English in its components, and moves over here screen by screen.
 *
 * No library: every string lives in one dictionary per language (en.json, tr.json,
 * it.json), keyed by where it is used, and text(key, vars) looks it up. A key missing
 * from a language falls back to English, so a half-translated screen still reads.
 *
 *   {name}  in a string is replaced by vars.name.
 *   A value that is an object of plural forms ({ one, other }, or any category
 *   Intl.PluralRules names for that language) is chosen by vars.count.
 *
 * The choice is kept per browser (STORAGE_KEY), and until somebody makes one it
 * follows the browser's own languages, so a phone set to Turkish opens in Turkish.
 * It also sets <html lang>, which is what makes CSS text-transform: uppercase give a
 * Turkish dotted İ rather than an English I.
 *
 * What people type themselves — a prompt, a ballot's options, an answer — is shown
 * as it was written, in whatever language that was.
 */

import { Fragment, createElement, useSyncExternalStore } from 'react';
import en from './en.json';
import tr from './tr.json';
import it from './it.json';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'it', name: 'Italiano' },
];

export const DEFAULT_LANGUAGE = 'en';

const DICTIONARIES = { en, tr, it };

// Deliberately outside services/api.js's STORAGE_KEYS: a language is a setting, not
// data, so erasing your data does not switch the app back to English.
export const STORAGE_KEY = 'placer_language';

const isSupported = (code) => LANGUAGES.some((language) => language.code === code);

/** The first of `preferred` (BCP 47 tags, best first) that PLACER has, or English. */
export function matchLanguage(preferred = []) {
  for (const tag of preferred) {
    const base = String(tag ?? '').toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSupported(stored) ? stored : null;
  } catch {
    return null;
  }
}

function browserLanguages() {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}

function applyToDocument(code) {
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

let current = readStored() ?? matchLanguage(browserLanguages());
applyToDocument(current);

const listeners = new Set();

/** The language everything is shown in right now. */
export function currentLanguage() {
  return current;
}

/** Switch language, remember it for this browser, and redraw whatever reads it. */
export function setLanguage(code) {
  if (!isSupported(code) || code === current) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Without storage the choice holds for this page load only.
  }
  applyToDocument(code);
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const lookup = (dictionary, key) =>
  key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dictionary);

const pluralRules = {};
function pluralCategory(language, count) {
  pluralRules[language] ??= new Intl.PluralRules(language);
  return pluralRules[language].select(count);
}

/**
 * The text for `key` in `language`, with `vars` filled in. Falls back to English, and
 * to the key itself when even English has nothing — loud enough to spot on screen.
 */
export function translate(language, key, vars = {}) {
  let value = lookup(DICTIONARIES[language], key);
  let from = language;
  if (value === undefined) {
    value = lookup(DICTIONARIES[DEFAULT_LANGUAGE], key);
    from = DEFAULT_LANGUAGE;
  }
  if (value === undefined) return key;

  if (value !== null && typeof value === 'object') {
    const category = pluralCategory(from, Number(vars.count ?? 0));
    value = value[category] ?? value.other;
  }

  return String(value).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// The regional form numbers, money and dates are written in for each language. English
// stays British, as the app was before there was a choice.
const FORMAT_LOCALES = { en: 'en-GB', tr: 'tr-TR', it: 'it-IT' };

/** The locale to hand Intl for numbers, money and dates in `language`. */
export function formatLocale(language = current) {
  return FORMAT_LOCALES[language] ?? FORMAT_LOCALES[DEFAULT_LANGUAGE];
}

/** text(key, vars) in the current language. For code outside React. */
export function text(key, vars) {
  return translate(current, key, vars);
}

/**
 * Like translate, but a var can be a React element: the string is split around each
 * {name} and the element set in its place, so a translation can move the bold word to
 * wherever its grammar wants it. Returns an array for JSX.
 */
export function translateRich(language, key, vars = {}) {
  const plain = Object.fromEntries(Object.entries(vars).filter(([, value]) => typeof value !== 'object' || value === null));
  const filled = translate(language, key, plain);
  return filled.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    const value = name && name in vars ? vars[name] : part;
    return createElement(Fragment, { key: index }, value);
  });
}

/**
 * For components: `const { text, rich, language } = useText();`. Redraws when the
 * language changes. Named for what it gives back rather than `t`, which is the theme here.
 */
export function useText() {
  const language = useSyncExternalStore(subscribe, currentLanguage, currentLanguage);
  return {
    language,
    text: (key, vars) => translate(language, key, vars),
    rich: (key, vars) => translateRich(language, key, vars),
  };
}

/**
 * A tool's name, tagline and blurb in the current language. The registry keeps the
 * English (toolkit/tools/*.js); a translation lives under tools.<id> in the dictionary.
 */
export function toolText(tool, field, language = current) {
  const translated = lookup(DICTIONARIES[language], `tools.${tool.id}.${field}`);
  return typeof translated === 'string' ? translated : tool[field];
}
