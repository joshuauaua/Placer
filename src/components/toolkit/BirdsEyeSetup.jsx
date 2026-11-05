/* PLACER — Toolkit: setting up a Birds Eye View.
 *
 * The plan is made on the configuration page's canvas (BirdsEyeEditor, `setup.Canvas`),
 * under the question as the slide's title:
 *
 *   - the outline: a 20 by 12 metre rectangle to start with. Drag its corners, or Draw
 *     outline and click corner after corner, back to the first, for any other shape.
 *     Its overall Width and Depth, typed in metres, stretch it (and what is in it) to
 *     its real size; each side's length is written along it.
 *   - its pieces: Add a rectangle or a circle, then drag it into place, pull its corner
 *     to size it and its top handle to turn it. The one picked is edited under the
 *     plan: its title ("Work bench"), its size in metres, how far it is turned, or
 *     Remove.
 *
 * The panel has the question and the timer. The project dashboard's setup has the
 * same editor as a stage of its own (BirdsEyePlanStep).
 */

import { useEffect, useId, useState } from 'react';
import { Btn } from '../UI';
import { BirdsEyePlan } from './BirdsEyePlan';
import { TimerSelect } from './WordCloudSetup';
import {
  DEFAULT_PROMPT, MAX_ASSETS, MAX_PROMPT_LENGTH, MAX_TITLE_LENGTH, area, bounds, newAsset, readAssets, readOutline,
  rectangleOutline, scalePlan,
} from '../../lib/birdsEye';

const fieldStyle = (t, width = 88) => ({
  width, height: 36, padding: '0 10px', borderRadius: 10, border: `1px solid ${t.lineStrong}`, background: t.surface,
  color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14, fontWeight: 600, boxSizing: 'border-box',
});

const labelStyle = (t) => ({ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: t.inkDim });

/** A number field in metres that only changes the setup once it is done with (Enter, or leaving it). */
function MetresField({ t, label, value, onCommit, min = 0.2 }) {
  // To the centimetre, as it is read: 2.4, not 2.40000001.
  const shown = String(Number(Number(value).toFixed(2)));
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const next = Number(draft.replace(',', '.'));
    if (Number.isFinite(next) && next >= min) onCommit(next);
    else setDraft(shown);
  };
  return (
    <label style={labelStyle(t)}>
      {label}
      <input type="text" inputMode="decimal" value={draft} aria-label={`${label} in metres`}
        onChange={(event) => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }}
        style={fieldStyle(t, 72)} />
      <span style={{ fontWeight: 600 }}>m</span>
    </label>
  );
}

