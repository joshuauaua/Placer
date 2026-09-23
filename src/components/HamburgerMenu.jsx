/* PLACER — the holding page's site menu.
 *
 * Sits at the right end of GlassNavbar. With the full nav bar off (see App.jsx),
 * this is the only way to reach About or Contact — and, once there, the only
 * way back. A trigger that flips
 * between the hamburger and close glyphs, and a small dropdown under it
 * rather than a full-screen dialog, since the list of links is short enough
 * to read at a glance.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const LINKS = [
  { key: 'welcome', label: 'Home' },
  { key: 'about', label: 'About' },
  { key: 'contact', label: 'Contact' },
];

export function HamburgerMenu({ t, view, onNavigate }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // A dropdown, not a modal: a click anywhere outside it closes it, the way
    // a native <select> or menu button behaves.
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
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
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="placer-menu-trigger"
        style={{ color: t.ink }}
      >
        <Icon name={open ? 'close' : 'menu'} size={20} stroke={2} />
      </button>

      {open && (
        <nav aria-label="Site" className="placer-menu-panel">
          {LINKS.map((link) => (
            <button
              key={link.key}
              onClick={() => go(link.key)}
              className="placer-menu-link"
              style={{ color: view === link.key ? t.ink : t.inkDim, fontWeight: view === link.key ? 700 : 600 }}
            >
              {link.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export default HamburgerMenu;
