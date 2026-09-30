import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * The Supabase SDK faked whole, with the same small thenable query builder
 * projects.test.js uses: every method records its call and returns the chain, which
 * resolves to whatever result the test configured.
 */
function makeChain(result = { data: null, error: null }) {
  const calls = [];
  const chain = { calls };
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order']) {
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
  created_by: 'user-1',
  unadministered_since: null,
  created_at: '2026-09-30T10:00:00.000Z',
};

beforeEach(() => {
  for (const key of Object.keys(fromChains)) delete fromChains[key];
  from.mockClear();
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
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
      location: 'Malmö', description: 'The city.', createdBy: 'user-1', unadministeredSince: null,
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
