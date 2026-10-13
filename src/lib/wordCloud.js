/* PLACER — Word Cloud: ask something, and see the answers as a cloud of words.
 *
 * A Poll with the answers left open: a prompt, a few words from each person, and a
 * cloud in which a word grows with the number of people who said it. The prompt and
 * how many words each person gets are fixed when a room opens; only the words are sent
 * after that.
 *
 * Words are counted by what they say rather than how they were typed: "Green", "green "
 * and "green!" are one word, and one person saying it twice is still one person.
 */

export const DEFAULT_PROMPT = 'One word for this place?';

/** The longest word — or short phrase — somebody can add. */
export const MAX_WORD_LENGTH = 20;

/** The fewest and most words one person can add, and how many when nobody has said. */
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 5;
export const DEFAULT_LIMIT = 5;

/** The longest prompt a room can be set up with. */
export const MAX_PROMPT_LENGTH = 200;

/**
 * A timer is optional: none, or between these many seconds in steps of TIMER_STEP. It
 * counts down from when whoever asked the prompt starts it, and once it runs out
 * nobody can add more words. They can pause it and carry on, or stop it there and then.
 */
export const MIN_TIMER = 10;
export const MAX_TIMER = 200;
export const TIMER_STEP = 10;
export const TIMER_OPTIONS = Array.from(
  { length: (MAX_TIMER - MIN_TIMER) / TIMER_STEP + 1 }, (_, index) => MIN_TIMER + index * TIMER_STEP,
);

/** How many words a cloud draws: past this the smallest are only noise. */
export const MAX_CLOUD_WORDS = 60;

/**
 * Whatever somebody typed, as the word it is counted as: lower case, single spaces,
 * and no punctuation hanging off either end. Empty when there is no word in it.
 */
export function cleanWord(text) {
  return String(typeof text === 'string' ? text : '')
    .replace(/\s+/g, ' ')
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
    .slice(0, MAX_WORD_LENGTH)
    .trim()
    .toLowerCase();
}

/** How many words each person gets in a room set up this way. */
export function wordLimit(config) {
  const limit = Number(config?.limit);
  if (!Number.isInteger(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limit));
}

const isTimer = (seconds) => Number.isInteger(seconds) && seconds >= MIN_TIMER && seconds <= MAX_TIMER
  && seconds % TIMER_STEP === 0;

/** How many seconds a room's timer runs for, or null when it was set up without one. */
export function cloudTimer(config) {
  return isTimer(config?.timer) ? config.timer : null;
}

/*
 * A timer that has been started is one of two things: `{ endsAt }`, running until that
 * moment in milliseconds (and over once it has passed), or `{ pausedLeft }`, paused with
 * that many milliseconds still to run. Not started is null.
 */

const isMoment = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** A timer as it came back from somewhere else, or null if it is not one. */
export function readTimer(value) {
  if (isMoment(value?.endsAt)) return { endsAt: value.endsAt };
  if (isMoment(value?.pausedLeft)) return { pausedLeft: value.pausedLeft };
  return null;
}

/**
 * A room's timer, or null if it has not been started. It travels as `timer` on the
 * contribution of whoever opened the room — a room has no other way to tell everybody
 * in it something — so it is looked for on all of them.
 */
export function roomTimer(states) {
  for (const state of states ?? []) {
    const timer = readTimer(state?.timer);
    if (timer) return timer;
  }
  return null;
}

/** A timer started now, to run for `seconds`. */
export function startTimer(seconds, now = Date.now()) {
  return { endsAt: now + seconds * 1000 };
}

/** A running timer paused now, holding on to what it had left. */
export function pauseTimer(timer, now = Date.now()) {
  return isPaused(timer) ? timer : { pausedLeft: Math.max(0, (timer?.endsAt ?? now) - now) };
}

/** A paused timer set running again now, from where it was paused. */
export function resumeTimer(timer, now = Date.now()) {
  return isPaused(timer) ? { endsAt: now + timer.pausedLeft } : timer;
}

/** A timer stopped now: over, however much it had left. */
export function stopTimer(now = Date.now()) {
  return { endsAt: now };
}

export function isPaused(timer) {
  return isMoment(timer?.pausedLeft);
}

/**
 * Whole seconds left on a timer: null before it starts, and 0 once it is over. `now`
 * is a parameter so this can be tested without waiting.
 */
export function secondsLeft(timer, now = Date.now()) {
  if (!timer) return null;
  const left = isPaused(timer) ? timer.pausedLeft : timer.endsAt - now;
  return Math.max(0, Math.ceil(left / 1000));
}

