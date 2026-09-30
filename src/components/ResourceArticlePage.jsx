/* PLACER — one Resources article, at /resources/<slug>, read from Storyblok.
 *
 * The article is the story's text, then its images, then any blocks in its body,
 * each rendered by its component in components/storyblok/blocks.jsx. Opened inside the Storyblok Visual Editor, the
 * bridge sends every edit straight back here, so the page updates as it is typed.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { StoryblokComponent, StoryblokRichText, registerStoryblokBridge, storyblokEditable } from '@storyblok/react';
import { Icon } from './Icon';
import { Btn, LoadingMark } from './UI';
import { getResource, isStoryblokConfigured, toResource } from '../services/storyblok';

// A Textarea field is a plain string, where a blank line starts a new paragraph; a
// Richtext field is a document.
function ArticleText({ text, t }) {
  if (!text) return null;
  return (
    <div className="placer-richtext" style={{ fontSize: 17, lineHeight: 1.7, color: t.ink, marginBottom: 32 }}>
      {typeof text === 'string'
        ? text.split(/\n\s*\n/).map((paragraph, i) => (
          <p key={i} style={{ whiteSpace: 'pre-line' }}>{paragraph.trim()}</p>
        ))
        : <StoryblokRichText document={text} />}
    </div>
  );
}

export function ResourceArticlePage({ t, slug }) {
  const [, navigate] = useLocation();
  // undefined while loading, null when there is no such article.
  const [article, setArticle] = useState(undefined);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!isStoryblokConfigured()) { setArticle(null); return; }
    let cancelled = false;
    setArticle(undefined);
    setLoadError(null);
    getResource(slug)
      .then((found) => {
        if (cancelled) return;
        setArticle(found);
        // Only does anything inside the Visual Editor, where the bridge is loaded.
        if (found && typeof window !== 'undefined' && window.storyblokRegisterEvent) {
          registerStoryblokBridge(found.storyId, (story) => setArticle(toResource(story)));
        }
      })
      .catch((error) => {
        console.error('Could not load the article from Storyblok', error);
        if (!cancelled) { setLoadError(error); setArticle(null); }
      });
    return () => { cancelled = true; };
  }, [slug]);

  const back = (
    <Btn t={t} variant="secondary" size="sm" icon="chevLeft" onClick={() => navigate('/resources')}>
      All resources
    </Btn>
  );

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '48px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>{back}</div>

        {article === undefined && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <LoadingMark />
          </div>
        )}

        {article === null && (
          <p style={{ fontSize: 16, color: t.inkDim, padding: '40px 0' }}>
            {loadError ? 'This article could not be loaded. Try again in a moment.' : 'There is no article here.'}
          </p>
        )}

        {article && (
          <article {...storyblokEditable(article.content)}>
            {article.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {article.tags.map(tag => (
                  <span key={tag} style={{ padding: '4px 10px', borderRadius: 12, background: t.surface,
                    border: `1px solid ${t.line}`, fontSize: 12, fontWeight: 500, color: t.ink }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h1 className="placer-disp" style={{ fontSize: 'var(--placer-h1)', lineHeight: 'var(--placer-h1-lh)',
              fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', marginBottom: 16 }}>
              {article.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: t.inkDim, marginBottom: 32 }}>
              {article.date && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="calendar" size={14} stroke={2} />{article.date}
                </span>
              )}
              {article.date && article.readTime && <span>•</span>}
              {article.readTime && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="clock" size={14} stroke={2} />{article.readTime}
                </span>
              )}
            </div>
            {article.cover && (
              <img src={article.cover.src} alt={article.cover.alt}
                style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, marginBottom: 32 }} />
            )}
            <ArticleText text={article.content.text} t={t} />
            {article.images.map(image => (
              <img key={image.src} src={image.src} alt={image.alt} loading="lazy"
                style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, marginBottom: 24 }} />
            ))}
            {(article.content.body ?? []).map(blok => (
              <StoryblokComponent key={blok._uid} blok={blok} t={t} />
            ))}
          </article>
        )}
      </div>
    </div>
  );
}

export default ResourceArticlePage;
