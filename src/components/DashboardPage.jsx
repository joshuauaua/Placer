/* PLACER — your dashboard: shortcuts to what to do next */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ImaginationCard } from './ImaginationCard';
import { ImaginationPreview } from './ImaginationPreview';
import { postsAreShared, readLocalImaginations } from '../services/imaginations';
import { CHARACTER } from '../theme';

// One of the three things the dashboard offers to do next, as a card-sized button.
/** A Quick Actions card: a grey tile with the icon above the label, both centred. */
function Shortcut({ t, icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="placer-quick-action"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, minHeight: 160, padding: 24, textAlign: 'center', background: t.surfaceAlt,
        border: 'none', borderRadius: 16, cursor: 'pointer',
        fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 700, color: t.ink }}>
      <Icon name={icon} size={30} stroke={2} />
      {label}
    </button>
  );
}

/** A section's heading, set as a small label above its cards. */
function SectionLabel({ t, id, children }) {
  return (
    <h2 id={id} className="placer-caption" style={{ textTransform: 'uppercase',
      letterSpacing: '0.08em', fontWeight: 700, color: t.inkDim, marginBottom: 12 }}>
      {children}
    </h2>
  );
}

/**
 * A large card with a gradient between two of the three brand colours, a small
 * label over a bold line, and an arrow. The colours are the 300 steps, which ink
 * reads well on from one end to the other.
 */
function BasicsCard({ t, from, to, label, title, onClick }) {
  return (
    <button type="button" onClick={onClick} className="placer-basics-card"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32,
        minHeight: 200, padding: 28, textAlign: 'left', cursor: 'pointer', border: 'none', borderRadius: 16,
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, color: t.ink,
        fontFamily: 'var(--placer-font)' }}>
      <span>
        <span className="placer-caption" style={{ display: 'block', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
          {label}
        </span>
        <span className="placer-disp" style={{ display: 'block', fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, maxWidth: 420 }}>
          {title}
        </span>
      </span>
      <Icon name="arrowRight" size={24} stroke={2.2} />
    </button>
  );
}

export function DashboardPage({ t, profile, accountId = null, onNavigate, onNewProject,
  onSignIn, onSignOut, onExplore, onOpenPublicProfile }) {
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
          gap: 16, flexWrap: 'wrap', marginBottom: 64 }}>
          {/* The heading and the profile link share a line, on their baselines, and the
              link drops under the heading when there is not room for both. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px 20px', flexWrap: 'wrap', minWidth: 0 }}>
            <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
              Welcome back, {name}
            </h1>
            {/* No account id in the local, no-project mode, and so no public page to go to. */}
            {accountId && onOpenPublicProfile && (
              <a href={`/people/${accountId}`}
                onClick={(e) => { e.preventDefault(); onOpenPublicProfile(accountId); }}
                style={{ fontSize: 16, color: t.ink, fontWeight: 500, textDecoration: 'underline' }}>
                View your public profile
              </a>
            )}
          </div>
          {onSignOut && (
            <Btn t={t} variant="outline" size="sm" icon="logout" onClick={onSignOut}>
              Log Out
            </Btn>
          )}
        </div>

        <section aria-labelledby="dashboard-basics" style={{ marginBottom: 48 }}>
          <SectionLabel t={t} id="dashboard-basics">Getting Started</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <BasicsCard t={t} from={CHARACTER.cityWorker.c300} to={CHARACTER.practitioner.c300}
              label="Quickstart tutorial" title="Create your first Project"
              onClick={() => onNavigate('quickstart')} />
            <BasicsCard t={t} from={CHARACTER.practitioner.c300} to={CHARACTER.citizen.c300}
              label="Project Examples" title="Explore what other projects exist on the platform"
              onClick={() => onNavigate('projectExamples')} />
          </div>
        </section>

        <section aria-labelledby="dashboard-quick-actions" style={{ marginBottom: 48 }}>
          <SectionLabel t={t} id="dashboard-quick-actions">Quick Actions</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Shortcut t={t} icon="pencil" label="Edit my profile" onClick={() => onNavigate('settings')} />
            <Shortcut t={t} icon="pin" label="Explore the map"
              onClick={() => (onExplore ? onExplore() : onNavigate('map'))} />
            {onNewProject && (
              <Shortcut t={t} icon="plus" label="Create a Project" onClick={onNewProject} />
            )}
          </div>
        </section>

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
