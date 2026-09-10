/* PLACER — your profile: what you have posted, and how it has landed */

import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, Btn, CatTag, Vote } from './UI';
import { fetchImaginations } from '../services/api';

const sum = (items, field) => items.reduce((total, item) => total + (item[field] || 0), 0);

// Local to this page, the way AdminDashboard keeps its own StatCard: the house
// convention here is to duplicate a small presentational helper rather than push
// it into UI.jsx.
function StatCard({ t, icon, label, value }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
      padding: 24, boxShadow: t.shadow }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: t.accent + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name={icon} size={24} stroke={2} style={{ color: t.accent }} />
      </div>
      <div className="placer-disp" style={{ fontSize: 32, fontWeight: 900, color: t.ink, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function ImaginationCard({ t, imagination }) {
  const { title, cat, blurb, loc, preview, votes = 0, comments = 0 } = imagination;

  return (
    <article
      style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
        overflow: 'hidden', boxShadow: t.shadow, transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = t.shadow;
      }}>
      {preview && (
        <img src={preview} alt={`Preview of ${title || 'this imagination'}`}
          style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 20, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cat && <div style={{ marginBottom: 10 }}><CatTag cat={cat} t={t} size="sm" /></div>}
          <h3 style={{ fontSize: 20, fontWeight: 700, color: t.ink, lineHeight: 1.3, marginBottom: 6 }}>
            {title || 'Untitled imagination'}
          </h3>
          {blurb && (
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: 10,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {blurb}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: t.inkDim }}>
            {loc && <span>{loc}</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="comment" size={14} stroke={2.1} />
              {comments}
            </span>
          </div>
        </div>
        <Vote t={t} count={votes} size="sm" />
      </div>
    </article>
  );
}

export function ProfilePage({ t, profile, onNavigate }) {
  const [imaginations, setImaginations] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;

    fetchImaginations()
      .then((saved) => {
        if (cancelled) return;
        setImaginations(saved);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load imaginations:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, []);

  const name = profile?.name ?? '';
  // Author is a plain string on a saved imagination, so this is all the ownership
  // there is to go on until accounts have ids.
  const mine = useMemo(
    () => imaginations.filter((imagination) => imagination.author === name),
    [imaginations, name],
  );

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
          <Avatar name={name} size={72} ring={t.line} />
          <div>
            <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 8 }}>
              Profile
            </h1>
            <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6 }}>
              Posting as <strong style={{ color: t.ink }}>{name}</strong>.{' '}
              <span
                onClick={() => onNavigate('settings')}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('settings'); }}
                style={{ color: t.ink, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                Change your name
              </span>
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20, marginBottom: 40 }}>
          <StatCard t={t} icon="grid" label="Imaginations posted" value={mine.length} />
          <StatCard t={t} icon="arrowUp" label="Votes received" value={sum(mine, 'votes')} />
          <StatCard t={t} icon="comment" label="Comments received" value={sum(mine, 'comments')} />
        </div>

        <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 900, color: t.ink,
          letterSpacing: '-0.02em', marginBottom: 20 }}>
          My imaginations
        </h2>

        {status === 'loading' && (
          <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>Loading imaginations…</div>
        )}

        {status === 'error' && (
          <div role="alert" style={{ padding: 16, borderRadius: 8, background: '#D6452F22',
            borderLeft: '4px solid #D6452F', fontSize: 14, fontWeight: 600, color: t.ink }}>
            Could not load your imaginations. See the console for details.
          </div>
        )}

        {status === 'ready' && mine.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12 }}>
            <Icon name="sparkle" size={30} stroke={1.9} style={{ color: t.inkFaint, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 6 }}>
              Nothing posted yet
            </div>
            <div style={{ fontSize: 14, color: t.inkDim, marginBottom: 20 }}>
              Find a street on the map, draw what it could be, and it shows up here.
            </div>
            <Btn t={t} variant="accent" icon="sparkle" onClick={() => onNavigate('map')}>
              Start imagining
            </Btn>
          </div>
        )}

        {status === 'ready' && mine.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 24, paddingBottom: 40 }}>
            {mine.map((imagination) => (
              <ImaginationCard key={imagination.id} t={t} imagination={imagination} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
