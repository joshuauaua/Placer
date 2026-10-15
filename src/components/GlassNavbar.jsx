/* PLACER — the holding page's nav bar.
 *
 * A full-width solid white bar: the wordmark on the left, and on the right the
 * main pages as links on a wide screen, or the site menu on a narrow one. It is
 * fixed over the top of the page; its styles live in index.css
 * (.placer-glass-nav). Which of the two shows is left to CSS, so neither
 * flickers in on the first render.
 */

import { HamburgerMenu } from './HamburgerMenu';
import { BrandLogo } from './UI';

// The same pages the menu offers, by shorter names that fit a bar.
const LINKS = [
  { label: 'User Labs', view: 'userLabs' },
  { label: 'Survey', view: 'placemakingTrendsSurvey' },
  { label: 'About', view: 'about' },
  { label: 'Contact', view: 'contact' },
];

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
        <nav aria-label="Main" className="placer-glass-nav-links">
          {LINKS.map(({ label, view: target }) => (
            <button
              key={target}
              onClick={() => onNavigate(target)}
              aria-current={view === target ? 'page' : undefined}
              className="placer-glass-nav-link"
            >
              {label}
            </button>
          ))}
        </nav>
        <HamburgerMenu t={t} view={view} onNavigate={onNavigate} />
      </div>
    </header>
  );
}

export default GlassNavbar;
