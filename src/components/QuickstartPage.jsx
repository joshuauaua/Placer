/* PLACER — Quickstart: a walk through creating a first project.
 *
 * Reached from the dashboard's "Getting Started" cards. It describes setting up a
 * project in five steps, then what the project gives you once it is live, and ends
 * where it should: on the button that starts one.
 */

import { Btn } from './UI';
import { CHARACTER } from '../theme';

// A step's `points` are labelled items listed under its body, and `after` a line
// that follows them.
const STEPS = [
  {
    title: 'Understand What a Project Is',
    body: 'A project brings people together around a place. It serves as a digital hub where communities can understand a location, reimagine its future, make decisions, and drive real-world change.',
  },
  {
    title: 'Choose Your Project Type',
    body: 'Indicate whether you have official decision-making authority over the site, are advocating for community change, or are pursuing another goal. This tailors the remaining setup steps to your focus.',
  },
  {
    title: 'Fill In the Basics',
    points: [
      { label: 'Details', text: 'Provide a clear, recognizable name and define your core goals.' },
      { label: 'Timeline', text: 'Set start and end dates to give your project structure.' },
      { label: 'Organization', text: 'Choose whether to publish under an organization account or as an individual.' },
      { label: 'Location', text: 'Enter key addresses or draw custom boundaries and target areas directly on the interactive map.' },
    ],
  },
  {
    title: 'Select Your Interactive Tools',
    body: 'Choose from a library of engagement tools created by expert organizations. Select and layer tools based on what your project needs to achieve:',
    points: [
      { label: 'Understand', text: 'Collect local data, run community surveys, and gather baseline insights.' },
      { label: 'Imagine', text: 'Use visual interactive tools to help participants explore possibilities and share ideas.' },
      { label: 'Plan', text: 'Mobilize action with community polls, co-budgeting exercises, and decision-making modules.' },
    ],
    after: 'Participants can engage with these tools throughout the lifecycle of your project via a direct link, PIN, or QR code.',
  },
  {
    title: 'Add Visuals & Customize the Page',
    body: 'Upload a crisp landscape photo to serve as the main project banner and preview card image. Customize the page layout to make sure it looks inviting and informative to the public before you launch.',
  },
];

const NEXT = [
  {
    title: 'Manage from the Dashboard',
    body: 'Monitor page views, invite collaborators, and manage team access settings.',
  },
  {
    title: 'Share the Public Page',
    body: 'Distribute your project link so the community can follow updates and map out ideas in real time.',
  },
  {
    title: 'Gather & Track Input',
    body: 'Use your selected Toolkit modules to host interactive sessions, collect feedback, and turn community input into action.',
  },
];

// The step numbers cycle through the three brand colours.
const NUMBER_COLOURS = [CHARACTER.cityWorker, CHARACTER.practitioner, CHARACTER.citizen];

function Step({ t, number, title, body, points, after }) {
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
        {body && <p style={{ fontSize: 16, lineHeight: 1.6, color: t.inkDim }}>{body}</p>}
        {points && (
          <ul style={{ margin: body ? '8px 0 0' : 0, paddingLeft: 20, fontSize: 16, lineHeight: 1.6,
            color: t.inkDim }}>
            {points.map((point) => (
              <li key={point.label} style={{ marginBottom: 4 }}>
                <strong style={{ color: t.ink }}>{point.label}:</strong> {point.text}
              </li>
            ))}
          </ul>
        )}
        {after && <p style={{ fontSize: 16, lineHeight: 1.6, color: t.inkDim, marginTop: 8 }}>{after}</p>}
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
          Create Your First Project
        </h1>
        <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, marginBottom: 40 }}>
          Launch a project in five quick steps. Here is how to set it up and what you can do
          once your project is live.
        </p>

        <h2 className="placer-h2" style={{ color: t.ink, marginBottom: 4 }}>Setting Up Your Project</h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 48px' }}>
          {STEPS.map((step, index) => (
            <Step key={step.title} t={t} number={index + 1} {...step} />
          ))}
        </ol>

        <h2 className="placer-h2" style={{ color: t.ink, marginBottom: 4 }}>What You Can Do Once It’s Live</h2>
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
