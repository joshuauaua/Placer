/* PLACER — Quickstart: a walk through creating a first project.
 *
 * Reached from the dashboard's "Getting Started" cards. It describes the five
 * steps of ProjectSetupPage in order, then what the project gives you once it
 * exists, and ends where it should: on the button that starts one. Keep the steps
 * in step with ProjectSetupPage's STEPS.
 */

import { Btn } from './UI';
import { CHARACTER } from '../theme';

const STEPS = [
  {
    title: 'Read what a project is',
    body: 'A project brings people together around a place: to imagine what it could be, and to decide or push for what happens to it. The first screen explains what you get.',
  },
  {
    title: 'Choose what kind of project it is',
    body: 'Say whether you have a say over the place, want to push for change in it, or something else. The next step asks its questions with that in mind.',
  },
  {
    title: 'Fill in the basics',
    body: 'Give it a name, write its goals, and add start and end dates if it has them. If you are an admin of an organisation, you can run it in the organisation’s name.',
  },
  {
    title: 'Mark the place',
    body: 'List the places it is about, one per line, and draw the area it covers on the map.',
  },
  {
    title: 'Add an image',
    body: 'A landscape photo is shown at the top of the project’s page and on its card. You can skip it and add one later.',
  },
];

const NEXT = [
  {
    title: 'Run it from its dashboard',
    body: 'Add collaborators, share links, and see how many people have viewed the project’s page.',
  },
  {
    title: 'Share its public page',
    body: 'Anyone can open it from a link, follow the project, and imagine something for it on the map.',
  },
  {
    title: 'Gather views with the Toolkit',
    body: 'Open a Toolkit room for the project, such as a vote or a budget ballot, and let people join with a PIN or a QR code.',
  },
];

// The step numbers cycle through the three brand colours.
const NUMBER_COLOURS = [CHARACTER.cityWorker, CHARACTER.practitioner, CHARACTER.citizen];

function Step({ t, number, title, body }) {
  const colour = NUMBER_COLOURS[(number - 1) % NUMBER_COLOURS.length];
  return (
    <li style={{ display: 'flex', gap: 20, alignItems: 'flex-start', padding: '20px 0',
      borderBottom: `1px solid ${t.line}` }}>
      <span aria-hidden="true" className="placer-disp" style={{ width: 44, height: 44, borderRadius: 12,
        flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: colour.c100, boxShadow: `inset 0 0 0 1px ${colour.c700}`, color: t.ink,
        fontSize: 18, fontWeight: 700 }}>
        {number}
      </span>
      <div>
        <h3 style={{ fontSize: 19, fontWeight: 700, color: t.ink, marginBottom: 6 }}>{title}</h3>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: t.inkDim }}>{body}</p>
      </div>
    </li>
  );
}

export function QuickstartPage({ t, onNewProject }) {
  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px 96px' }} className="placer-scroll">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="placer-caption" style={{ textTransform: 'uppercase', letterSpacing: '0.08em',
          fontWeight: 700, color: t.inkDim, marginBottom: 12 }}>
          Quickstart tutorial
        </div>
        <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
          Create your first Project
        </h1>
        <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, marginBottom: 40 }}>
          Starting a project takes five short steps and a few minutes. Here is what each
          one asks, and what you can do once it is set up.
        </p>

        <h2 className="placer-h2" style={{ color: t.ink, marginBottom: 4 }}>The five steps</h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 48px' }}>
          {STEPS.map((step, index) => (
            <Step key={step.title} t={t} number={index + 1} {...step} />
          ))}
        </ol>

        <h2 className="placer-h2" style={{ color: t.ink, marginBottom: 4 }}>Once it exists</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 48px' }}>
          {NEXT.map((item) => (
            <li key={item.title} style={{ padding: '16px 0', borderBottom: `1px solid ${t.line}` }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: t.ink, marginBottom: 4 }}>{item.title}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: t.inkDim }}>{item.body}</p>
            </li>
          ))}
        </ul>

        {onNewProject && (
          <Btn t={t} variant="primary" size="lg" icon="plus" onClick={onNewProject}>
            Create a Project
          </Btn>
        )}
      </div>
    </div>
  );
}

export default QuickstartPage;
