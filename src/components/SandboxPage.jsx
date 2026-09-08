/* PLACER — Sandbox: a gallery of small experiments about participatory urban design.
 *
 * Each tile is a self-contained toy in the spirit of Chrome Music Lab: no sign-in,
 * nothing saved, and something moving within a second of arriving. The register of
 * experiments is src/sandbox/experiments.js.
 *
 * The page owns the /sandbox part of the URL itself rather than taking the selected
 * experiment as a prop, so every experiment has a link that can be shared.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { SandboxLayout } from './SandboxLayout';
import { EXPERIMENTS, findExperiment } from '../sandbox/experiments';

/** The experiment id in a path like /sandbox/street-mixer, if there is one. */
export function experimentIdFrom(path) {
  const match = /^\/sandbox\/([^/?#]+)/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function Tile({ t, experiment, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
        border: 'none', borderRadius: 14, padding: '26px 24px 24px', minHeight: 220,
        background: `linear-gradient(150deg, ${experiment.color} 0%, ${experiment.color}D9 100%)`,
        color: '#fff', display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: "'Archivo', sans-serif", boxShadow: t.shadow,
        transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-4px)';
        event.currentTarget.style.boxShadow = '0 16px 36px rgba(0,0,0,0.18)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.boxShadow = t.shadow;
      }}>
      {/* The experiment's own mark, oversized and half out of frame. */}
      <span aria-hidden="true" style={{ position: 'absolute', right: -18, bottom: -22, opacity: 0.22 }}>
        <Icon name={experiment.icon} size={150} stroke={1.4} />
      </span>

      <Icon name={experiment.icon} size={30} stroke={2.1} />
      <span className="placer-disp" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15, position: 'relative' }}>
        {experiment.name}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.92, lineHeight: 1.45, position: 'relative', maxWidth: 320 }}>
        {experiment.tagline}
      </span>
      <div style={{ flex: 1 }} />
      <span className="placer-mono" style={{ fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        Open <Icon name="arrowRight" size={14} stroke={2.4} />
      </span>
    </button>
  );
}

export function SandboxPage({ t }) {
  const [location, navigate] = useLocation();
  const requestedId = experimentIdFrom(location);
  const experiment = requestedId ? findExperiment(requestedId) : null;
  const missing = requestedId && !experiment ? requestedId : null;

  useEffect(() => {
    if (!experiment) return;
    posthog.capture('sandbox_experiment_opened', { experiment: experiment.id });
  }, [experiment]);

  const Experiment = experiment?.component;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page, padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {experiment && Experiment ? (
          <SandboxLayout t={t} experiment={experiment} onBack={() => navigate('/sandbox')}>
            <Experiment t={t} experiment={experiment} />
          </SandboxLayout>
        ) : (
          <>
            <div style={{ marginBottom: 40 }}>
              <div className="placer-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: t.inkDim, marginBottom: 14 }}>
                <Icon name="flask" size={15} stroke={2.1} />
                Experiments
              </div>
              <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 900, color: t.ink,
                letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.05 }}>
                Sandbox
              </h1>
              <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, maxWidth: 680 }}>
                Small tools for the arguments participatory design keeps having. Each one takes a few
                seconds to understand and makes one point that is hard to make with a drawing. Nothing
                is saved, and nothing here is a proposal — it is somewhere to find out what you think.
              </p>
            </div>

            {missing && (
              <p role="status" style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 10,
                background: t.surfaceAlt, border: `1px solid ${t.line}`, fontSize: 14, color: t.ink }}>
                There is no experiment called <span className="placer-mono">{missing}</span>. Here is everything there is.
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {EXPERIMENTS.map((entry) => (
                <Tile key={entry.id} t={t} experiment={entry} onOpen={() => navigate(`/sandbox/${entry.id}`)} />
              ))}
            </div>

            <p style={{ marginTop: 32, fontSize: 13.5, color: t.inkFaint, lineHeight: 1.65, maxWidth: 680 }}>
              The figures behind these are deliberately rough — calibrated so the trade-offs behave the
              way real ones do, not so they can size a real scheme.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default SandboxPage;
