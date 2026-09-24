/* PLACER — the account menu at the right-hand end of the nav bar */

import { useEffect, useRef, useState } from 'react';
import { Avatar, Btn } from './UI';
import { Icon } from './Icon';

function MenuItem({ t, icon, label, onClick, divided }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 14px', background: 'transparent', color: t.ink, cursor: 'pointer',
        border: 'none', borderTop: divided ? `1px solid ${t.line}` : 'none',
        fontFamily: 'var(--placer-font)', fontWeight: 600, fontSize: 14.5,
        letterSpacing: '-0.01em', textAlign: 'left' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <Icon name={icon} size={17} stroke={2} />
      {label}
    </button>
  );
}

/**
 * The avatar, the display name, and a dropdown holding Dashboard, Settings and
 * Log out. Logged out, it is a Sign in button and nothing else: an avatar with
 * nobody behind it invited a click that went nowhere.
 *
 * This is the app's first dropdown, so the dismissal it uses is the same shape as
 * the Escape handling around the map preview (MapContainer): a guarded effect that
 * adds window listeners and tears them down again.
 */
export function UserMenu({ t, profile, onNavigate, onSignIn, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    // mousedown rather than click, so the menu is already gone by the time a
    // click lands on whatever is underneath it.
    const handlePointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  if (!profile) {
    return <Btn t={t} variant="outline" onClick={onSignIn}>Sign in</Btn>;
  }

  const go = (view) => () => {
    setOpen(false);
    onNavigate(view);
  };

  return (
    // The nav row itself is not positioned, so the panel is anchored here.
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        aria-label={`Account menu — ${profile.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 4px',
          background: 'transparent', border: 'none', borderRadius: 999, cursor: 'pointer',
          color: t.ink, fontFamily: 'var(--placer-font)', fontWeight: 600, fontSize: 14.5,
          letterSpacing: '-0.01em' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <Avatar name={profile.name} icon={profile.avatar} size={40} ring={t.line} />
        <Icon name={open ? 'chevUp' : 'chevDown'} size={16} stroke={2.2} style={{ color: t.inkDim }} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          // Above the nav bar's own 60, below the cookie banner's 200.
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 70,
            minWidth: 190, padding: '6px 0', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12, boxShadow: t.shadow,
            overflow: 'hidden' }}>
          <MenuItem t={t} icon="user" label="Dashboard" onClick={go('dashboard')} />
          <MenuItem t={t} icon="gear" label="Settings" onClick={go('settings')} />
          <MenuItem t={t} icon="logout" label="Log out" divided onClick={() => { setOpen(false); onSignOut(); }} />
        </div>
      )}
    </div>
  );
}

export default UserMenu;
