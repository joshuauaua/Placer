/* PLACER — the holding page's nav bar.
 *
 * A full-width solid white bar: the wordmark on the left, the site menu on
 * the right. It is fixed over the top of the page; its styles live in
 * index.css (.placer-glass-nav).
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
