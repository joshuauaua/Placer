import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

const rpc = vi.fn();
const createClient = vi.fn(() => ({ rpc }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

vi.mock('../media', async (importOriginal) => ({
  ...(await importOriginal()),
  mediaUrl: (path) => (path ? `https://media.example/${path}` : null),
}));

let service;

async function load({ configured = true } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.resetModules();
  service = await import('../search');
}

beforeEach(() => {
  rpc.mockReset();
  createClient.mockClear();
  vi.unstubAllEnvs();
});

describe('search', () => {
  it('sends nothing for fewer than two characters', async () => {
    await load();

    await expect(service.search(' m ')).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('asks placer_search with the trimmed query, and hands back the app shape', async () => {
    await load();
    rpc.mockResolvedValue({ data: [
      { kind: 'person', id: 'user-1', name: 'Mara Quinn', detail: null, image_path: 'avatars/user-1/a.webp' },
      { kind: 'project', id: 'proj-1', name: 'Greenway', detail: 'Malmö Stad', image_path: null },
    ], error: null });

    const found = await service.search('  mar ');

    expect(rpc).toHaveBeenCalledWith('placer_search', { p_query: 'mar' });
    expect(found).toEqual([
      { kind: 'person', id: 'user-1', name: 'Mara Quinn', detail: '', image: 'https://media.example/avatars/user-1/a.webp' },
      { kind: 'project', id: 'proj-1', name: 'Greenway', detail: 'Malmö Stad', image: null },
    ]);
  });

  it('surfaces a refusal as a readable error', async () => {
    await load();
    rpc.mockResolvedValue({ data: null, error: { message: 'searching needs an account' } });

    await expect(service.search('mar')).rejects.toThrow('Could not search: searching needs an account');
  });

  it('refuses with no Supabase project', async () => {
    await load({ configured: false });

    await expect(service.search('mar')).rejects.toThrow(/Supabase project/);
  });
});
