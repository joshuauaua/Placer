import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';

const VERSION_KEY = 'placer_storage_version';
const IMAGINATIONS = 'placemaking_imaginations';
const ASSETS = 'placemaking_assets';
const UPVOTES = 'placemaking_upvotes';
const COMMENTS = 'placemaking_comments';
const CONSENT_KEY = 'placer_analytics_consent';

let migrateStorage;

describe('migrateStorage — one-time purge for the PLOT to PLACER rename', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    ({ migrateStorage } = await import('../api'));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('discards imaginations, upvotes and comments stored under the old name', () => {
    localStorage.setItem(IMAGINATIONS, JSON.stringify([{ id: 'old' }]));
    localStorage.setItem(UPVOTES, JSON.stringify({ old: 1 }));
    localStorage.setItem(COMMENTS, JSON.stringify([{ text: 'stale' }]));

    expect(migrateStorage()).toEqual({ migrated: true, from: 0 });

    expect(localStorage.getItem(IMAGINATIONS)).toBeNull();
    expect(localStorage.getItem(UPVOTES)).toBeNull();
    expect(localStorage.getItem(COMMENTS)).toBeNull();
  });

  it('leaves the seed asset library in place', () => {
    localStorage.setItem(ASSETS, JSON.stringify([{ type: 'tree' }]));
    migrateStorage();

    // Seed data, not something the visitor authored.
    expect(localStorage.getItem(ASSETS)).not.toBeNull();
  });

  it('leaves an existing analytics consent decision alone', () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    migrateStorage();

    // A decision the visitor already made has to survive the rename.
    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
  });

  it('runs only once, so imaginations saved afterwards survive a reload', () => {
    localStorage.setItem(IMAGINATIONS, JSON.stringify([{ id: 'old' }]));
    expect(migrateStorage()).toEqual({ migrated: true, from: 0 });

    // The visitor creates something new under the new name.
    localStorage.setItem(IMAGINATIONS, JSON.stringify([{ id: 'new' }]));

    expect(migrateStorage()).toEqual({ migrated: false, from: 1 });
    expect(JSON.parse(localStorage.getItem(IMAGINATIONS))).toEqual([{ id: 'new' }]);
  });

  it('stamps the version even for a first-time visitor with nothing stored', () => {
    expect(migrateStorage()).toEqual({ migrated: true, from: 0 });
    expect(localStorage.getItem(VERSION_KEY)).toBe('1');
  });

  it('does not throw when storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });

    expect(() => migrateStorage()).not.toThrow();
    expect(migrateStorage()).toEqual({ migrated: false, from: null });

    getItem.mockRestore();
  });

  it('retries on the next load rather than marking a failed purge done', () => {
    localStorage.setItem(IMAGINATIONS, JSON.stringify([{ id: 'old' }]));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(migrateStorage()).toEqual({ migrated: false, from: 0 });

    setItem.mockRestore();
    // The version was never stamped, so the purge still happens.
    expect(migrateStorage()).toEqual({ migrated: true, from: 0 });
    expect(localStorage.getItem(IMAGINATIONS)).toBeNull();
  });
});
