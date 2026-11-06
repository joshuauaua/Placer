/* PLACER — a timer's control, as every tool with a timer draws it: a square button with
 * only its icon — start, pause, stop or refresh (Icon.jsx). What it does is its name, for
 * a screen reader and as its tooltip ("Start the 60 second timer", "Pause"), since there
 * is no text on it. `primary` is the one to press next: ink, where the rest are outlined.
 */

import { Btn } from '../UI';

export function TimerButton({ t, icon, label, onClick, primary = false, disabled = false }) {
  return (
    <Btn t={t} size="sm" variant={primary ? 'primary' : 'outline'} icon={icon} ariaLabel={label}
      disabled={disabled} onClick={onClick} style={{ width: 40, padding: 0, flex: '0 0 auto' }} />
  );
}

export default TimerButton;
