/* PLACER — what this account follows, on the dashboard: people, organisations and
 * projects, each a link to its public page.
 *
 * Names are the ones snapshotted when each was followed (services/follows.js), so a
 * renamed organisation keeps its old name here until it is unfollowed and followed
 * again. Following happens on the public pages themselves (FollowButton).
 */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { readFollows } from '../services/follows';

const GROUPS = [
  { type: 'user', label: 'People', icon: 'user', href: (id) => `/people/${id}` },
  { type: 'organisation', label: 'Organisations', icon: 'building', href: (id) => `/organisations/${id}` },
  { type: 'project', label: 'Projects', icon: 'grid', href: (id) => `/projects/${id}` },
];

export function FollowingList({ t, onOpen }) {
  const [follows, setFollows] = useState(null); // { user: [], organisation: [], project: [] } | null
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(GROUPS.map(({ type }) => readFollows(type)))
      .then((lists) => {
        if (cancelled) return;
        setFollows(Object.fromEntries(GROUPS.map(({ type }, i) => [type, lists[i]])));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load what you follow:', err);
        setFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

  const heading = (
    <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
      letterSpacing: '-0.02em', marginBottom: 16 }}>
      Following
    </h2>
  );

  if (failed) {
    return (
      <section style={{ marginBottom: 48 }}>
        {heading}
        <p role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
          Could not load what you follow. Try again in a moment.
        </p>
      </section>
    );
  }

  if (!follows) return null;

  const total = GROUPS.reduce((sum, { type }) => sum + follows[type].length, 0);

  return (
    <section style={{ marginBottom: 48 }} aria-labelledby="following-heading">
      <h2 id="following-heading" className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
        letterSpacing: '-0.02em', marginBottom: 16 }}>
        Following
      </h2>
      {total === 0 ? (
        <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6 }}>
          Nothing yet. Use Follow on a person&rsquo;s, an organisation&rsquo;s or a project&rsquo;s
          page to keep up with them here.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {GROUPS.filter(({ type }) => follows[type].length > 0).map(({ type, label, icon, href }) => (
            <div key={type} style={{ padding: 20, background: t.surface, border: `1px solid ${t.line}`,
              borderRadius: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: t.inkDim, marginBottom: 8 }}>{label}</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {follows[type].map((entry) => (
                  <li key={entry.id}>
                    <a href={href(entry.targetId)}
                      onClick={(e) => { e.preventDefault(); onOpen?.(type, entry.targetId); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                        fontSize: 15, fontWeight: 700, color: t.ink, textDecoration: 'none' }}>
                      <Icon name={icon} size={16} stroke={2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.label}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default FollowingList;
