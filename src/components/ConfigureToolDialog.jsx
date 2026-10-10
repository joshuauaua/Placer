/* PLACER — configuring one of a project's tools, from its dashboard.
 *
 * A tool is a template (toolkit/tools.js): the Toolkit page shows it on its own, and a
 * project fills it in for itself here before it goes live on the project's public
 * page. What there is to fill in depends on the tool (projectSetupKind):
 *
 *   scene — Idea Visualizer: the place, and the photo of it people add their ideas
 *           to (project_tools.config, supabase/project-tool-config.sql)
 *   room  — a tool that runs in a room: its own setup form, if it has one, and how long
 *           the project's room stays open. Saving opens that room, which is what puts
 *           the tool live; its row on the dashboard then opens out to the room.
 *   none  — nothing to fill in. Saving only puts the tool live.
 *
 * It opens on an introduction to the tool — what it is, and what configuring it
 * involves — and the form follows on Get started.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import { ImagePicker } from './ImagePicker';
import { AddressInput } from './AddressInput';
import { DatePicker } from './DatePicker';
import {
  markProjectToolConfigured, readProjectToolConfig, removeProjectImageFile, saveProjectToolConfig,
  uploadSceneImage,
} from '../services/projects';
import { createRoom } from '../services/rooms';
import { checkPickedImage } from '../services/media';
import { ROOM_LIFETIMES, formatRoomDate, rememberHostedRoom, scheduleRange } from '../toolkit/rooms';
import { findCategory, projectSetupKind, setupSteps } from '../toolkit/tools';
import { SetupSteps } from './toolkit/SetupSteps';

// A project's room is usually left up for people to find, not run as a workshop.
const DEFAULT_PROJECT_LIFETIME = '30d';

const inputStyle = (t) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 16px',
  fontSize: 15,
  border: `1.5px solid ${t.line}`,
  borderRadius: 12,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

function Field({ t, label, htmlFor, hint, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label htmlFor={htmlFor}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      {hint && <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  );
}

/**
 * Idea Visualizer's scene: where the place is, and the photo of it that people place
 * benches, trees and the rest on. Both are required — without them there is nothing
 * for anyone to draw on. A new scene starts at the project's own address, which is
 * usually the place in question.
 */
function SceneForm({ t, project, tool, busy, setBusy, onDone, onError, onCancel }) {
  const [saved, setSaved] = useState(undefined); // undefined while loading
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState(null);
  const [pending, setPending] = useState(null); // { file, url } | null
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readProjectToolConfig(project.id, tool.id)
      .then((scene) => {
        if (cancelled) return;
        setSaved(scene);
        setAddress(scene?.address || project.address || '');
        setPoint(scene ? scene.point : project.locationPoint ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load how Idea Visualizer is set up:', err);
        setSaved(null);
        setAddress(project.address ?? '');
        setPoint(project.locationPoint ?? null);
      });
    return () => { cancelled = true; };
  }, [project.id, project.address, project.locationPoint, tool.id]);

  if (saved === undefined) {
    return <p style={{ fontSize: 14, color: t.inkDim }}>Loading…</p>;
  }

  const image = pending?.url ?? (cleared ? null : saved?.image ?? null);
  const complete = Boolean(image) && address.trim().length > 0 && Boolean(point);

  const save = async (e) => {
    e.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    onError(null);
    const previousPath = saved?.imagePath ?? null;
    try {
      const imagePath = pending ? await uploadSceneImage(project.id, pending.file) : previousPath;
      await saveProjectToolConfig(project.id, tool.id, { address: address.trim(), point, imagePath });
      if (previousPath && previousPath !== imagePath) {
        removeProjectImageFile(previousPath).catch((err) => console.error('Could not remove the old base image:', err));
      }
      onDone();
    } catch (err) {
      console.error('Could not set up Idea Visualizer:', err);
      onError(err?.message ?? 'Could not set up Idea Visualizer.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: '0 0 20px' }}>
        People imagining for this project place their ideas on a photo you choose, of a place you choose,
        instead of finding a spot in Street View.
      </p>

      <Field t={t} label="Location *" htmlFor="scene-address"
        hint={'Where the photo is of. Pick it from the suggestions, so the ideas are pinned there on the map.'}>
        <AddressInput id="scene-address" value={address}
          placeholder="e.g. Folkets Park, Malmö" style={inputStyle(t)}
          onChange={(next) => { setAddress(next); setPoint(null); }}
          onPick={(picked) => { setAddress(picked.address); setPoint(picked.point); }} />
        {address.trim() && !point && (
          <div style={{ fontSize: 13, color: t.inkFaint, marginTop: 8 }}>
            Not pinned yet: pick the address from the suggestions.
          </div>
        )}
      </Field>

      <Field t={t} label="Base image *"
        hint="The photo people add to. A wide, landscape photo of the place works best. It is resized, and saved without its location data.">
        {image && (
          <img src={image} alt="The base image" style={{ display: 'block', width: '100%', aspectRatio: '10 / 7',
            objectFit: 'cover', borderRadius: 12, border: `1px solid ${t.line}`, marginBottom: 14 }} />
        )}
        <ImagePicker t={t} hasImage={!!image} uploadLabel="Add a base image" replaceLabel="Choose another"
          onUpload={async (file) => {
            checkPickedImage(file, 'A base image'); // Throws the same sentence the upload would.
            setPending({ file, url: URL.createObjectURL(file) });
            setCleared(false);
          }}
          onRemove={async () => { setPending(null); setCleared(true); }} disabled={busy} />
      </Field>

      <Actions t={t} busy={busy} disabled={!complete} label="Save and go live" onCancel={onCancel} />
    </form>
  );
}

/**
 * When a room set up in stages starts: now, or on a day within the project's dates
 * (scheduleRange). A project without dates, or past them, can only start now.
 */
function StartsField({ t, project, starts, onChange, busy }) {
  const range = scheduleRange(project);
  const radio = (value, label, disabled = false) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: disabled ? t.inkFaint : t.ink }}>
      <input type="radio" name="configure-starts" value={value} checked={starts.mode === value}
        disabled={busy || disabled} onChange={() => onChange({ ...starts, mode: value })} />
      {label}
    </label>
  );

  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 22px' }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, padding: 0, marginBottom: 8 }}>Starts</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {radio('now', 'Now')}
        {radio('date', 'On a date', !range)}
        {starts.mode === 'date' && range && (
          <div style={{ marginLeft: 26, maxWidth: 280 }}>
            <label htmlFor="configure-start-date"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: t.inkDim, marginBottom: 6 }}>
              Start date
            </label>
            <DatePicker t={t} id="configure-start-date" value={starts.date} min={range.min} max={range.max}
              label="Choose the start date" placeholder="Pick a day" clearable={false} disabled={busy}
              onChange={(date) => onChange({ ...starts, date })} style={inputStyle(t)} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: t.inkDim, marginTop: 8, lineHeight: 1.5 }}>
        {range
          ? `Any day from ${formatRoomDate(range.min)} to ${formatRoomDate(range.max)}, within the project's dates. It is not on the project's page until then.`
          : 'Give the project start and end dates to schedule it for later.'}
      </div>
    </fieldset>
  );
}

