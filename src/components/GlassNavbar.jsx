/* PLACER — the holding page's nav bar.
 *
 * A full-width "liquid glass" bar: the wordmark on the left, the site menu on
 * the right. It sits over the page rather than above it, so what scrolls
 * underneath shows through the blur. The glass itself lives in index.css
 * (.placer-glass-nav), since backdrop-filter and the layered highlights read
 * better there than as an inline style.
 */

import { HamburgerMenu } from './HamburgerMenu';
import { BrandLogo } from './UI';

export function GlassNavbar({ t, view, onNavigate }) {
  return (
    <header className="placer-glass-nav" style={{ color: t.ink }}>
      <button
        onClick={() => onNavigate('welcome')}
        aria-label="PLACER home"
        className="placer-glass-nav-logo"
      >
        <BrandLogo height={18} />
      </button>

      <div className="placer-glass-nav-end">
        <HamburgerMenu t={t} view={view} onNavigate={onNavigate} />
      </div>
    </header>
  );
}

export default GlassNavbar;
