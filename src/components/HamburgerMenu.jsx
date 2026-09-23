/* PLACER — the site menu at the right-hand end of the nav bar.
 *
 * Ported from the landingpage branch. A trigger that flips between the
 * hamburger and close glyphs, and a small dropdown under it rather than a
 * full-screen dialog, since the list of links is short enough to read at a
 * glance. Each item is { key, label, onSelect }; `view` marks the current one.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function HamburgerMenu({ t, view, items }) {
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

  const choose = (item) => {
    setOpen(false);
    item.onSelect();
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
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => choose(item)}
              className="placer-menu-link"
              style={{ color: view === item.key ? t.ink : t.inkDim, fontWeight: view === item.key ? 700 : 600 }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export default HamburgerMenu;
