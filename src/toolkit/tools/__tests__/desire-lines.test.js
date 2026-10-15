import { describe, it, expect } from 'vite-plus/test';
import { findTool } from '../../tools';
import { emptyDesire } from '../../../lib/desireLines';

const site = { id: 's1', name: 'Market square', point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: null };
const path = (id) => ({ id, points: [[13.4, 52.52], [13.401, 52.52]] });

describe("Desire Lines' setup", () => {
  const { setup } = findTool('desire-lines');

  it('asks the organiser for at least one site', () => {
    expect(setup.problems(setup.defaults())).toHaveLength(1);
    expect(setup.problems({ prompt: 'Which way?', sites: [site] })).toEqual([]);
  });
});

describe("Desire Lines' room", () => {
  const { room } = findTool('desire-lines');

  it('starts a participant with no walks or marks', () => {
    expect(room.empty()).toEqual({ sites: {}, elements: {} });
    expect(room.empty()).toEqual(emptyDesire());
  });

  it("gathers everybody's walks by site", () => {
    const combined = room.combine([{ sites: { s1: [path('a')] } }, { sites: { s1: [path('b')] } }]);
    expect(combined.people).toBe(2);
    expect(combined.sites.s1).toHaveLength(2);
  });

  it('labels a room by its question, or else by its sites', () => {
    expect(room.label({ prompt: 'Which way do you walk?', sites: [site] })).toBe('Which way do you walk?');
    expect(room.label({ prompt: ' ', sites: [site, { ...site, id: 's2', name: 'Park' }] })).toBe('Market square, Park');
  });

  it('has no label for a room set up with nothing it can use', () => {
    for (const config of [null, {}, 'garbage', { prompt: 7, sites: 'none' }]) {
      expect(room.label(config), JSON.stringify(config)).toBeNull();
    }
  });
});
