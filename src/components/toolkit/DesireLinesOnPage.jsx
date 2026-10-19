/* PLACER — Desire Lines on a project's page.
 *
 * The room an organiser opened for the project, set into its public page rather than
 * behind a link: the sites they chose, a map of each to draw the walks you really make
 * on, and Send. The room is the project's (services/rooms' readProjectOpenRooms); the
 * walks are saved against it with this browser's participant token, so sending again
 * replaces the first — nobody draws twice — and what was sent is remembered in this
 * browser (toolkit/rooms' rememberAnswer) so coming back shows it.
 *
 * Everybody else's walks are readable here as they are for the Word Cloud, and shown
 * only if the visitor asks (DesireLinesBoard) — drawing from memory first.
 *
 * The organisers' note on why they are interested is not repeated here: the project's page
 * shows it under the section's heading (`why` in toolkit/tools/desire-lines.js).
 *
 * The service arrives as a prop, as in WordCloudOnPage, so a test can hand this a fake.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Btn } from '../UI';
import { DesireLinesBoard } from './DesireLinesBoard';
import {
  cleanElements, cleanPaths, combineDesire, elementCount, elementsOthersOn, emptyDesire, othersOn as othersOnSite,
  paletteOf, pathCount, sitesOf,
} from '../../lib/desireLines';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import * as roomService from '../../services/rooms';

// What this browser remembers is state written by an earlier version of this page.
function remembered(roomId, siteIds) {
  const saved = rememberedAnswer(roomId);
  if (!saved || typeof saved !== 'object' || typeof saved.sites !== 'object' || saved.sites === null) return null;
  const sites = {};
  const elements = {};
  for (const id of siteIds) {
    const paths = cleanPaths(saved.sites[id]);
    if (paths.length > 0) sites[id] = paths;
    const placed = cleanElements(saved.elements?.[id]);
    if (placed.length > 0) elements[id] = placed;
  }
  return { sites, elements };
}

export function DesireLinesOnPage({ t, tool, room, service = roomService }) {
  const sites = useMemo(
    () => sitesOf(room.config).map((site) => ({
      id: site.id, name: site.name, elements: site.elements,
      scope: { point: site.point, zoom: site.zoom, bounds: site.bounds },
    })),
    [room.config],
  );
  const palette = useMemo(() => paletteOf(room.config), [room.config]);
  const [sent, setSent] = useState(() => remembered(room.id, sites.map((site) => site.id)));
  const [state, setState] = useState(() => sent ?? emptyDesire());
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'closed' | 'error'
  const [combined, setCombined] = useState(null);

  // Everyone's walks, kept live while the page is open.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => service.readContributions(room.id)
      .then((contributions) => {
        if (!cancelled) setCombined(combineDesire(contributions.map((entry) => entry.state)));
      })
      .catch((err) => console.error('Could not read the desire lines:', err));
    refresh();
    const unsubscribe = service.subscribeToRoom(room.id, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [room.id, service]);

  const othersOn = useCallback((siteId, mine) => ({
    paths: othersOnSite(combined, siteId, mine.paths),
    elements: elementsOthersOn(combined, siteId, mine.elements),
  }), [combined]);

  const drawn = pathCount(state) + elementCount(state);
  const changed = JSON.stringify(state) !== JSON.stringify(sent ?? emptyDesire());

  const send = async () => {
    setStatus('sending');
    try {
      const saved = await service.saveContribution({
        roomId: room.id, participantToken: participantToken(), displayName: null, state,
      });
      if (!saved) {
        setStatus('closed');
        return;
      }
      rememberAnswer(room.id, state);
      setSent(state);
      setStatus('idle');
    } catch (err) {
      console.error('Could not send the walks:', err);
      setStatus('error');
    }
  };

  const closes = formatRoomDate(room.expiresAt);

  if (sites.length === 0) return null;

  return (
    <div className="placer-card" style={{ padding: 24 }}>
      {room.config?.prompt && (
        <p style={{ fontSize: 22, lineHeight: 1.35, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em',
          margin: '0 0 20px' }}>
          {room.config.prompt}
        </p>
      )}

      <DesireLinesBoard
        t={t}
        tool={tool}
        sites={sites}
        state={state}
        onChange={(next) => { setState(next); if (status !== 'sending') setStatus('idle'); }}
        othersOn={othersOn}
        palette={palette}
        disabled={status === 'closed'}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
        <Btn t={t} variant="primary" icon="send" disabled={status === 'sending' || status === 'closed' || !changed
          || (drawn === 0 && !sent)} onClick={send}>
          {sent ? 'Update my walks' : 'Send my walks'}
        </Btn>
        <span role="status" aria-live="polite" style={{ fontSize: 14, color: t.inkDim }}>
          {status === 'closed' ? 'This has closed, so no more walks are being taken.'
            : status === 'sending' ? 'Sending…'
              : sent && !changed ? 'Sent. Thank you — you can still look at what others drew.'
                : drawn > 0 ? 'Not sent yet.' : ''}
        </span>
      </div>
      {status === 'error' && (
        <p role="alert" style={{ fontSize: 14, color: t.ink, marginTop: 12 }}>
          Your walks did not go through. Please try again.
        </p>
      )}
      {closes && status !== 'closed' && (
        <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 16 }}>Open until {closes}.</p>
      )}
    </div>
  );
}

export default DesireLinesOnPage;
