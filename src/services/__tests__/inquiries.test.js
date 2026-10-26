import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * The Supabase client is faked whole, offering only what supabase/profile-inquiries.sql
 * grants the signed-in account: insert (owner_id, tool, title, note, config), select and
 * delete. Pictures go through services/media, faked as the two calls this uses.
 */

const single = vi.fn();
const insert = vi.fn(() => ({ select: () => ({ single }) }));
const deleted = vi.fn();
const eqDelete = vi.fn(() => ({ select: deleted }));
const from = vi.fn(() => ({ insert, delete: () => ({ eq: eqDelete }) }));
const getSession = vi.fn();
const client = { from, auth: { getSession } };

vi.mock('../supabase', () => ({ getSupabase: () => Promise.resolve(client) }));

const uploadPhoto = vi.fn();
const removeMedia = vi.fn();
vi.mock('../media', () => ({
  uploadPhoto: (...a) => uploadPhoto(...a),
  removeMedia: (...a) => removeMedia(...a),
}));

// jsdom cannot decode a picture, so the re-encode fails and the picture goes as exported.
vi.mock('../../lib/imageEncode', async (importOriginal) => ({
  ...(await importOriginal()),
  encodeImage: () => Promise.reject(new Error('no canvas here')),
}));

vi.mock('../../analytics', () => ({ track: vi.fn() }));

const { saveInquiry, deleteInquiry } = await import('../inquiries');

const ACCOUNT = '11111111-2222-3333-4444-555555555555';
const PREVIEW = 'data:image/jpeg;base64,/9j/';
const row = (over = {}) => ({
  id: 'inq-1', tool: 'reimagine-a-space', title: 'Pocket park', note: '', config: {}, created_at: '2026-10-26T10:00:00Z', ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } } });
  single.mockResolvedValue({ data: row(), error: null });
  removeMedia.mockResolvedValue(undefined);
});

describe('saveInquiry', () => {
  it('writes only the columns the account may, as the account', async () => {
    await saveInquiry({ tool: 'open-vote', title: '  More benches?  ', note: 'n', config: { question: 'More benches?' } });

    expect(from).toHaveBeenCalledWith('profile_inquiries');
    expect(insert).toHaveBeenCalledWith({
      owner_id: ACCOUNT, tool: 'open-vote', title: 'More benches?', note: 'n', config: { question: 'More benches?' },
    });
    expect(uploadPhoto).not.toHaveBeenCalled();
  });

  it('keeps a note within what the table takes', async () => {
    await saveInquiry({ tool: 'budget-ballot', title: 'Co-Budget', note: 'x'.repeat(1500), config: {} });

    expect(insert.mock.calls[0][0].note).toHaveLength(1000);
  });

  it("uploads a picture to the account's previews folder first, and keeps its key", async () => {
    uploadPhoto.mockResolvedValue(`previews/${ACCOUNT}/pic.jpg`);

    await saveInquiry({ tool: 'reimagine-a-space', title: 'Pocket park', config: { fov: 90 }, preview: PREVIEW });

    expect(uploadPhoto.mock.calls[0][1]).toMatch(new RegExp(`^previews/${ACCOUNT}/[0-9a-f-]{36}$`));
    expect(insert.mock.calls[0][0].config).toEqual({ fov: 90, preview: `previews/${ACCOUNT}/pic.jpg` });
    expect(uploadPhoto.mock.invocationCallOrder[0]).toBeLessThan(insert.mock.invocationCallOrder[0]);
  });

  it('writes nothing when the picture did not upload', async () => {
    uploadPhoto.mockRejectedValue(new Error('too big'));

    await expect(saveInquiry({ tool: 'reimagine-a-space', title: 'Pocket park', config: {}, preview: PREVIEW }))
      .rejects.toThrow(/Could not upload the picture/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('removes the picture again when the row is refused', async () => {
    uploadPhoto.mockResolvedValue(`previews/${ACCOUNT}/pic.jpg`);
    single.mockResolvedValue({ data: null, error: { message: 'violates check constraint' } });

    await expect(saveInquiry({ tool: 'reimagine-a-space', title: 'Pocket park', config: {}, preview: PREVIEW }))
      .rejects.toThrow(/Could not save this to your profile/);
    expect(removeMedia).toHaveBeenCalledWith(client, `previews/${ACCOUNT}/pic.jpg`);
  });

  it('needs somebody signed in', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(saveInquiry({ tool: 'open-vote', title: 'Q', config: {} })).rejects.toThrow(/Sign in/);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('deleteInquiry', () => {
  it('deletes the row, and the picture that went with it', async () => {
    deleted.mockResolvedValue({ data: [{ config: { preview: `previews/${ACCOUNT}/pic.jpg` } }], error: null });

    await deleteInquiry('inq-1');

    expect(eqDelete).toHaveBeenCalledWith('id', 'inq-1');
    expect(removeMedia).toHaveBeenCalledWith(client, `previews/${ACCOUNT}/pic.jpg`);
  });

  it('touches no picture for an inquiry without one', async () => {
    deleted.mockResolvedValue({ data: [{ config: { walks: [] } }], error: null });

    await deleteInquiry('inq-1');

    expect(removeMedia).not.toHaveBeenCalled();
  });

  it('still counts as deleted when the picture could not be removed', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    deleted.mockResolvedValue({ data: [{ config: { preview: `previews/${ACCOUNT}/pic.jpg` } }], error: null });
    removeMedia.mockRejectedValue(new Error('gone already'));

    await expect(deleteInquiry('inq-1')).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});
