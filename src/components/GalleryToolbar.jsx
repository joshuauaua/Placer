/* PLACER — the toolbar under a gallery page's title (the Toolkit, Projects), stuck
 * to the page header with it: a filter menu on the left, the sort order in the
 * middle, and favourites and the grid and list views on the right.
 *
 * Also here, because both galleries need them the same way: the heart that
 * favourites one item, and the per-browser memory of the view and the favourites.
 * Styling is in index.css (.placer-gallery-*, .placer-reveal-btn).
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/**
 * `menu` is { label, current, badge, sections }: the button reads `current` and is
 * named "<label>: <current>", `badge` is an optional icon after it, and each section
 * is a list of { key, label, selected, onSelect, kind, title } items — `kind` is
 * 'radio' (the default) or 'checkbox'. Sections are ruled off from each other.
 *
 * `sorts` is [{ id, name, direction }], and `sort` the current { id, direction }.
 */
export function GalleryToolbar({ t, menu, sorts, sort, onSort, favouritesOnly, onFavouritesOnly, view, onView }) {
  return (
    <div className="placer-gallery-toolbar">
      <FilterMenu t={t} menu={menu} />
      <SortTabs t={t} sorts={sorts} sort={sort} onChange={onSort} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifySelf: 'end' }}>
        <RevealButton t={t} icon="heart" label="Favourites" pressed={favouritesOnly}
          iconFill={favouritesOnly ? 'currentColor' : 'none'}
          onClick={() => onFavouritesOnly(!favouritesOnly)} />
        <div role="group" aria-label="View" style={{ display: 'flex', gap: 4 }}>
          <RevealButton t={t} icon="grid" label="Grid" title="Grid view" pressed={view === 'grid'}
            onClick={() => onView('grid')} />
          <RevealButton t={t} icon="menu" label="List" title="List view" pressed={view === 'list'}
            onClick={() => onView('list')} />
        </div>
      </div>
    </div>
  );
}

/**
 * An icon button whose label slides out beside it on hover or focus, pushing the
 * icon to the left. Named by `label` either way.
 */
function RevealButton({ t, icon, label, title, pressed, onClick, iconFill = 'none' }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} aria-label={label}
      className={`placer-reveal-btn${pressed ? ' is-pressed' : ''}`} style={{ color: t.ink }}>
      <Icon name={icon} size={20} stroke={2} fill={iconFill} />
      <span className="placer-reveal-btn-label" aria-hidden="true">{title ?? label}</span>
    </button>
  );
}

/** What to show, as a menu off a pill-shaped button. Choosing an item closes it. */
function FilterMenu({ t, menu }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Closes on a click anywhere else, and on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', justifySelf: 'start' }}>
      <button type="button" onClick={() => setOpen((was) => !was)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`${menu.label}: ${menu.current}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 40, padding: '0 14px 0 18px',
          borderRadius: 999, border: `1px solid ${t.ink}`, background: t.surface, color: t.ink, cursor: 'pointer',
          fontFamily: 'var(--placer-font)', fontSize: 14, fontWeight: 500 }}>
        {menu.current}
        {menu.badge && <Icon name={menu.badge} size={14} stroke={2.2} />}
        <Icon name="chevDown" size={16} stroke={2.2} />
      </button>
      {open && (
        <div role="menu" aria-label={menu.label} style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          zIndex: 20, minWidth: 220, padding: 6, borderRadius: 12, background: t.surface,
          border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
          {menu.sections.map((section, index) => (
            <div key={index} style={index > 0 ? { borderTop: `1px solid ${t.line}`, marginTop: 6, paddingTop: 6 } : null}>
              {section.map((item) => (
                <button key={item.key} type="button"
                  role={item.kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitemradio'}
                  aria-checked={item.selected} title={item.title}
                  onClick={() => { item.onSelect(); setOpen(false); }}
                  className="placer-gallery-menu-item"
                  style={{ color: t.ink, fontWeight: item.selected ? 700 : 400 }}>
                  <span style={{ width: 16, display: 'inline-flex' }}>
                    {item.selected && <Icon name="check" size={16} stroke={2.4} />}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The order the gallery is in. The current one is underlined, with an arrow for its
 * direction, and choosing it again turns it round.
 */
function SortTabs({ t, sorts, sort, onChange }) {
  return (
    <div role="group" aria-label="Sort" className="placer-gallery-sorts">
      {sorts.map((option) => {
        const active = sort.id === option.id;
        return (
          <button key={option.id} type="button" aria-pressed={active}
            onClick={() => onChange(active
              ? { id: option.id, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
              : { id: option.id, direction: option.direction })}
            className="placer-gallery-sort"
            style={{ color: active ? t.ink : t.inkDim, fontWeight: active ? 700 : 500,
              borderBottomColor: active ? t.ink : 'transparent' }}>
            {option.name}
            {active && (
              <Icon name={sort.direction === 'asc' ? 'arrowUp' : 'arrowDown'} size={15} stroke={2.2}
                style={{ marginLeft: 6 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The heart on a tile or a row: favourites the item in this browser, or stops. */
export function FavouriteButton({ t, name, favourite, onToggle, style }) {
  const label = favourite ? `Remove ${name} from favourites` : `Add ${name} to favourites`;
  return (
    <button type="button" onClick={onToggle} aria-pressed={favourite} aria-label={label} title={label}
      className="placer-gallery-favourite" style={{ color: t.ink, ...style }}>
      <Icon name="heart" size={20} stroke={2} fill={favourite ? 'currentColor' : 'none'} />
    </button>
  );
}

// The view and the favourites are per-browser conveniences, so they live in
// localStorage, and every read and write is allowed to fail (a private window,
// blocked site data) — then it is just grid, and no favourites.
function read(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered, which is fine.
  }
}

/** Grid or list, remembered under `key` as the bare word (not JSON), as it always was. */
export function useGalleryView(key) {
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(key) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const change = (next) => {
    setView(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not remembered, which is fine.
    }
  };
  return [view, change];
}

/** The ids favourited, remembered under `key`, and a toggle for one of them. */
export function useFavourites(key) {
  const [ids, setIds] = useState(() => {
    const stored = read(key, []);
    return Array.isArray(stored) ? stored : [];
  });
  const toggle = (id) => {
    setIds((current) => {
      const next = current.includes(id) ? current.filter((each) => each !== id) : [...current, id];
      write(key, next);
      return next;
    });
  };
  return [ids, toggle];
}

export default GalleryToolbar;
