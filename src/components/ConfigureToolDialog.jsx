/* PLACER — configuring one of a project's tools, from its dashboard.
 *
 * A tool is a template (toolkit/tools.js): the Toolkit page shows it on its own, and a
 * project fills it in for itself here before it goes live on the project's public
 * page. What there is to fill in depends on the tool (projectSetupKind):
 *
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
import { DatePicker } from './DatePicker';
import { markProjectToolConfigured } from '../services/projects';
import { createRoom, rescheduleRoom } from '../services/rooms';
import { suggestCurrency } from '../lib/currency';
import {
  ROOM_LIFETIMES, formatRoomDate, localDay, localTime, localToday, rememberHostedRoom, roomLifetime, scheduleRange,
} from '../toolkit/rooms';
import { findCategory, projectSetupKind, setupSteps } from '../toolkit/tools';
import { SetupSteps } from './toolkit/SetupSteps';

// A project's room is usually left up for people to find, not run as a workshop.
const DEFAULT_PROJECT_LIFETIME = '30d';
// When a room scheduled for later starts on its day, until another time is chosen.
const DEFAULT_START_TIME = '09:00';

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
 * When a room set up in stages starts: now, or at a time on a day within the project's
 * dates (scheduleRange), in this browser's time zone. A project without dates, or past
 * them, can only start now.
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
        {radio('date', 'On a date and time', !range)}
        {starts.mode === 'date' && range && (
          <div style={{ marginLeft: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', maxWidth: 280 }}>
              <label htmlFor="configure-start-date" style={smallLabel(t)}>Start date</label>
              <DatePicker t={t} id="configure-start-date" value={starts.date} min={range.min} max={range.max}
                label="Choose the start date" placeholder="Pick a day" clearable={false} disabled={busy}
                onChange={(date) => onChange({ ...starts, date })} style={inputStyle(t)} />
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <label htmlFor="configure-start-time" style={smallLabel(t)}>Start time</label>
              <input id="configure-start-time" type="time" value={starts.time} disabled={busy} required
                onChange={(e) => onChange({ ...starts, time: e.target.value })} style={inputStyle(t)} />
            </div>
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

const smallLabel = (t) => ({ display: 'block', fontSize: 13, fontWeight: 600, color: t.inkDim, marginBottom: 6 });

/** What is wrong with when a room starts, as sentences. */
function startsProblems(project, starts, now = new Date()) {
  if (starts.mode !== 'date') return [];
  const range = scheduleRange(project);
  if (!starts.date) return ['Choose the day it starts.'];
  if (!range || starts.date < range.min || starts.date > range.max) {
    return ['Choose a day within the project\u2019s dates, from today on.'];
  }
  if (!starts.time) return ['Choose the time it starts.'];
  if (starts.date === localToday(now) && starts.time <= localTime(now)) {
    return ['Choose a time later than now.'];
  }
  return [];
}

/**
 * A tool that runs in a room: its own setup, in as many stages as it asks for
 * (setupSteps), and then when the project's room starts and how long it stays open as
 * the last. Given a `room` that has not started yet, it edits that room instead of
 * opening another, starting from everything it was opened with.
 */
