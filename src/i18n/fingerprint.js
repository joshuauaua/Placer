/* PLACER — telling when a translation has fallen behind its English.
 *
 * Every Turkish and Italian string was made from some English. sources.json keeps a
 * fingerprint of that English, per language and key; when the English is reworded,
 * its fingerprint no longer matches and the translation is stale. scripts/i18n.mjs
 * reports stale and missing strings, drafts new ones, and records the fingerprint of
 * whatever it (or a person) has just translated.
 *
 * Plain JavaScript with no imports, so the script under Node and the tests under
 * Vitest share it.
 */

const PLURAL = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** True for a set of plural forms ({ one, other }), which is one string to translate. */
export function isPlural(node) {
  return Boolean(node) && typeof node === 'object' && !Array.isArray(node)
    && Object.keys(node).length > 0 && Object.keys(node).every((key) => PLURAL.includes(key));
}

/**
 * Every translatable string in a dictionary by its dotted key — the same keys text()
 * looks up — with a set of plural forms kept together as one entry.
 */
export function flatten(node, prefix = '') {
  if (typeof node === 'string' || isPlural(node)) return [[prefix, node]];
  const children = Array.isArray(node) ? node.map((value, index) => [String(index), value]) : Object.entries(node);
  return children.flatMap(([key, value]) => flatten(value, prefix ? `${prefix}.${key}` : key));
}

/** Put a value back at its dotted key, making arrays where the English has them. */
export function setAt(dictionary, key, value, shape) {
  const parts = key.split('.');
  let node = dictionary;
  let mirror = shape;
  parts.slice(0, -1).forEach((part) => {
    mirror = mirror?.[part];
    node[part] ??= Array.isArray(mirror) ? [] : {};
    node = node[part];
  });
  node[parts.at(-1)] = value;
}

/** A short fingerprint of an English value: 32-bit FNV-1a over its JSON, as hex. */
export function fingerprint(value) {
  const input = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * What a language is missing against the English, and what it has that was made from
 * English since reworded. `sources` is that language's { key: fingerprint }.
 */
export function drift(english, translated, sources = {}) {
  const own = new Map(flatten(translated));
  const missing = [];
  const stale = [];
  for (const [key, value] of flatten(english)) {
    if (!own.has(key)) missing.push(key);
    else if (sources[key] !== fingerprint(value)) stale.push(key);
  }
  return { missing, stale };
}
