/* PLACER — the nav bar.
 *
 * The landingpage branch's "liquid glass" bar: a full-width strip across the
 * top with the wordmark on the left. It floats over the page, so what scrolls
 * underneath shows through the blur; MainApp pads its content area by the
 * bar's height so nothing starts out hidden behind it. The glass itself lives
 * in index.css (.placer-glass-nav).
 *
 * The right-hand end depends on who is there. Logged out, it is Create Account
 * and Log In and nothing else. Logged in, it is just the account menu — the side
 * nav and the footer carry the site links. While the session is still being read it stays empty,
 * rather than flashing the logged-out buttons at someone who is signed in.
 */

import { Btn } from './UI';
import { UserMenu } from './UserMenu';

export function GlassNavbar({ t, profile, loading, onNavigate, onSignIn, onCreateAccount, onSignOut }) {
  return (
    <header className="placer-glass-nav" style={{ color: t.ink }}>
      <button
        onClick={() => onNavigate('welcome')}
        aria-label="PLACER home"
        className="placer-glass-nav-logo placer-wordmark"
      >
        PLACER
      </button>

      <div className="placer-glass-nav-end">
        {loading ? null : profile ? (
          <UserMenu t={t} profile={profile} onNavigate={onNavigate} onSignIn={onSignIn} onSignOut={onSignOut} />
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
