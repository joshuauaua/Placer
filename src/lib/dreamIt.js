/* PLACER — Dream It: prompts that invite people to imagine a place freely.
 *
 * The prompts are drawn like cards from a shuffled deck rather than rolled like a die:
 * every prompt comes up once before any comes up again, and reshuffling never deals the
 * one that was just on the table. A room of people asked for "another" should get
 * another.
 *
 * Which prompts are in the deck is chosen first: the ones here, a group's own, or both.
 * A group's own prompts are held by the page and nowhere else, so they last only until
 * it is refreshed or left.
 */

import { text } from '../i18n';

export const PROMPTS = [
  'If this place had a voice, what would it say?',
  'What is missing here that would bring joy or comfort?',
  'Imagine this place in 2050 — what happens here?',
  'What kind of stories could unfold in this place?',
  'What would make you want to spend more time here?',
  'If this place were a feeling, which one would you want it to be?',
  'What would a perfect morning here look like?',
  'Who do you wish you could meet here, and what would you do together?',
  'What would a child love about this place if anything were possible?',
  'What sounds would you like to hear when you arrive?',
  'If you could give this place one gift, what would it be?',
  'What memory would you like somebody to make here?',
  'What would make this place feel like it belongs to everyone?',
  'Imagine this place on its best day — what is going on?',
  'What would you want to find here on a cold, dark evening?',
];

/**
 * Our prompts in the reader's language (dreamIt.prompts in the dictionary, in the same
 * order as PROMPTS, which stays the English original).
 */
export function ourPrompts() {
  return PROMPTS.map((prompt, index) => text(`dreamIt.prompts.${index}`));
}

/** The prompts in a new order. `random` is a parameter so this can be tested. */
export function shuffle(prompts = PROMPTS, random = Math.random) {
  const deck = [...prompts];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * The next prompt, and the deck left once it has been drawn. An empty deck is
 * reshuffled first, with `last` — the prompt showing now — kept off the top so the
 * same one is never dealt twice running.
 */
export function drawPrompt(deck = [], last = null, { prompts = PROMPTS, random = Math.random } = {}) {
  let left = deck;
  if (left.length === 0) {
    left = shuffle(prompts, random);
    if (left.length > 1 && left[0] === last) left.push(left.shift());
  }
  const [prompt, ...rest] = left;
  return { prompt: prompt ?? null, deck: rest };
}

/** The three ways to fill the deck, in the order they are offered. */
export const MODES = [
  { id: 'existing', name: 'Use the existing prompts', note: `${PROMPTS.length} prompts, ready to go.` },
  { id: 'own', name: 'Write your own prompts', note: 'Only the prompts you add.' },
  { id: 'both', name: 'Keep the existing ones and add your own', note: 'Your prompts, shuffled in with ours.' },
];

/** The longest prompt somebody can write, and the most of them. */
export const MAX_PROMPT_LENGTH = 200;
export const MAX_OWN_PROMPTS = 50;

/** Whether a way of filling the deck asks for prompts to be written. */
export function writesOwn(mode) {
  return mode === 'own' || mode === 'both';
}

/**
 * A group's prompts with one more added, tidied — or the same list back when it cannot
 * be: nothing written, one they (or, when both are in play, we) already have, or one
 * past the most allowed.
 */
export function addPrompt(own, written, mode = 'own') {
  const prompt = String(typeof written === 'string' ? written : '').replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT_LENGTH);
  if (!prompt || own.length >= MAX_OWN_PROMPTS) return own;
  const taken = (mode === 'both' ? [...ourPrompts(), ...own] : own).map((entry) => entry.toLowerCase());
  return taken.includes(prompt.toLowerCase()) ? own : [...own, prompt];
}

/** The prompts a deck is made of: ours, a group's own, or ours with theirs after. */
export function deckPrompts(mode, own = []) {
  if (mode === 'own') return own;
  const ours = ourPrompts();
  if (mode === 'both') return [...ours, ...own.filter((prompt) => !ours.includes(prompt))];
  return ours;
}
