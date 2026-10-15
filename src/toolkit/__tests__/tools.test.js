import { describe, it, expect } from 'vite-plus/test';
import { CATEGORIES, ORGANISATIONS, TOOLS, filterTools, findCategory, findTool } from '../tools';

describe('the register', () => {
  it('credits the Public Life Data Protocol on the tools built on it, and only those', () => {
    const credited = TOOLS.filter((tool) => tool.credit?.startsWith('The Public Life Data Protocol'));
    expect(credited.map((tool) => tool.id).sort())
      .toEqual(['site-spatial-mapping', 'social-space-survey', 'stationary-activity-mapping']);
  });

  it('finds a tool by the id in its URL', () => {
    expect(findTool('budget-ballot')).toMatchObject({ id: 'budget-ballot' });
  });

  it('is null for an id that is not one, rather than throwing', () => {
    expect(findTool('not-a-tool')).toBeNull();
  });

  it('puts every tool in one of the categories', () => {
    for (const tool of TOOLS) {
      expect(findCategory(tool.category), tool.id).not.toBeNull();
    }
  });

  it('says which organisation created every tool', () => {
    for (const tool of TOOLS) {
      expect(typeof tool.createdBy, tool.id).toBe('string');
      expect(tool.createdBy.length, tool.id).toBeGreaterThan(0);
    }
  });

  it('lists the categories as Understand, Imagine and Plan', () => {
    expect(CATEGORIES.map((category) => category.name)).toEqual(['Understand', 'Imagine', 'Plan']);
  });

  it('gives every room-capable tool both halves of the contract', () => {
    // A `room` with only one of these would fail at runtime, in a room, in front of
    // people — so it is checked here instead.
    for (const tool of TOOLS.filter((entry) => entry.room)) {
      expect(typeof tool.room.empty).toBe('function');
      expect(typeof tool.room.combine).toBe('function');
    }
  });

  it('gives every tool with a setup a room to use it in, and all three parts', () => {
    // A setup is fixed when a room opens, so on a tool with no room it would never
    // be asked for.
    for (const tool of TOOLS.filter((entry) => entry.setup)) {
      expect(tool.room, tool.id).toBeTruthy();
      expect(typeof tool.setup.defaults, tool.id).toBe('function');
      expect(typeof tool.setup.problems, tool.id).toBe('function');
      expect(typeof tool.setup.Form, tool.id).toBe('function');
    }
  });

  it('starts every setup from one the tool can check', () => {
    // Not necessarily one it accepts: a Poll has no question until the organiser
    // writes one.
    for (const tool of TOOLS.filter((entry) => entry.setup)) {
      const problems = tool.setup.problems(tool.setup.defaults());
      expect(Array.isArray(problems), tool.id).toBe(true);
      for (const problem of problems) expect(typeof problem, tool.id).toBe('string');
    }
  });

});

describe('filterTools', () => {
  const ids = (filters) => filterTools(TOOLS, filters).map((tool) => tool.id);

  it('returns every tool with no filters', () => {
    expect(ids({})).toHaveLength(TOOLS.length);
  });

  it('searches names, taglines, descriptions and organisations, ignoring case', () => {
    expect(ids({ query: 'BUDGET' })).toEqual(['budget-ballot']);
    expect(ids({ query: 'gehl' })).toEqual(['social-space-survey']);
    expect(ids({ query: 'cycle track' })).toContain('street-mixer');
  });

  it('ignores accents, so a plain query finds an accented word', () => {
    const accented = [{ ...TOOLS[0], id: 'accented', name: 'Malmö mapping' }];
    expect(filterTools(accented, { query: 'malmo' }).map((tool) => tool.id)).toEqual(['accented']);
  });

  it('needs every word of the query to match somewhere', () => {
    expect(ids({ query: 'vote room-free-nonsense' })).toEqual([]);
  });

  it('filters by category', () => {
    for (const { id } of CATEGORIES) {
      expect(ids({ category: id })).toEqual(TOOLS.filter((tool) => tool.category === id).map((tool) => tool.id));
    }
    expect(ids({ category: 'plan' })).toEqual(expect.arrayContaining(['budget-ballot', 'open-vote']));
    expect(ids({ category: 'plan' })).not.toContain('desire-lines');
  });

  it('filters by the organisation that made the tool', () => {
    expect(ids({ organisation: 'Gehl Institute' })).toEqual(['social-space-survey']);
  });

  it('keeps only the tools that can run in a room when asked', () => {
    const rooms = ids({ groupOnly: true });
    expect(rooms).toEqual(TOOLS.filter((tool) => tool.room).map((tool) => tool.id));
    expect(rooms).toEqual(expect.arrayContaining(['budget-ballot', 'open-vote']));
    expect(rooms).toContain('desire-lines');
    expect(rooms).not.toContain('street-mixer');
  });

  it('combines filters', () => {
    expect(ids({ category: 'understand', query: 'map' })).toEqual(
      expect.arrayContaining(['site-spatial-mapping', 'stationary-activity-mapping']),
    );
    expect(ids({ category: 'imagine', groupOnly: true })).toEqual([]);
  });

  it('lists each organisation once, alphabetically', () => {
    expect(ORGANISATIONS).toEqual(['Gehl Institute', 'PLACER']);
  });
});

