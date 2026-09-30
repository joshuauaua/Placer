/* PLACER — the Storyblok client, which the Resources page reads its articles from.
 *
 * Optional in the same way Supabase is: with no VITE_STORYBLOK_TOKEN there is no
 * client, and the Resources page shows its built-in sample posts instead.
 *
 * The content model it reads, as set up in the Storyblok space: each article is a
 * story of the content type `case-study`, anywhere in the space, with the fields
 *   name               Text — the title
 *   short_description  Text — the line under the title on the card
 *   cover_image        Image — optional; without one the card shows a coloured tile
 *   text               Textarea or Richtext — the article itself
 *   images             Multi-Assets — optional, shown after the text
 *   body               Blocks — optional, any of the blocks in
 *                      components/storyblok/blocks.jsx, shown after that
 * Tags are the story's own Storyblok tags (the Tags field in the story's settings),
 * the date is when it was first published, and the reading time is worked out from
 * the text.
 *
 * The token goes in the bundle. Use the space's Public token, which can only read
 * published content. A Preview token also reads drafts, so put one only in a local
 * .env.local, together with VITE_STORYBLOK_VERSION=draft, for editing in the Visual
 * Editor — never in a deployed build.
 *
 * The SDK is imported with the Resources page, which is itself lazy, so nobody who
 * never opens it downloads any of this.
 */

import { apiPlugin, getStoryblokApi, storyblokInit } from '@storyblok/react';
import { BLOCKS } from '../components/storyblok/blocks';

const CONTENT_TYPE = 'case-study';
const WORDS_PER_MINUTE = 200;

// Read at call time rather than module load so tests can stub the environment,
// matching isSupabaseConfigured() in services/supabase.js.
export function isStoryblokConfigured() {
  return Boolean(import.meta.env.VITE_STORYBLOK_TOKEN);
}

/** 'draft' only when asked for, since a Public token is refused drafts outright. */
export function storyblokVersion() {
  return import.meta.env.VITE_STORYBLOK_VERSION === 'draft' ? 'draft' : 'published';
}

let initialised = false;

/** The shared client, or null when no token is configured. */
export function getStoryblok() {
  if (!isStoryblokConfigured()) return null;
  if (!initialised) {
    storyblokInit({
      accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
      use: [apiPlugin],
      apiOptions: { region: import.meta.env.VITE_STORYBLOK_REGION || 'eu' },
      components: BLOCKS,
      // The Visual Editor bridge is only fetched when the page is open inside the
      // Storyblok editor, so this costs visitors nothing.
      bridge: true,
    });
    initialised = true;
  }
  return getStoryblokApi();
}

/**
 * An image field's address, whether the field is an Asset (an object with a
 * filename) or the older Image type (a bare, protocol-relative URL).
 */
function imageFrom(field) {
  const src = typeof field === 'string' ? field : field?.filename;
  if (!src) return null;
  return { src: src.startsWith('//') ? `https:${src}` : src, alt: field?.alt ?? '' };
}

/** Every word in a plain string or a Richtext document. */
function wordsIn(text) {
  if (!text) return 0;
  if (typeof text === 'string') return text.split(/\s+/).filter(Boolean).length;
  return (text.content ?? []).reduce((sum, node) => sum + wordsIn(node.text ?? node), 0);
}

/** A story as the card grid and the article page want it. */
export function toResource(story) {
  const content = story.content ?? {};
  const published = story.first_published_at ?? story.published_at;
  const words = wordsIn(content.text);
  return {
    id: story.uuid ?? story.id,
    storyId: story.id,
    slug: story.full_slug ?? story.slug,
    title: content.name || story.name,
    excerpt: content.short_description ?? '',
    cover: imageFrom(content.cover_image),
    images: (content.images ?? []).map(imageFrom).filter(Boolean),
    tags: story.tag_list ?? [],
    date: published
      ? new Date(published).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
    readTime: words ? `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read` : '',
    content,
  };
}

/** Every article in the space, newest first. */
export async function listResources() {
  const api = getStoryblok();
  if (!api) return [];
  const stories = await api.getAll('cdn/stories', {
    content_type: CONTENT_TYPE,
    version: storyblokVersion(),
    sort_by: 'first_published_at:desc',
  });
  return stories.map(toResource);
}

/**
 * One article by its full slug (folders included, 'guides/street-trees'), or null
 * when there is none — or when the story there is not an article.
 */
export async function getResource(slug) {
  const api = getStoryblok();
  if (!api) return null;
  try {
    const { data } = await api.get(`cdn/stories/${slug}`, { version: storyblokVersion() });
    return data.story.content?.component === CONTENT_TYPE ? toResource(data.story) : null;
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}
