/* PLACER — your dashboard: shortcuts to what to do next */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ImaginationCard } from './ImaginationCard';
import { ImaginationPreview } from './ImaginationPreview';
import { FollowingList } from './FollowingList';
import { postsAreShared, readLocalImaginations } from '../services/imaginations';

// One of the three things the dashboard offers to do next, as a card-sized button.
function Shortcut({ t, icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="placer-btn placer-btn-secondary"
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 20, textAlign: 'left',
        background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, cursor: 'pointer',
        fontFamily: 'var(--placer-font)', fontSize: 16, fontWeight: 700, color: t.ink }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: t.surfaceAlt, flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} stroke={2} />
      </span>
      {label}
    </button>
  );
}

export function DashboardPage({ t, profile, accountId = null, onNavigate, onNewProject,
  onSignIn, onSignOut, onExplore, onOpenPublicProfile, onOpenFollowed }) {
  // The imagination open in the modal, if any — set from any card on this page.
  const [selected, setSelected] = useState(null);
  // Imaginations still only in this browser, made before there were accounts: nobody
  // else can see them. Only a separate store where a project is configured — without
  // one, the local store is the only store and there is nothing to set apart.
  const [onlyHere, setOnlyHere] = useState([]);

  const shared = postsAreShared();

  useEffect(() => {
    if (!shared) return undefined;

    let cancelled = false;

    readLocalImaginations()
      .then((local) => {
        if (!cancelled) setOnlyHere(local);
      })
      .catch((err) => {
        if (!cancelled) console.error('Could not load imaginations saved on this device:', err);
      });

    return () => { cancelled = true; };
  }, [shared]);

  // Escape closes the modal, matching the map's own Escape behaviour.
  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const name = profile?.name ?? '';

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '96px 40px 48px' }} className="placer-scroll">
      {selected && (
        <ImaginationPreview t={t} imagination={selected} onClose={() => setSelected(null)}
          accountId={accountId} authorName={name} onSignIn={onSignIn}
          onDeleted={(id) => {
            setOnlyHere((current) => current.filter((item) => item.id !== id));
            setSelected(null);
          }} />
      )}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.03em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            Welcome back, {name}
          </h1>
          {onSignOut && (
            <Btn t={t} variant="outline" size="sm" icon="logout" onClick={onSignOut}>
              Log Out
            </Btn>
          )}
        </div>

        <div style={{ marginTop: -20, marginBottom: 32 }}>
          {/* No account id in the local, no-project mode, and so no public page to go to. */}
          {accountId && onOpenPublicProfile && (
            <a href={`/people/${accountId}`}
              onClick={(e) => { e.preventDefault(); onOpenPublicProfile(accountId); }}
              style={{ fontSize: 16, color: t.ink, fontWeight: 500, textDecoration: 'underline' }}>
              View your public profile
            </a>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16, marginBottom: 48 }}>
          <Shortcut t={t} icon="pencil" label="Edit my profile" onClick={() => onNavigate('settings')} />
          <Shortcut t={t} icon="pin" label="Explore the map"
            onClick={() => (onExplore ? onExplore() : onNavigate('map'))} />
          {onNewProject && (
            <Shortcut t={t} icon="plus" label="Create a Project" onClick={onNewProject} />
          )}
        </div>

        {/* People and organisations only have pages with an account behind them, so in
            the local, no-project mode there is nothing to have followed. */}
        {accountId && onOpenFollowed && <FollowingList t={t} onOpen={onOpenFollowed} />}

        {/* Anything made before there were accounts. Left where it is rather than uploaded:
            it was made under a privacy policy that said it would never leave the device,
            and publishing it to a shared map without being asked would break that. */}
        {shared && onlyHere.length > 0 && (
          <>
            <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.02em', marginBottom: 8 }}>
              Saved on this device
            </h2>
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
              Made before you had an account, so they live in this browser and nobody else
              can see them. They stay here until you clear your browsing data — they are not
              on the community map, and nothing has been uploaded.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 24, paddingBottom: 40 }}>
              {onlyHere.map((imagination) => (
                <ImaginationCard key={imagination.id} t={t} imagination={imagination} onOpen={setSelected} />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default DashboardPage;
