/* PLACER — somebody's public profile, at /people/<account id>.
 *
 * What anyone may see of an account: the display name, profile photo, bio and
 * location it chose to fill in, and everything it has posted to the map. Needs no
 * session, the same as a project's public page — a profile link is something to
 * share. The profile comes from profile_public() (supabase/profiles-public.sql),
 * because the profiles table itself is readable only by its owner.
 */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, LoadingMark } from './UI';
import { ImaginationCard } from './ImaginationCard';
import { ImaginationPreview } from './ImaginationPreview';
import { ACCOUNT_TYPES, isSupabaseConfigured, readPublicProfile } from '../services/auth';
import { readImaginationsByUser } from '../services/imaginations';

export function PublicProfilePage({ t, userId, accountId = null, authorName, onSignIn }) {
  const [person, setPerson] = useState(null);
  const [imaginations, setImaginations] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'notFound' | 'error'
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // No Supabase project, no accounts — and so nobody to have a profile.
    if (!isSupabaseConfigured()) {
      setStatus('notFound');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    Promise.all([readPublicProfile(userId), readImaginationsByUser(userId)])
      .then(([found, posted]) => {
        if (cancelled) return;
        if (!found) {
          setStatus('notFound');
          return;
        }
        setPerson(found);
        setImaginations(posted);
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

  // Escape closes the open imagination, matching the dashboard.
  useEffect(() => {
    if (!selected) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

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
      {selected && (
        <ImaginationPreview t={t} imagination={selected} onClose={() => setSelected(null)}
          accountId={accountId} authorName={authorName} onSignIn={onSignIn}
          onDeleted={(id) => {
            setImaginations((current) => current.filter((item) => item.id !== id));
            setSelected(null);
          }} />
      )}

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
          {isYou && (
            <p style={{ fontSize: 14.5, color: t.inkDim, fontWeight: 500, marginBottom: 16 }}>
              This is how others see your profile.
            </p>
          )}

          <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.02em', marginBottom: 12 }}>
            About
          </h2>
          <p style={{ fontSize: 16, color: person.bio ? t.inkDim : t.inkFaint, lineHeight: 1.7,
            marginBottom: 48, maxWidth: 680, whiteSpace: 'pre-line' }}>
            {person.bio || (isYou ? 'You have not written a bio yet. Add one in Settings.' : 'No bio yet.')}
          </p>

          <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.02em', marginBottom: 20 }}>
            Imaginations
          </h2>

          {imaginations.length === 0 ? (
            <p style={{ fontSize: 15, color: t.inkDim }}>
              {isYou ? 'You have not posted anything yet.' : 'Nothing posted yet.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {imaginations.map((imagination) => (
                <ImaginationCard key={imagination.id} t={t} imagination={imagination} onOpen={setSelected} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default PublicProfilePage;
