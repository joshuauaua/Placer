import { describe, it, expect } from 'vite-plus/test';
import { buildJSON, buildSummary, emptyState } from '../siteMapping';

const SITE = { name: 'Folkets Park', lat: 55.59, lng: 13.01 };

describe('where the person is', () => {
  it('starts with no pin', () => {
    expect(emptyState().here).toBeNull();
    expect(JSON.parse(buildJSON(SITE, emptyState())).here).toBeNull();
    expect(buildSummary(SITE, emptyState())).not.toContain('You were here');
  });

  it('goes out with the export once it is dropped', () => {
    const state = { ...emptyState(), here: { x: 0.25, y: 0.5 } };
    expect(JSON.parse(buildJSON(SITE, state)).here).toEqual({ x: 0.25, y: 0.5 });
    expect(buildSummary(SITE, state)).toContain('You were here: 25% across, 50% down the site view');
  });
});
