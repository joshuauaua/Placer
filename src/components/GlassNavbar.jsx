/* PLACER — the nav bar.
 *
 * The landingpage branch's "liquid glass" bar: a full-width strip across the
 * top with the wordmark on the left. It floats over the page, so what scrolls
 * underneath shows through the blur; MainApp pads its content area by the
 * bar's height so nothing starts out hidden behind it. The glass itself lives
 * in index.css (.placer-glass-nav).
 *
 * The right-hand end depends on who is there. Logged out, it is Create Account
 * and Log In and nothing else. Logged in, it is notifications, the account menu
 * and the site menu. While the session is still being read it stays empty,
 * rather than flashing the logged-out buttons at someone who is signed in.
 */

import { Btn } from './UI';
import { HamburgerMenu } from './HamburgerMenu';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

export function GlassNavbar({ t, view, profile, loading, onNavigate, onExplore, onSignIn,
  onCreateAccount, onSignOut, onOpenProject }) {
  const siteItems = [
    { key: 'about', label: 'About', onSelect: () => onNavigate('about') },
    { key: 'resources', label: 'Resources', onSelect: () => onNavigate('resources') },
    { key: 'sandbox', label: 'Sandbox', onSelect: () => onNavigate('sandbox') },
    { key: 'map', label: 'Explore', onSelect: onExplore },
  ];

  return (
    <header className="placer-glass-nav" style={{ color: t.ink }}>
      <button
        onClick={() => onNavigate('welcome')}
        aria-label="PLACER home"
        className="placer-glass-nav-logo placer-disp"
      >
        PLACER
      </button>

      <div className="placer-glass-nav-end">
        {loading ? null : profile ? (
          <>
            <NotificationBell t={t} enabled onOpenProject={onOpenProject} />
            <UserMenu t={t} profile={profile} onNavigate={onNavigate} onSignIn={onSignIn} onSignOut={onSignOut} />
            <HamburgerMenu t={t} view={view} items={siteItems} />
          </>
        ) : (
          <>
            <Btn t={t} variant="primary" size="sm" onClick={onCreateAccount}>Create Account</Btn>
            <Btn t={t} variant="outline" size="sm" onClick={onSignIn}>Log In</Btn>
          </>
        )}
      </div>
    </header>
  );
}

export default GlassNavbar;
