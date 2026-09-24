/* PLACER — the strip above an experiment when it is being played in a room.
 *
 * Two audiences, one component. The facilitator is standing at a screen other
 * people are looking at, so the PIN and the QR code are the largest things on it
 * and everything else is small. A participant already joined and does not need the
 * PIN again, so they get the count and nothing to press.
 *
 * The QR encodes the join URL rather than the room id: scanning it has to land
 * somebody in the room without them typing anything.
 *
 * A workshop room lasts two hours from being opened, so the time left is on screen
 * next to the PIN — a facilitator needs to know whether there is room for one more
 * round before they start it.
 *
 * A room a project opened for weeks is a different object: nobody reads its PIN
 * aloud, and it is joined by the code in its QR link rather than by a PIN at all
 * (supabase/rooms-lifetime.sql). So in its place the bar says when the room closes,
 * and offers the QR code as a file to print.
 */

import QRCode from 'react-qr-code';
import { Icon } from '../Icon';
import { Panel } from '../SandboxLayout';
import { Btn, CopyButton } from '../UI';
import { codeJoinUrl, formatPin, formatRoomDate, joinUrl, timeRemaining } from '../../sandbox/rooms';
import { downloadQrSvg } from '../../lib/qrDownload';
import { useEffect, useRef, useState } from 'react';

/**
 * The time left, re-read every half minute. Coarse on purpose — the countdown is
 * shown in whole minutes, so anything finer would be redraws nobody can see.
 */
function useTimeRemaining(expiresAt) {
  const [left, setLeft] = useState(() => timeRemaining(expiresAt));

  useEffect(() => {
    setLeft(timeRemaining(expiresAt));
    if (!expiresAt) return undefined;

    const tick = setInterval(() => setLeft(timeRemaining(expiresAt)), 30000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  return left;
}

function CloseRoom({ t, onClose }) {
  // Closing ends it for everybody in the room, so it asks once first — the same
  // two-step the GDPR page uses for erasing data.
  const [confirming, setConfirming] = useState(false);

  return (
    <Btn
      t={t}
      variant="quiet"
      size="sm"
      icon="close"
      onClick={() => (confirming ? onClose() : setConfirming(true))}
      onBlur={() => setConfirming(false)}
      style={confirming ? { borderColor: '#C0392B', color: '#C0392B' } : undefined}>
      {confirming ? 'Close — confirm' : 'Close room'}
    </Btn>
  );
}

export function RoomBar({ t, experiment, room }) {
  const left = useTimeRemaining(room.expiresAt);
  const qrRef = useRef(null);

  if (room.status === 'none') return null;

  if (room.status === 'closed' || room.status === 'expired') {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: t.ink, lineHeight: 1.6 }}>
          {room.status === 'closed'
            ? 'This room is closed. Nothing more can be added to it, and what it held has been let go.'
            : 'This room has run out of time, and what it held has been let go.'}
          {' '}The experiment still works on its own, and a new room can be opened for another round.
        </p>
      </Panel>
    );
  }

  if (room.status === 'error') {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: '#C0392B', lineHeight: 1.6 }}>
          {room.error}
        </p>
      </Panel>
    );
  }

  if (room.status === 'opening') {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: t.inkDim }}>Opening the room…</p>
      </Panel>
    );
  }

  const people = room.participantCount;
  const countLabel = `${people} ${people === 1 ? 'person has' : 'people have'} contributed`;

  // A participant: joined already, so no PIN and nothing to press.
  if (!room.isHost) {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: experiment.color, display: 'flex' }}>
            <Icon name="user" size={18} stroke={2.2} />
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>You are in a room</span>
          <span style={{ fontSize: 13.5, color: t.inkDim }}>
            Your ballot joins everybody else&rsquo;s. {countLabel}
            {left ? `, and the room has ${left} left` : ''}.
          </span>
        </div>
      </Panel>
    );
  }

  // Only a long room has a join code, so its presence is what says which kind this is.
  const long = Boolean(room.joinCode);
  const url = long ? codeJoinUrl(room.joinCode) : joinUrl(room.pin);
  const closesOn = formatRoomDate(room.expiresAt);

  return (
    <Panel t={t} title="The room" style={{ marginBottom: 20 }} aside={
      <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
        {countLabel}
        {left && (
          <>
            {' · '}
            {/* Under ten minutes is the point at which it stops being background
                information and starts being something to act on. */}
            <span style={{ color: timeIsShort(left) ? '#C0392B' : t.inkDim }}>{left} left</span>
          </>
        )}
      </span>
    }>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        {/* The QR, at a size that survives being photographed from across a room. */}
        <div ref={qrRef} data-testid="room-qr"
          style={{ background: '#fff', padding: 10, borderRadius: 10, border: `1px solid ${t.line}`, flex: '0 0 auto' }}>
          <QRCode value={url} size={132} bgColor="#ffffff" fgColor="#000000" />
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          {long ? (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim, marginBottom: 6 }}>
                Scan the code or share the link
              </div>
              {/* No PIN to read out, so the headline is the thing a poster needs: until when. */}
              <div className="placer-disp"
                style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1.1, color: t.ink }}>
                Open until {closesOn}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim, marginBottom: 6 }}>
                Join at {typeof window === 'undefined' ? '' : window.location.host}/join
              </div>
              {/* The PIN is the thing somebody reads aloud, so it is set as large as the
                  headline numbers in the experiments themselves. */}
              <div className="placer-disp" aria-label={`Room PIN ${formatPin(room.pin)}`}
                style={{ fontSize: 46, fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.05,
                  color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
                {formatPin(room.pin)}
              </div>
            </>
          )}

          <CopyButton
            t={t}
            value={url}
            label="Copy join link"
            fieldLabel="Link to join this room"
            fieldWidth={320}
            style={{ marginTop: 14 }}
            actions={(
              <>
                {long && (
                  <Btn t={t} variant="quiet" size="sm" icon="arrowDown"
                    onClick={() => downloadQrSvg(qrRef.current, `placer-${experiment.id}-qr.svg`)}>
                    Download QR
                  </Btn>
                )}
                <CloseRoom t={t} onClose={room.close} />
              </>
            )}
          />

          <p style={{ fontSize: 12.5, color: t.inkFaint, lineHeight: 1.55, marginTop: 12 }}>
            {long
              ? `The room stays open until ${closesOn}${left ? ` — ${left} left` : ''}. You can close it sooner from here or from the project's dashboard. Either way what it held is let go a day after it ends.`
              : `The room lasts two hours from opening${left ? ` — ${left} left` : ''}, and closing it ends it sooner. Either way what it held is let go.`}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/** True for a countdown worth colouring: minutes only, and fewer than ten of them. */
function timeIsShort(left) {
  const match = /^(\d+)m$/.exec(left ?? '');
  return left === 'under a minute' || (match !== null && Number(match[1]) < 10);
}

export default RoomBar;