export function BirdsEyeEditor({ t, setup, onChange, height = 460 }) {
  const outline = readOutline(setup.outline);
  const assets = readAssets(setup.assets);
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  const box = bounds(outline);
  const round1 = (value) => Math.round(value * 10) / 10;

  const setAssets = (next) => onChange({ ...setup, assets: next });
  const changeAsset = (id, patch) => setAssets(assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)));
  const add = (shape) => {
    const asset = newAsset(setup, shape);
    setAssets([...assets, asset]);
    setSelectedId(asset.id);
  };

  // Drawing an outline: each click a corner; one on the first corner closes it.
  const drawAt = (point) => {
    const first = drawing?.[0];
    const near = first && Math.hypot(point.x - first.x, point.y - first.y) < Math.max(box.width, box.depth, 1) / 30;
    if (near && drawing.length >= 3) {
      finishDrawing(drawing);
      return;
    }
    setDrawing([...(drawing ?? []), point]);
  };
  const finishDrawing = (points) => {
    // From its own top left, so its sizes read from 0.
    const drawn = bounds(points);
    const at = ({ x, y }) => ({ x: round1(x - drawn.minX), y: round1(y - drawn.minY) });
    onChange({ ...setup, outline: points.map(at), assets: assets.map((asset) => ({ ...asset, ...at(asset) })) });
    setDrawing(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="toolbar" aria-label="Plan" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {drawing ? (
          <>
            <span role="status" style={{ fontSize: 13.5, color: t.ink, fontWeight: 600 }}>
              Click each corner in turn, then the first one again to close the shape.
            </span>
            <div style={{ flex: 1 }} />
            <Btn t={t} size="sm" variant="ghost" onClick={() => setDrawing(null)}>Cancel</Btn>
            <Btn t={t} size="sm" icon="check" disabled={drawing.length < 3} onClick={() => finishDrawing(drawing)}>
              Finish shape
            </Btn>
          </>
        ) : (
          <>
            <Btn t={t} size="sm" variant="outline" icon="pencil" onClick={() => { setSelectedId(null); setDrawing([]); }}>
              Draw outline
            </Btn>
            <Btn t={t} size="sm" variant="ghost" onClick={() => onChange({ ...setup,
              outline: rectangleOutline(round1(box.width) || 20, round1(box.depth) || 12) })}>
              Make it a rectangle
            </Btn>
            <div style={{ flex: 1 }} />
            <MetresField t={t} label="Width" value={round1(box.width)} onCommit={(width) => onChange(scalePlan(setup, width, box.depth))} />
            <span aria-hidden="true" style={{ color: t.inkDim }}>×</span>
            <MetresField t={t} label="Depth" value={round1(box.depth)} onCommit={(depth) => onChange(scalePlan(setup, box.width, depth))} />
            <span style={{ fontSize: 13, color: t.inkDim }}>{Math.round(area(outline))} m²</span>
          </>
        )}
      </div>

      <BirdsEyePlan outline={outline} assets={assets} mode="edit" selectedId={selectedId} onSelect={setSelectedId}
        onMoveCorner={(index, point) => onChange({ ...setup, outline: outline.map((corner, i) => (i === index ? point : corner)) })}
        onChangeAsset={changeAsset} drawing={drawing} onPlanClick={drawing ? drawAt : undefined} height={height}
        label="Plan of the place, to edit" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.inkDim }}>Add a piece</span>
        <Btn t={t} size="sm" variant="outline" icon="plus" disabled={assets.length >= MAX_ASSETS || Boolean(drawing)}
          onClick={() => add('rect')}>Rectangle</Btn>
        <Btn t={t} size="sm" variant="outline" icon="plus" disabled={assets.length >= MAX_ASSETS || Boolean(drawing)}
          onClick={() => add('circle')}>Circle</Btn>
        <span style={{ fontSize: 13, color: t.inkDim }}>
          {assets.length === 0 ? 'Then drag it into place, and pull its corner to size it.' : `${assets.length} ${assets.length === 1 ? 'piece' : 'pieces'}`}
        </span>
      </div>

      {selected && (
        <fieldset aria-label="The piece picked" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          margin: 0, padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.line}`, background: t.surfaceAlt ?? t.surface }}>
          <label style={labelStyle(t)}>
            Title
            <input type="text" value={selected.title} maxLength={MAX_TITLE_LENGTH} placeholder="Work bench"
              aria-label="Piece title" onChange={(event) => changeAsset(selected.id, { title: event.target.value })}
              style={fieldStyle(t, 180)} />
          </label>
          <MetresField t={t} label={selected.shape === 'circle' ? 'Across' : 'Width'} value={selected.w}
            onCommit={(w) => changeAsset(selected.id, selected.shape === 'circle' ? { w, d: w } : { w })} />
          {selected.shape !== 'circle' && (
            <MetresField t={t} label="Depth" value={selected.d} onCommit={(d) => changeAsset(selected.id, { d })} />
          )}
          <Btn t={t} size="sm" variant="ghost" onClick={() => changeAsset(selected.id, { r: (selected.r + 90) % 360 })}>
            Turn 90°
          </Btn>
          <div style={{ flex: 1 }} />
          <Btn t={t} size="sm" variant="ghost" icon="trash" onClick={() => {
            setAssets(assets.filter((asset) => asset.id !== selected.id));
            setSelectedId(null);
          }}>
            Remove
          </Btn>
        </fieldset>
      )}
    </div>
  );
}

/** The question. */
export function BirdsEyePromptStep({ t, setup, onChange, compact = false }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {!compact && <label htmlFor={`${id}-prompt`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>The prompt</label>}
      <input id={`${id}-prompt`} aria-label={compact ? 'The prompt' : undefined} type="text" maxLength={MAX_PROMPT_LENGTH}
        value={setup.prompt ?? ''} placeholder={DEFAULT_PROMPT}
        onChange={(event) => onChange({ ...setup, prompt: event.target.value })}
        style={{ height: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface,
          color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 700 }} />
    </div>
  );
}

/** The plan, as a stage of the dashboard's setup. */
export function BirdsEyePlanStep({ t, setup, onChange }) {
  return <BirdsEyeEditor t={t} setup={setup} onChange={onChange} height={360} />;
}

/** The timer: none, or one of Word Cloud's. */
export function BirdsEyeTimerStep({ t, setup, onChange, compact = false }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-timer`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Timer</label>
      <TimerSelect t={t} id={`${id}-timer`} value={setup.timer} onChange={(timer) => onChange({ ...setup, timer })} />
      {!compact && (
        <span style={{ fontSize: 12.5, color: t.inkDim }}>Optional. When it runs out, no more layouts are taken.</span>
      )}
    </div>
  );
}

/** All of it on one screen, for a host that does not walk through `steps`. */
export function BirdsEyeSetup({ t, setup, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <BirdsEyePromptStep t={t} setup={setup} onChange={onChange} />
      <BirdsEyePlanStep t={t} setup={setup} onChange={onChange} />
      <BirdsEyeTimerStep t={t} setup={setup} onChange={onChange} />
    </div>
  );
}

export default BirdsEyeSetup;
