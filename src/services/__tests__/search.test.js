import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';

const rpc = vi.fn();
const createClient = vi.fn(() => ({ rpc }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

vi.mock('../media', async (importOriginal) => ({
  ...(await importOriginal()),
  mediaUrl: (path) => (path ? `https://media.example/${path}` : null),
}));

// A small register of its own, so what a search finds among tools is known here.
vi.mock('../../toolkit/tools', () => ({
  TOOLS: [
    { id: 'desire-lines', name: 'Desire Lines', category: 'understand', createdBy: 'PLACER', icon: 'path' },
    { id: 'open-vote', name: 'Open Vote', category: 'plan', createdBy: 'PLACER', icon: 'chart' },
  ],
  filterTools: (tools, { query }) => tools.filter((tool) => tool.name.toLowerCase().includes(query.toLowerCase())),
  findCategory: (id) => ({ understand: { name: 'Understand' }, plan: { name: 'Plan' } })[id] ?? null,
}));

const searchResources = vi.fn();
vi.mock('../storyblok', () => ({ searchResources }));

let service;

async function load({ configured = true, storyblok = false } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', configured ? 'https://example.supabase.co' : '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', configured ? 'anon-key' : '');
  vi.stubEnv('VITE_STORYBLOK_TOKEN', storyblok ? 'token' : '');
  vi.resetModules();
  service = await import('../search');
}

beforeEach(() => {
  rpc.mockReset();
  searchResources.mockReset();
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

  it('finds tools by what the register says about them, with their category and icon', async () => {
    await load();
    rpc.mockResolvedValue({ data: [], error: null });

    expect(await service.search('desire')).toEqual([
      { kind: 'tool', id: 'desire-lines', name: 'Desire Lines', detail: 'Understand · PLACER', image: null, icon: 'path' },
    ]);
  });

  it('finds case studies through Storyblok, opened by their slug', async () => {
    await load({ storyblok: true });
    rpc.mockResolvedValue({ data: [], error: null });
    searchResources.mockResolvedValue([
      { slug: 'case-studies/folkets-park', title: 'Folkets Park', excerpt: 'A park, reimagined.', cover: { src: 'https://a.example/p.jpg' } },
    ]);

    expect(await service.search('park')).toEqual([
      { kind: 'caseStudy', id: 'case-studies/folkets-park', name: 'Folkets Park', detail: 'A park, reimagined.',
        image: 'https://a.example/p.jpg' },
    ]);
    expect(searchResources).toHaveBeenCalledWith('park', 4);
  });

  it('asks Storyblok nothing without a token', async () => {
    await load();
    rpc.mockResolvedValue({ data: [], error: null });

    await service.search('park');

    expect(searchResources).not.toHaveBeenCalled();
  });

  it('still finds tools with no Supabase project', async () => {
    await load({ configured: false });

    expect((await service.search('vote')).map((result) => result.id)).toEqual(['open-vote']);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps what one source found when another fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await load();
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });

    expect((await service.search('desire')).map((result) => result.id)).toEqual(['desire-lines']);
  });
});