function RoomForm({ t, project, tool, room = null, busy, setBusy, onDone, onError, onCancel }) {
  const [setup, setSetup] = useState(() => {
    if (room?.config && Object.keys(room.config).length > 0) return room.config;
    const defaults = tool.setup?.defaults() ?? null;
    // A setup counted in money starts in the currency where the project is.
    if (!defaults?.currency) return defaults;
    return { ...defaults, currency: suggestCurrency({ places: project.locations ?? [], fallback: defaults.currency }) };
  });
  const [lifetime, setLifetime] = useState(() => (room && roomLifetime(room)) || DEFAULT_PROJECT_LIFETIME);
  const [starts, setStarts] = useState(() => (room?.opensAt
    ? { mode: 'date', date: localDay(room.opensAt), time: localTime(room.opensAt) }
    : { mode: 'now', date: '', time: DEFAULT_START_TIME }));
  const staged = Boolean(tool.setup?.steps?.length);
  // When it starts is asked for alongside how long it stays open: always for a room
  // being changed, since it was scheduled, and otherwise for a tool set up in stages.
  const scheduling = staged || Boolean(room);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    onError(null);
    try {
      const opens = scheduling && starts.mode === 'date' ? { on: starts.date, at: starts.time } : null;
      if (room) {
        await rescheduleRoom(room.id, { lifetime, config: setup, opens });
      } else {
        const opened = await createRoom(tool.id, project.id, lifetime, setup, opens);
        // This browser can run the room as its facilitator straight away.
        rememberHostedRoom(opened.id, { pin: opened.pin, token: opened.facilitatorToken, code: opened.joinCode ?? null });
      }
      onDone();
    } catch (err) {
      const doing = room ? `change the room for ${tool.name}` : `open a room for ${tool.name}`;
      console.error(`Could not ${doing}:`, err);
      onError(err?.message ?? `Could not ${doing}.`);
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
    content: <Form t={t} tool={tool} project={project} setup={setup} onChange={setSetup} />,
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
      content: (
        <>
          {intro}{toolSteps[0]?.content}
          {scheduling && <StartsField t={t} project={project} starts={starts} onChange={setStarts} busy={busy} />}
          {openFor}
        </>
      ),
      problems: [...(toolSteps[0]?.problems ?? []), ...(scheduling ? startsProblems(project, starts) : [])],
    }];

  return (
    <SetupSteps t={t} steps={steps} busy={busy} onCancel={onCancel} onFinish={save}
      finishLabel={room ? 'Save changes' : 'Save and go live'} busyLabel="Saving…" />
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

const FORMS = { room: RoomForm, none: NothingForm };

// What configuring each kind of tool involves, for the introduction.
const WHAT_YOU_SET_UP = {
  room: 'You will set it up for this project and choose how long it stays open on the project\u2019s page.',
  none: 'There is nothing to fill in: going live adds it to the project\u2019s page, for people to try.',
};

/** The tool introduced, as its Toolkit cover does, before anything is filled in. */
function Intro({ t, tool, kind, onStart, onCancel }) {
  const note = tool.setupNote !== undefined ? tool.setupNote : WHAT_YOU_SET_UP[kind];
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
      {tool.Preview && (
        <div style={{ margin: '4px 0 16px' }}>
          <tool.Preview t={t} />
        </div>
      )}
      {(tool.duration || tool.createdBy) && (
        <p className="placer-caption" style={{ color: t.inkFaint, margin: '0 0 16px' }}>
          {[tool.duration, tool.createdBy && `By ${tool.createdBy}`].filter(Boolean).join(' · ')}
        </p>
      )}
      {tool.credit && (
        <p className="placer-caption" style={{ color: t.inkFaint, margin: '-8px 0 16px' }}>{tool.credit}</p>
      )}
      {note && (
        <p style={{ fontSize: 14, color: t.ink, lineHeight: 1.6, margin: '0 0 20px', padding: '12px 14px',
          borderRadius: 12, background: t.chrome }}>
          {note}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn t={t} variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Btn>
        <Btn t={t} variant="primary" size="sm" type="button" onClick={onStart}>Get started</Btn>
      </div>
    </div>
  );
}

/**
 * Configuring a tool for a project. Given `room`, one of the project's rooms that has
 * not started yet, it edits that room instead — straight onto the form, since the
 * introduction is for a tool not yet set up.
 */
export function ConfigureToolDialog({ t, project, tool, room = null, onClose, onConfigured }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(Boolean(room));
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
            {room ? 'Edit' : 'Configure'} {tool.name}
          </h2>
        </div>

        {error && (
          <p role="alert" style={{ fontSize: 13.5, color: '#B3261E', margin: '0 0 16px' }}>{error}</p>
        )}

        {started ? (
          <SetupForm t={t} project={project} tool={tool} room={room} busy={busy} setBusy={setBusy}
            onDone={onConfigured} onError={setError} onCancel={onClose} />
        ) : (
          <Intro t={t} tool={tool} kind={kind} onStart={() => setStarted(true)} onCancel={onClose} />
        )}
      </div>
    </div>
  );
}

export default ConfigureToolDialog;
