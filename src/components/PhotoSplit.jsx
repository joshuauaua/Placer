/* PLACER — a photo beside a block of copy.
 *
 * The layout the User Labs page introduced, shared with the Placemaking Trends
 * survey's cover: the photo fills the left half, running up under the glass nav
 * bar, and the copy sits centred on the right. On a phone they stack, photo
 * first. The geometry lives in index.css (.placer-split-*), since a media query
 * cannot override an inline style.
 */

export function PhotoSplit({ t, src, alt, children }) {
  return (
    <div className="placer-split" style={{ background: t.page }}>
      <div className="placer-split-photo">
        <img src={src} alt={alt} />
      </div>
      <div className="placer-split-copy">{children}</div>
    </div>
  );
}

/** The page's title, then a bolder subtitle under it. */
export function PhotoSplitHeading({ t, title, subtitle }) {
  return (
    <>
      <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em',
        lineHeight: 1.05, color: t.ink }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ marginTop: 16, fontSize: 21, fontWeight: 700, lineHeight: 1.4, color: t.ink }}>
          {subtitle}
        </p>
      )}
    </>
  );
}

export default PhotoSplit;
