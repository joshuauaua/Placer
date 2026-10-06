import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * The Supabase SDK is faked whole, so no client is built and no request is made. Rather
 * than a fixed hand-built chain per call site (the shape imaginations.test.js and
 * rooms.test.js use, where every call shape is small and known in advance),
 * services/projects.js has enough distinct query shapes across three tables that a
 * small fake query builder is worth it: every method records what it was called with
 * and returns itself, and the whole thing is thenable, resolving to whatever result the
 * test configured. That mirrors how the real supabase-js builder behaves closely enough
 * to exercise this module honestly, while still letting a test assert on exactly which
 * columns and filters went out.
 */
function makeChain(result = { data: null, error: null }) {
  const calls = [];
  const chain = { calls };
  for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in']) {
    chain[method] = (...args) => { calls.push([method, args]); return chain; };
  }
  chain.order = (...args) => { calls.push(['order', args]); return Promise.resolve(result); };
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const fromChains = {};
const from = vi.fn((table) => fromChains[table] ?? makeChain());
const rpc = vi.fn();
const createClient = vi.fn(() => ({ from, rpc }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

// Pictures go through services/media (media.test.js covers it). Its checks stay real,
// since the type and size check is part of what the image tests assert; only the
// re-encode is faked, as the WebP a real browser hands back — jsdom cannot decode.
const encodeImage = vi.fn(() => Promise.resolve({
  blob: new Blob(['webp'], { type: 'image/webp' }), type: 'image/webp', ext: 'webp',
}));
vi.mock('../../lib/imageEncode', async (importOriginal) => ({
  ...(await importOriginal()),
  encodeImage: (...a) => encodeImage(...a),
}));

const upload = vi.fn((supabase, path) => Promise.resolve(path));
const remove = vi.fn(() => Promise.resolve());
vi.mock('../media', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadMedia: (...a) => upload(...a),
  removeMedia: (...a) => remove(...a),
  mediaUrl: (path) => (path ? `https://media.example/${path}` : null),
}));

let projects;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  projects = await import('../projects');
}

const ROW = {
  id: 'proj-1',
  owner_id: 'user-1',
  owner_name: 'Mara Quinn',
  name: 'Riverside Greenway',
  description: 'Turn the old rail corridor into a park.',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  locations: ['Malmö', 'Folkets Park'],
  location_shapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
};

beforeEach(() => {
  for (const key of Object.keys(fromChains)) delete fromChains[key];
  // mockReset rather than mockClear: one test below overrides the implementation
  // outright, and every other test needs the default dispatch-by-table behaviour
  // back rather than whatever the previous test left it as.
  from.mockReset();
  from.mockImplementation((table) => fromChains[table] ?? makeChain());
  rpc.mockReset();
  upload.mockClear();
  remove.mockClear();
  encodeImage.mockClear();
  vi.unstubAllEnvs();
});

