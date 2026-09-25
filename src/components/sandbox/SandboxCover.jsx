/* PLACER — the cover page every sandbox experiment opens on.
 *
 * The layout of the landingpage branch's User Labs page (PhotoSplit there): a
 * block of the experiment's character tint fills the left half where User Labs has
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
      <div className="placer-cover-color" style={{ background: experiment.tint }}>
        <Icon name={experiment.icon} size={120} stroke={1.5} style={{ color: t.ink }} />
      </div>

      <div className="placer-cover-copy">
        <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onBack}
          style={{ padding: '0 12px 0 6px', marginBottom: 24, color: t.inkDim }}>
          All experiments
        </Btn>

        <div className="placer-caption" style={{ textTransform: 'uppercase', color: experiment.color,
          fontWeight: 700, marginBottom: 12 }}>
          Sandbox experiment
        </div>
        <h1 style={{ color: t.ink }}>
          {experiment.name}
        </h1>
        {experiment.tagline && (
          <p className="placer-h3" style={{ marginTop: 16, color: t.ink }}>
            {experiment.tagline}
          </p>
        )}
        <p className="placer-body-lg" style={{ marginTop: 16, color: t.inkDim }}>
          {experiment.blurb}
        </p>
        {(experiment.duration || experiment.submittedBy) && (
          <p className="placer-caption" style={{ marginTop: 16, color: t.inkFaint }}>
            {[experiment.duration, experiment.submittedBy && `By ${experiment.submittedBy}`]
              .filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="placer-cover-action">
          <Btn t={t} size="lg" onClick={onStart}>Get started</Btn>
        </div>
      </div>
    </div>
  );
}

export default SandboxCover;
