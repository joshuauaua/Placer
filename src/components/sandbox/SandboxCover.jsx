/* PLACER — the cover page every sandbox experiment opens on.
 *
 * The layout of the landingpage branch's User Labs page (PhotoSplit there): a
 * block of the experiment's own colour fills the left half where User Labs has
 * its photo, and the copy sits centred on the right, ending in the one button
 * that starts the tool. On a phone they stack, colour first. Everything on it is
 * read from the registry entry, so the tile, the cover and the header above the
 * tool never disagree. The geometry lives in index.css (.placer-cover-*).
 */

import { Icon } from '../Icon';
import { Btn } from '../UI';

export function SandboxCover({ t, experiment, onStart, onBack }) {
  return (
    <div className="placer-cover" style={{ background: t.page }}>
      <div className="placer-cover-color" style={{ background: experiment.color }}>
        <Icon name={experiment.icon} size={120} stroke={1.4} style={{ color: '#fff' }} />
      </div>

      <div className="placer-cover-copy">
        <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onBack}
          style={{ padding: '0 12px 0 6px', marginBottom: 24, color: t.inkDim }}>
          All experiments
        </Btn>

        <div className="placer-mono" style={{ fontSize: 11.5, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: t.inkDim, marginBottom: 14 }}>
          Sandbox experiment
        </div>
        <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em',
          lineHeight: 1.05, color: t.ink }}>
          {experiment.name}
        </h1>
        {experiment.tagline && (
          <p style={{ marginTop: 16, fontSize: 21, fontWeight: 700, lineHeight: 1.4, color: t.ink }}>
            {experiment.tagline}
          </p>
        )}
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
          {experiment.blurb}
        </p>
        {(experiment.duration || experiment.submittedBy) && (
          <p className="placer-mono" style={{ marginTop: 20, fontSize: 11, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: t.inkFaint }}>
            {[experiment.duration, experiment.submittedBy && `By ${experiment.submittedBy}`]
              .filter(Boolean).join(' · ')}
          </p>
        )}

        <button onClick={onStart} className="placer-cover-action"
          style={{ background: t.primaryBg, color: t.primaryFg }}>
          Get started
        </button>
      </div>
    </div>
  );
}

export default SandboxCover;
