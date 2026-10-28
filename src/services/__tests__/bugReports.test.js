import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

/*
 * The Supabase client is faked whole, offering only what supabase/bug-reports.sql and
 * bug-report-screenshots.sql grant: insert (message, page, user_agent, screenshot_path).
 * The screenshot goes through services/media, faked as the three calls this uses.
 */

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
const getSession = vi.fn();
const client = { from, auth: { getSession } };

vi.mock('../supabase', () => ({
  getSupabase: () => Promise.resolve(client),
  isSupabaseConfigured: () => true,
}));

const preparePhoto = vi.fn();
const uploadPhoto = vi.fn();
const removeMedia = vi.fn();
vi.mock('../media', () => ({
  isMediaConfigured: () => true,
  preparePhoto: (...a) => preparePhoto(...a),
  uploadPhoto: (...a) => uploadPhoto(...a),
  removeMedia: (...a) => removeMedia(...a),
}));

vi.mock('../../analytics', () => ({ track: vi.fn() }));

const { submitBugReport } = await import('../bugReports');
const { IMAGE_PRESETS } = await import('../../lib/imageEncode');

const ACCOUNT = '11111111-2222-3333-4444-555555555555';
const SHOT = new File(['png'], 'shot.png', { type: 'image/png' });
const ENCODED = { blob: new Blob(['webp']), ext: 'webp', copies: [] };

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } } });
  insert.mockResolvedValue({ error: null });
  preparePhoto.mockResolvedValue(ENCODED);
  uploadPhoto.mockImplementation((_, base) => Promise.resolve(`${base}.webp`));
  removeMedia.mockResolvedValue(undefined);
});

describe('submitBugReport', () => {
  it('sends a report on its own without touching the bucket', async () => {
    await submitBugReport('The map is blank');
    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.not.objectContaining({ screenshot_path: expect.anything() }));
  });

  it('re-encodes the screenshot smaller, uploads it under the account, then files the key', async () => {
    await submitBugReport('The map is blank', { screenshot: SHOT });

    expect(IMAGE_PRESETS.screenshot).toMatchObject({ maxSide: 1920 });
    expect(preparePhoto).toHaveBeenCalledWith(SHOT, 'screenshot', 'A screenshot');
    expect(uploadPhoto).toHaveBeenCalledWith(client, expect.stringMatching(
      new RegExp(`^bug-reports/${ACCOUNT}/[0-9a-f-]{36}$`)), ENCODED);
    const key = uploadPhoto.mock.calls[0][1];
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      message: 'The map is blank', screenshot_path: `${key}.webp`,
    }));
    expect(uploadPhoto.mock.invocationCallOrder[0]).toBeLessThan(insert.mock.invocationCallOrder[0]);
  });

  it('will not upload for somebody signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(submitBugReport('Broken', { screenshot: SHOT })).rejects.toThrow('Sign in to attach a screenshot.');
    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('files nothing when the upload is refused', async () => {
    uploadPhoto.mockRejectedValue(new Error('A picture can be at most 1.5 MB.'));
    await expect(submitBugReport('Broken', { screenshot: SHOT }))
      .rejects.toThrow('Could not upload the screenshot: A picture can be at most 1.5 MB.');
    expect(insert).not.toHaveBeenCalled();
  });

  it('removes the screenshot again when the report is refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    insert.mockResolvedValue({ error: { message: 'nope' } });
    await expect(submitBugReport('Broken', { screenshot: SHOT })).rejects.toThrow('nope');
    expect(removeMedia).toHaveBeenCalledWith(client, uploadPhoto.mock.calls[0][1] + '.webp');
  });
});
