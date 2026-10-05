import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * The Supabase SDK faked whole, with the same small thenable query builder
 * projects.test.js uses: every method records its call and returns the chain, which
 * resolves to whatever result the test configured.
 */
function makeChain(result = { data: null, error: null }) {
  const calls = [];
  const chain = { calls };
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order']) {
    chain[method] = (...args) => { calls.push([method, args]); return chain; };
  }
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

const fromChains = {};
const from = vi.fn((table) => fromChains[table] ?? makeChain());
const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
const createClient = vi.fn(() => ({ from, rpc }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

// Pictures go through services/media (media.test.js covers it). Only the re-encode and
// the transfer are faked, the same way projects.test.js fakes them.
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

let organisations;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  organisations = await import('../organisations');
}

const ROW = {
  id: 'org-1',
  name: 'Malmö Stad',
  contact_email: 'hello@malmo.se',
  website: 'https://malmo.se',
  location: 'Malmö',
  description: 'The city.',
  cover_path: null,
  created_by: 'user-1',
  unadministered_since: null,
  created_at: '2026-09-30T10:00:00.000Z',
};

beforeEach(() => {
  for (const key of Object.keys(fromChains)) delete fromChains[key];
  // mockReset rather than mockClear: a test below overrides the implementation, and
  // every other test needs the dispatch-by-table behaviour back.
  from.mockReset();
  from.mockImplementation((table) => fromChains[table] ?? makeChain());
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  upload.mockClear();
  remove.mockClear();
  vi.unstubAllEnvs();
});

describe('with no Supabase project', () => {
  it('refuses every call, and has nothing to list for nobody', async () => {
    await load({ configured: false });

    await expect(organisations.createOrganisation({ createdBy: 'user-1', name: 'x' }))
      .rejects.toThrow(/Supabase project/);
    await expect(organisations.readOrganisation('org-1')).rejects.toThrow(/Supabase project/);
    await expect(organisations.readMyOrganisations(null)).resolves.toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('creating an organisation', () => {
  it('refuses with no account, before a request is sent', async () => {
    await load();

    await expect(organisations.createOrganisation({ name: 'x' })).rejects.toThrow('needs an account');
    expect(from).not.toHaveBeenCalled();
  });

  it('sends only the columns the grant allows, trimmed, with the website made a link', async () => {
    await load();
    fromChains.organisations = makeChain({ data: ROW, error: null });

    const saved = await organisations.createOrganisation({
      createdBy: 'user-1', name: '  Malmö Stad ', description: 'The city.', location: 'Malmö',
      contactEmail: 'hello@malmo.se', website: 'malmo.se',
    });

    const [insertCall] = fromChains.organisations.calls;
    expect(insertCall).toEqual(['insert', [{
      created_by: 'user-1', name: 'Malmö Stad', description: 'The city.', location: 'Malmö',
      contact_email: 'hello@malmo.se', website: 'https://malmo.se',
    }]]);
    expect(saved).toEqual({
      id: 'org-1', name: 'Malmö Stad', contactEmail: 'hello@malmo.se', website: 'https://malmo.se',
      location: 'Malmö', description: 'The city.', coverPath: null, cover: null,
      createdBy: 'user-1', unadministeredSince: null,
      createdAt: '2026-09-30T10:00:00.000Z',
    });
  });

  it('surfaces a refusal as a readable error', async () => {
    await load();
    fromChains.organisations = makeChain({ data: null, error: { message: 'violates check constraint' } });

    await expect(organisations.createOrganisation({ createdBy: 'user-1', name: 'x' }))
      .rejects.toThrow('Could not create that organisation: violates check constraint');
  });
});

describe('listing my organisations', () => {
  it('reads the memberships first, then the organisations by name', async () => {
    await load();
    fromChains.organisation_admins = makeChain({ data: [{ organisation_id: 'org-1' }], error: null });
    fromChains.organisations = makeChain({ data: [ROW], error: null });

    const found = await organisations.readMyOrganisations('user-1');

    expect(fromChains.organisation_admins.calls).toContainEqual(['eq', ['user_id', 'user-1']]);
    expect(fromChains.organisations.calls).toContainEqual(['in', ['id', ['org-1']]]);
    expect(found.map((org) => org.name)).toEqual(['Malmö Stad']);
  });

  it('asks no more once there are no memberships', async () => {
    await load();
    fromChains.organisation_admins = makeChain({ data: [], error: null });

    await expect(organisations.readMyOrganisations('user-1')).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalledWith('organisations');
  });
});

describe('organisations for the map', () => {
  it('reads the ones that say where they are, leaving out a blank location', async () => {
    await load();
    const chain = makeChain({ data: [ROW, { ...ROW, id: 'org-2', location: '   ' }], error: null });
    fromChains.organisations = chain;

    const found = await organisations.readMapOrganisations();

    expect(found.map(({ id }) => id)).toEqual(['org-1']);
    expect(chain.calls).toContainEqual(['neq', ['location', '']]);
  });

  it('surfaces a failure as a readable error', async () => {
    await load();
    fromChains.organisations = makeChain({ data: null, error: { message: 'network down' } });

    await expect(organisations.readMapOrganisations()).rejects.toThrow('network down');
  });
});

describe('admins', () => {
  it('adds, removes and claims through the database functions', async () => {
    await load();

    await organisations.addAdmin('org-1', 'sam@example.com');
    await organisations.removeAdmin('org-1', 'user-2');
    await organisations.claimOrganisation('org-1');

    expect(rpc.mock.calls).toEqual([
      ['organisation_add_admin', { p_organisation_id: 'org-1', p_email: 'sam@example.com' }],
      ['organisation_remove_admin', { p_organisation_id: 'org-1', p_user_id: 'user-2' }],
      ['organisation_claim', { p_organisation_id: 'org-1' }],
    ]);
  });

  it('passes on the last-admin refusal in words', async () => {
    await load();
    rpc.mockResolvedValue({ data: null, error: { message: 'an organisation needs at least one admin' } });

    await expect(organisations.removeAdmin('org-1', 'user-1'))
      .rejects.toThrow('Could not remove that admin: an organisation needs at least one admin');
  });

  it('answers whether this account may claim, as a plain boolean', async () => {
    await load();
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(organisations.canClaimOrganisation('org-1')).resolves.toBe(true);
  });
});

describe('the cover image', () => {
  it('is re-encoded as a cover and uploaded into the organisation\'s own folder', async () => {
    await load();
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

    const path = await organisations.uploadOrganisationCover('org-1', file);

    expect(encodeImage).toHaveBeenCalledWith(file, expect.objectContaining({ maxSide: 1920 }));
    expect(path).toMatch(/^organisations\/org-1\/cover-\d+\.webp$/);
    expect(upload).toHaveBeenCalledWith(expect.anything(), path, expect.any(Blob));
  });

  it('refuses something that is not a photo before anything is sent', async () => {
    await load();

    await expect(organisations.uploadOrganisationCover('org-1', new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })))
      .rejects.toThrow('A cover image has to be a photo');
    expect(upload).not.toHaveBeenCalled();
  });

  it('is saved as a key, and read back as an address', async () => {
    await load();
    const path = 'organisations/org-1/cover-1.webp';
    fromChains.organisations = makeChain({ data: { ...ROW, cover_path: path }, error: null });

    const saved = await organisations.updateOrganisation('org-1', { coverPath: path });

    expect(fromChains.organisations.calls[0]).toEqual(['update', [{ cover_path: path }]]);
    expect(saved).toMatchObject({ coverPath: path, cover: `https://media.example/${path}` });
  });

  it('goes with the organisation when it is closed, and only after it', async () => {
    await load();
    fromChains.organisations = makeChain({ data: { cover_path: 'organisations/org-1/cover-1.webp' }, error: null });

    await organisations.closeOrganisation('org-1');

    expect(fromChains.organisations.calls.map(([method]) => method)).toContain('delete');
    expect(remove).toHaveBeenCalledWith(expect.anything(), 'organisations/org-1/cover-1.webp');
  });

  it('stays when closing is refused', async () => {
    await load();
    let call = 0;
    from.mockImplementation(() => makeChain(call++ === 0
      ? { data: { cover_path: 'organisations/org-1/cover-1.webp' }, error: null }
      : { data: null, error: { message: 'permission denied' } }));

    await expect(organisations.closeOrganisation('org-1')).rejects.toThrow('permission denied');
    expect(remove).not.toHaveBeenCalled();
  });
});
