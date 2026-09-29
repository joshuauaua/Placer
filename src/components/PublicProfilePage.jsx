/* PLACER — somebody's public profile, at /people/<account id>.
 *
 * What anyone may see of an account: the display name, profile photo, bio and
 * location it chose to fill in. Needs no
 * session, the same as a project's public page — a profile link is something to
 * share. The profile comes from profile_public() (supabase/profiles-public.sql),
 * because the profiles table itself is readable only by its owner.
 */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, LoadingMark } from './UI';
import { ACCOUNT_TYPES, isSupabaseConfigured, readPublicProfile } from '../services/auth';

export function PublicProfilePage({ t, userId, accountId = null }) {
  const [person, setPerson] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'notFound' | 'error'

  useEffect(() => {
    // No Supabase project, no accounts — and so nobody to have a profile.
    if (!isSupabaseConfigured()) {
      setStatus('notFound');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    readPublicProfile(userId)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setStatus('notFound');
          return;
        }
        setPerson(found);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // An id that is not a uuid at all is refused by the database as malformed,
        // which to whoever followed the link is the same as no such person.
        if (/invalid input syntax for type uuid/i.test(err?.message ?? '')) {
          setStatus('notFound');
          return;
        }
        console.error('Could not load this profile:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [userId]);

  const shell = (children) => (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
    </div>
  );

  if (status === 'loading') {
    return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><LoadingMark /></div>;
  }

  if (status === 'notFound') {
    return shell(
      <div style={{ textAlign: 'center', padding: 48 }}>
        <h1 style={{ color: t.ink, marginBottom: 8 }}>Profile not found</h1>
        <p style={{ fontSize: 16, color: t.inkDim }}>The link may be wrong, or the account may have been removed.</p>
      </div>
    );
  }

  if (status === 'error') {
    return shell(
      <div role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
        Could not load this profile. Try again in a moment.
      </div>
    );
  }

  const isYou = accountId && accountId === person.id;
  const accountType = ACCOUNT_TYPES.find(({ key }) => key === person.accountType)?.label ?? 'Individual';
  // The address as people read it, without the https:// or a trailing slash.
  const websiteLabel = person.website.replace(/^https?:\/\//i, '').replace(/\/$/, '');

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page }}
      className="placer-scroll">
      {/* The cover, edge to edge, with the name and location on it. Without a cover it
        * is a plain grey band, and the text is ink rather than white. */}
      <header className={`placer-profile-cover${person.cover ? ' placer-profile-cover-image' : ''}`}
        style={person.cover
          ? { backgroundImage: `url("${person.cover}")` }
          : { background: t.surfaceAlt }}>
        <div className="placer-profile-cover-inner"
          style={{ color: person.cover ? '#FFFFFF' : t.ink }}>
          <Avatar name={person.name} photo={person.photo} size={72}
            ring={person.cover ? '#FFFFFF' : t.line} />
          <div style={{ minWidth: 0 }}>
            <h1 className="placer-disp placer-profile-title">{person.name}</h1>
            {person.location && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 500,
                marginTop: 6, opacity: 0.92 }}>
                <Icon name="pin" size={16} stroke={2.1} />
                {person.location}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="placer-profile-body">
        <aside className="placer-profile-details">
          <section style={{ padding: 24, background: t.surface, border: `1px solid ${t.line}`,
            borderRadius: 12, boxShadow: t.shadow }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 16 }}>Details</h2>
            <dl className="placer-profile-dl">
              <dt style={{ color: t.inkFaint }}>Name</dt>
              <dd style={{ color: t.ink }}>{person.name}</dd>
              <dt style={{ color: t.inkFaint }}>Account type</dt>
              <dd style={{ color: t.ink }}>{accountType}</dd>
              <dt style={{ color: t.inkFaint }}>Email</dt>
              <dd style={{ color: t.ink }}>
                {person.contactEmail
                  ? <a href={`mailto:${person.contactEmail}`} style={{ color: t.ink }}>{person.contactEmail}</a>
                  : <span style={{ color: t.inkFaint }}>Not shared</span>}
              </dd>
              <dt style={{ color: t.inkFaint }}>Website</dt>
              <dd style={{ color: t.ink }}>
                {person.website
                  ? <a href={person.website} target="_blank" rel="noopener noreferrer nofollow"
                      style={{ color: t.ink }}>{websiteLabel}</a>
                  : <span style={{ color: t.inkFaint }}>Not shared</span>}
              </dd>
            </dl>
          </section>
        </aside>

        <main className="placer-profile-main">
          <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.02em', marginBottom: 12 }}>
            About
          </h2>
          <p style={{ fontSize: 16, color: person.bio ? t.inkDim : t.inkFaint, lineHeight: 1.7,
            maxWidth: 680, whiteSpace: 'pre-line' }}>
            {person.bio || (isYou ? 'You have not written a bio yet. Add one in Settings.' : 'No bio yet.')}
          </p>
        </main>
      </div>
    </div>
  );
}

export default PublicProfilePage;
