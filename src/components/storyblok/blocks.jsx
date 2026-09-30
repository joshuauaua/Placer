/* PLACER — the Storyblok blocks an article's body is built from.
 *
 * Each key is a block's technical name in the Storyblok space, and each component
 * gets the block's fields as `blok`, plus the theme as `t` from ResourceArticle.
 * storyblokEditable() marks the element so that clicking it in the Visual Editor
 * opens that block; outside the editor it adds attributes and nothing else.
 *
 * A block added in Storyblok but not here renders nothing, rather than breaking the
 * article — add a component to BLOCKS to show it.
 */

import { StoryblokRichText, storyblokEditable } from '@storyblok/react';

function RichTextBlock({ blok, t }) {
  return (
    <div {...storyblokEditable(blok)} className="placer-richtext"
      style={{ fontSize: 17, lineHeight: 1.7, color: t.ink, marginBottom: 24 }}>
      <StoryblokRichText document={blok.text} />
    </div>
  );
}

function ImageBlock({ blok, t }) {
  if (!blok.image?.filename) return null;
  return (
    <figure {...storyblokEditable(blok)} style={{ margin: '0 0 32px' }}>
      <img
        src={blok.image.filename}
        alt={blok.image.alt ?? ''}
        loading="lazy"
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }}
      />
      {blok.caption && (
        <figcaption style={{ marginTop: 8, fontSize: 13, color: t.inkDim }}>{blok.caption}</figcaption>
      )}
    </figure>
  );
}

function QuoteBlock({ blok, t }) {
  return (
    <blockquote {...storyblokEditable(blok)} style={{
      margin: '0 0 32px',
      padding: '8px 0 8px 20px',
      borderLeft: `3px solid ${t.line}`,
    }}>
      <p style={{ fontSize: 20, lineHeight: 1.5, color: t.ink, fontStyle: 'italic' }}>{blok.text}</p>
      {blok.attribution && (
        <footer style={{ marginTop: 8, fontSize: 14, color: t.inkDim }}>— {blok.attribution}</footer>
      )}
    </blockquote>
  );
}

export const BLOCKS = {
  rich_text: RichTextBlock,
  image: ImageBlock,
  quote: QuoteBlock,
};