/** 75 → '1:15', for the countdown. */
export function formatCountdown(left) {
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** The state one participant starts from: no words yet. */
export function emptyWords() {
  return { words: [] };
}

// One person's words as they are counted: cleaned, each once, and no more than the limit.
function ownWords(state, limit) {
  const words = Array.isArray(state?.words) ? state.words : [];
  return [...new Set(words.map(cleanWord).filter(Boolean))].slice(0, limit);
}

/**
 * A person's words with one more added — or the same list back when it cannot be: an
 * empty word, one they already have, or one past the limit.
 */
export function addWord(words, text, limit = DEFAULT_LIMIT) {
  const word = cleanWord(text);
  if (!word || words.includes(word) || words.length >= limit) return words;
  return [...words, word];
}

/**
 * Everybody's words, counted. `words` is every word with the number of people who said
 * it, the most said first and alphabetical within a count; `total` is how many words
 * were said in all, and `people` how many people said any. This is also what one
 * person's words (outside a room) are shown through.
 *
 * A malformed or missing contribution — the state comes back from a database other
 * browsers wrote to — is skipped rather than thrown on.
 */
export function countWords(states, limit = MAX_LIMIT) {
  const counts = new Map();
  let people = 0;
  for (const state of states ?? []) {
    const words = ownWords(state, limit);
    if (words.length > 0) people += 1;
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const words = [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  const total = words.reduce((sum, entry) => sum + entry.count, 0);

  return { words, total, people };
}

/** Everybody's words in a room, counted against the limit it was set up with. */
export function combineWords(states, config) {
  return countWords(states, wordLimit(config));
}

/**
 * A count laid out as a cloud: the most said words, each with a `weight` from 0 (said
 * once) to 1 (said the most), in the order they are drawn — the heaviest in the middle
 * and the rest falling away to either side, which is what makes a wrapped row of words
 * read as a cloud rather than a ranking.
 *
 * When every word has been said once there is nothing to rank, so they all take the
 * same middling weight rather than all being drawn at the largest size.
 */
export function cloudWords(result, max = MAX_CLOUD_WORDS) {
  const top = (result?.words ?? []).slice(0, max);
  const peak = top[0]?.count ?? 0;

  const cloud = [];
  top.forEach((entry, index) => {
    const weight = peak > 1 ? Math.sqrt((entry.count - 1) / (peak - 1)) : 0.4;
    const placed = { ...entry, weight };
    if (index % 2 === 0) cloud.push(placed);
    else cloud.unshift(placed);
  });
  return cloud;
}

/*
 * Setting a word cloud up for a room. Opened for a project, the prompt is what the
 * project's page shows above the cloud, so it is written once, before the room opens,
 * and fixed for its life (supabase/rooms-config.sql).
 */

export function defaultCloudSetup() {
  return { prompt: '', limit: DEFAULT_LIMIT, timer: null };
}

/** What is wrong with a setup, as sentences for the organiser. Empty when it is ready. */
export function cloudSetupProblems(setup) {
  return [...promptProblems(setup), ...limitProblems(setup), ...timerProblems(setup)];
}

/** What is wrong with the setup's prompt: the first stage of setting a word cloud up. */
export function promptProblems(setup) {
  const prompt = typeof setup?.prompt === 'string' ? setup.prompt.trim() : '';
  if (!prompt) return ['Write what you want people to answer.'];
  if (prompt.length > MAX_PROMPT_LENGTH) return [`Keep the prompt under ${MAX_PROMPT_LENGTH} characters.`];
  return [];
}

/** What is wrong with the words each person gets: the second stage. None said is the default. */
export function limitProblems(setup) {
  const limit = setup?.limit;
  if (limit === undefined) return [];
  if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return [`Give each person between ${MIN_LIMIT} and ${MAX_LIMIT} words.`];
  }
  return [];
}

/** What is wrong with the setup's timer. None at all is fine: a timer is optional. */
export function timerProblems(setup) {
  const timer = setup?.timer;
  if (timer === undefined || timer === null) return [];
  return isTimer(timer) ? [] : [`Set the timer between ${MIN_TIMER} and ${MAX_TIMER} seconds, in steps of ${TIMER_STEP}.`];
}

/** What is wrong with the second stage as a whole: the words each person gets, and the timer. */
export function wordsProblems(setup) {
  return [...limitProblems(setup), ...timerProblems(setup)];
}
