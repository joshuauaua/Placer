/* PLACER — the strip above a tool when it is being played in a room.
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
import { Panel } from '../ToolLayout';
import { Btn, CopyButton } from '../UI';
import { codeJoinUrl, formatPin, formatRoomDate, formatRoomStart, joinUrl, timeRemaining } from '../../toolkit/rooms';
import { downloadQrSvg } from '../../lib/qrDownload';
import { useEffect, useRef, useState } from 'react';
import { useText } from '../../i18n';
import { LanguagePicker } from '../LanguagePicker';

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
  const { text } = useText();
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
      style={confirming ? { borderColor: '#B3261E', color: '#B3261E' } : undefined}>
      {text(confirming ? 'room.closeConfirm' : 'room.close')}
    </Btn>
  );
}

function DeleteRoom({ t, onDelete }) {
  const { text } = useText();
  // Deleting takes everybody's contributions with it, for good, so it asks first the
  // same way closing does.
  const [confirming, setConfirming] = useState(false);

  return (
    <Btn
      t={t}
      variant="quiet"
      size="sm"
      icon="trash"
      onClick={() => (confirming ? onDelete() : setConfirming(true))}
      onBlur={() => setConfirming(false)}
      style={confirming ? { borderColor: '#B3261E', color: '#B3261E' } : undefined}>
      {text(confirming ? 'room.deleteConfirm' : 'room.delete')}
    </Btn>
  );
}

export function RoomBar({ t, tool, room }) {
  const { text } = useText();
  const left = useTimeRemaining(room.expiresAt);
  const qrRef = useRef(null);

  if (room.status === 'none') return null;

  if (room.status === 'deleted') {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: t.ink, lineHeight: 1.6 }}>
          {text('room.deleted')}
        </p>
      </Panel>
    );
  }

  if (room.status === 'scheduled') {
    const opens = formatRoomStart(room.opensAt);
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: t.ink, lineHeight: 1.6 }}>
          {opens ? text('room.opensOn', { date: opens }) : text('room.notOpenYet')} {text('room.scheduledHint')}
        </p>
      </Panel>
    );
  }

  if (room.status === 'closed' || room.status === 'expired') {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: t.ink, lineHeight: 1.6 }}>
          {text(room.status === 'closed' ? 'room.closed' : 'room.expired')}
          {' '}{text('room.stillWorks')}
        </p>
      </Panel>
    );
  }

  if (room.status === 'error') {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: '#B3261E', lineHeight: 1.6 }}>
          {room.error}
        </p>
      </Panel>
    );
  }

  if (room.status === 'opening') {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <p role="status" style={{ fontSize: 14, color: t.inkDim }}>{text('room.opening')}</p>
      </Panel>
    );
  }

  const people = room.participantCount;
  const countLabel = text('room.contributed', { count: people });

  // A participant: joined already, so no PIN and nothing to press.
  if (!room.isHost) {
    return (
      <Panel t={t} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: tool.color, display: 'flex' }}>
            <Icon name="user" size={18} stroke={2.2} />
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{text('room.youAreIn')}</span>
          <span style={{ fontSize: 13.5, color: t.inkDim, flex: '1 1 240px' }}>
            {text('room.joinsEverybody')} {left ? text('room.countAndLeft', { contributed: countLabel, left }) : `${countLabel}.`}
          </span>
          <LanguagePicker t={t} />
        </div>
      </Panel>
    );
  }

  // Only a long room has a join code, so its presence is what says which kind this is.
  const long = Boolean(room.joinCode);
  const url = long ? codeJoinUrl(room.joinCode) : joinUrl(room.pin);
  const closesOn = formatRoomDate(room.expiresAt);

  return (
    <Panel t={t} title={text('room.title')} style={{ marginBottom: 20 }} aside={
      <span className="placer-mono" style={{ fontSize: 12, color: t.inkDim }}>
        {countLabel}
        {left && (
          <>
            {' · '}
            {/* Under ten minutes is the point at which it stops being background
                information and starts being something to act on. */}
            <span style={{ color: timeIsShort(room.expiresAt) ? '#B3261E' : t.inkDim }}>{text('room.left', { left })}</span>
          </>
        )}
      </span>
    }>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        {/* The QR, at a size that survives being photographed from across a room. */}
        <div ref={qrRef} data-testid="room-qr"
          style={{ background: '#fff', padding: 10, borderRadius: 12, border: `1px solid ${t.line}`, flex: '0 0 auto' }}>
          <QRCode value={url} size={132} bgColor="#ffffff" fgColor="#000000" />
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          {long ? (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim, marginBottom: 6 }}>
                {text('room.scanOrShare')}
              </div>
              {/* No PIN to read out, so the headline is the thing a poster needs: until when. */}
              <div className="placer-disp"
                style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1, color: t.ink }}>
                {text('room.openUntil', { date: closesOn })}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.inkDim, marginBottom: 6 }}>
                {text('room.joinAt', { url: `${typeof window === 'undefined' ? '' : window.location.host}/join` })}
              </div>
              {/* The PIN is the thing somebody reads aloud, so it is set as large as the
                  headline numbers in the tools themselves. */}
              <div className="placer-disp" aria-label={text('room.pinLabel', { pin: formatPin(room.pin) })}
                style={{ fontSize: 46, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.05,
                  color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
                {formatPin(room.pin)}
              </div>
            </>
          )}

          <CopyButton
            t={t}
            value={url}
            label={text('room.copyLink')}
            fieldLabel={text('room.linkLabel')}
            fieldWidth={320}
            style={{ marginTop: 14 }}
            actions={(
              <>
                {long && (
                  <Btn t={t} variant="quiet" size="sm" icon="arrowDown"
                    onClick={() => downloadQrSvg(qrRef.current, `placer-${tool.id}-qr.svg`)}>
                    {text('room.downloadQr')}
                  </Btn>
                )}
                <CloseRoom t={t} onClose={room.close} />
                <DeleteRoom t={t} onDelete={room.remove} />
              </>
            )}
          />

          <p style={{ fontSize: 12.5, color: t.inkFaint, lineHeight: 1.55, marginTop: 12 }}>
            {long
              ? text(left ? 'room.longHintLeft' : 'room.longHint', { date: closesOn, left })
              : text(left ? 'room.shortHintLeft' : 'room.shortHint', { left })}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/** True for a countdown worth colouring: fewer than ten minutes to go. */
function timeIsShort(expiresAt, now = Date.now()) {
  const left = new Date(expiresAt ?? 0).getTime() - now;
  return Number.isFinite(left) && left > 0 && left < 10 * 60000;
}

export default RoomBar;
