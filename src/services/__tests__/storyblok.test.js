import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStoryblokConfigured, storyblokVersion, toResource } from '../storyblok';

describe('storyblok', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is configured only with a token', () => {
    vi.stubEnv('VITE_STORYBLOK_TOKEN', '');
    expect(isStoryblokConfigured()).toBe(false);
    vi.stubEnv('VITE_STORYBLOK_TOKEN', 'abc');
    expect(isStoryblokConfigured()).toBe(true);
  });

  it('reads published content unless drafts are asked for', () => {
    vi.stubEnv('VITE_STORYBLOK_VERSION', '');
    expect(storyblokVersion()).toBe('published');
    vi.stubEnv('VITE_STORYBLOK_VERSION', 'draft');
    expect(storyblokVersion()).toBe('draft');
  });

  it('turns a case-study story into a card', () => {
    const resource = toResource({
      id: 7,
      uuid: 'u-7',
      slug: 'street-trees',
      full_slug: 'guides/street-trees',
      name: 'Street trees (story name)',
      tag_list: ['Research', 'Environment'],
      first_published_at: '2026-06-10T09:00:00.000Z',
      content: {
        component: 'case-study',
        name: 'The Impact of Street Trees',
        short_description: 'Shade, air and value.',
        cover_image: '//a.storyblok.com/f/1/tree.jpg',
        text: 'word '.repeat(1000),
        images: [{ filename: 'https://a.storyblok.com/f/1/b.jpg', alt: 'A bench' }, { filename: '' }],
      },
    });
    expect(resource).toMatchObject({
      id: 'u-7',
      storyId: 7,
      slug: 'guides/street-trees',
      title: 'The Impact of Street Trees',
      excerpt: 'Shade, air and value.',
      cover: { src: 'https://a.storyblok.com/f/1/tree.jpg', alt: '' },
      images: [{ src: 'https://a.storyblok.com/f/1/b.jpg', alt: 'A bench' }],
      tags: ['Research', 'Environment'],
      date: '10 June 2026',
      readTime: '5 min read',
    });
  });

  it('counts the words of a Richtext document', () => {
    const text = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] }] };
    expect(toResource({ id: 1, content: { text } }).readTime).toBe('1 min read');
  });

  it('copes with a story whose fields are still empty', () => {
    const resource = toResource({ id: 1, slug: 'draft', name: 'Untitled', content: { cover_image: '' } });
    expect(resource).toMatchObject({ title: 'Untitled', excerpt: '', cover: null, images: [], tags: [], date: '', readTime: '' });
  });
});
