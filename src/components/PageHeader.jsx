/* PLACER — the header at the top of a signed-in page: a small uppercase label with
 * an icon, the page's title under it, and any actions at the far end.
 *
 * It sticks to the top of the scrolling area, just under the nav bar, on the page's
 * own background so what scrolls passes out of sight beneath it. The page it sits in
 * is padded on either side; `inset` is that padding, which the header reaches back
 * out across so its background and rule run the page's full width. `maxWidth` lines
 * its text up with the page's column.
 *
 * `toolbar`, optional, is a row under the title that stays stuck with it — the
 * Toolkit's filter, sort and view controls.
 */

import { Icon } from './Icon';

export function PageHeader({ t, icon, label, title, actions, toolbar, inset = 40, maxWidth = 1200, style }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 10, margin: `0 -${inset}px 32px`,
      padding: `48px ${inset}px ${toolbar ? 12 : 24}px`, background: t.page, borderBottom: `1px solid ${t.line}`,
      ...style }}>
      <div style={{ maxWidth, margin: '0 auto', display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="placer-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDim, marginBottom: 14 }}>
            <Icon name={icon} size={15} stroke={2.1} />
            {label}
          </div>
          <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {title}
          </h1>
        </div>
        {actions && <div style={{ display: 'flex', gap: 12, flex: '0 0 auto' }}>{actions}</div>}
      </div>
      {toolbar && <div style={{ maxWidth, margin: '24px auto 0' }}>{toolbar}</div>}
    </header>
  );
}

export default PageHeader;
