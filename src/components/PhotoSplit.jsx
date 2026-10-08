/* PLACER — a photo beside a block of copy.
 *
 * The layout the User Labs page introduced, shared with the Placemaking Trends
 * survey's cover: the photo fills the left half, running up under the glass nav
 * bar, and the copy sits centred on the right. On a phone they stack, photo
 * first. The geometry lives in index.css (.placer-split-*), since a media query
 * cannot override an inline style.
 */

/* `heading`, when given, opens the copy on a wide screen, and on a phone moves
 * onto the foot of the photo: the copy then dissolves into the grid (display:
 * contents) so the heading can share the photo's cell. */
export function PhotoSplit({ t, src, alt, heading, children }) {
  return (
    <div className={`placer-split${heading ? ' placer-split-has-heading' : ''}`} style={{ background: t.page }}>
      <div className="placer-split-photo">
        <img src={src} alt={alt} />
      </div>
      <div className="placer-split-copy">
        {heading && <div className="placer-split-heading">{heading}</div>}
        <div className="placer-split-body">{children}</div>
      </div>
    </div>
  );
}

/** The page's title, then a bolder subtitle under it, set in italics where asked. */
export function PhotoSplitHeading({ t, title, subtitle, subtitleItalic = false }) {
  return (
    <>
      <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em',
        lineHeight: 1.05, color: t.ink }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ marginTop: 16, fontSize: 21, fontWeight: 700, lineHeight: 1.4, color: t.ink,
          fontStyle: subtitleItalic ? 'italic' : undefined }}>
          {subtitle}
        </p>
      )}
    </>
  );
}

export default PhotoSplit;
