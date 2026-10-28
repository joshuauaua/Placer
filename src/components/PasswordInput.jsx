/* PLACER — a password field with an eye at its end, to show what was typed and hide
 * it again. Used wherever a password is typed: signing in and up, and Settings. */

import { useState } from 'react';
import { Icon } from './Icon';

export function PasswordInput({ t, id, style, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input id={id} type={shown ? 'text' : 'password'} {...props}
        style={{ ...style, paddingRight: 48 }} />
      <button type="button" onClick={() => setShown((now) => !now)}
        aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} aria-controls={id}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 44, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none',
          color: t.inkDim, cursor: 'pointer', padding: 0 }}>
        <Icon name={shown ? 'eyeOff' : 'eye'} size={20} stroke={1.9} />
      </button>
    </div>
  );
}

export default PasswordInput;