/** What is wrong with when a room starts, as sentences. */
function startsProblems(project, starts) {
  if (starts.mode !== 'date') return [];
  const range = scheduleRange(project);
  if (!starts.date) return ['Choose the day it starts.'];
  if (!range || starts.date < range.min || starts.date > range.max) {
    return ['Choose a day within the project\u2019s dates, from today on.'];
  }
  return [];
}

/**
 * A tool that runs in a room: its own setup, in as many stages as it asks for
 * (setupSteps), and then when the project's room starts and how long it stays open as
 * the last.
 */
function RoomForm({ t, project, tool, busy, setBusy, onDone, onError, onCancel }) {
  const [setup, setSetup] = useState(() => tool.setup?.defaults() ?? null);
  const [lifetime, setLifetime] = useState(DEFAULT_PROJECT_LIFETIME);
  const [starts, setStarts] = useState({ mode: 'now', date: '' });
  const staged = setupSteps(tool).length > 1;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    onError(null);
    try {
      const opensOn = staged && starts.mode === 'date' ? starts.date : null;
      const room = await createRoom(tool.id, project.id, lifetime, setup, opensOn);
      // This browser can run the room as its facilitator straight away.
      rememberHostedRoom(room.id, { pin: room.pin, token: room.facilitatorToken, code: room.joinCode ?? null });
      onDone();
    } catch (err) {
      console.error(`Could not open a room for ${tool.name}:`, err);
      onError(err?.message ?? `Could not open a room for ${tool.name}.`);
      setBusy(false);
    }
  };

  const openFor = (
    <Field t={t} label="Open for" htmlFor="configure-lifetime"
      hint="How long people can take part, from when it starts. You can close it sooner from the dashboard.">
      <select id="configure-lifetime" value={lifetime} onChange={(e) => setLifetime(e.target.value)}
        disabled={busy} style={{ ...inputStyle(t), width: 'auto' }}>
        {ROOM_LIFETIMES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </Field>
  );
  const intro = (
    <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: '0 0 20px' }}>
      Everybody who takes part sees {tool.name} the way you set it up here, on the project&rsquo;s
      page, until it closes — so their answers are all about the same thing.
    </p>
  );

  const toolSteps = setupSteps(tool).map(({ title, Form, problems }) => ({
    title,
    content: <Form t={t} tool={tool} setup={setup} onChange={setSetup} />,
    problems: problems(setup),
  }));
  // A tool set up on one screen keeps how long it stays open on that screen too; one
  // set up in stages gets it as a stage of its own.
  const steps = staged
    ? [...toolSteps, {
      title: 'Open for',
      content: <><StartsField t={t} project={project} starts={starts} onChange={setStarts} busy={busy} />{openFor}</>,
      problems: startsProblems(project, starts),
    }]
    : [{
      title: null,
      content: <>{intro}{toolSteps[0]?.content}{openFor}</>,
      problems: toolSteps[0]?.problems ?? [],
    }];

  return (
    <SetupSteps t={t} steps={steps} busy={busy} onCancel={onCancel} onFinish={save}
      finishLabel="Save and go live" busyLabel="Saving…" />
  );
}

