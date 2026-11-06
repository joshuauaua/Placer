/* PLACER — the first screen of a Gehl field tool's room, for somebody taking part.
 *
 * Whoever comes in by the room's link, PIN or QR code (after its invitation,
 * InviteCover) fills this in before anything else:
 *
 *   signed out          — sign in, here, without leaving the room (AuthForm)
 *   checking            — are they on the room's project? (isRoomMember)
 *   not on the project  — they cannot take part: ask the organiser to add them as a
 *                         collaborator
 *   on the project      — Name (their account's, locked), Date (today), Time (now) and
 *                         Weather; Continue hands the session to the tool (`onReady`)
 *
 * The facilitator running the room never sees it.
 */

import { useEffect, useState } from 'react';
import { Btn, Field, inputStyle } from '../UI';
import { Icon } from '../Icon';
import { AuthForm } from '../AuthPage';
import { isRoomMember as checkMember } from '../../services/rooms';
import { WEATHER, emptyFieldSession, fieldSessionProblems } from '../../lib/toolkit/fieldSession';

function Card({ t, tool, title, children }) {
  return (
    <section aria-label={title} style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16,
      padding: 28, boxShadow: t.shadow, fontFamily: 'var(--placer-font)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: tool.tint, color: t.ink,
          boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name={tool.icon} size={22} stroke={2.2} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>{title}</h1>
          <p className="placer-mono" style={{ margin: '2px 0 0', fontSize: 11, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: t.inkFaint }}>{tool.name}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * `identity` is { status, accountId, name } from useIdentity (App): status 'loading',
 * 'signedIn', 'signedOut' or 'local' (no accounts at all, as in development, where
 * there is no project to be on and nothing is checked).
 */
export function FieldSessionGate({ t, tool, roomId, identity, onReady, isRoomMember = checkMember }) {
  const { status, accountId, name } = identity ?? {};
  const [authMode, setAuthMode] = useState('signin');
  // null while checking, then true or false; an error is said rather than guessed at.
  const [member, setMember] = useState(null);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(() => emptyFieldSession(name ?? ''));
  const [tried, setTried] = useState(false);

  // The name is the account's: it fills in once the profile has been read.
  useEffect(() => {
    setSession((current) => ({ ...current, name: name ?? '' }));
  }, [name]);

  useEffect(() => {
    setMember(null);
    setError(null);
    if (status === 'local') { setMember(true); return undefined; }
    if (status !== 'signedIn' || !accountId || !roomId) return undefined;
    let cancelled = false;
    isRoomMember(roomId)
      .then((yes) => { if (!cancelled) setMember(yes); })
      .catch((err) => {
        console.error('Could not check the project team:', err);
        if (!cancelled) setError(err?.message ?? 'Could not check whether you are on this project.');
      });
    return () => { cancelled = true; };
  }, [status, accountId, roomId, isRoomMember]);

  if (status === 'loading' || status === undefined) {
    return <p role="status" style={{ fontSize: 14, color: t.inkDim }}>Loading…</p>;
  }

  if (status === 'signedOut') {
    return (
      <Card t={t} tool={tool} title="Sign in to take part">
        <p style={{ margin: '0 0 20px', fontSize: 14, color: t.inkDim, lineHeight: 1.55 }}>
          {tool.name} is filled in by the project&rsquo;s team. Sign in with the account the
          organiser added as a collaborator.
        </p>
        <AuthForm t={t} mode={authMode} onModeChange={setAuthMode} onSignedIn={() => {}} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card t={t} tool={tool} title="Something went wrong">
        <p role="alert" style={{ margin: 0, fontSize: 14, color: '#B3261E', lineHeight: 1.55 }}>{error}</p>
      </Card>
    );
  }

  if (member === null) {
    return <p role="status" style={{ fontSize: 14, color: t.inkDim }}>Checking you are on this project…</p>;
  }

  if (!member) {
    return (
      <Card t={t} tool={tool} title="You are not on this project">
        <p role="alert" style={{ margin: 0, fontSize: 14, color: t.ink, lineHeight: 1.55 }}>
          Only the project&rsquo;s team can fill in {tool.name}. Ask the organiser to add{' '}
          {name ? <strong>{name}</strong> : 'your account'} as a collaborator, then open this link again.
        </p>
      </Card>
    );
  }

  const problems = fieldSessionProblems(session);
  const set = (field) => (event) => setSession({ ...session, [field]: event.target.value });
  const submit = (event) => {
    event.preventDefault();
    setTried(true);
    if (problems.length === 0) onReady(session);
  };

  return (
    <Card t={t} tool={tool} title="Before you start">
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field t={t} spacing={0} label="Name" htmlFor="field-session-name"
          hint="From your account. You are taking part as a collaborator on this project.">
          <input id="field-session-name" type="text" value={session.name} readOnly
            style={{ ...inputStyle(t), background: t.surfaceAlt, color: t.inkDim }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18 }}>
          <Field t={t} spacing={0} label="Date" htmlFor="field-session-date">
            <input id="field-session-date" type="date" value={session.date} onChange={set('date')} style={inputStyle(t)} />
          </Field>
          <Field t={t} spacing={0} label="Time" htmlFor="field-session-time">
            <input id="field-session-time" type="time" value={session.time} onChange={set('time')} style={inputStyle(t)} />
          </Field>
        </div>
        <Field t={t} spacing={0} label="Weather" htmlFor="field-session-weather">
          <select id="field-session-weather" value={session.weather} onChange={set('weather')} style={inputStyle(t)}>
            <option value="">Pick the weather</option>
            {WEATHER.map((weather) => <option key={weather} value={weather}>{weather}</option>)}
          </select>
        </Field>
        {tried && problems.length > 0 && (
          <ul role="alert" style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: '#B3261E', lineHeight: 1.6 }}>
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn t={t} type="submit" icon="arrowRight">Continue</Btn>
        </div>
      </form>
    </Card>
  );
}

export default FieldSessionGate;