describe('with no Supabase project', () => {
  it('refuses every call, the same shape services/rooms.js uses', async () => {
    await load({ configured: false });

    await expect(projects.createProject({ ownerId: 'user-1', ownerName: 'Mara', name: 'x' }))
      .rejects.toThrow(/Supabase project/);
    await expect(projects.readProject('proj-1')).rejects.toThrow(/Supabase project/);
    await expect(projects.readMyProjects('user-1')).rejects.toThrow(/Supabase project/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('has no projects to offer with no account either', async () => {
    await load({ configured: false });

    await expect(projects.readMyProjects(null)).resolves.toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('starting a project', () => {
  it('refuses with no owner, before a request is even sent', async () => {
    await load();

    await expect(projects.createProject({ ownerName: 'Mara', name: 'x' }))
      .rejects.toThrow('needs an account');
    expect(from).not.toHaveBeenCalled();
  });

  it('sends the columns the grant allows, and hands back the saved shape', async () => {
    await load();
    fromChains.projects = makeChain({ data: ROW, error: null });

    const saved = await projects.createProject({
      ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
      description: 'Turn the old rail corridor into a park.',
      startDate: '2026-01-01', endDate: '2026-12-31', locations: ['Malmö', 'Folkets Park'],
      locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
      projectType: 'steward',
    });

    expect(from).toHaveBeenCalledWith('projects');
    const [insertCall] = fromChains.projects.calls;
    expect(insertCall).toEqual(['insert', [{
      owner_id: 'user-1', owner_name: 'Mara Quinn', name: 'Riverside Greenway',
      description: 'Turn the old rail corridor into a park.',
      start_date: '2026-01-01', end_date: '2026-12-31', locations: ['Malmö', 'Folkets Park'],
      location_shapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
      address: '', location_lat: null, location_lng: null,
      project_type: 'steward', organisation_id: null,
    }]]);
    expect(saved).toMatchObject({ id: 'proj-1', ownerId: 'user-1', name: 'Riverside Greenway' });
  });

  it('surfaces a failure as a readable error', async () => {
    await load();
    fromChains.projects = makeChain({ data: null, error: { message: 'name too long' } });

    await expect(projects.createProject({ ownerId: 'user-1', ownerName: 'Mara', name: 'x' }))
      .rejects.toThrow('name too long');
  });
});

describe('reading a project', () => {
  it('needs no account — a project page is public', async () => {
    await load();
    fromChains.projects = makeChain({ data: ROW, error: null });

    const found = await projects.readProject('proj-1');

    expect(found).toMatchObject({
      id: 'proj-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
      locations: ['Malmö', 'Folkets Park'], startDate: '2026-01-01', endDate: '2026-12-31',
      locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
    });
  });

  it('defaults locationShapes to an empty array for a row saved before the column existed', async () => {
    await load();
    fromChains.projects = makeChain({ data: { ...ROW, location_shapes: undefined }, error: null });

    const found = await projects.readProject('proj-1');

    expect(found.locationShapes).toEqual([]);
  });

  it('is null for a project that does not exist, rather than throwing', async () => {
    await load();
    fromChains.projects = makeChain({ data: null, error: null });

    await expect(projects.readProject('nope')).resolves.toBeNull();
  });
});

describe('projects for Explore', () => {
  it('reads every project with a drawn shape in full, leaving the rest out', async () => {
    await load();
    fromChains.projects = makeChain({ data: [ROW, { ...ROW, id: 'proj-2', location_shapes: [] }], error: null });

    const found = await projects.readMapProjects();

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: ROW.id, name: ROW.name, locationShapes: ROW.location_shapes,
      description: ROW.description });
  });

  it('includes a project with no outline when it has the point of an address', async () => {
    await load();
    fromChains.projects = makeChain({ data: [
      { ...ROW, id: 'proj-2', location_shapes: [], address: 'Folkets Park, Malmö', location_lat: 55.59, location_lng: 13.01 },
    ], error: null });

    const found = await projects.readMapProjects();

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 'proj-2', address: 'Folkets Park, Malmö',
      locationPoint: { lat: 55.59, lng: 13.01 } });
  });

  it('surfaces a failure as a readable error', async () => {
    await load();
    fromChains.projects = makeChain({ data: null, error: { message: 'network down' } });

    await expect(projects.readMapProjects()).rejects.toThrow('network down');
  });
});

describe('project locations, for the community map', () => {
  it('reads every project with a drawn shape, leaving the rest out', async () => {
    await load();
    fromChains.projects = makeChain({
      data: [
        { id: 'proj-1', name: 'Riverside Greenway', location_shapes: ROW.location_shapes },
        { id: 'proj-2', name: 'No outline yet', location_shapes: [] },
      ],
      error: null,
    });

    const locations = await projects.readProjectLocations();

    expect(locations).toEqual([
      { id: 'proj-1', name: 'Riverside Greenway', locationShapes: ROW.location_shapes },
    ]);
  });

  it('needs no account — the community map is public', async () => {
    await load();
    fromChains.projects = makeChain({ data: [], error: null });

    await expect(projects.readProjectLocations()).resolves.toEqual([]);
  });

  it('surfaces a failure as a readable error', async () => {
    await load();
    fromChains.projects = makeChain({ data: null, error: { message: 'network down' } });

    await expect(projects.readProjectLocations()).rejects.toThrow('network down');
  });
});

describe('your projects', () => {
  it('combines what you own with what you collaborate on', async () => {
    await load();
    const owned = { ...ROW, id: 'proj-owned' };
    const collabProject = { ...ROW, id: 'proj-collab', owner_id: 'user-2' };

    fromChains.projects = {
      calls: [],
      select: () => fromChains.projects,
      eq: (...a) => { fromChains.projects.calls.push(['eq', a]); return fromChains.projects; },
      in: (...a) => { fromChains.projects.calls.push(['in', a]); return fromChains.projects; },
      order: () => Promise.resolve({ data: [owned], error: null }),
    };
    fromChains.project_collaborators = makeChain({ data: [{ project_id: 'proj-collab' }], error: null });

    // The second projects() query — for the collaborator ids — needs its own
    // resolved order() distinct from the first, so `from` is asked to switch
    // chains after the first call is done.
    let projectsCallCount = 0;
    from.mockImplementation((table) => {
      if (table !== 'projects') return fromChains[table] ?? makeChain();
      projectsCallCount += 1;
      if (projectsCallCount === 1) return fromChains.projects;
      return makeChain({ data: [collabProject], error: null });
    });

    const mine = await projects.readMyProjects('user-1');

    expect(mine.map((p) => p.id)).toEqual(['proj-owned', 'proj-collab']);
  });

  it('asks nothing more when there is nothing to collaborate on', async () => {
    await load();
    fromChains.projects = makeChain({ data: [ROW], error: null });
    fromChains.project_collaborators = makeChain({ data: [], error: null });

    const mine = await projects.readMyProjects('user-1');

    expect(mine).toHaveLength(1);
    // Only the owned-projects query and the collaborator-id lookup ran — no second
    // projects query for an empty id list.
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe('editing and removing a project', () => {
  it('sends only the fields being changed', async () => {
    await load();
    fromChains.projects = makeChain({ data: { ...ROW, name: 'New name' }, error: null });

    await projects.updateProject('proj-1', { name: 'New name' });

    const [updateCall] = fromChains.projects.calls;
    expect(updateCall).toEqual(['update', [{ name: 'New name' }]]);
  });

  it('saves an image path under its column name', async () => {
    await load();
    fromChains.projects = makeChain({ data: { ...ROW, image_path: 'projects/proj-1/image-1.jpg' }, error: null });

    const saved = await projects.updateProject('proj-1', { imagePath: 'projects/proj-1/image-1.jpg' });

    expect(fromChains.projects.calls[0]).toEqual(['update', [{ image_path: 'projects/proj-1/image-1.jpg' }]]);
    expect(saved).toMatchObject({
      imagePath: 'projects/proj-1/image-1.jpg', image: 'https://media.example/projects/proj-1/image-1.jpg',
    });
  });

  it('removes a project', async () => {
    await load();
    fromChains.projects = makeChain({ error: null });

    await expect(projects.deleteProject('proj-1')).resolves.toEqual({ success: true });
    expect(fromChains.projects.calls).toContainEqual(['delete', []]);
    expect(fromChains.projects.calls).toContainEqual(['eq', ['id', 'proj-1']]);
  });

  it('removes the image along with the project, after the row', async () => {
    await load();
    fromChains.projects = makeChain({ data: { image_path: 'projects/proj-1/image-1.jpg' }, error: null });

    await projects.deleteProject('proj-1');

    expect(remove).toHaveBeenCalledWith(expect.anything(), 'projects/proj-1/image-1.jpg');
  });

  it('keeps the image when the delete is refused', async () => {
    await load();
    fromChains.projects = makeChain({ data: { image_path: 'projects/proj-1/image-1.jpg' },
      error: { message: 'violates row-level security' } });

    await expect(projects.deleteProject('proj-1')).rejects.toThrow(/row-level security/);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('project images', () => {
  it('uploads into the project\'s own folder, not the uploader\'s', async () => {
    await load();
    const file = { type: 'image/jpeg', size: 1000 };

    const path = await projects.uploadProjectImage('proj-1', file);

    // Re-encoded at project-image size first; the re-encoded copy is what goes.
    expect(encodeImage).toHaveBeenCalledWith(file, expect.objectContaining({ maxSide: 1600 }));
    expect(path).toMatch(/^projects\/proj-1\/image-\d+\.webp$/);
    expect(upload).toHaveBeenCalledWith(expect.anything(), path, expect.objectContaining({ type: 'image/webp' }));
  });

  it('refuses anything that is not a photo, and anything over 30 MB, before uploading', async () => {
    await load();

    await expect(projects.uploadProjectImage('proj-1', { type: 'text/html', size: 10 }))
      .rejects.toThrow(/has to be a photo/);
    await expect(projects.uploadProjectImage('proj-1', { type: 'image/png', size: 31 * 1024 * 1024 }))
      .rejects.toThrow(/30 MB/);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('collaborators', () => {
  it('reads the roster', async () => {
    await load();
    fromChains.project_collaborators = makeChain({
      data: [{ user_id: 'user-2', email: 'devon@example.com', display_name: 'Devon Park',
        created_at: '2026-09-02T10:00:00.000Z' }],
      error: null,
    });

    const roster = await projects.readCollaborators('proj-1');

    expect(roster).toEqual([
      { userId: 'user-2', email: 'devon@example.com', displayName: 'Devon Park',
        createdAt: '2026-09-02T10:00:00.000Z' },
    ]);
  });

  it('invites by email through the RPC, not a direct insert', async () => {
    await load();
    rpc.mockResolvedValue({ error: null });

    await projects.addCollaborator('proj-1', 'devon@example.com');

    expect(rpc).toHaveBeenCalledWith('project_add_collaborator', {
      p_project_id: 'proj-1', p_email: 'devon@example.com',
    });
  });

  it('surfaces the RPC refusing an unknown email', async () => {
    await load();
    rpc.mockResolvedValue({ error: { message: 'no PLACER account is registered to that email address' } });

    await expect(projects.addCollaborator('proj-1', 'nobody@example.com'))
      .rejects.toThrow(/no PLACER account/);
  });

  it('removes a collaborator through the RPC', async () => {
    await load();
    rpc.mockResolvedValue({ error: null });

    await projects.removeCollaborator('proj-1', 'user-2');

    expect(rpc).toHaveBeenCalledWith('project_remove_collaborator', {
      p_project_id: 'proj-1', p_user_id: 'user-2',
    });
  });
});

describe('links', () => {
  it('reads them oldest first', async () => {
    await load();
    fromChains.project_links = makeChain({
      data: [{ id: 'link-1', title: 'Council report', url: 'https://example.com/report',
        added_by: 'user-1', created_at: '2026-09-03T10:00:00.000Z' }],
      error: null,
    });

    const links = await projects.readLinks('proj-1');

    expect(links).toEqual([
      { id: 'link-1', title: 'Council report', url: 'https://example.com/report',
        addedBy: 'user-1', createdAt: '2026-09-03T10:00:00.000Z' },
    ]);
  });

  it('adds a link, checked against the caller by the insert policy', async () => {
    await load();
    fromChains.project_links = makeChain({
      data: { id: 'link-1', title: 'Council report', url: 'https://example.com/report',
        added_by: 'user-1', created_at: '2026-09-03T10:00:00.000Z' },
      error: null,
    });

    const link = await projects.addLink('proj-1', { title: 'Council report', url: 'https://example.com/report', addedBy: 'user-1' });

    expect(fromChains.project_links.calls).toContainEqual([
      'insert', [{ project_id: 'proj-1', title: 'Council report', url: 'https://example.com/report', added_by: 'user-1' }],
    ]);
    expect(link).toMatchObject({ id: 'link-1', title: 'Council report' });
  });

  it('removes a link', async () => {
    await load();
    fromChains.project_links = makeChain({ error: null });

    await expect(projects.removeLink('link-1')).resolves.toEqual({ success: true });
    expect(fromChains.project_links.calls).toContainEqual(['eq', ['id', 'link-1']]);
  });
});

describe('the dashboard', () => {
  it('reads the aggregate numbers through the RPC', async () => {
    await load();
    rpc.mockReturnValue({
      single: () => Promise.resolve({
        data: { imaginations_count: 4, imaginations_upvotes: 19, toolkit_rooms_count: 2 },
        error: null,
      }),
    });

    const stats = await projects.readStats('proj-1');

    expect(rpc).toHaveBeenCalledWith('project_stats', { p_project_id: 'proj-1' });
    expect(stats).toEqual({ imaginationsCount: 4, imaginationsUpvotes: 19, toolkitRoomsCount: 2 });
  });

  it('refuses for anyone but an owner or collaborator, surfaced as a readable error', async () => {
    await load();
    rpc.mockReturnValue({
      single: () => Promise.resolve({
        data: null, error: { message: 'only a project\'s owner or collaborators may read its dashboard' },
      }),
    });

    await expect(projects.readStats('proj-1')).rejects.toThrow(/owner or collaborators/);
  });
});

describe("the public page's Toolkit count", () => {
  it('reads it with no account', async () => {
    await load();
    rpc.mockResolvedValue({ data: 3, error: null });

    await expect(projects.readPublicToolkitActivity('proj-1')).resolves.toBe(3);
    expect(rpc).toHaveBeenCalledWith('project_toolkit_activity', { p_project_id: 'proj-1' });
  });

  it('surfaces a failure as a readable error', async () => {
    await load();
    rpc.mockResolvedValue({ data: null, error: { message: 'network down' } });

    await expect(projects.readPublicToolkitActivity('proj-1')).rejects.toThrow('network down');
  });
});

describe('page views', () => {
  beforeEach(() => sessionStorage.clear());

  it('counts a view once per project per browser session', async () => {
    await load();
    rpc.mockResolvedValue({ data: null, error: null });

    await projects.recordProjectView('proj-1');
    await projects.recordProjectView('proj-1');
    await projects.recordProjectView('proj-2');

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('project_view_record', { p_project_id: 'proj-1' });
    expect(rpc).toHaveBeenCalledWith('project_view_record', { p_project_id: 'proj-2' });
  });

  it('tries again next time when counting failed, and never throws', async () => {
    await load();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(projects.recordProjectView('proj-1')).resolves.toBeUndefined();
    await projects.recordProjectView('proj-1');

    expect(rpc).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('reads the total and the days', async () => {
    await load();
    rpc.mockImplementation((name) => Promise.resolve(name === 'project_views_total'
      ? { data: 42, error: null }
      : { data: [{ day: '2026-09-26', views: 3 }, { day: '2026-09-27', views: null }], error: null }));

    await expect(projects.readProjectViews('proj-1', 7)).resolves.toEqual({
      total: 42,
      daily: [{ day: '2026-09-26', views: 3 }, { day: '2026-09-27', views: 0 }],
    });
    expect(rpc).toHaveBeenCalledWith('project_views_daily', { p_project_id: 'proj-1', p_days: 7 });
  });
});

describe('the address', () => {
  it('saves the address and its point when starting a project', async () => {
    await load();
    fromChains.projects = makeChain({ data: ROW, error: null });

    await projects.createProject({ ownerId: 'user-1', ownerName: 'Mara', name: 'x',
      address: 'Folkets Park, Malmö', locationPoint: { lat: 55.59, lng: 13.01 } });

    expect(fromChains.projects.calls[0][1][0]).toMatchObject({
      address: 'Folkets Park, Malmö', location_lat: 55.59, location_lng: 13.01,
    });
  });

  it('clears the point along with the address', async () => {
    await load();
    fromChains.projects = makeChain({ data: ROW, error: null });

    await projects.updateProject('proj-1', { address: '', locationPoint: null });

    expect(fromChains.projects.calls[0]).toEqual(['update', [{ address: '', location_lat: null, location_lng: null }]]);
  });

  it('reads no point for a project without one', async () => {
    await load();
    fromChains.projects = makeChain({ data: ROW, error: null });

    await expect(projects.readProject('proj-1')).resolves.toMatchObject({ address: '', locationPoint: null });
  });
});

describe("a project's tools", () => {
  it('reads them as registry ids, oldest first', async () => {
    await load();
    fromChains.project_tools = makeChain({ data: [{ tool: 'open-vote' }, { tool: 'budget-ballot' }], error: null });

    await expect(projects.readProjectTools('proj-1')).resolves.toEqual(['open-vote', 'budget-ballot']);
    expect(fromChains.project_tools.calls).toContainEqual(['eq', ['project_id', 'proj-1']]);
  });

  it('adds what is new and removes what is gone, leaving the rest alone', async () => {
    await load();
    fromChains.project_tools = makeChain({ data: [{ tool: 'open-vote' }, { tool: 'desire-lines' }], error: null });

    const saved = await projects.saveProjectTools('proj-1', ['open-vote', 'budget-ballot'], 'user-1');

    const { calls } = fromChains.project_tools;
    expect(calls).toContainEqual(['insert', [[{ project_id: 'proj-1', tool: 'budget-ballot', added_by: 'user-1' }]]]);
    expect(calls).toContainEqual(['in', ['tool', ['desire-lines']]]);
    expect(saved).toEqual(['open-vote', 'budget-ballot']);
  });

  it('writes nothing when nothing changed', async () => {
    await load();
    fromChains.project_tools = makeChain({ data: [{ tool: 'open-vote' }], error: null });

    await projects.saveProjectTools('proj-1', ['open-vote'], 'user-1');

    const methods = fromChains.project_tools.calls.map(([method]) => method);
    expect(methods).not.toContain('insert');
    expect(methods).not.toContain('delete');
  });

  it('surfaces a failure as a readable error', async () => {
    await load();
    fromChains.project_tools = makeChain({ data: null, error: { message: 'permission denied' } });

    await expect(projects.readProjectTools('proj-1')).rejects.toThrow('permission denied');
  });
});

describe("a project's budget", () => {
  it('reads the answer, the amount and the currency', async () => {
    await load();
    fromChains.project_budgets = makeChain({ data: { has_budget: true, amount: '250000.00', currency: 'SEK' }, error: null });

    await expect(projects.readProjectBudget('proj-1'))
      .resolves.toEqual({ hasBudget: true, amount: 250000, currency: 'SEK' });
    expect(fromChains.project_budgets.calls).toContainEqual(['eq', ['project_id', 'proj-1']]);
  });

  it('is null when the question was never answered, or the reader may not see it', async () => {
    await load();
    fromChains.project_budgets = makeChain({ data: null, error: null });

    await expect(projects.readProjectBudget('proj-1')).resolves.toBeNull();
  });

  it('saves with one write per project, replacing the last answer', async () => {
    await load();
    fromChains.project_budgets = makeChain({ data: null, error: null });

    await projects.saveProjectBudget('proj-1', { hasBudget: true, amount: 50000, currency: 'DKK' });

    const [method, [row, options]] = fromChains.project_budgets.calls[0];
    expect(method).toBe('upsert');
    expect(row).toMatchObject({ project_id: 'proj-1', has_budget: true, amount: 50000, currency: 'DKK' });
    expect(options).toEqual({ onConflict: 'project_id' });
  });

  it('drops the amount of a no, as the table requires', async () => {
    await load();
    fromChains.project_budgets = makeChain({ data: null, error: null });

    await projects.saveProjectBudget('proj-1', { hasBudget: false, amount: 50000 });

    expect(fromChains.project_budgets.calls[0][1][0]).toMatchObject({ has_budget: false, amount: null });
  });

  it('surfaces a failure as a readable error', async () => {
    await load();
    fromChains.project_budgets = makeChain({ data: null, error: { message: 'permission denied' } });

    await expect(projects.saveProjectBudget('proj-1', { hasBudget: true })).rejects.toThrow('permission denied');
  });
});
