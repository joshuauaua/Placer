/* PLACER — the nav bar.
 *
 * The landingpage branch's "liquid glass" bar: a full-width strip across the
 * top with the wordmark on the left. It floats over the page, so what scrolls
 * underneath shows through the blur; MainApp pads its content area by the
 * bar's height so nothing starts out hidden behind it. The glass itself lives
 * in index.css (.placer-glass-nav).
 *
 * The right-hand end depends on who is there. Logged out, it is Log In and
 * Create Account and nothing else. Logged in, it is the search box and the account menu
 * — the side nav and the footer carry the site links. The search box needs a
 * Supabase project to search, so without one it is left out. While the session is still being read it stays empty,
 * rather than flashing the logged-out buttons at someone who is signed in.
 */

import { BrandLogo, Btn } from './UI';
import { UserMenu } from './UserMenu';
import { NavSearch } from './NavSearch';
import { isSupabaseConfigured } from '../services/search';

export function GlassNavbar({ t, profile, loading, onNavigate, onSignIn, onCreateAccount, onSignOut,
  onSearchSelect }) {
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
        {loading ? null : profile ? (
          <>
            {onSearchSelect && isSupabaseConfigured() && <NavSearch t={t} onSelect={onSearchSelect} />}
            <UserMenu t={t} profile={profile} onNavigate={onNavigate} onSignIn={onSignIn} onSignOut={onSignOut} />
          </>
        ) : (
          <>
            <Btn t={t} variant="outline" size="sm" onClick={onSignIn}>Log In</Btn>
            <Btn t={t} variant="primary" size="sm" onClick={onCreateAccount}>Create Account</Btn>
          </>
        )}
      </div>
    </header>
  );
}

export default GlassNavbar;
