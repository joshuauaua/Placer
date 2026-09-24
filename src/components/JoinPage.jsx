/* PLACER — joining a sandbox room.
 *
 * The page a QR code lands on, and the page somebody types a PIN into. It is its
 * own route rather than a view inside the app because it is only ever an entry
 * point: the whole job is to work out which room a PIN means and get out of the way.
 *
 * With a ?pin= in the URL it looks the room up immediately, so scanning a code
 * involves no tapping at all. Without one — or when that PIN has been closed — it
 * asks, which is also the way in for somebody reading the PIN off a screen.
 *
 * A ?code= is a long room's QR link (supabase/rooms-lifetime.sql). It is followed the
 * same way, but a poster outlives its poll, so a code for a room that has ended says
 * when it ended rather than that nothing matched.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { Btn, Logo } from './UI';
import { findExperiment } from '../sandbox/experiments';
import { PIN_LENGTH, formatPin, formatRoomDate, parseJoinCode, parsePin, roomPath } from '../sandbox/rooms';
import { isSupabaseConfigured, joinRoom, joinRoomByCode } from '../services/rooms';

export function JoinPage({ t }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [typed, setTyped] = useState('');
  // 'idle' | 'joining' | 'unknown' | 'ended' | 'error'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  // When the room a ?code= named ended, for status 'ended'.
  const [endedOn, setEndedOn] = useState(null);

  const configured = isSupabaseConfigured();

  const attempt = useCallback(
    async (raw) => {
      const pin = parsePin(raw);
      if (!pin) {
        setStatus('unknown');
        return;
      }

      setStatus('joining');
      setError(null);

      try {
        const room = await joinRoom(pin);
        if (!room) {
          setStatus('unknown');
          return;
        }

        const experiment = findExperiment(room.experiment);
        if (!experiment) {
          // The room is for an experiment this build does not have — an old link
          // against a newer database, or the other way round.
          setError('That room is for an experiment this version of PLACER does not have.');
          setStatus('error');
          return;
        }

        posthog.capture('sandbox_room_joined', { experiment: room.experiment });
        navigate(roomPath(room.experiment, room.id));
      } catch (cause) {
        setError(cause.message);
        setStatus('error');
      }
    },
    [navigate]
  );

  const attemptCode = useCallback(
    async (code) => {
      setStatus('joining');
      setError(null);

      try {
        const room = await joinRoomByCode(code);
        if (!room) {
          setStatus('unknown');
          return;
        }
        if (room.status !== 'open') {
          setEndedOn(formatRoomDate(room.endsAt));
          setStatus('ended');
          return;
        }
        if (!findExperiment(room.experiment)) {
          setError('That room is for an experiment this version of PLACER does not have.');
          setStatus('error');
          return;
        }

        posthog.capture('sandbox_room_joined', { experiment: room.experiment, via: 'code' });
        navigate(roomPath(room.experiment, room.id));
      } catch (cause) {
        setError(cause.message);
        setStatus('error');
      }
    },
    [navigate]
  );

  // A PIN or a code in the URL is followed once, on arrival. Re-running this when it
  // changes would fight the navigate() above.
  const params = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  const fromUrl = parsePin(params.get('pin'));
  const codeFromUrl = parseJoinCode(params.get('code'));
  useEffect(() => {
    if (!configured) return;
    if (codeFromUrl) attemptCode(codeFromUrl);
    else if (fromUrl) attempt(fromUrl);
  }, [configured, fromUrl, codeFromUrl, attempt, attemptCode]);

  const digits = typed.replace(/\D/g, '');
  const ready = digits.length === PIN_LENGTH;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ marginBottom: 28 }}>
          <Logo t={t} size={22} />
        </div>

        <h1 className="placer-disp" style={{ fontSize: 34, fontWeight: 900, color: t.ink,
          letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>
          Join a room
        </h1>

        {!configured ? (
          <p role="status" style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6 }}>
            Rooms are not switched on for this site. A room is shared between devices, so it needs
            a database behind it — see <span className="placer-mono">supabase/README.md</span>.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 15.5, color: t.inkDim, lineHeight: 1.6, marginBottom: 24 }}>
              Type the six digits on the facilitator&rsquo;s screen. Your answers join everyone
              else&rsquo;s in the room.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (ready) attempt(digits);
              }}>
              <label htmlFor="join-pin" style={{ display: 'block', fontSize: 12.5, fontWeight: 700,
                color: t.inkDim, marginBottom: 6 }}>
                Room PIN
              </label>
              <input
                id="join-pin"
                // Not type="number": a PIN is six characters, not a quantity, and a
                // spinner on it is nonsense. inputMode gets the numeric keypad anyway.
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="839-201"
                value={typed}
                onChange={(event) => {
                  setTyped(formatPin(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)));
                  if (status !== 'idle') setStatus('idle');
                }}
                style={{ width: '100%', height: 58, padding: '0 16px', borderRadius: 10,
                  border: `1.5px solid ${status === 'unknown' ? '#C0392B' : t.line}`,
                  background: t.chrome, color: t.ink, fontFamily: 'var(--placer-font)',
                  fontWeight: 900, fontSize: 26, letterSpacing: '0.06em', outline: 'none',
                  fontVariantNumeric: 'tabular-nums' }}
              />

              <Btn
                t={t}
                type="submit"
                size="lg"
                icon="arrowRight"
                full
                disabled={!ready || status === 'joining'}
                style={{ marginTop: 14 }}>
                {status === 'joining' ? 'Looking for it…' : 'Join'}
              </Btn>
            </form>

            {status === 'unknown' && (
              <p role="status" style={{ marginTop: 16, fontSize: 14, color: '#C0392B', lineHeight: 1.6 }}>
                {codeFromUrl && !ready
                  ? 'That link does not lead to a room any more. It may have ended a while ago.'
                  : 'No open room has that PIN. It may have been closed, or one of the digits may be off.'}
              </p>
            )}

            {status === 'ended' && (
              <p role="status" style={{ marginTop: 16, fontSize: 14, color: t.ink, lineHeight: 1.6 }}>
                {endedOn ? `This room closed on ${endedOn}.` : 'This room has closed.'} Thanks for
                looking &mdash; it is not taking any more answers.
              </p>
            )}

            {status === 'error' && (
              <p role="status" style={{ marginTop: 16, fontSize: 14, color: '#C0392B', lineHeight: 1.6 }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default JoinPage;
