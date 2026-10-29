/**
 * What PLACER keeps in the browser, and the survey responses: the GDPR export and
 * erasure of it, and the Idea Visualizer draft parked while its author signs up.
 */

import { getSupabase } from './supabase';
import { track } from '../analytics';

/** The table survey responses are appended to. */
export const SURVEY_TABLE = 'survey_responses';

// The one registry of everything PLACER keeps in the browser: exportAllData and
// eraseAllData walk it, so a key listed here is covered by the GDPR portability
// and erasure requests for free — and a key that is not is silently missed by
// both. PROFILE is owned by services/profile.js, which declares the same literal
// rather than importing it, so that mocking this module in a test cannot take the
// profile module down with it. services/__tests__/api.test.js holds the two sides
// together.
const STORAGE_KEYS = {
  // Imaginations, their votes and their comments as this browser kept them before
  // there were accounts, and the placeholder asset library that used to be seeded on
  // every page load. Nothing writes them any more (an idea is kept on the profile now,
  // services/inquiries.js), but a browser may still hold some, and they stay listed so
  // the export and erasure requests still reach them.
  IMAGINATIONS: 'placemaking_imaginations',
  ASSETS_LIBRARY: 'placemaking_assets',
  UPVOTES: 'placemaking_upvotes',
  COMMENTS: 'placemaking_comments',
  SURVEY_RESPONSES: 'placemaking_survey_responses',
  PROFILE: 'placemaking_profile',
  // Both owned by toolkit/rooms.js, which declares the same literals for the same
  // reason PROFILE does. ROOM_PARTICIPANT is the token that says which contribution
  // in a room is this browser's; ROOMS_HOSTED is what lets a facilitator close a
  // room they opened.
  ROOM_PARTICIPANT: 'placemaking_room_participant',
  ROOMS_HOSTED: 'placemaking_rooms_hosted',
  // Also toolkit/rooms.js's: what this browser answered in a poll on a project's page,
  // so it is shown the results when it comes back.
  ROOM_ANSWERS: 'placemaking_room_answers',
  // Owned by services/follows.js, which declares the same literal for the same
  // reason PROFILE does. Who and what this browser follows before there are
  // accounts to hold that.
  FOLLOWS: 'placemaking_follows',
  // One imagination in progress, parked here only while its author goes to sign in.
  // Signing in with Google, or confirming a new account by email, navigates the whole
  // page away and takes the half-finished imagination in React state with it — so it
  // is written down first and picked up again on the way back. Cleared as soon as it is
  // restored or saved, so in the ordinary case nothing is stored here at all.
  PENDING_IMAGINATION: 'placemaking_pending_imagination'
};

// Simulate network delay for realistic async behavior
const simulateDelay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch every submitted survey response
 */
export const fetchSurveyResponses = async () => {
  await simulateDelay();
  const responses = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
  return responses ? JSON.parse(responses) : [];
};

/**
 * One response as a survey_responses row. The answers stay nested under their
 * sections in a single jsonb value, so rewording a survey needs no migration;
 * only the tag, the address and the free text get columns of their own.
 */
const asSurveyRow = ({ email, otherText, source, ...answers }) => ({
  source,
  // An empty address is no address; the column is nullable.
  email: email || null,
  answers,
  other_text: otherText ?? {}
});

/**
 * Save a completed survey response. Throws if it could not be stored, so the
 * survey can tell the visitor rather than showing a thank-you for nothing.
 *
 * Goes to Supabase when a project is configured, and otherwise stays in this
 * browser — which is what makes the survey work with no backend at all, and what
 * keeps the tests off the network.
 */
export const saveSurveyResponse = async (response) => {
  const supabase = await getSupabase();

  if (supabase) {
    const row = asSurveyRow(response);
    // Deliberately no .select(): neither role may read the table, so asking for
    // the row back would fail the insert it just made.
    const { error } = await supabase.from(SURVEY_TABLE).insert(row);
    if (error) {
      throw new Error(`Could not save the survey response: ${error.message}`);
    }
    track('survey_submitted', { source: response.source });
    return { ...row, submittedAt: new Date().toISOString() };
  }

  await simulateDelay();

  const responses = await fetchSurveyResponses();
  const saved = {
    ...response,
    id: `survey-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    submittedAt: new Date().toISOString()
  };

  responses.push(saved);
  localStorage.setItem(STORAGE_KEYS.SURVEY_RESPONSES, JSON.stringify(responses));
  return saved;
};

/**
 * Park the imagination somebody is in the middle of making, because they are about to be
 * sent somewhere that will reload the page.
 *
 * Silently does nothing if it will not fit. The record carries a composited preview and
 * often a Street View capture as well, which is a few hundred KB of base64 against
 * localStorage's few MB — and failing to park a draft is a much smaller problem than
 * throwing an exception into the middle of somebody signing in. They lose the drawing,
 * which is exactly what happened before this existed.
 */
export const savePendingImagination = async (pending) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_IMAGINATION, JSON.stringify({
      ...pending,
      stashedAt: new Date().toISOString()
    }));
    return { success: true };
  } catch (err) {
    console.error('Could not park the imagination in progress:', err);
    return { success: false };
  }
};

// How long a parked imagination is worth restoring. Somebody who goes to confirm an
// account and comes back an hour later should find their work; somebody who abandoned it
// a fortnight ago should not be dropped back onto a Post step they have forgotten about.
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The parked imagination, or null. */
export const readPendingImagination = async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_IMAGINATION);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    // A record with nothing on it is worse than none: it would send somebody to a Post
    // step with no imagination to post.
    if (!parsed || typeof parsed !== 'object' || !parsed.capturedView) return null;

    const stashedAt = Date.parse(parsed.stashedAt ?? '');
    if (!Number.isFinite(stashedAt) || Date.now() - stashedAt > PENDING_MAX_AGE_MS) {
      // Too old to spring on somebody, and no reason to keep taking up the budget.
      localStorage.removeItem(STORAGE_KEYS.PENDING_IMAGINATION);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

/** Forget the parked imagination, once it has been restored or posted. */
export const clearPendingImagination = async () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_IMAGINATION);
  } catch {
    // Nothing to do about it, and nothing depends on it having worked.
  }
};

/**
 * Export every piece of PLACER data held in this browser.
 * Backs the data portability request on the GDPR page.
 */
export const exportAllData = async () => {
  await simulateDelay();

  const data = {};
  Object.values(STORAGE_KEYS).forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // Keep unparseable values verbatim so nothing is silently dropped
      data[key] = raw;
    }
  });

  const payload = { exportedAt: new Date().toISOString(), data };
  const dataStr = JSON.stringify(payload, null, 2);

  return {
    ...payload,
    dataUri: 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
  };
};

/**
 * Delete every piece of PLACER data held in this browser.
 * Backs the erasure request on the GDPR page.
 */
export const eraseAllData = async () => {
  await simulateDelay();

  const keys = Object.values(STORAGE_KEYS);
  keys.forEach(key => localStorage.removeItem(key));

  return { success: true, keysCleared: keys.length };
};
