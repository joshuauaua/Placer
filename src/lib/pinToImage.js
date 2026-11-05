/* PLACER — Pin to Image: the setup, a participant's pin, and everybody's together.
 *
 * The organiser picks a picture and asks a question about it ("Where would you sit?");
 * everybody answers with one dot, pinned where they tap on the picture. A pin is where
 * on the picture it is, as fractions of its width and height from its top left corner
 * — { x, y }, each 0 to 1 — so it lands in the same place whatever size the picture is
 * drawn at.
 *
 * The timer is Word Cloud's (lib/wordCloud.js): optional, set up as seconds, started by
 * the room's facilitator, and carried as `timer` on their own contribution.
 */

import { roomTimer as wordCloudRoomTimer, timerProblems as wordCloudTimerProblems } from './wordCloud';

export const DEFAULT_PROMPT = 'Where would you put it?';
export const MAX_PROMPT_LENGTH = 200;

/** The setup a new slide starts from: no question, no picture, no timer. */
export function defaultPinSetup() {
  return { prompt: '', imagePath: null, timer: null };
}

/** What is wrong with the question: the first stage of setting it up. */
export function promptProblems(setup) {
  const prompt = typeof setup?.prompt === 'string' ? setup.prompt.trim() : '';
  if (!prompt) return ['Write what you want people to answer.'];
  if (prompt.length > MAX_PROMPT_LENGTH) return [`Keep the prompt under ${MAX_PROMPT_LENGTH} characters.`];
  return [];
}

/** What is wrong with the picture: there has to be one. */
export function imageProblems(setup) {
  return typeof setup?.imagePath === 'string' && setup.imagePath ? [] : ['Add a picture for people to pin on.'];
}

/** What is wrong with the timer. None at all is fine. */
export function timerProblems(setup) {
  return wordCloudTimerProblems(setup);
}

/** What is wrong with a setup, as sentences for the organiser. Empty when it is ready. */
export function pinSetupProblems(setup) {
  return [...promptProblems(setup), ...imageProblems(setup), ...timerProblems(setup)];
}

const isFraction = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** A pin as it came back from somewhere else, or null if it is not one. */
export function readPin(value) {
  if (!value || !isFraction(value.x) || !isFraction(value.y)) return null;
  return { x: value.x, y: value.y };
}

/** Where on the picture a click or tap at (clientX, clientY) is, in a box `rect`. */
export function pinAt(rect, clientX, clientY) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const clamp = (value) => Math.min(1, Math.max(0, value));
  // Rounded to a ten-thousandth: plenty on any screen, and short to send.
  const round = (value) => Math.round(clamp(value) * 10000) / 10000;
  return { x: round((clientX - rect.left) / rect.width), y: round((clientY - rect.top) / rect.height) };
}

/** The state one participant starts from: no pin yet. */
export function emptyPin() {
  return { pin: null };
}

/** Everybody's pins, and how many people pinned one. */
export function combinePins(states) {
  const pins = [];
  for (const state of states ?? []) {
    const pin = readPin(state?.pin);
    if (pin) pins.push(pin);
  }
  return { pins, people: pins.length };
}

/** The room's timer, wherever it travels (roomTimer in lib/wordCloud.js). */
export function roomTimer(states) {
  return wordCloudRoomTimer(states);
}
