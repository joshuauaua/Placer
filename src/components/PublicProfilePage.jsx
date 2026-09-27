/* PLACER — somebody's public profile, at /people/<account id>.
 *
 * What anyone may see of an account: the display name, avatar icon, bio and
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
import { isSupabaseConfigured, readPublicProfile } from '../services/auth';
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

  return shell(
    <>
      {selected && (
        <ImaginationPreview t={t} imagination={selected} onClose={() => setSelected(null)}
          accountId={accountId} authorName={authorName} onSignIn={onSignIn} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 48 }}>
        <Avatar name={person.name} icon={person.avatar} size={72} ring={t.line} />
        <div>
          <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.03em', marginBottom: 8 }}>
            {person.name}
          </h1>
          {isYou && (
            <p style={{ fontSize: 14.5, color: t.inkDim, fontWeight: 500, marginBottom: 6 }}>
              This is how others see your profile.
            </p>
          )}
          {person.location && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5,
              color: t.inkDim, fontWeight: 500, marginTop: 6 }}>
              <Icon name="pin" size={15} stroke={2.1} />
              {person.location}
            </p>
          )}
          {person.bio && (
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginTop: 10, maxWidth: 560 }}>
              {person.bio}
            </p>
          )}
        </div>
      </div>

      <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
        letterSpacing: '-0.02em', marginBottom: 20 }}>
        Imaginations
      </h2>

      {imaginations.length === 0 ? (
        <p style={{ fontSize: 15, color: t.inkDim }}>
          {isYou ? 'You have not posted anything yet.' : 'Nothing posted yet.'}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {imaginations.map((imagination) => (
            <ImaginationCard key={imagination.id} t={t} imagination={imagination} onOpen={setSelected} />
          ))}
        </div>
      )}
    </>
  );
}

export default PublicProfilePage;
