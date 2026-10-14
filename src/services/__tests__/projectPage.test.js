import { describe, it, expect, vi, afterEach } from 'vite-plus/test';

/*
 * The Supabase SDK is faked whole, as in follows.test.js. The posts may only send a
 * project and a body: who wrote them is set by the database
 * (supabase/project-public-page.sql).
 */
const order = vi.fn();
const eqSelect = vi.fn(() => ({ order }));
const single = vi.fn();
const insertSelect = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({ select: insertSelect }));
const eqDelete = vi.fn(() => Promise.resolve({ error: null }));
const del = vi.fn(() => ({ eq: eqDelete }));
const from = vi.fn(() => ({ select: () => ({ eq: eqSelect }), insert, delete: del }));
// No photos unless a test says otherwise (profile_photos, for the posts' authors).
const rpc = vi.fn(() => Promise.resolve({ data: [], error: null }));
const createClient = vi.fn(() => ({ from, rpc }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

let page;

async function load() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  vi.resetModules();
  page = await import('../projectPage');
}

const ROW = { id: 'c1', project_id: 'proj-1', author_id: 'user-2', author_name: 'Lee', body: 'Hi',
  created_at: '2026-05-01T10:00:00Z' };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('projectPage', () => {
  it('reads the summary in the shape the page speaks', async () => {
    await load();
    rpc.mockResolvedValueOnce({ data: {
      views: 12, followers: 2, interactions: 5,
      owner: { id: 'user-1', name: 'Mara', bio: '', location: 'Malmö', avatar_path: null,
        joined_at: '2026-01-02T00:00:00Z', projects: 3 },
      collaborators: [{ id: 'user-3', name: 'Ines', avatar_path: null }],
      can_post_update: true,
    }, error: null });

    const summary = await page.readProjectSummary('proj-1');

    expect(rpc).toHaveBeenCalledWith('project_public_summary', { p_project_id: 'proj-1' });
    expect(summary).toMatchObject({ views: 12, followers: 2, interactions: 5,
      owner: { id: 'user-1', name: 'Mara', location: 'Malmö', joinedAt: '2026-01-02T00:00:00Z', projects: 3 },
      collaborators: [{ id: 'user-3', name: 'Ines' }], canPostUpdate: true });
  });

  it('is null for a project that cannot be seen', async () => {
    await load();
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(page.readProjectSummary('proj-1')).resolves.toBeNull();
  });

  it('reads comments newest first', async () => {
    await load();
    order.mockResolvedValueOnce({ data: [ROW], error: null });

    const comments = await page.readComments('proj-1');

    expect(from).toHaveBeenCalledWith('project_comments');
    expect(eqSelect).toHaveBeenCalledWith('project_id', 'proj-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(comments).toEqual([{ id: 'c1', projectId: 'proj-1', authorId: 'user-2', authorName: 'Lee',
      organisationId: null, authorPhoto: null, body: 'Hi', createdAt: '2026-05-01T10:00:00Z' }]);
  });

  it("puts each author's profile photo beside their posts, but not beside the organisation's", async () => {
    await load();
    order.mockResolvedValueOnce({ data: [
      ROW,
      { ...ROW, id: 'c2', author_id: 'user-3', author_name: 'Ines' },
      { ...ROW, id: 'c3', author_id: 'user-2', author_name: 'STPLN', organisation_id: 'org-1' },
    ], error: null });
    rpc.mockResolvedValueOnce({ data: [{ id: 'user-2', avatar_path: 'avatars/user-2/a.jpg' },
      { id: 'user-3', avatar_path: null }], error: null });

    const comments = await page.readComments('proj-1');

    expect(rpc).toHaveBeenCalledWith('profile_photos', { p_ids: ['user-2', 'user-3'] });
    expect(comments[0].authorPhoto).toMatch(/avatars\/user-2\/a\.jpg$/);
    expect(comments[1].authorPhoto).toBeNull();
    expect(comments[2].authorPhoto).toBeNull();
  });

  it('still returns the posts when the photos cannot be read', async () => {
    await load();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    order.mockResolvedValueOnce({ data: [ROW], error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'function does not exist' } });

    const comments = await page.readComments('proj-1');

    expect(comments).toHaveLength(1);
    expect(comments[0].authorPhoto).toBeNull();
  });

  it('posts an update with only its project and its body, trimmed', async () => {
    await load();
    single.mockResolvedValueOnce({ data: { ...ROW, id: 'u1', body: 'News' }, error: null });

    const update = await page.postUpdate('proj-1', '  News  ');

    expect(from).toHaveBeenCalledWith('project_updates');
    expect(insert).toHaveBeenCalledWith({ project_id: 'proj-1', body: 'News' });
    expect(update.body).toBe('News');
  });

  it('posts a comment as the organisation only when asked to', async () => {
    await load();
    single.mockResolvedValue({ data: { ...ROW, organisation_id: 'org-1', author_name: 'STPLN' }, error: null });

    const comment = await page.postComment('proj-1', 'Hi', 'org-1');
    await page.postComment('proj-1', 'Hi');

    expect(insert).toHaveBeenNthCalledWith(1, { project_id: 'proj-1', body: 'Hi', organisation_id: 'org-1' });
    expect(insert).toHaveBeenNthCalledWith(2, { project_id: 'proj-1', body: 'Hi' });
    expect(comment).toMatchObject({ organisationId: 'org-1', authorName: 'STPLN' });
  });

  it('says so when a post is refused', async () => {
    await load();
    single.mockResolvedValueOnce({ data: null, error: { message: 'new row violates row-level security policy' } });

    await expect(page.postComment('proj-1', 'Hi')).rejects.toThrow(/Could not post that comment/);
  });

  it('removes a comment by its id', async () => {
    await load();

    await page.removeComment('c1');

    expect(from).toHaveBeenCalledWith('project_comments');
    expect(eqDelete).toHaveBeenCalledWith('id', 'c1');
  });
});
