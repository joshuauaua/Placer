#!/usr/bin/env node
/* PLACER — keeping the Turkish and Italian dictionaries in step with the English.
 *
 *   node scripts/i18n.mjs check
 *       Lists what each language is missing, and what it translated from English that
 *       has since been reworded (src/i18n/fingerprint.js). Exits 3 if there is any.
 *
 *   node scripts/i18n.mjs translate [--lang tr]
 *       Drafts every missing and stale string with Claude, writes it into the
 *       dictionary and records what English it came from. Needs ANTHROPIC_API_KEY and
 *       the Anthropic SDK, which is not an app dependency: the pull request workflow
 *       installs it on its own (.github/workflows/translations.yml), and locally
 *       `npm install --no-save @anthropic-ai/sdk` does the same.
 *
 *   node scripts/i18n.mjs stamp [--lang tr] [key ...]
 *       Records the current English for strings a person has just translated or
 *       checked by hand, so they stop counting as stale. Without keys, stamps every
 *       string the language has — only right after reviewing all of them.
 *
 * `--root <dir>` reads and writes the dictionaries under another checkout, which is
 * how the workflow runs this script from the base branch against a pull request.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { drift, fingerprint, flatten, setAt } from '../src/i18n/fingerprint.js';

const TARGETS = { tr: 'Turkish (Türkiye)', it: 'Italian (Italy)' };
const MODEL = 'claude-opus-5-5';

const args = process.argv.slice(2);
const command = args[0];
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? null : args[at + 1];
};
const positional = args.slice(1).filter((arg, index, all) => !arg.startsWith('--') && !all[index - 1]?.startsWith('--'));

const root = resolve(option('root') ?? '.');
const dir = join(root, 'src/i18n');
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
const write = (name, data) => writeFileSync(join(dir, name), `${JSON.stringify(data, null, 2)}\n`);

const english = read('en.json');
const sources = read('sources.json');
const languages = option('lang') ? [option('lang')] : Object.keys(TARGETS);

function check() {
  let behind = 0;
  for (const language of languages) {
    const { missing, stale } = drift(english, read(`${language}.json`), sources[language]);
    behind += missing.length + stale.length;
    console.log(`${language}: ${missing.length} missing, ${stale.length} out of date`);
    for (const key of missing) console.log(`  missing  ${key}`);
    for (const key of stale) console.log(`  stale    ${key}`);
  }
  if (behind > 0) {
    console.log('\nRun `node scripts/i18n.mjs translate` to draft them, then have a native speaker check the diff.');
    // Not 1, which is also what a crash exits with: the workflow tells the two apart.
    process.exitCode = 3;
  }
}

function stamp() {
  const englishByKey = new Map(flatten(english));
  for (const language of languages) {
    const own = new Map(flatten(read(`${language}.json`)));
    const keys = positional.length > 0 ? positional : [...own.keys()];
    sources[language] ??= {};
    for (const key of keys) {
      if (!englishByKey.has(key) || !own.has(key)) throw new Error(`${language}: no string at ${key}`);
      sources[language][key] = fingerprint(englishByKey.get(key));
    }
    console.log(`${language}: stamped ${keys.length}`);
  }
  write('sources.json', sortKeys(sources));
}

const sortKeys = (object) => Object.fromEntries(Object.entries(object)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => [key, value && typeof value === 'object' && !Array.isArray(value) ? sortKeys(value) : value]));

// Plural forms travel as separate strings ("key#one"), so every string in the reply
// has the same shape and the schema stays flat.
const toStrings = (entries) => entries.flatMap(([key, value]) => (typeof value === 'string'
  ? [{ key, english: value }]
  : Object.entries(value).map(([form, text]) => ({ key: `${key}#${form}`, english: text }))));

function instructions(language) {
  return [
    `You translate the interface of PLACER, a participatory placemaking app, from British English into ${TARGETS[language]}.`,
    'The people reading it are residents taking part in a workshop or an online consultation about a street or square near them, mostly on a phone.',
    'Write the way a careful local designer would: plain, warm, short. Use the informal second person, as the existing translation does.',
    'Keep every {placeholder} exactly as written, and keep the punctuation that ends each string (a full stop, a question mark, an ellipsis).',
    'Do not add a suffix directly onto a {placeholder}: the value is filled in later, so its ending is not known.',
    'Keys ending in #one and #other are the plural forms of one string; translate each so it reads right for that count.',
    'Use the same word for the same thing as the existing translation does. It is given in full as the glossary to follow.',
    'Reply with the translations only, in the JSON schema provided, one entry per key you were given.',
  ].join('\n');
}

async function translate() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const englishByKey = new Map(flatten(english));

  for (const language of languages) {
    const translated = read(`${language}.json`);
    const { missing, stale } = drift(english, translated, sources[language]);
    const keys = [...missing, ...stale];
    if (keys.length === 0) {
      console.log(`${language}: up to date`);
      continue;
    }

    const own = new Map(flatten(translated));
    const wanted = toStrings(keys.map((key) => [key, englishByKey.get(key)])).map((entry) => {
      const [key, form] = entry.key.split('#');
      const previous = form ? own.get(key)?.[form] : own.get(key);
      return previous === undefined ? entry : { ...entry, previous_translation: previous };
    });

    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      // A safety decline is rerun on another model rather than failing the job.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              translations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { key: { type: 'string' }, text: { type: 'string' } },
                  required: ['key', 'text'],
                  additionalProperties: false,
                },
              },
            },
            required: ['translations'],
            additionalProperties: false,
          },
        },
      },
      system: instructions(language),
      messages: [{
        role: 'user',
        content: [
          `The existing ${TARGETS[language]} translation, as the glossary:\n${JSON.stringify(translated)}`,
          'Translate these. Where a previous_translation is given, the English has changed since it was made: update it to say what the new English says, keeping its wording where it still fits.',
          JSON.stringify(wanted, null, 2),
        ].join('\n\n'),
      }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') throw new Error(`${language}: the request was declined.`);
    if (message.stop_reason === 'max_tokens') throw new Error(`${language}: the reply was cut off; translate fewer strings at once.`);
    const reply = message.content.find((block) => block.type === 'text');
    const { translations } = JSON.parse(reply?.text ?? '{}');

    const byKey = new Map((translations ?? []).map((entry) => [entry.key, entry.text]));
    const unanswered = wanted.filter((entry) => !byKey.has(entry.key)).map((entry) => entry.key);
    if (unanswered.length > 0) throw new Error(`${language}: no translation came back for ${unanswered.join(', ')}`);

    sources[language] ??= {};
    for (const key of keys) {
      const source = englishByKey.get(key);
      const value = typeof source === 'string'
        ? byKey.get(key)
        : Object.fromEntries(Object.keys(source).map((form) => [form, byKey.get(`${key}#${form}`)]));
      setAt(translated, key, value, english);
      sources[language][key] = fingerprint(source);
    }
    write(`${language}.json`, translated);
    console.log(`${language}: drafted ${keys.length} (${missing.length} new, ${stale.length} reworded)`);
  }
  write('sources.json', sortKeys(sources));
}

const commands = { check, stamp, translate };
if (!commands[command]) {
  console.error('Usage: node scripts/i18n.mjs check | translate [--lang xx] | stamp [--lang xx] [key ...]');
  process.exit(2);
}
await commands[command]();
