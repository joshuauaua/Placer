/* PLACER — the side nav, down the left edge for anyone who is signed in.
 *
 * The places someone with an account goes back to: the map, the Sandbox, their
 * profile, a new project and their settings. It sits under the glass nav bar
 * rather than beside it, so the bar still spans the full width. Below 760px it
 * narrows to a rail of icons, with each label kept as the button's accessible
 * name. Styling lives in index.css (.placer-side-nav).
 *
 * Each item is { key, label, icon, onSelect, active }. `active` is a list of views,
 * because some places own more than one — a project's dashboard is reached from the
 * profile, so the profile stays marked while it is open.
 */

import { Icon } from './Icon';

export function SideNav({ t, view, onNavigate, onExplore, onNewProject }) {
  const items = [
    { key: 'map', label: 'Explore', icon: 'pin', onSelect: onExplore, active: ['map'] },
    { key: 'sandbox', label: 'Sandbox', icon: 'flask', onSelect: () => onNavigate('sandbox'), active: ['sandbox'] },
    { key: 'profile', label: 'Profile', icon: 'user', onSelect: () => onNavigate('profile'), active: ['profile', 'projectDashboard'] },
    { key: 'projectNew', label: 'New project', icon: 'plus', onSelect: onNewProject, active: ['projectNew'] },
    { key: 'settings', label: 'Settings', icon: 'gear', onSelect: () => onNavigate('settings'), active: ['settings'] },
  ];

  return (
    <nav aria-label="App" className="placer-side-nav" style={{ background: t.chrome, borderRight: `1px solid ${t.line}` }}>
      {items.map((item) => {
        const current = item.active.includes(view);
        return (
          <button
            key={item.key}
            onClick={item.onSelect}
            aria-label={item.label}
            aria-current={current ? 'page' : undefined}
            title={item.label}
            className="placer-side-nav-link"
            style={{ color: current ? t.ink : t.inkDim, fontWeight: current ? 700 : 600,
              background: current ? t.surfaceAlt : undefined }}
          >
            <Icon name={item.icon} size={19} stroke={2} />
            <span className="placer-side-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default SideNav;