/** A tool with nothing to fill in for a project: configuring it only puts it live. */
function NothingForm({ t, project, tool, busy, setBusy, onDone, onError, onCancel }) {
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    onError(null);
    try {
      await markProjectToolConfigured(project.id, tool.id);
      onDone();
    } catch (err) {
      console.error(`Could not put ${tool.name} live:`, err);
      onError(err?.message ?? `Could not put ${tool.name} live.`);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: '0 0 20px' }}>
        {tool.name} has nothing to set up for a project. Putting it live adds it to the
        project&rsquo;s page, for people to try.
      </p>
      <Actions t={t} busy={busy} label="Go live" onCancel={onCancel} />
    </form>
  );
}

// The dialog's buttons, inside each form so that Save is the form's own submit.
function Actions({ t, busy, disabled = false, label, onCancel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
      <Btn t={t} variant="outline" size="sm" type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </Btn>
      <Btn t={t} variant="primary" size="sm" type="submit" disabled={busy || disabled}>
        {busy ? 'Saving…' : label}
      </Btn>
    </div>
  );
}

const FORMS = { scene: SceneForm, room: RoomForm, none: NothingForm };

// What configuring each kind of tool involves, for the introduction.
const WHAT_YOU_SET_UP = {
  scene: 'You will pick the place, and add the photo of it that people put their ideas on.',
  room: 'You will set it up for this project and choose how long it stays open on the project\u2019s page.',
  none: 'There is nothing to fill in: going live adds it to the project\u2019s page, for people to try.',
};

/** The tool introduced, as its Toolkit cover does, before anything is filled in. */
function Intro({ t, tool, kind, onStart, onCancel }) {
  return (
    <div>
      <div style={{ height: 120, borderRadius: 12, background: tool.tint, marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={tool.icon} size={56} stroke={1.5} style={{ color: t.ink }} />
      </div>

      <div className="placer-caption" style={{ textTransform: 'uppercase', color: tool.color,
        fontWeight: 700, marginBottom: 8 }}>
        {findCategory(tool.category)?.name ?? 'Tool'}
      </div>
      {tool.tagline && (
        <p style={{ fontSize: 17, fontWeight: 700, color: t.ink, lineHeight: 1.4, margin: '0 0 10px' }}>
          {tool.tagline}
        </p>
      )}
      <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: '0 0 12px' }}>{tool.blurb}</p>
      {(tool.duration || tool.createdBy) && (
        <p className="placer-caption" style={{ color: t.inkFaint, margin: '0 0 16px' }}>
          {[tool.duration, tool.createdBy && `By ${tool.createdBy}`].filter(Boolean).join(' · ')}
        </p>
      )}
      <p style={{ fontSize: 14, color: t.ink, lineHeight: 1.6, margin: '0 0 20px', padding: '12px 14px',
        borderRadius: 12, background: t.chrome }}>
        {WHAT_YOU_SET_UP[kind]}
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn t={t} variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Btn>
        <Btn t={t} variant="primary" size="sm" type="button" onClick={onStart}>Get started</Btn>
      </div>
    </div>
  );
}

export function ConfigureToolDialog({ t, project, tool, onClose, onConfigured }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const panelRef = useRef(null);
  const kind = projectSetupKind(tool);
  const SetupForm = FORMS[kind];

  // Escape closes it, unless a save is under way.
  useEffect(() => {
    panelRef.current?.focus();
    const handleKeyDown = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="configure-tool-title" tabIndex={-1}
        style={{ width: '100%', maxWidth: 560, maxHeight: 'min(90vh, 820px)', overflowY: 'auto', padding: 24,
          background: t.surface, borderRadius: 16, boxShadow: t.shadow, outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, flex: '0 0 auto', background: tool.tint,
            boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center' }}>
            <Icon name={tool.icon} size={18} stroke={2} />
          </span>
          <h2 id="configure-tool-title" style={{ fontSize: 18, fontWeight: 700, color: t.ink, margin: 0 }}>
            Configure {tool.name}
          </h2>
        </div>

        {error && (
          <p role="alert" style={{ fontSize: 13.5, color: '#B3261E', margin: '0 0 16px' }}>{error}</p>
        )}

        {started ? (
          <SetupForm t={t} project={project} tool={tool} busy={busy} setBusy={setBusy}
            onDone={onConfigured} onError={setError} onCancel={onClose} />
        ) : (
          <Intro t={t} tool={tool} kind={kind} onStart={() => setStarted(true)} onCancel={onClose} />
        )}
      </div>
    </div>
  );
}

export default ConfigureToolDialog;
