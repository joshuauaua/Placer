/* PLACER — the list behind a profile's Followers and Following counts.
 *
 * A dialog over the profile, with a tab for each list. Followers are always people;
 * Following is people, organisations and projects. Each row opens that page. Escape,
 * the close button or a click outside the panel closes it.
 */

import { useEffect, useRef, useState } from 'react';
import { Avatar, LoadingMark } from './UI';
import { Icon } from './Icon';
import { readFollowers, readFollowing } from '../services/follows';

const TABS = [
  { key: 'followers', label: 'Followers', read: readFollowers },
  { key: 'following', label: 'Following', read: readFollowing },
];

const KIND_LABELS = { user: 'Person', organisation: 'Organisation', project: 'Project' };

function Thumbnail({ t, entry }) {
  if (entry.type === 'user') return <Avatar name={entry.name} photo={entry.image} size={40} />;
  return (
    <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, flex: '0 0 auto',
      background: entry.image ? `center / cover no-repeat url("${entry.image}")` : t.surfaceAlt,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkDim }}>
      {!entry.image && <Icon name={entry.type === 'organisation' ? 'building' : 'grid'} size={18} stroke={2} />}
    </span>
  );
}

export function FollowListDialog({ t, userId, name, initialTab = 'followers', onOpen, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [lists, setLists] = useState({}); // tab key -> entries, once loaded
  const [failed, setFailed] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (lists[tab]) return undefined;
    let cancelled = false;
    setFailed(null);
    TABS.find(({ key }) => key === tab).read(userId)
      .then((entries) => { if (!cancelled) setLists((current) => ({ ...current, [tab]: entries })); })
      .catch((err) => {
        if (cancelled) return;
        console.error(`Could not load ${tab}:`, err);
        setFailed(tab);
      });
    return () => { cancelled = true; };
  }, [tab, userId, lists]);

  useEffect(() => {
    panelRef.current?.focus();
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const entries = lists[tab];
  const empty = tab === 'followers' ? `Nobody follows ${name} yet.` : `${name} does not follow anything yet.`;

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${name}: followers and following`}
        tabIndex={-1}
        style={{ width: '100%', maxWidth: 440, maxHeight: 'min(80vh, 640px)', display: 'flex',
          flexDirection: 'column', background: t.surface, borderRadius: 16, boxShadow: t.shadow,
          outline: 'none', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 0 16px',
          borderBottom: `1px solid ${t.line}` }}>
          <div role="tablist" aria-label="Lists" style={{ display: 'flex', gap: 4, flex: 1 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key}
                onClick={() => setTab(key)}
                style={{ padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: tab === key ? 700 : 500,
                  color: tab === key ? t.ink : t.inkDim,
                  boxShadow: tab === key ? `inset 0 -2px 0 ${t.ink}` : 'none' }}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'none',
              cursor: 'pointer', color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} stroke={2} />
          </button>
        </div>

        <div role="tabpanel" aria-label={TABS.find(({ key }) => key === tab).label}
          style={{ overflowY: 'auto', padding: '8px 0' }}>
          {failed === tab && (
            <p role="alert" style={{ padding: '12px 16px', fontSize: 14, color: t.ink }}>
              Could not load this list. Try again in a moment.
            </p>
          )}
          {!entries && failed !== tab && (
            <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><LoadingMark size={40} /></div>
          )}
          {entries && entries.length === 0 && (
            <p style={{ padding: '12px 16px', fontSize: 14, color: t.inkDim }}>{empty}</p>
          )}
          {entries && entries.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {entries.map((entry) => (
                <li key={`${entry.type}-${entry.id}`}>
                  <button type="button" onClick={() => { onClose(); onOpen?.(entry.type, entry.id); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 16px',
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'var(--placer-font)', color: t.ink }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
                    <Thumbnail t={t} entry={entry} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.name}
                      </span>
                      {tab === 'following' && (
                        <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim }}>
                          {KIND_LABELS[entry.type]}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default FollowListDialog;
