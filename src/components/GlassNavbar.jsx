/* PLACER — the holding page's nav bar.
 *
 * A full-width "liquid glass" bar: the wordmark in the centre, the site menu on
 * the right. It sits over the page rather than above it, so what scrolls
 * underneath shows through the blur. The glass itself lives in index.css
 * (.placer-glass-nav), since backdrop-filter and the layered highlights read
 * better there than as an inline style.
 */

import { HamburgerMenu } from './HamburgerMenu';

export function GlassNavbar({ t, view, onNavigate }) {
  return (
    <header className="placer-glass-nav" style={{ color: t.ink }}>
      {/* An empty first column the width of the last, so the wordmark stays
          centred on the bar rather than on the space left of the menu. */}
      <div aria-hidden="true" />

      <button
        onClick={() => onNavigate('welcome')}
        aria-label="PLACER home"
        className="placer-glass-nav-logo placer-disp"
      >
        PLACER
      </button>

      <div className="placer-glass-nav-end">
        <HamburgerMenu t={t} view={view} onNavigate={onNavigate} />
      </div>
    </header>
  );
}

export default GlassNavbar;
