/* PLACER — Tutorials, on the Tools page: a card per video (toolkit/tutorials.js), its
 * player above its title and how long it runs. A tutorial with an `embedUrl` plays in
 * place, in an iframe; one without shows a placeholder where the video will go. */

import { Icon } from './Icon';
import { TUTORIALS } from '../toolkit/tutorials';

function TutorialCard({ tutorial }) {
  return (
    <li className="placer-tutorial-card">
      <div className="placer-tutorial-video">
        {tutorial.embedUrl ? (
          <iframe src={tutorial.embedUrl} title={tutorial.title} loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <div role="img" aria-label={`Video coming soon: ${tutorial.title}`} className="placer-tutorial-placeholder">
            <Icon name="video" size={44} stroke={1.6} />
            <span>Video coming soon</span>
          </div>
        )}
      </div>
      <div className="placer-template-text">
        <h3 className="placer-template-title" style={{ margin: 0 }}>{tutorial.title}</h3>
        {tutorial.duration && <span className="placer-started-details">{tutorial.duration}</span>}
      </div>
    </li>
  );
}

export function Tutorials({ t }) {
  if (TUTORIALS.length === 0) return null;
  return (
    <section aria-labelledby="tutorials-title" style={{ marginBottom: 32 }}>
      <h2 id="tutorials-title" className="placer-caption" style={{ textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 700, color: t.inkDim, marginBottom: 12 }}>
        Tutorials
      </h2>
      <ul className="placer-template-grid">
        {TUTORIALS.map((tutorial) => <TutorialCard key={tutorial.id} tutorial={tutorial} />)}
      </ul>
    </section>
  );
}

export default Tutorials;
