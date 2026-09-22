/**
 * Mock API Service Layer using localStorage
 *
 * This service encapsulates all data persistence operations.
 * Replace localStorage calls with actual HTTP requests to swap
 * in a real backend without changing UI components.
 */

// The one registry of everything PLACER keeps in the browser: exportAllData and
// eraseAllData walk it, so a key listed here is covered by the GDPR portability
// and erasure requests for free — and a key that is not is silently missed by
// both. PROFILE is owned by services/profile.js, which declares the same literal
// rather than importing it, so that mocking this module in a test cannot take the
// profile module down with it. services/__tests__/api.test.js holds the two sides
// together.
const STORAGE_KEYS = {
  IMAGINATIONS: 'placemaking_imaginations',
  ASSETS_LIBRARY: 'placemaking_assets',
  UPVOTES: 'placemaking_upvotes',
  COMMENTS: 'placemaking_comments',
  SURVEY_RESPONSES: 'placemaking_survey_responses',
  PROFILE: 'placemaking_profile',
  // Both owned by sandbox/rooms.js, which declares the same literals for the same
  // reason PROFILE does. ROOM_PARTICIPANT is the token that says which contribution
  // in a room is this browser's; ROOMS_HOSTED is what lets a facilitator close a
  // room they opened.
  ROOM_PARTICIPANT: 'placemaking_room_participant',
  ROOMS_HOSTED: 'placemaking_rooms_hosted',
  // Owned by services/follows.js, which declares the same literal for the same
  // reason PROFILE does. Who and what this browser follows before there are
  // accounts to hold that.
  FOLLOWS: 'placemaking_follows',
  // One imagination in progress, parked here only while its author goes to sign in.
  // Signing in with Google, or confirming a new account by email, navigates the whole
  // page away and takes the half-finished imagination in React state with it — so it
  // is written down first and picked up again on the way back. Cleared as soon as it is
  // restored or posted, so in the ordinary case nothing is stored here at all.
  PENDING_IMAGINATION: 'placemaking_pending_imagination'
};

// Simulate network delay for realistic async behavior
const simulateDelay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initialize default asset library if not present
 */
const initializeDefaultAssets = () => {
  const existing = localStorage.getItem(STORAGE_KEYS.ASSETS_LIBRARY);
  if (!existing) {
    const defaultAssets = [
      {
        id: 'asset-1',
        name: 'Park Bench',
        category: 'furniture',
        imageUrl: 'https://via.placeholder.com/150/8B4513/FFFFFF?text=Bench',
        width: 150,
        height: 80
      },
      {
        id: 'asset-2',
        name: 'Tree',
        category: 'nature',
        imageUrl: 'https://via.placeholder.com/120/228B22/FFFFFF?text=Tree',
        width: 120,
        height: 180
      },
      {
        id: 'asset-3',
        name: 'Shrub',
        category: 'nature',
        imageUrl: 'https://via.placeholder.com/80/32CD32/FFFFFF?text=Shrub',
        width: 80,
        height: 60
      },
      {
        id: 'asset-4',
        name: 'Street Lamp',
        category: 'lighting',
        imageUrl: 'https://via.placeholder.com/60/FFD700/000000?text=Lamp',
        width: 60,
        height: 140
      },
      {
        id: 'asset-5',
        name: 'Flower Bed',
        category: 'nature',
        imageUrl: 'https://via.placeholder.com/100/FF69B4/FFFFFF?text=Flowers',
        width: 100,
        height: 50
      },
      {
        id: 'asset-6',
        name: 'Bike Rack',
        category: 'furniture',
        imageUrl: 'https://via.placeholder.com/90/808080/FFFFFF?text=Bike+Rack',
        width: 90,
        height: 70
      }
    ];
    localStorage.setItem(STORAGE_KEYS.ASSETS_LIBRARY, JSON.stringify(defaultAssets));
  }
};

// Initialize on module load
initializeDefaultAssets();

/**
 * Fetch all available assets from the library
 */
export const fetchAssets = async () => {
  await simulateDelay();
  const assets = localStorage.getItem(STORAGE_KEYS.ASSETS_LIBRARY);
  return assets ? JSON.parse(assets) : [];
};

/**
 * Fetch all saved imaginations
 */
export const fetchImaginations = async () => {
  await simulateDelay();
  const imaginations = localStorage.getItem(STORAGE_KEYS.IMAGINATIONS);
  return imaginations ? JSON.parse(imaginations) : [];
};

/**
 * Fetch a single imagination by ID
 */
export const fetchImaginationById = async (id) => {
  await simulateDelay();
  const imaginations = await fetchImaginations();
  return imaginations.find(img => img.id === id) || null;
};

/**
 * Save a new imagination or update existing
 */
