import { describe, it, expect, vi, afterEach } from 'vite-plus/test';

/* The Supabase SDK faked whole, as in follows.test.js. */
const limit = vi.fn();
const order = vi.fn(() => ({ limit }));
const is = vi.fn(() => ({ order }));
const eq = vi.fn(() => ({ is }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn();
const createClient = vi.fn(() => ({ from, rpc }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

let activity;

async function load() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  vi.resetModules();
  activity = await import('../profileActivity');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('profileActivity', () => {
  it('reads when they joined and their projects', async () => {
    await load();
    rpc.mockResolvedValueOnce({ data: { joined_at: '2025-03-10T10:00:00Z', projects: [
      { id: 'p1', name: 'Greenway', summary: 'A park', description: '', image_path: null,
        start_date: '2026-01-01', end_date: null, role: 'collaborator' },
    ] }, error: null });

    const found = await activity.readProfileActivity('user-1');

    expect(rpc).toHaveBeenCalledWith('profile_public_activity', { p_user_id: 'user-1' });
    expect(found).toMatchObject({ joinedAt: '2025-03-10T10:00:00Z',
      projects: [{ id: 'p1', name: 'Greenway', summary: 'A park', startDate: '2026-01-01', role: 'collaborator' }] });
  });

  it('is null for an account that does not exist', async () => {
    await load();
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(activity.readProfileActivity('nobody')).resolves.toBeNull();
  });

  it("reads their own comments, newest first, leaving out those posted as an organisation", async () => {
    await load();
    limit.mockResolvedValueOnce({ data: [
      { id: 'c1', body: 'Hi', created_at: '2026-05-01T10:00:00Z', project_id: 'p1', projects: { name: 'Greenway' } },
    ], error: null });

    const comments = await activity.readProfileComments('user-1');

    expect(from).toHaveBeenCalledWith('project_comments');
    expect(eq).toHaveBeenCalledWith('author_id', 'user-1');
    expect(is).toHaveBeenCalledWith('organisation_id', null);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(comments).toEqual([{ id: 'c1', body: 'Hi', createdAt: '2026-05-01T10:00:00Z', projectId: 'p1',
      projectName: 'Greenway' }]);
  });
});
