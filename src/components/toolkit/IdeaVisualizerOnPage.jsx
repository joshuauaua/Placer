/* PLACER — Idea Visualizer on a project's page.
 *
 * The room an organiser opened for the project, set into its public page rather than
 * behind a link: the Street View photo they took when setting it up, and Visualize,
 * which opens the whole tool right there — the photo, and the library of benches,
 * trees, lighting and the rest to place on it — with a name and a few words for the
 * idea under it.
 *
 * Recording one shows the results: a grid of every visualization recorded so far,
 * this browser's own first and marked Yours, and Create another, which opens the tool
 * again on a clean photo. Somebody can record up to MAX_VISUALS. They are all saved
 * as one contribution against the room with this browser's participant token, and
 * remembered in this browser (toolkit/rooms' rememberAnswer), so coming back opens on
 * the results again.
 *
 * Until then, See other visualizations draws everybody's recorded ideas on the same
 * photo (VisualThumb). Either way they are kept live while the page is open. The room
 * is the project's (services/rooms' readProjectOpenRooms); the logic is in
 * lib/ideaVisualizer.js.
 *
 * The service arrives as a prop, as in DesireLinesOnPage, so a test can hand this a fake.
 */

import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import { Btn } from '../UI';
import { ASSET_LIB } from '../../data';
import { CAT } from '../../theme';
import {
  MAX_DESCRIPTION, MAX_TITLE, MAX_VISUALS, STAGE, combineVisuals, personVisuals, recordedVisual,
} from '../../lib/ideaVisualizer';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import { mediaUrl } from '../../services/media';
import * as roomService from '../../services/rooms';

const ImaginationCanvas = lazy(() => import('../ImaginationCanvas'));

const BY_TYPE = new Map(ASSET_LIB.map((asset) => [asset.type, asset]));
const KNOWN_TYPES = new Set(BY_TYPE.keys());

// What this browser remembers may have been written by an earlier version of this
// page, which kept a single visual rather than a list.
function remembered(roomId) {
  return personVisuals(rememberedAnswer(roomId), KNOWN_TYPES);
}

/** The visuals in `all` that are not `mine`, each of mine taken out once. */
function othersThan(all, mine) {
  const left = mine.map((visual) => JSON.stringify(visual));
  return all.filter((visual) => {
    const at = left.indexOf(JSON.stringify(visual));
    if (at === -1) return true;
    left.splice(at, 1);
    return false;
  });
}

/**
 * A recorded idea drawn again on the photo it was made on: each asset where it was
 * placed on the stage, as large and as turned, the same way ImaginationCanvas draws it.
 */