export const saveImagination = async (imaginationData) => {
  await simulateDelay();

  const imaginations = await fetchImaginations();
  const timestamp = new Date().toISOString();

  if (imaginationData.id) {
    // Update existing
    const index = imaginations.findIndex(img => img.id === imaginationData.id);
    if (index !== -1) {
      imaginations[index] = {
        ...imaginationData,
        updatedAt: timestamp
      };
    }
  } else {
    // Create new
    const newImagination = {
      ...imaginationData,
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      upvotes: 0,
      comments: []
    };
    imaginations.push(newImagination);
  }

  localStorage.setItem(STORAGE_KEYS.IMAGINATIONS, JSON.stringify(imaginations));
  return imaginationData.id ? imaginations.find(img => img.id === imaginationData.id) : imaginations[imaginations.length - 1];
};

/**
 * Delete an imagination
 */
export const deleteImagination = async (id) => {
  await simulateDelay();
  const imaginations = await fetchImaginations();
  const filtered = imaginations.filter(img => img.id !== id);
  localStorage.setItem(STORAGE_KEYS.IMAGINATIONS, JSON.stringify(filtered));
  return { success: true };
};

// A vote's weight, for turning a browser's standing 'up'/'down'/null into the delta
// it contributes to an imagination's score.
const VOTE_WEIGHT = { up: 1, down: -1 };
const weightOf = (direction) => VOTE_WEIGHT[direction] || 0;

/**
 * Cast, change, or withdraw this browser's vote on an imagination.
 *
 * `direction` is the button that was pressed — 'up' or 'down'. Pressing the one that
 * is already standing withdraws it rather than doubling it, which is why the caller
 * does not have to track what the previous vote was; this reads it back out of
 * STORAGE_KEYS.UPVOTES itself. There is no per-account tracking to dodge here the
 * way the Supabase path needs it — this browser only ever has the one vote to cast,
 * so its own record of what that vote currently is is the whole of the bookkeeping.
 *
 * Returns { upvotes, myVote }, or null for an imagination that is no longer there.
 */
export const voteImagination = async (id, direction) => {
  await simulateDelay();

  const imaginations = await fetchImaginations();
  const index = imaginations.findIndex(img => img.id === id);
  if (index === -1) return null;

  const votes = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPVOTES) || '{}');
  const before = votes[id] || null;
  const after = before === direction ? null : direction;

  imaginations[index].upvotes = (imaginations[index].upvotes || 0) - weightOf(before) + weightOf(after);

  if (after) votes[id] = after;
  else delete votes[id];

  localStorage.setItem(STORAGE_KEYS.UPVOTES, JSON.stringify(votes));
  localStorage.setItem(STORAGE_KEYS.IMAGINATIONS, JSON.stringify(imaginations));

  return { upvotes: imaginations[index].upvotes, myVote: after };
};

/**
 * This browser's standing vote on an imagination — 'up', 'down', or null.
 */
export const readMyVote = async (id) => {
  await simulateDelay();
  const votes = JSON.parse(localStorage.getItem(STORAGE_KEYS.UPVOTES) || '{}');
  return votes[id] || null;
};

/**
 * Add a comment to an imagination
 */
export const addComment = async (imaginationId, commentData) => {
  await simulateDelay();

  const imaginations = await fetchImaginations();
  const index = imaginations.findIndex(img => img.id === imaginationId);

  if (index !== -1) {
    const newComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: commentData.text,
      author: commentData.author || 'Anonymous',
      createdAt: new Date().toISOString()
    };

    if (!imaginations[index].comments) {
      imaginations[index].comments = [];
    }

    imaginations[index].comments.push(newComment);
    localStorage.setItem(STORAGE_KEYS.IMAGINATIONS, JSON.stringify(imaginations));
    return newComment;
  }

  return null;
};

/**
 * Every comment on an imagination, in the order they were added.
 */
export const readComments = async (imaginationId) => {
  await simulateDelay();
  const imagination = await fetchImaginationById(imaginationId);
  return imagination?.comments || [];
};

/**
 * Fetch every submitted survey response
 */
export const fetchSurveyResponses = async () => {
  await simulateDelay();
  const responses = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
  return responses ? JSON.parse(responses) : [];
};

/**
 * Save a completed survey response. Throws if it could not be stored, so the
 * survey can tell the visitor rather than showing a thank-you for nothing.
 */
export const saveSurveyResponse = async (response) => {
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
 * Backs the erasure request on the GDPR page. The default asset library is
 * recreated on the next page load, since it is seed data rather than user data.
 */
export const eraseAllData = async () => {
  await simulateDelay();

  const keys = Object.values(STORAGE_KEYS);
  keys.forEach(key => localStorage.removeItem(key));

  return { success: true, keysCleared: keys.length };
};

/**
 * Export imagination data as JSON (for sharing)
 */
export const exportImagination = async (id) => {
  await simulateDelay();
  const imagination = await fetchImaginationById(id);
  if (imagination) {
    const dataStr = JSON.stringify(imagination, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    return dataUri;
  }
  return null;
};
