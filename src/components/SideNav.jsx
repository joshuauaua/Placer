/* PLACER — the side nav, down the left edge for anyone who is signed in.
 *
 * The places someone with an account goes back to: their dashboard and their boards,
 * under a primary button for creating a tool — a dropdown of the three kinds of tool,
 * Understand, Imagine and Plan (CreateToolMenu) — with small links low down above a
 * line: Explore, their organisations (once they run one), the Guides, the FAQ and the
 * terms (which the footer had before it went for anyone signed in). Their settings
 * are under that line at the very bottom. It sits under the glass
 * nav bar rather than beside it, so the bar still spans the full width, and it
 * stops where the page does, so the footer does too. The button at its top
 * collapses it to a rail of icons. Below 1024px it becomes the glass tab bar
 * along the bottom of the window. Either way each label stays on as the button's
 * accessible name. All the styling, the brand kit's glass sidebar, lives in
 * index.css (.placer-side-nav).
 *
 * Each item is { key, label, icon, onSelect, active, bottom }. `active` is a list
 * of views, because some places own more than one — a project's dashboard is
 * reached from Projects, so Projects stays marked while it is open.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { findCategory } from '../toolkit/tools';
import { isNewProjectShortcut } from '../lib/shortcuts';

// Collapsed or not is a per-browser convenience, so it lives in localStorage and
// every read and write is allowed to fail — a private window just starts expanded.
const COLLAPSED_KEY = 'placer_side_nav_collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // Nothing to do: it simply will not be remembered.
  }
}

/**
 * A label in the side nav, and the shorter one the phone's tab bar shows when the
 * full one would not fit in a tab (index.css swaps them below 1024px). The button's
 * aria-label carries the full name either way, so neither span is what a screen
 * reader announces.
 */
function NavLabel({ label, short }) {
  if (!short) return <span className="placer-side-nav-label">{label}</span>;
  return (
    <span className="placer-side-nav-label">
      <span className="placer-side-nav-label-long">{label}</span>
      <span className="placer-side-nav-label-short">{short}</span>
    </span>
  );
}

/**
 * `expanded` holds it open whatever was chosen, without forgetting the choice: the
 * welcome tour sets it, so the places it points at are there with their names.
 */
// The small links above Settings that only open a view. Desktop only: the phone's tab
// bar has no room, and a collapsed rail has no room for their words. Explore and
// Organisations go before these (SideNav), as they need more than a view to open.
const SMALL_LINKS = [
  { key: 'guides', label: 'Guides', view: 'guides' },
  { key: 'faq', label: 'FAQ', view: 'faq' },
  { key: 'terms', label: 'Terms and Privacy', view: 'terms' },
];

// What Create a tool offers: one of the tool categories each, by its own name. Each has
// a few words of its own rather than the category's full description, to fit a card.
export const TOOL_KINDS = [
  { category: 'understand', label: 'Understand', hint: 'How a place is used', icon: 'eye' },
  { category: 'imagine', label: 'Imagine', hint: 'How it could change', icon: 'sparkle' },
  { category: 'plan', label: 'Plan', hint: 'Shape the change', icon: 'layers' },
];

// The menu's width: three cards side by side, narrower if the window is.
const MENU_WIDTH = 640;

/**
 * The dropdown off Create a tool, its three choices side by side as cards. It is drawn into document.body, fixed beside the
 * button, because the side nav scrolls (overflow-y: auto) and would clip anything
 * hanging out of it: under the button in the side nav, above it in the phone's tab
 * bar. Escape or a press anywhere else closes it, the same as UserMenu. The Tools
 * page's Create a Tool shortcut opens it too (DashboardPage).
 */
