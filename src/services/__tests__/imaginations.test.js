import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * Two fakes, because this module has two stores to choose between.
 *
 * The Supabase SDK is faked whole, so no client is built and no request is made. The
 * shape of the fake is part of the assertion: from() offers select, insert, update and
 * delete and nothing else. Pictures go through services/media, faked below as the three
 * calls it offers; what it does with them is media.test.js's business.
 * A test fails the moment this module reaches for something the rules in
 * supabase/imaginations.sql do not grant it.
 *
 * services/api is faked so that the localStorage path is observable as delegation rather
 * than having to be inspected through localStorage itself — what matters here is which
 * store was chosen, and that is what these assert.
 */

const order = vi.fn();
const maybeSingle = vi.fn();
const single = vi.fn();
// eq() after select() serves two shapes: readImaginationById chains .maybeSingle(),
// readImaginationsByProject and readComments chain .order(...) — both live on what
// it returns. match() is readMyVote's own way in, filtering on two columns in one
// call rather than chaining .eq() twice.
const eqSelect = vi.fn(() => ({ maybeSingle, order }));
const matchSelect = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ order, eq: eqSelect, match: matchSelect }));
const selectAfterInsert = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({ select: selectAfterInsert }));
const eqDelete = vi.fn();
const del = vi.fn(() => ({ eq: eqDelete }));
const update = vi.fn(() => ({ eq: vi.fn() }));
const from = vi.fn(() => ({ select, insert, delete: del, update }));
const rpc = vi.fn();

const upload = vi.fn();
const remove = vi.fn();
const mediaUrl = vi.fn((path) => (path ? `https://media.example/${path}` : null));

vi.mock('../media', () => ({
  uploadMedia: (...a) => upload(...a),
  removeMedia: (...a) => remove(...a),
  mediaUrl: (...a) => mediaUrl(...a),
}));

// The preview re-encode. By default it fails, the way it does in a browser that cannot
// write WebP (or in jsdom, which cannot decode at all), so the preview goes as exported
// — which is what most tests below assert. One test has it succeed.
const encodeImage = vi.fn(() => Promise.reject(new Error('no canvas here')));
vi.mock('../../lib/imageEncode', async (importOriginal) => ({
  ...(await importOriginal()),
  encodeImage: (...a) => encodeImage(...a),
}));