export function VisualThumb({ t, photo, visual, label, tag = null }) {
  return (
    <figure style={{ margin: 0 }}>
      <div role="img" aria-label={label} style={{ position: 'relative', width: '100%', aspectRatio: `${STAGE.width} / ${STAGE.height}`,
        overflow: 'hidden', borderRadius: 12, background: '#000', border: `1px solid ${t.line}` }}>
        {photo && (
          <img src={photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {tag && (
          <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, padding: '2px 8px', borderRadius: 999,
            background: t.surface, color: t.ink, fontSize: 12, fontWeight: 600 }}>
            {tag}
          </span>
        )}
        {visual.assets.map((asset, index) => {
          const lib = BY_TYPE.get(asset.type);
          const size = (asset.scale * 80 * 100) / STAGE.width;
          return (
            <span key={index} aria-hidden="true" style={{ position: 'absolute', left: `${(asset.x / STAGE.width) * 100}%`,
              top: `${(asset.y / STAGE.height) * 100}%`, width: `${size}%`, aspectRatio: '1 / 1',
              transform: `translate(-50%, -50%) rotate(${asset.rotation}deg)` }}>
              {lib.icon ? (
                <img src={lib.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%',
                  background: (CAT[lib.cat] ?? CAT.green).color, opacity: 0.8 }} />
              )}
            </span>
          );
        })}
      </div>
      {(visual.title || visual.description) && (
        <figcaption style={{ marginTop: 8 }}>
          {visual.title && <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{visual.title}</div>}
          {visual.description && (
            <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.55, margin: '2px 0 0', overflowWrap: 'anywhere' }}>
              {visual.description}
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}

export function IdeaVisualizerOnPage({ t, room, service = roomService }) {
  const id = useId();
  const photo = mediaUrl(room.config?.imagePath);
  // What this browser has recorded here, oldest first.
  const [mine, setMine] = useState(() => remembered(room.id));
  const [mode, setMode] = useState(() => (mine.length > 0 ? 'results' : 'photo')); // 'photo' | 'editing' | 'results'
  const [assets, setAssets] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'recorded' | 'closed' | 'error'
  const [combined, setCombined] = useState(null);
  const [showingOthers, setShowingOthers] = useState(false);

  // Everyone's ideas, kept live while the page is open.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => service.readContributions(room.id)
      .then((contributions) => {
        if (!cancelled) setCombined(combineVisuals(contributions.map((entry) => entry.state), KNOWN_TYPES));
      })
      .catch((err) => console.error('Could not read the visualizations:', err));
    refresh();
    const unsubscribe = service.subscribeToRoom(room.id, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [room.id, service]);

  const visual = useMemo(() => recordedVisual({ assets, title, description }, KNOWN_TYPES),
    [assets, title, description]);
  // Everybody else's: the room's, less this browser's own, which the results show first.
  const others = useMemo(() => othersThan(combined?.visuals ?? [], mine), [combined, mine]);
  const full = mine.length >= MAX_VISUALS;

  const record = async () => {
    setStatus('sending');
    const next = [...mine, visual];
    try {
      const saved = await service.saveContribution({
        roomId: room.id, participantToken: participantToken(), displayName: null, state: { visuals: next },
      });
      if (!saved) {
        setStatus('closed');
        return;
      }
      rememberAnswer(room.id, { visuals: next });
      setMine(next);
      setStatus('recorded');
      setMode('results');
    } catch (err) {
      console.error('Could not record the visualization:', err);
      setStatus('error');
    }
  };

  const createAnother = () => {
    setAssets([]);
    setTitle('');
    setDescription('');
    setStatus('idle');
    setMode('editing');
  };

  const closes = formatRoomDate(room.expiresAt);
  const count = combined?.visuals.length ?? 0;
  const field = {
    width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface,
    color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, boxSizing: 'border-box',
  };
  const thumbLabel = (each, index) => (each.title
    ? `${each.title}, drawn on the photo` : `Visualization ${index + 1}, drawn on the photo`);

  return (
    <div className="placer-card" style={{ padding: 24 }}>
      {mode === 'photo' && (
        <>
          {photo && (
            <img src={photo} alt="The Street View photo to imagine on" style={{ display: 'block', width: '100%',
              aspectRatio: `${STAGE.width} / ${STAGE.height}`, objectFit: 'cover', borderRadius: 12,
              border: `1px solid ${t.line}` }} />
          )}
          {room.config?.address && (
            <p className="placer-caption" style={{ color: t.inkFaint, margin: '8px 0 0' }}>{room.config.address}</p>
          )}
          <div style={{ marginTop: 16 }}>
            <Btn t={t} variant="primary" icon="sparkle" onClick={() => setMode('editing')}>Visualize</Btn>
          </div>
        </>
      )}

      {mode === 'editing' && (
        <>
          <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.line}` }}>
            <Suspense fallback={<p style={{ padding: 24, fontSize: 14, color: t.inkDim }}>Loading the tool…</p>}>
              <ImaginationCanvas fit availableAssets={ASSET_LIB} canvasAssets={assets} onCanvasAssetsChange={setAssets}
                width={STAGE.width} height={STAGE.height} backgroundImage={photo} />
            </Suspense>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 640 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={`${id}-title`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Name your idea</label>
              <input id={`${id}-title`} type="text" maxLength={MAX_TITLE} value={title} placeholder="e.g. A shady corner to sit"
                onChange={(event) => setTitle(event.target.value)} style={field} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={`${id}-description`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
                What is it, and why? <span style={{ fontWeight: 500, color: t.inkDim }}>(optional)</span>
              </label>
              <textarea id={`${id}-description`} rows={3} maxLength={MAX_DESCRIPTION} value={description}
                onChange={(event) => setDescription(event.target.value)} style={{ ...field, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <Btn t={t} variant="primary" icon="send"
              disabled={status === 'sending' || status === 'closed' || visual.assets.length === 0}
              onClick={record}>
              {status === 'sending' ? 'Recording…' : 'Record my visualization'}
            </Btn>
            {mine.length > 0 && (
              <Btn t={t} variant="ghost" onClick={() => setMode('results')}>Cancel</Btn>
            )}
            <span role="status" aria-live="polite" style={{ fontSize: 14, color: t.inkDim }}>
              {status === 'closed' ? 'This has closed, so no more visualizations are being recorded.'
                : visual.assets.length === 0 ? 'Place something on the photo to record it.'
                  : 'Recorded without your name.'}
            </span>
          </div>
          {status === 'error' && (
            <p role="alert" style={{ fontSize: 14, color: t.ink, marginTop: 12 }}>
              Your visualization did not go through. Please try again.
            </p>
          )}
        </>
      )}

      {mode === 'results' && (
        <>
          <p role="status" aria-live="polite" style={{ fontSize: 14, color: t.inkDim, margin: '0 0 16px' }}>
            {status === 'recorded' ? 'Recorded to the project. Thank you.' : `You have recorded ${mine.length === 1
              ? 'a visualization' : `${mine.length} visualizations`} here.`}
          </p>
          <div role="list" aria-label="Visualizations" style={{ display: 'grid', gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {[...mine.map((each) => ({ each, yours: true })), ...others.map((each) => ({ each, yours: false }))]
              .map(({ each, yours }, index) => (
                <div role="listitem" key={index}>
                  <VisualThumb t={t} photo={photo} visual={each} label={thumbLabel(each, index)}
                    tag={yours ? 'Yours' : null} />
                </div>
              ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
            <Btn t={t} variant="primary" icon="plus" disabled={full} onClick={createAnother}>Create another</Btn>
            {full && (
              <span style={{ fontSize: 14, color: t.inkDim }}>
                {`That is the most one person can record here: ${MAX_VISUALS}.`}
              </span>
            )}
          </div>
        </>
      )}

      {mode !== 'results' && (
        <div style={{ borderTop: `1px solid ${t.line}`, marginTop: 24, paddingTop: 16 }}>
          <Btn t={t} variant="outline" icon={showingOthers ? 'chevUp' : 'image'}
            onClick={() => setShowingOthers((was) => !was)}>
            {showingOthers ? 'Hide other visualizations' : `See other visualizations${count ? ` (${count})` : ''}`}
          </Btn>
          {showingOthers && (
            count === 0 ? (
              <p style={{ fontSize: 14, color: t.inkDim, marginTop: 12 }}>
                Nobody has recorded a visualization yet. Be the first.
              </p>
            ) : (
              <div role="list" aria-label="Other visualizations" style={{ display: 'grid', gap: 16, marginTop: 16,
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {combined.visuals.map((other, index) => (
                  <div role="listitem" key={index}>
                    <VisualThumb t={t} photo={photo} visual={other} label={thumbLabel(other, index)} />
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {closes && status !== 'closed' && (
        <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 16 }}>Open until {closes}.</p>
      )}
    </div>
  );
}

export default IdeaVisualizerOnPage;
