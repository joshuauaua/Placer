/**
 * Mock API Service Layer using localStorage
 *
 * This service encapsulates all data persistence operations.
 * Replace localStorage calls with actual HTTP requests to swap
 * in a real backend without changing UI components.
 */

const STORAGE_KEYS = {
  IMAGINATIONS: 'placemaking_imaginations',
  ASSETS_LIBRARY: 'placemaking_assets',
  UPVOTES: 'placemaking_upvotes',
  COMMENTS: 'placemaking_comments',
  SURVEY_RESPONSES: 'placemaking_survey_responses'
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

/**
 * Upvote an imagination
 */
export const upvoteImagination = async (id) => {
  await simulateDelay();

  const imaginations = await fetchImaginations();
  const index = imaginations.findIndex(img => img.id === id);

  if (index !== -1) {
    imaginations[index].upvotes = (imaginations[index].upvotes || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.IMAGINATIONS, JSON.stringify(imaginations));
    return imaginations[index];
  }

  return null;
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
