/* PLACER — the holding page's site menu.
 *
 * Sits at the right end of GlassNavbar. With the full nav bar off (see App.jsx),
 * this is the only way to reach the pages behind it — and, once there, the only
 * way back. A trigger that flips between the hamburger and close glyphs, and a
 * panel that covers everything under the bar, down to the bottom of the viewport,
 * in the bar's own glass. It lists the footer's sections (FOOTER_COLUMNS), so the
 * two always offer the same pages.
 *
 * The panel is portalled to <body> rather than rendered inside the bar. The bar has
 * a backdrop-filter, which makes it the containing block for a fixed descendant —
 * the panel would be clipped to the bar's 56px — and a backdrop-filter nested in
 * another only blurs what is inside the outer one, not the page.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { FOOTER_COLUMNS } from './SiteFooter';

// Two columns: the project's own pages on the left, About Us on its own on the
// right. Anything not named here falls into the left column.
const RIGHT_COLUMN = ['About Us'];
const MENU_COLUMNS = [
  FOOTER_COLUMNS.filter(({ heading }) => !RIGHT_COLUMN.includes(heading)),
  FOOTER_COLUMNS.filter(({ heading }) => RIGHT_COLUMN.includes(heading)),
];

export function HamburgerMenu({ t, view, onNavigate }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // The panel covers the page, so the only thing left outside both it and the
    // trigger is the rest of the bar — the wordmark — and pressing that closes it.
    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const go = (key) => {
    setOpen(false);
    onNavigate(key);
  };

  return (
    <div ref={rootRef} className="placer-menu-root">
      <button
        onClick={() => setOpen((current) => !current)}
        aria-controls="placer-menu-panel"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="placer-menu-trigger"
        style={{ color: t.ink }}
      >
        <Icon name={open ? 'close' : 'menu'} size={20} stroke={2} />
      </button>

      {open && createPortal(
        <nav id="placer-menu-panel" ref={panelRef} aria-label="Site" className="placer-menu-panel"
          style={{ color: t.ink }}>
          <div className="placer-menu-columns">
            {MENU_COLUMNS.map((sections, index) => (
              <div key={index} className="placer-menu-column">
                {sections.map(({ heading, links }) => (
                  <section key={heading} className="placer-menu-section">
                    <div className="placer-menu-heading" style={{ color: t.inkFaint }}>{heading}</div>
                    {links.map(({ label, view: target, href }) => target ? (
                      <button
                        key={label}
                        onClick={() => go(target)}
                        aria-current={view === target ? 'page' : undefined}
                        className="placer-menu-link"
                        style={{ color: view === target ? t.ink : t.inkDim }}
                      >
                        {label}
                      </button>
                    ) : href ? (
                      <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                        onClick={() => setOpen(false)} className="placer-menu-link" style={{ color: t.inkDim }}>
                        {label}
                      </a>
                    ) : (
                      <span key={label} className="placer-menu-link" style={{ color: t.inkFaint, cursor: 'default' }}>
                        {label}
                      </span>
                    ))}
                  </section>
                ))}
              </div>
            ))}
          </div>
        </nav>,
        document.body,
      )}
    </div>
  );
}

export default HamburgerMenu;
