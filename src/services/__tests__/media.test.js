import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';

/*
 * The Supabase client is a hand-made fake with only functions.invoke on it, because
 * that is the only thing this module is allowed to ask of it: every write goes through
 * the media Edge Function, never straight to a bucket. fetch is faked only to prove it
 * is never called — the bytes go to the function, which checks them, not to R2.
 */

const invoke = vi.fn();
const supabase = { functions: { invoke } };
const fetchSpy = vi.fn();

let media;

async function load({ base = 'https://media.example/' } = {}) {
  vi.stubEnv('VITE_MEDIA_URL', base);
  vi.resetModules();
  media = await import('../media');
}

beforeEach(() => {
  invoke.mockReset();
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
  invoke.mockResolvedValue({ data: { url: 'https://r2.example/signed' }, error: null });
  fetchSpy.mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('addresses', () => {
  it('puts a key under the public bucket address, without doubling the slash', async () => {
    await load();

    expect(media.mediaUrl('covers/user-1/cover-1.jpg')).toBe('https://media.example/covers/user-1/cover-1.jpg');
  });

  it('has no address for no key', async () => {
    await load();

    expect(media.mediaUrl(null)).toBeNull();
  });

  it('has no address when no bucket is configured, rather than a broken one', async () => {
    await load({ base: '' });

    expect(media.isMediaConfigured()).toBe(false);
    expect(media.mediaUrl('covers/user-1/cover-1.jpg')).toBeNull();
  });
});

describe('uploading', () => {
  const blob = new Blob(['abc'], { type: 'image/png' });

  it('sends the bytes themselves to the function, with the key in a header', async () => {
    await load();
    invoke.mockResolvedValue({ data: { path: 'covers/user-1/c.png' }, error: null });

    await expect(media.uploadMedia(supabase, 'covers/user-1/c.png', blob)).resolves.toBe('covers/user-1/c.png');

    expect(invoke).toHaveBeenCalledWith('media', {
      body: blob,
      // Opaque on purpose: the function reads the bytes to decide what the file is.
      headers: { 'x-media-path': 'covers/user-1/c.png', 'Content-Type': 'application/octet-stream' },
    });
  });

  it('never talks to R2 directly', async () => {
    await load();

    await media.uploadMedia(supabase, 'covers/user-1/c.png', blob);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes on the function\'s own explanation when it refuses', async () => {
    await load();
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: () => Promise.resolve({ error: 'That file is not a picture this can take (JPG, PNG, WEBP).' }) } },
    });

    await expect(media.uploadMedia(supabase, 'covers/user-1/c.png', blob))
      .rejects.toThrow('That file is not a picture this can take (JPG, PNG, WEBP).');
  });

  it('falls back to the generic message when the refusal has no body', async () => {
    await load();
    invoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request' } });

    await expect(media.uploadMedia(supabase, 'covers/user-1/c.png', blob)).rejects.toThrow('Failed to send a request');
  });

  it('refuses to upload when there is no bucket to show the picture from', async () => {
    await load({ base: '' });

    await expect(media.uploadMedia(supabase, 'covers/user-1/c.png', blob)).rejects.toThrow(/VITE_MEDIA_URL/);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('removing', () => {
  it('asks the function to delete the key', async () => {
    await load();
    invoke.mockResolvedValue({ data: { ok: true }, error: null });

    await media.removeMedia(supabase, 'previews/user-1/img-1.jpg');

    expect(invoke).toHaveBeenCalledWith('media', { body: { action: 'delete', path: 'previews/user-1/img-1.jpg' } });
  });

  it('does nothing for no key', async () => {
    await load();

    await media.removeMedia(supabase, null);

    expect(invoke).not.toHaveBeenCalled();
  });
});
