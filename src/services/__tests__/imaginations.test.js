import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * Two fakes, because this module has two stores to choose between.
 *
 * The Supabase SDK is faked whole, so no client is built and no request is made. The
 * shape of the fake is part of the assertion: from() offers select, insert, update and
 * delete and nothing else, and the storage handle offers upload, remove and getPublicUrl.
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
const eqSelect = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ order, eq: eqSelect }));
const selectAfterInsert = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({ select: selectAfterInsert }));
const eqDelete = vi.fn();
const del = vi.fn(() => ({ eq: eqDelete }));
const update = vi.fn(() => ({ eq: vi.fn() }));
const from = vi.fn(() => ({ select, insert, delete: del, update }));
const rpc = vi.fn();

const upload = vi.fn();
const remove = vi.fn();
const getPublicUrl = vi.fn((path) => ({
  data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/imagination-previews/${path}` },
}));
const storageFrom = vi.fn(() => ({ upload, remove, getPublicUrl }));

const createClient = vi.fn(() => ({ from, rpc, storage: { from: storageFrom } }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

const fetchLocal = vi.fn(() => Promise.resolve([]));
const saveLocal = vi.fn((record) => Promise.resolve({ ...record, id: 'local-1' }));
const deleteLocal = vi.fn(() => Promise.resolve({ success: true }));
const upvoteLocal = vi.fn(() => Promise.resolve({ id: 'local-1', upvotes: 4 }));

vi.mock('../api', () => ({
  fetchImaginations: (...a) => fetchLocal(...a),
  saveImagination: (...a) => saveLocal(...a),
  deleteImagination: (...a) => deleteLocal(...a),
  upvoteImagination: (...a) => upvoteLocal(...a),
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
  preview_path: 'user-1/img-1.jpg',
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
  for (const spy of [order, maybeSingle, single, eqSelect, select, selectAfterInsert, insert,
    eqDelete, del, update, from, rpc, upload, remove, getPublicUrl, storageFrom, createClient,
    fetchLocal, saveLocal, deleteLocal, upvoteLocal]) {
    spy.mockClear();
  }
  order.mockResolvedValue({ data: [], error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  single.mockResolvedValue({ data: ROW, error: null });
  eqDelete.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ data: { path: 'user-1/img-1.jpg' }, error: null });
  remove.mockResolvedValue({ data: [], error: null });
  rpc.mockResolvedValue({ data: 13, error: null });
  getPublicUrl.mockImplementation((path) => ({
    data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/imagination-previews/${path}` },
  }));
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('img-1');
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

  it('deletes and votes locally', async () => {
    await load({ configured: false });

    await imaginations.removeImagination('local-1');
    const count = await imaginations.upvoteImagination('local-1');

    expect(deleteLocal).toHaveBeenCalledWith('local-1');
    expect(count).toBe(4);
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

    expect(getPublicUrl).toHaveBeenCalledWith('user-1/img-1.jpg');
    expect(first.preview).toContain('imagination-previews/user-1/img-1.jpg');
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

    expect(storageFrom).toHaveBeenCalledWith('imagination-previews');
    expect(upload.mock.calls[0][0]).toBe('user-1/img-1.jpg');
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
    expect(upload.mock.calls[0][0]).toBe('user-1/img-1.png');
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' });
  });

  it('posts without a picture rather than refusing to post', async () => {
    await load();

    await imaginations.postImagination({ ...DRAFT, preview: null });

    expect(upload).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).toMatchObject({ preview_path: null });
  });

  it('does not insert a half-posted imagination when the upload fails', async () => {
    await load();
    upload.mockResolvedValue({ data: null, error: { message: 'bucket missing' } });

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
      preview_path: 'user-1/img-1.jpg',
    });
    // Not the client's to set: the defaults and the trigger own these.
    expect(row).not.toHaveProperty('created_at');
    expect(row).not.toHaveProperty('updated_at');
    expect(row).not.toHaveProperty('upvotes');
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
});

describe('removing', () => {
  it('takes the picture with the row', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { preview_path: 'user-1/img-1.jpg' }, error: null });

    await imaginations.removeImagination('img-1');

    expect(eqDelete).toHaveBeenCalledWith('id', 'img-1');
    expect(remove).toHaveBeenCalledWith(['user-1/img-1.jpg']);
  });

  it('reads the path before deleting the row that holds it', async () => {
    await load();
    maybeSingle.mockResolvedValue({ data: { preview_path: 'user-1/img-1.jpg' }, error: null });

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
    maybeSingle.mockResolvedValue({ data: { preview_path: 'user-1/img-1.jpg' }, error: null });
    remove.mockResolvedValue({ data: null, error: { message: 'object missing' } });

    // An orphan in a bucket is untidy; a pin that will not go away is the actual problem.
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

    const count = await imaginations.upvoteImagination('img-1');

    // The update policy is owner-only, and voting is by definition done to somebody
    // else's imagination.
    expect(rpc).toHaveBeenCalledWith('imagination_upvote', { p_id: 'img-1' });
    expect(update).not.toHaveBeenCalled();
    expect(count).toBe(13);
  });

  it('is null for an imagination that has since been deleted', async () => {
    await load();
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(imaginations.upvoteImagination('img-1')).resolves.toBeNull();
  });

  it('explains a failed vote', async () => {
    await load();
    rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });

    await expect(imaginations.upvoteImagination('img-1')).rejects.toThrow(/timeout/);
  });
});
