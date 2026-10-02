/* PLACER — Resources Page */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Icon } from './Icon';
import { Chip, LoadingMark } from './UI';
import { isStoryblokConfigured, listResources } from '../services/storyblok';

// The tile colours a card without a cover picture cycles through.
const TILE_COLOURS = ['#C6DEF8', '#DDD2FA', '#FFD9B8'];

export function ResourcesPage({ t }) {
  const [, navigate] = useLocation();
  const fromStoryblok = isStoryblokConfigured();
  const [posts, setPosts] = useState(fromStoryblok ? null : []);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!fromStoryblok) return;
    let cancelled = false;
    listResources()
      .then((found) => { if (!cancelled) setPosts(found); })
      .catch((error) => {
        console.error('Could not load resources from Storyblok', error);
        if (!cancelled) { setLoadError(error); setPosts([]); }
      });
    return () => { cancelled = true; };
  }, [fromStoryblok]);

  return (
    <ResourceIndex
      t={t}
      title="Resources"
      intro="Guides, case studies, and insights to help you reimagine your community spaces."
      noun="resources"
      posts={posts}
      loadError={loadError}
      onOpen={(post) => navigate(`/resources/${post.slug}`)}
    />
  );
}

/**
 * The page's layout without its data, shared with the Guides page: a heading, a row
 * of tag filters, and a grid of cards. `posts` is null while loading; a post opens
 * with `onOpen` only if it has a `slug`.
 */
export function ResourceIndex({ t, title, intro, noun, posts, loadError, onOpen }) {
  const [selectedTag, setSelectedTag] = useState(null);
  const allTags = ['All', ...new Set((posts ?? []).flatMap(post => post.tags))];

  const filteredPosts = selectedTag && selectedTag !== 'All'
    ? posts.filter(post => post.tags.includes(selectedTag))
    : posts ?? [];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '48px 40px'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1 className="placer-disp" style={{
            fontSize: 48,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 16
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 18,
            color: t.inkDim,
            lineHeight: 1.6,
            maxWidth: 680
          }}>
            {intro}
          </p>
        </div>

        {/* Filter Tags */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 40,
          paddingBottom: 32,
          borderBottom: `1px solid ${t.line}`
        }}>
          {allTags.map(tag => (
            <Chip
              key={tag}
              t={t}
              active={selectedTag === tag || (tag === 'All' && !selectedTag)}
              onClick={() => setSelectedTag(tag === 'All' ? null : tag)}
            >
              {tag}
            </Chip>
          ))}
        </div>

        {/* Posts Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 24
        }}>
          {filteredPosts.map((post, index) => (
            <article
              key={post.id}
              role={post.slug ? 'link' : undefined}
              tabIndex={post.slug ? 0 : undefined}
              onClick={post.slug ? () => onOpen(post) : undefined}
              onKeyDown={post.slug ? (e) => { if (e.key === 'Enter') onOpen(post); } : undefined}
              style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.line}`,
                overflow: 'hidden',
                cursor: post.slug ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: t.shadow
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = t.shadow;
              }}
            >
              {/* Post Image */}
              <div style={{
                width: '100%',
                height: 200,
                background: post.image?.bg ?? TILE_COLOURS[index % TILE_COLOURS.length],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {post.cover
                  ? <img src={post.cover.src} alt={post.cover.alt} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Icon name={post.image?.icon ?? 'layers'} size={56} stroke={2} style={{ color: t.ink }} />}

                {/* Tags overlay */}
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  display: 'flex',
                  gap: 6
                }}>
                  {post.tags.slice(0, 3).map(tag => (
                    <span key={tag} style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 500,
                      color: t.ink
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Post Content */}
              <div style={{ padding: 24 }}>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: t.ink,
                  marginBottom: 12,
                  lineHeight: 1.3
                }}>
                  {post.title}
                </h3>

                <p style={{
                  fontSize: 14,
                  color: t.inkDim,
                  lineHeight: 1.6,
                  marginBottom: 16
                }}>
                  {post.excerpt}
                </p>

                {/* Meta info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12,
                  color: t.inkDim
                }}>
                  {post.date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="calendar" size={14} stroke={2} />
                      {post.date}
                    </span>
                  )}
                  {post.date && post.readTime && <span>•</span>}
                  {post.readTime && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="clock" size={14} stroke={2} />
                      {post.readTime}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {posts === null && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 20px' }}>
            <LoadingMark />
          </div>
        )}

        {/* Empty State */}
        {posts !== null && filteredPosts.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: t.inkDim
          }}>
            <Icon name="inbox" size={48} stroke={1.5} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ fontSize: 16 }}>
              {loadError
                ? `The ${noun} could not be loaded. Try again in a moment.`
                : selectedTag ? `No ${noun} found for this filter.` : `No ${noun} have been published yet.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResourcesPage;
