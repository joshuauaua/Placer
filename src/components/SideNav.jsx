/* PLACER — the side nav, down the left edge for anyone who is signed in.
 *
 * The places someone with an account goes back to: their dashboard, the map, their
 * projects, their organisations (once they run one) and the Toolkit, under a primary button for starting a new project,
 * with their settings apart from the rest at the bottom. It sits under the glass
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

import { useState } from 'react';
import { Icon } from './Icon';

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

export function SideNav({ view, onNavigate, onExplore, onNewProject, showOrganisations = false }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    setCollapsed((was) => {
      writeCollapsed(!was);
      return !was;
    });
  };

  const items = [
    // First, straight under New project: the dashboard is home for a signed-in account.
    { key: 'dashboard', label: 'Dashboard', icon: 'user', onSelect: () => onNavigate('dashboard'), active: ['dashboard'] },
    { key: 'map', label: 'Explore', icon: 'pin', onSelect: onExplore, active: ['map'] },
    { key: 'projects', label: 'Projects', icon: 'grid', onSelect: () => onNavigate('projects'), active: ['projects', 'projectDashboard'] },
    // Only for an account that runs at least one organisation — until then there is
    // nothing to go back to, and creating one starts from Settings.
    ...(showOrganisations ? [{ key: 'organisations', label: 'Organisations', icon: 'building',
      onSelect: () => onNavigate('organisations'), active: ['organisations', 'organisationNew', 'organisationDashboard'] }] : []),
    { key: 'toolkit', label: 'Toolkit', icon: 'flask', onSelect: () => onNavigate('toolkit'), active: ['toolkit'] },
    { key: 'settings', label: 'Settings', icon: 'gear', onSelect: () => onNavigate('settings'), active: ['settings'], bottom: true },
  ];

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
        onClick={onNewProject}
        aria-label="New project"
        aria-current={view === 'projectNew' ? 'page' : undefined}
        title="New project"
        className="placer-side-nav-link placer-side-nav-primary"
      >
        <Icon name="plus" size={20} stroke={2.2} />
        <span className="placer-side-nav-label">New project</span>
      </button>

      {items.map((item) => {
        const current = item.active.includes(view);
        return (
          <button
            key={item.key}
            onClick={item.onSelect}
            aria-label={item.label}
            aria-current={current ? 'page' : undefined}
            title={item.label}
            className={`placer-side-nav-link${item.bottom ? ' placer-side-nav-bottom' : ''}`}
          >
            <Icon name={item.icon} size={20} stroke={2} />
            <span className="placer-side-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default SideNav;
