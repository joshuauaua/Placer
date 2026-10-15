/* PLACER — the language switch on the participant side (src/i18n).
 *
 * A plain select, each language named in itself, so somebody who reads only Turkish
 * can still find Türkçe. Shown where a participant arrives: joining a room, a tool's
 * cover, and the bar above a room they are in.
 */

import { useId } from 'react';
import { LANGUAGES, setLanguage, useText } from '../i18n';

export function LanguagePicker({ t, style }) {
  const id = useId();
  const { text, language } = useText();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}>
      <label htmlFor={id} className="placer-visually-hidden">{text('common.language')}</label>
      <select
        id={id}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        style={{ height: 34, padding: '0 10px', borderRadius: 10, border: `1px solid ${t.lineStrong}`,
          background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 13.5, fontWeight: 600,
          cursor: 'pointer' }}>
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code} lang={option.code}>{option.name}</option>
        ))}
      </select>
    </span>
  );
}

export default LanguagePicker;
