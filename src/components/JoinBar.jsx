/* PLACER — the strip under the nav bar for joining a live tool.
 *
 * Somebody at a workshop reads a six-digit PIN off the facilitator's screen and
 * types it here. The holding page has no rooms of its own, so a whole PIN is
 * handed to the app's /join page, which looks the room up and opens its tool.
 *
 * It is fixed under the nav bar; App.jsx pushes the page down by its height
 * while it is open. Its styles live in index.css (.placer-join-bar).
 */

import { useState } from 'react';
import posthog from 'posthog-js';
import { Btn } from './UI';
import { Icon } from './Icon';

// The same length the app's parsePin accepts (src/toolkit/rooms.js on Development).
const PIN_LENGTH = 6;

const APP_URL = import.meta.env.VITE_APP_URL || 'https://beta.plcr.org';

export function JoinBar({ t, onClose }) {
  const [pin, setPin] = useState('');
  const complete = pin.length === PIN_LENGTH;

  const join = (event) => {
    event.preventDefault();
    if (!complete) return;
    posthog.capture('join_code_submitted');
    window.location.assign(`${APP_URL}/join?pin=${pin}`);
  };

  return (
    <div className="placer-join-bar" style={{ color: t.ink }}>
      <form className="placer-join-bar-form" onSubmit={join}>
        <label htmlFor="placer-join-pin" className="placer-join-bar-label">
          Enter code<span className="placer-join-bar-label-rest"> to join a live tool</span>
        </label>
        <input
          id="placer-join-pin"
          className="placer-join-bar-input"
          // Text rather than type="number": a PIN can start with 0, and a number
          // input would drop it and offer arrows to step through PINs.
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={PIN_LENGTH}
          placeholder="000000"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
        />
        <Btn t={t} size="sm" disabled={!complete}>Join</Btn>
      </form>

      <button type="button" className="placer-join-bar-close" onClick={onClose} aria-label="Close">
        <Icon name="close" size={18} stroke={2} />
      </button>
    </div>
  );
}

export default JoinBar;
