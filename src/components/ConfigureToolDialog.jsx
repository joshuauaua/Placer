/* PLACER — configuring one of a project's tools, from its dashboard.
 *
 * A tool is a template (toolkit/tools.js): the Toolkit page shows it on its own, and a
 * project fills it in for itself here before it goes live on the project's public
 * page. What there is to fill in depends on the tool (projectSetupKind):
 *
 *   scene — Reimagine a Space: the place, and the photo of it people add their ideas
 *           to (project_tools.config, supabase/project-tool-config.sql)
 *   room  — a tool that runs in a room: its own setup form, if it has one, and how long
 *           the project's room stays open. Saving opens that room, which is what puts
 *           the tool live; the room is then listed under Open rooms.
 *   none  — nothing to fill in. Saving only puts the tool live.
 */

import { useEffect, useRef, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import { ImagePicker } from './ImagePicker';
import { AddressInput } from './AddressInput';
import {
  markProjectToolConfigured, readProjectToolConfig, removeProjectImageFile, saveProjectToolConfig,
  uploadSceneImage,
} from '../services/projects';
import { createRoom } from '../services/rooms';
import { checkPickedImage } from '../services/media';
import { ROOM_LIFETIMES, rememberHostedRoom } from '../toolkit/rooms';
import { projectSetupKind } from '../toolkit/tools';

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
 * Reimagine a Space's scene: where the place is, and the photo of it that people place
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
        console.error('Could not load how Reimagine a Space is set up:', err);
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
      console.error('Could not set up Reimagine a Space:', err);
      onError(err?.message ?? 'Could not set up Reimagine a Space.');
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
 * A tool that runs in a room: its own setup form, if it has one, and how long the
 * project's room stays open. Problems are only listed once somebody has tried to save
 * — a form that starts out shouting has not let you fill it in yet.
 */
function RoomForm({ t, project, tool, busy, setBusy, onDone, onError, onCancel }) {
  const [setup, setSetup] = useState(() => tool.setup?.defaults() ?? null);
  const [lifetime, setLifetime] = useState(DEFAULT_PROJECT_LIFETIME);
  const [tried, setTried] = useState(false);
  const problems = tool.setup ? tool.setup.problems(setup) : [];
  const Form = tool.setup?.Form;

  const save = async (e) => {
    e.preventDefault();
    setTried(true);
    if (problems.length > 0 || busy) return;
    setBusy(true);
    onError(null);
    try {
      const room = await createRoom(tool.id, project.id, lifetime, setup);
      // This browser can run the room as its facilitator straight away.
      rememberHostedRoom(room.id, { pin: room.pin, token: room.facilitatorToken, code: room.joinCode ?? null });
      onDone();
    } catch (err) {
      console.error(`Could not open a room for ${tool.name}:`, err);
      onError(err?.message ?? `Could not open a room for ${tool.name}.`);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, margin: '0 0 20px' }}>
        Everybody who takes part sees {tool.name} the way you set it up here, on the project&rsquo;s
        page, until it closes — so their answers are all about the same thing.
      </p>

      {Form && <Form t={t} tool={tool} setup={setup} onChange={setSetup} />}

      <Field t={t} label="Open for" htmlFor="configure-lifetime"
        hint="How long people can take part. You can close it sooner from the dashboard.">
        <select id="configure-lifetime" value={lifetime} onChange={(e) => setLifetime(e.target.value)}
          disabled={busy} style={{ ...inputStyle(t), width: 'auto' }}>
          {ROOM_LIFETIMES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </Field>

      {tried && problems.length > 0 && (
        <ul role="alert" style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13.5, color: '#B3261E', lineHeight: 1.6 }}>
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}

      <Actions t={t} busy={busy} label="Save and go live" onCancel={onCancel} />
    </form>
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

export function ConfigureToolDialog({ t, project, tool, onClose, onConfigured }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  const SetupForm = FORMS[projectSetupKind(tool)];

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

        <SetupForm t={t} project={project} tool={tool} busy={busy} setBusy={setBusy}
          onDone={onConfigured} onError={setError} onCancel={onClose} />
      </div>
    </div>
  );
}

export default ConfigureToolDialog;
