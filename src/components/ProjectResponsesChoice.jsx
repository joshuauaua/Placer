/* PLACER — how loud answers in a project's Toolkit sessions are.
 *
 * The same choice in two places: in Settings, for every project at once, and on a
 * project's dashboard, for that one, where it can also follow the Settings choice.
 * See supabase/notifications-projects.sql for what each level sends.
 */

import { PROJECT_RESPONSE_LEVELS } from '../services/notifications';

export const PROJECT_RESPONSE_LABELS = {
  every: { title: 'Every response', description: 'An alert for each new answer, as it comes in.' },
  session: { title: 'When a session closes',
    description: 'One summary per session, once whoever is running it closes it.' },
  off: { title: 'Off', description: 'No alerts about answers.' },
};

/**
 * A radio group. `value` is one of PROJECT_RESPONSE_LEVELS, or null for "use my
 * default" when `defaultLevel` is given (the project dashboard); without it (Settings)
 * there is no such option.
 */
export function ProjectResponsesChoice({ t, name, legend, value, defaultLevel, disabled, onChange }) {
  const options = [
    ...(defaultLevel ? [{ key: null, title: 'Use my default',
      description: `${PROJECT_RESPONSE_LABELS[defaultLevel].title}, as set in Settings.` }] : []),
    ...PROJECT_RESPONSE_LEVELS.map((level) => ({ key: level, ...PROJECT_RESPONSE_LABELS[level] })),
  ];

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }} disabled={disabled}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 10, padding: 0 }}>
        {legend}
      </legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map(({ key, title, description }) => (
          <label key={key ?? 'default'} style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: disabled ? 'default' : 'pointer' }}>
            <input type="radio" name={name} checked={value === key} onChange={() => onChange(key)}
              style={{ marginTop: 3 }} />
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: t.ink }}>{title}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim, lineHeight: 1.4, marginTop: 2 }}>
                {description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default ProjectResponsesChoice;
