/* PLACER — Idea Visualizer on a project's page.
 *
 * The room an organiser opened for the project, set into its public page rather than
 * behind a link: the Street View photo they took when setting it up, and Visualize,
 * which opens the whole tool right there — the photo, and the library of benches,
 * trees, lighting and the rest to place on it — with a name and a few words for the
 * idea under it. Recording saves the idea against the room with this browser's
 * participant token, so recording again replaces the first, and remembers it in this
 * browser (toolkit/rooms' rememberAnswer) so coming back opens it again.
 *
 * See other visualizations draws everybody's recorded ideas on the same photo
 * (VisualThumb), kept live while the page is open. The room is the project's
 * (services/rooms' readProjectOpenRooms); the logic is in lib/ideaVisualizer.js.
 *
 * The service arrives as a prop, as in DesireLinesOnPage, so a test can hand this a fake.
 */

import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import { Btn } from '../UI';
import { ASSET_LIB } from '../../data';
import { CAT } from '../../theme';
import {
  MAX_DESCRIPTION, MAX_TITLE, STAGE, combineVisuals, recordedVisual,
} from '../../lib/ideaVisualizer';
import { formatRoomDate, participantToken, rememberAnswer, rememberedAnswer } from '../../toolkit/rooms';
import { mediaUrl } from '../../services/media';
import * as roomService from '../../services/rooms';

const ImaginationCanvas = lazy(() => import('../ImaginationCanvas'));

const BY_TYPE = new Map(ASSET_LIB.map((asset) => [asset.type, asset]));
const KNOWN_TYPES = new Set(BY_TYPE.keys());

/** A recorded asset as the canvas works with it, its artwork looked up again. */
function canvasAsset(asset, index) {
  const lib = BY_TYPE.get(asset.type);
  return { id: `recorded-${index}`, type: asset.type, label: lib.label, cat: lib.cat, icon: lib.icon,
    x: asset.x, y: asset.y, scale: asset.scale, rotation: asset.rotation };
}

// What this browser remembers may have been written by an earlier version of this page.
function remembered(roomId) {
  const saved = rememberedAnswer(roomId);
  if (!saved || typeof saved !== 'object') return null;
  const visual = recordedVisual(saved, KNOWN_TYPES);
  return visual.assets.length > 0 ? visual : null;
}

/**
 * A recorded idea drawn again on the photo it was made on: each asset where it was
 * placed on the stage, as large and as turned, the same way ImaginationCanvas draws it.
 */
export function VisualThumb({ t, photo, visual, label }) {
  return (
    <figure style={{ margin: 0 }}>
      <div role="img" aria-label={label} style={{ position: 'relative', width: '100%', aspectRatio: `${STAGE.width} / ${STAGE.height}`,
        overflow: 'hidden', borderRadius: 12, background: '#000', border: `1px solid ${t.line}` }}>
        {photo && (
          <img src={photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
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
  const [sent, setSent] = useState(() => remembered(room.id));
  const [open, setOpen] = useState(() => Boolean(sent));
  const [assets, setAssets] = useState(() => (sent ? sent.assets.map(canvasAsset) : []));
  const [title, setTitle] = useState(sent?.title ?? '');
  const [description, setDescription] = useState(sent?.description ?? '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'closed' | 'error'
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
  const changed = JSON.stringify(visual) !== JSON.stringify(sent);

  const record = async () => {
    setStatus('sending');
    try {
      const saved = await service.saveContribution({
        roomId: room.id, participantToken: participantToken(), displayName: null, state: visual,
      });
      if (!saved) {
        setStatus('closed');
        return;
      }
      rememberAnswer(room.id, visual);
      setSent(visual);
      setStatus('idle');
    } catch (err) {
      console.error('Could not record the visualization:', err);
      setStatus('error');
    }
  };

  const closes = formatRoomDate(room.expiresAt);
  const count = combined?.people ?? 0;
  const field = {
    width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface,
    color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, boxSizing: 'border-box',
  };

  return (
    <div className="placer-card" style={{ padding: 24 }}>
      {!open ? (
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
            <Btn t={t} variant="primary" icon="sparkle" onClick={() => setOpen(true)}>Visualize</Btn>
          </div>
        </>
      ) : (
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
              disabled={status === 'sending' || status === 'closed' || visual.assets.length === 0 || !changed}
              onClick={record}>
              {status === 'sending' ? 'Recording…' : sent ? 'Update my visualization' : 'Record my visualization'}
            </Btn>
            <span role="status" aria-live="polite" style={{ fontSize: 14, color: t.inkDim }}>
              {status === 'closed' ? 'This has closed, so no more visualizations are being recorded.'
                : sent && !changed ? 'Recorded to the project. Thank you.'
                  : visual.assets.length === 0 ? 'Place something on the photo to record it.'
                    : sent ? 'You have changed it since recording it.' : 'Recorded without your name.'}
            </span>
          </div>
          {status === 'error' && (
            <p role="alert" style={{ fontSize: 14, color: t.ink, marginTop: 12 }}>
              Your visualization did not go through. Please try again.
            </p>
          )}
        </>
      )}

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
                  <VisualThumb t={t} photo={photo} visual={other}
                    label={other.title ? `${other.title}, drawn on the photo` : `Visualization ${index + 1}, drawn on the photo`} />
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {closes && status !== 'closed' && (
        <p className="placer-caption" style={{ color: t.inkFaint, marginTop: 16 }}>Open until {closes}.</p>
      )}
    </div>
  );
}

export default IdeaVisualizerOnPage;