const createClient = vi.fn(() => ({ from, rpc }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

const fetchLocal = vi.fn(() => Promise.resolve([]));
const saveLocal = vi.fn((record) => Promise.resolve({ ...record, id: 'local-1' }));
const deleteLocal = vi.fn(() => Promise.resolve({ success: true }));
const voteLocal = vi.fn(() => Promise.resolve({ upvotes: 4, myVote: 'up' }));
const readMyVoteLocal = vi.fn(() => Promise.resolve(null));
const addCommentLocal = vi.fn(() => Promise.resolve({ id: 'c1', text: 'Nice idea', author: 'Mara Quinn', createdAt: '2026-09-01T10:00:00.000Z' }));
const readCommentsLocal = vi.fn(() => Promise.resolve([]));

vi.mock('../api', () => ({
  fetchImaginations: (...a) => fetchLocal(...a),
  saveImagination: (...a) => saveLocal(...a),
  deleteImagination: (...a) => deleteLocal(...a),
  voteImagination: (...a) => voteLocal(...a),
  readMyVote: (...a) => readMyVoteLocal(...a),
  addComment: (...a) => addCommentLocal(...a),
  readComments: (...a) => readCommentsLocal(...a),
}));

let imaginations;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  // The module reads the environment at call time but the client is cached, so each test
  // needs its own copy.
  imaginations = await import('../imaginations');
}

const ROW = {
  id: 'img-1',
  user_id: 'user-1',
  author_name: 'Mara Quinn',
  title: 'Pocket park on Lot 7',
  category: 'green',
  blurb: 'Trees instead of asphalt.',
  loc: '51.5074, -0.1278',
  lat: 51.5074,
  lng: -0.1278,
  source: 'streetview',
  pov: { heading: 90, pitch: 0, zoom: 1 },
  fov: 90,
  canvas_assets: [{ id: 'a1' }],
  preview_path: 'previews/user-1/img-1.jpg',
  upvotes: 12,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
};

// A one-pixel JPEG, so the base64 actually decodes.
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const DRAFT = {
  userId: 'user-1',
  author: 'Mara Quinn',
  title: 'Pocket park on Lot 7',
  cat: 'green',
  blurb: 'Trees instead of asphalt.',
  loc: '51.5074, -0.1278',
  position: { lat: 51.5074, lng: -0.1278 },
  source: 'streetview',
  pov: { heading: 90, pitch: 0, zoom: 1 },
  fov: 90,
  canvasAssets: [{ id: 'a1' }],
  preview: JPEG,
};

beforeEach(() => {
  for (const spy of [order, maybeSingle, single, eqSelect, matchSelect, select, selectAfterInsert,
    insert, eqDelete, del, update, from, rpc, upload, remove, mediaUrl, createClient,
    fetchLocal, saveLocal, deleteLocal, voteLocal, readMyVoteLocal, addCommentLocal, readCommentsLocal]) {
    spy.mockClear();
  }
  order.mockResolvedValue({ data: [], error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  single.mockResolvedValue({ data: ROW, error: null });
  eqDelete.mockResolvedValue({ error: null });
  upload.mockImplementation((supabase, path) => Promise.resolve(path));
  remove.mockResolvedValue(undefined);
  // imagination_vote returns a one-row table, unlike the old imagination_upvote's
  // bare integer — see the "voting" describe block below.
  rpc.mockResolvedValue({ data: [{ upvotes: 13, my_vote: 1 }], error: null });
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('img-1');
  encodeImage.mockReset();
  encodeImage.mockRejectedValue(new Error('no canvas here'));
  // postImagination says, on the console, when it falls back to the exported preview.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('with no project configured', () => {
  it('keeps everything in the browser, and says posts are not shared', async () => {
    await load({ configured: false });

    expect(imaginations.postsAreShared()).toBe(false);
  });

  it('reads from localStorage', async () => {
    await load({ configured: false });
    fetchLocal.mockResolvedValue([{ id: 'local-1', title: 'Bench by the canal' }]);

    const all = await imaginations.readImaginations();

    expect(fetchLocal).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(all[0]).toMatchObject({ id: 'local-1', shared: false });
  });

  it('writes to localStorage, and does not need an account to do it', async () => {
    await load({ configured: false });

    const saved = await imaginations.postImagination({ title: 'Bench by the canal' });

    expect(saveLocal).toHaveBeenCalled();
    expect(saved).toMatchObject({ shared: false });
  });

  it('deletes and votes locally, asking for no account to do either', async () => {
    await load({ configured: false });

    await imaginations.removeImagination('local-1');
    const result = await imaginations.voteImagination('local-1', 'up');

    expect(deleteLocal).toHaveBeenCalledWith('local-1');
    expect(voteLocal).toHaveBeenCalledWith('local-1', 'up');
    expect(result).toEqual({ upvotes: 4, myVote: 'up' });
  });

  it('reads and posts comments locally', async () => {
    await load({ configured: false });

    const posted = await imaginations.postComment('local-1', { authorName: 'Mara Quinn', text: 'Nice idea' });
    const all = await imaginations.readComments('local-1');

    expect(addCommentLocal).toHaveBeenCalledWith('local-1', { text: 'Nice idea', author: 'Mara Quinn' });
    expect(posted).toMatchObject({ text: 'Nice idea', author: 'Mara Quinn' });
    expect(readCommentsLocal).toHaveBeenCalledWith('local-1');
    expect(all).toEqual([]);
  });

  it('has no project\'s imaginations to read, since a project cannot exist here either', async () => {
    await load({ configured: false });

    await expect(imaginations.readImaginationsByProject('proj-1')).resolves.toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('reading the community', () => {
  it('says posts are shared', async () => {
    await load();

    expect(imaginations.postsAreShared()).toBe(true);
  });

  it('asks for the newest first', async () => {
    await load();

    await imaginations.readImaginations();

    expect(from).toHaveBeenCalledWith('imaginations');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('reads a project\'s imaginations, newest first, needing no account', async () => {
    await load();
    order.mockResolvedValue({ data: [ROW], error: null });

    const all = await imaginations.readImaginationsByProject('proj-1');

    expect(eqSelect).toHaveBeenCalledWith('project_id', 'proj-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(all[0]).toMatchObject({ id: 'img-1', shared: true });
  });

  it('names its columns rather than asking for everything', async () => {
    await load();

    await imaginations.readImaginations();

    // '*' would mean adding a column silently changes what every visitor downloads.
    expect(select.mock.calls[0][0]).not.toBe('*');
    expect(select.mock.calls[0][0]).toContain('author_name');
  });

  it('hands back the shape the rest of the app already speaks', async () => {
    await load();
    order.mockResolvedValue({ data: [ROW], error: null });

    const [first] = await imaginations.readImaginations();

    expect(first).toMatchObject({
      id: 'img-1',
      userId: 'user-1',
      author: 'Mara Quinn',
      cat: 'green',
      position: { lat: 51.5074, lng: -0.1278 },
      canvasAssets: [{ id: 'a1' }],
      upvotes: 12,
      comments: [],
      shared: true,
    });
  });

  it('turns the stored path into something an img tag can use', async () => {
    await load();
    order.mockResolvedValue({ data: [ROW], error: null });

    const [first] = await imaginations.readImaginations();

    expect(mediaUrl).toHaveBeenCalledWith('previews/user-1/img-1.jpg');
    expect(first.preview).toBe('https://media.example/previews/user-1/img-1.jpg');
  });

  it('has no position at all when there are no coordinates', async () => {
    await load();
    order.mockResolvedValue({ data: [{ ...ROW, lat: null, lng: null }], error: null });

    const [first] = await imaginations.readImaginations();

    // MapContainer filters on this, so undefined coordinates must not look like 0, 0 —
    // which is a real place in the Atlantic.
    expect(first.position).toBeNull();
  });

  it('has no preview when none was uploaded', async () => {
    await load();
    order.mockResolvedValue({ data: [{ ...ROW, preview_path: null }], error: null });

    const [first] = await imaginations.readImaginations();

    expect(first.preview).toBeNull();
  });

  it('explains a failed read', async () => {
    await load();
    order.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

    await expect(imaginations.readImaginations()).rejects.toThrow(/connection reset/);
  });

  it('does not mix in what is only in this browser', async () => {
    await load();
    order.mockResolvedValue({ data: [ROW], error: null });

    await imaginations.readImaginations();

    // Those were never posted anywhere. Putting them on a shared map would say otherwise.
    expect(fetchLocal).not.toHaveBeenCalled();
  });

  it('offers the local ones separately, for a screen that wants to be honest about them', async () => {
    await load();
    fetchLocal.mockResolvedValue([{ id: 'old', title: 'Bench by the canal' }]);

    const local = await imaginations.readLocalImaginations();

    expect(local).toEqual([{ id: 'old', title: 'Bench by the canal', shared: false }]);
  });
});

describe('posting', () => {
  it('refuses without an account, rather than letting the policy refuse it', async () => {
    await load();

    await expect(imaginations.postImagination({ ...DRAFT, userId: null }))
      .rejects.toThrow(/needs an account/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('uploads the picture into a folder named after the account', async () => {
    await load();

    await imaginations.postImagination(DRAFT);

    expect(upload.mock.calls[0][1]).toBe('previews/user-1/img-1.jpg');
  });

  it('re-encodes the preview as WebP where the browser can, to save space', async () => {
    await load();
    const webp = new Blob(['webp'], { type: 'image/webp' });
    encodeImage.mockResolvedValue({ blob: webp, type: 'image/webp', ext: 'webp' });

    await imaginations.postImagination(DRAFT);

    expect(encodeImage).toHaveBeenCalledWith(expect.any(Blob), expect.objectContaining({ maxSide: 1920 }));
    expect(upload.mock.calls[0][1]).toBe('previews/user-1/img-1.webp');
    expect(upload.mock.calls[0][2]).toBe(webp);
    expect(insert.mock.calls[0][0]).toMatchObject({ preview_path: 'previews/user-1/img-1.webp' });
  });

  it('uploads before it inserts, because the row carries the path', async () => {
    await load();

    await imaginations.postImagination(DRAFT);

    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(insert.mock.invocationCallOrder[0]);
  });

  it('keeps a PNG a PNG', async () => {
    await load();

    await imaginations.postImagination({ ...DRAFT, preview: PNG });

    // StreetScreen exports PNG when the capture failed, because JPEG has no alpha and a
    // transparent stage would flatten to black.
    expect(upload.mock.calls[0][1]).toBe('previews/user-1/img-1.png');
    expect(upload.mock.calls[0][2].type).toBe('image/png');
  });

  it('posts without a picture rather than refusing to post', async () => {
    await load();

    await imaginations.postImagination({ ...DRAFT, preview: null });

    expect(upload).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).toMatchObject({ preview_path: null });
  });

  it('does not insert a half-posted imagination when the upload fails', async () => {
    await load();
    upload.mockRejectedValue(new Error('bucket missing'));

    await expect(imaginations.postImagination(DRAFT)).rejects.toThrow(/bucket missing/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('sends the columns the grant allows, and no timestamps', async () => {
    await load();

    await imaginations.postImagination(DRAFT);

    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      id: 'img-1',
      user_id: 'user-1',
      author_name: 'Mara Quinn',
      category: 'green',
      lat: 51.5074,
      lng: -0.1278,
      preview_path: 'previews/user-1/img-1.jpg',
    });
    // Not the client's to set: the defaults and the trigger own these.
    expect(row).not.toHaveProperty('created_at');
    expect(row).not.toHaveProperty('updated_at');
    expect(row).not.toHaveProperty('upvotes');
  });

  it('posts with no project attached by default', async () => {
    await load();

    await imaginations.postImagination(DRAFT);

    expect(insert.mock.calls[0][0]).toMatchObject({ project_id: null });
  });

  it('attaches a project when one is given', async () => {
    await load();

    await imaginations.postImagination({ ...DRAFT, projectId: 'proj-1' });

    expect(insert.mock.calls[0][0]).toMatchObject({ project_id: 'proj-1' });
  });

  it('turns an unchosen category into null, which is what the column accepts', async () => {
    await load();

    await imaginations.postImagination({ ...DRAFT, cat: '' });

    // '' would fail imaginations_category_known.
    expect(insert.mock.calls[0][0].category).toBeNull();
  });

  it('explains a refused insert', async () => {
    await load();
    single.mockResolvedValue({ data: null, error: { message: 'violates row-level security' } });

    await expect(imaginations.postImagination(DRAFT)).rejects.toThrow(/row-level security/);
  });

  it('deletes the uploaded picture when the insert is refused, so it does not sit unused', async () => {
    await load();
    single.mockResolvedValue({ data: null, error: { message: 'violates row-level security' } });

    await expect(imaginations.postImagination(DRAFT)).rejects.toThrow();
    expect(remove).toHaveBeenCalledWith(expect.anything(), 'previews/user-1/img-1.jpg');
  });
});

describe('removing', () => {
  it('removes one still only in this browser from the browser, not the table', async () => {
    await load();

    await imaginations.removeImagination('local-1', { local: true });

    expect(deleteLocal).toHaveBeenCalledWith('local-1');
    expect(del).not.toHaveBeenCalled();
  });

  it('takes the picture with the row', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { preview_path: 'previews/user-1/img-1.jpg' }, error: null });

    await imaginations.removeImagination('img-1');

    expect(eqDelete).toHaveBeenCalledWith('id', 'img-1');
    expect(remove).toHaveBeenCalledWith(expect.anything(), 'previews/user-1/img-1.jpg');
  });

  it('reads the path before deleting the row that holds it', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { preview_path: 'previews/user-1/img-1.jpg' }, error: null });

    await imaginations.removeImagination('img-1');

    expect(maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(del.mock.invocationCallOrder[0]);
  });

  it('does not try to remove a picture that was never there', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { preview_path: null }, error: null });

    await imaginations.removeImagination('img-1');

    expect(remove).not.toHaveBeenCalled();
  });

  it('counts the imagination gone even if the picture will not delete', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await load();
    maybeSingle.mockResolvedValue({ data: { preview_path: 'previews/user-1/img-1.jpg' }, error: null });
    remove.mockRejectedValue(new Error('object missing'));

    // An orphan in the bucket is untidy; a pin that will not go away is the actual problem.
    await expect(imaginations.removeImagination('img-1')).resolves.toMatchObject({ success: true });
    consoleError.mockRestore();
  });

  it('explains a refused delete', async () => {
    await load();
    eqDelete.mockResolvedValue({ error: { message: 'violates row-level security' } });

    await expect(imaginations.removeImagination('img-1')).rejects.toThrow(/row-level security/);
  });
});

describe('voting', () => {
  it('goes through the function, not the table', async () => {
    await load();

    const result = await imaginations.voteImagination('img-1', 'up', { accountId: 'user-1' });

    // The update policy is owner-only, and voting is by definition done to somebody
    // else's imagination.
    expect(rpc).toHaveBeenCalledWith('imagination_vote', { p_id: 'img-1', p_direction: 'up' });
    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ upvotes: 13, myVote: 'up' });
  });

  it('reads the standing vote back as down, not just up', async () => {
    await load();
    rpc.mockResolvedValue({ data: [{ upvotes: 2, my_vote: -1 }], error: null });

    await expect(imaginations.voteImagination('img-1', 'down', { accountId: 'user-1' }))
      .resolves.toEqual({ upvotes: 2, myVote: 'down' });
  });

  it('reads a withdrawn vote back as null', async () => {
    await load();
    rpc.mockResolvedValue({ data: [{ upvotes: 0, my_vote: null }], error: null });

    await expect(imaginations.voteImagination('img-1', 'up', { accountId: 'user-1' }))
      .resolves.toEqual({ upvotes: 0, myVote: null });
  });

  it('refuses without an account, rather than letting the RPC refuse it', async () => {
    await load();

    await expect(imaginations.voteImagination('img-1', 'up')).rejects.toThrow(/needs an account/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('is null for an imagination that has since been deleted', async () => {
    await load();
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(imaginations.voteImagination('img-1', 'up', { accountId: 'user-1' })).resolves.toBeNull();
  });

  it('explains a failed vote', async () => {
    await load();
    rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });

    await expect(imaginations.voteImagination('img-1', 'up', { accountId: 'user-1' })).rejects.toThrow(/timeout/);
  });

  it('reads back this account\'s own vote, filtered to their row', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { value: -1 }, error: null });

    const vote = await imaginations.readMyVote('img-1', { accountId: 'user-1' });

    expect(matchSelect).toHaveBeenCalledWith({ imagination_id: 'img-1', user_id: 'user-1' });
    expect(vote).toBe('down');
  });

  it('has no vote to read for a signed-out visitor', async () => {
    await load();

    await expect(imaginations.readMyVote('img-1')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalledWith('imagination_votes');
  });
});

describe('commenting', () => {
  it('posts a comment credited to the signed-in account', async () => {
    await load();
    single.mockResolvedValue({
      data: { id: 'c1', author_name: 'Mara Quinn', body: 'Nice idea', created_at: '2026-09-01T10:00:00.000Z' },
      error: null,
    });

    const saved = await imaginations.postComment('img-1', {
      authorName: 'Mara Quinn', accountId: 'user-1', text: 'Nice idea',
    });

    expect(insert.mock.calls[0][0]).toMatchObject({
      imagination_id: 'img-1', user_id: 'user-1', author_name: 'Mara Quinn', body: 'Nice idea',
    });
    expect(saved).toEqual({
      id: 'c1', author: 'Mara Quinn', text: 'Nice idea', createdAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('trims the comment before posting it', async () => {
    await load();

    await imaginations.postComment('img-1', { authorName: 'Mara Quinn', accountId: 'user-1', text: '  Nice idea  ' });

    expect(insert.mock.calls[0][0]).toMatchObject({ body: 'Nice idea' });
  });

  it('refuses a blank comment before it ever reaches the table', async () => {
    await load();

    await expect(imaginations.postComment('img-1', { authorName: 'Mara Quinn', accountId: 'user-1', text: '   ' }))
      .rejects.toThrow(/needs some words/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses without an account, rather than letting the policy refuse it', async () => {
    await load();

    await expect(imaginations.postComment('img-1', { authorName: 'Mara Quinn', text: 'Nice idea' }))
      .rejects.toThrow(/needs an account/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('explains a refused comment', async () => {
    await load();
    single.mockResolvedValue({ data: null, error: { message: 'violates row-level security' } });

    await expect(imaginations.postComment('img-1', { authorName: 'Mara Quinn', accountId: 'user-1', text: 'Nice idea' }))
      .rejects.toThrow(/row-level security/);
  });

  it('reads comments oldest first', async () => {
    await load();
    order.mockResolvedValue({
      data: [{ id: 'c1', author_name: 'Mara Quinn', body: 'Nice idea', created_at: '2026-09-01T10:00:00.000Z' }],
      error: null,
    });

    const all = await imaginations.readComments('img-1');

    expect(eqSelect).toHaveBeenCalledWith('imagination_id', 'img-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(all).toEqual([
      { id: 'c1', author: 'Mara Quinn', text: 'Nice idea', createdAt: '2026-09-01T10:00:00.000Z' },
    ]);
  });

  it('explains a failed read', async () => {
    await load();
    order.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

    await expect(imaginations.readComments('img-1')).rejects.toThrow(/connection reset/);
  });
});