export function CreateToolMenu({ anchor, onChoose, onClose }) {
  const menuRef = useRef(null);
  const [place, setPlace] = useState(null);

  // Layout effects, so the menu is placed and its first choice focused before the
  // browser paints or takes the next key: an arrow pressed straight after N still lands.
  useLayoutEffect(() => {
    const measure = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const above = rect.top > window.innerHeight / 2;
      const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setPlace(above
        ? { left, width, bottom: window.innerHeight - rect.top + 8 }
        : { left, width, top: rect.bottom + 8 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [anchor]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      onClose();
      anchor.current?.focus();
    };
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || anchor.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [anchor, onClose]);

  // The first choice takes focus once the menu is placed, so it can be used from the keyboard.
  useLayoutEffect(() => {
    if (place) menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [Boolean(place)]); // eslint-disable-line react-hooks/exhaustive-deps

  // The arrow keys move between the choices: left and right, as they are laid out, and
  // up and down as well.
  const onMenuKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    const next = (at + step + items.length) % items.length;
    items[next]?.focus();
  };

  return createPortal(
    <div ref={menuRef} role="menu" aria-label="Create a tool" onKeyDown={onMenuKeyDown}
      className="placer-create-tool-menu"
      style={{ ...place, visibility: place ? 'visible' : 'hidden' }}>
      {TOOL_KINDS.map(({ category, label, hint, icon }) => {
        const kind = findCategory(category);
        return (
          <button key={category} role="menuitem" onClick={() => onChoose(category)}
            className="placer-create-tool-item">
            <span className="placer-create-tool-icon"
              style={{ background: kind?.colour?.c100, color: kind?.colour?.c900 }}>
              <Icon name={icon} size={24} stroke={2} />
            </span>
            <span className="placer-create-tool-label">{label}</span>
            <span className="placer-create-tool-description">{hint}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

export function SideNav({ view, onNavigate, onExplore, onCreateTool, showOrganisations = false, expanded = false }) {
  const [chosenCollapsed, setCollapsed] = useState(readCollapsed);
  const collapsed = chosenCollapsed && !expanded;

  // Create a tool's dropdown, which N opens too, for anyone signed in (the side nav
  // is only there for them) — never while something is being typed (lib/shortcuts.js).
  const [menuOpen, setMenuOpen] = useState(false);
  const createRef = useRef(null);
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!isNewProjectShortcut(e)) return;
      e.preventDefault();
      setMenuOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  const closeMenu = () => setMenuOpen(false);
  const chooseKind = (category) => {
    setMenuOpen(false);
    onCreateTool?.(category);
  };

  const toggle = () => {
    writeCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };

  const items = [
    // First, straight under Create a tool: the dashboard is home for a signed-in account.
    { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'home', onSelect: () => onNavigate('dashboard'), active: ['dashboard', 'activity'] },
    { key: 'projects', label: 'Projects', icon: 'grid', onSelect: () => onNavigate('projects'), active: ['projects', 'projectDashboard'] },
    { key: 'settings', label: 'Settings', icon: 'gear', onSelect: () => onNavigate('settings'), active: ['settings'], bottom: true },
  ];

  // The small links: Explore, then Organisations — only for an account that runs at
  // least one, since until then there is nothing to go back to and creating one starts
  // from Settings — then the ones that only open a view.
  const smallLinks = [
    { key: 'map', label: 'Explore', onSelect: onExplore, active: ['map'] },
    ...(showOrganisations ? [{ key: 'organisations', label: 'Organisations', onSelect: () => onNavigate('organisations'),
      active: ['organisations', 'organisationNew', 'organisationDashboard'] }] : []),
    ...SMALL_LINKS.map(({ key, label, view: target }) => ({ key, label, onSelect: () => onNavigate(target), active: [target] })),
  ];

  const renderItem = (item) => {
    const current = item.active.includes(view);
    return (
      <button
        key={item.key}
        onClick={item.onSelect}
        aria-label={item.label}
        aria-current={current ? 'page' : undefined}
        data-tour={item.key}
        title={item.label}
        className={`placer-side-nav-link${item.bottom ? ' placer-side-nav-bottom' : ''}`}
      >
        <Icon name={item.icon} size={20} stroke={2} />
        <NavLabel label={item.label} short={item.short} />
      </button>
    );
  };

  return (
    <nav aria-label="App" className={`placer-side-nav${collapsed ? ' is-collapsed' : ''}`}
    >
      <button
        onClick={toggle}
        aria-label={collapsed ? 'Expand side nav' : 'Collapse side nav'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand' : 'Collapse'}
        className="placer-side-nav-link placer-side-nav-toggle"
      >
        <Icon name={collapsed ? 'chevRight' : 'chevLeft'} size={20} stroke={2} />
      </button>

      <button
        ref={createRef}
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Create a tool"
        aria-keyshortcuts="N"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-tour="createTool"
        title="Create a tool (N)"
        className="placer-side-nav-link placer-side-nav-primary"
      >
        <Icon name="plus" size={20} stroke={2.2} />
        <NavLabel label="Create a tool" short="Create" />
      </button>
      {menuOpen && <CreateToolMenu anchor={createRef} onChoose={chooseKind} onClose={closeMenu} />}

      {items.filter((item) => !item.bottom).map(renderItem)}

      <ul className="placer-side-nav-small">
        {smallLinks.map((link) => (
          <li key={link.key}>
            <button onClick={link.onSelect}
              aria-current={link.active.includes(view) ? 'page' : undefined}
              data-tour={link.key}
              className="placer-side-nav-small-link">
              {link.label}
            </button>
          </li>
        ))}
      </ul>

      {items.filter((item) => item.bottom).map(renderItem)}
    </nav>
  );
}

export default SideNav;
