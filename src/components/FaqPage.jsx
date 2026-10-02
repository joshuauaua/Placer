/* PLACER — FAQ Page
 *
 * Each question is a <details>, so it opens and closes without any state and stays
 * reachable by keyboard.
 */

import { Icon } from './Icon';

const CONTACT_EMAIL = 'info@plcr.org';

const QUESTIONS = [
  {
    q: 'What is PLACER?',
    a: 'PLACER is a toolkit for shaping shared spaces together. It lets residents, designers and local authorities understand how a place is used, imagine how it could change, and plan that change in one transparent place.',
  },
  {
    q: 'Who is PLACER for?',
    a: 'Anyone who cares about a street, square or park: residents with an idea, community groups, designers, and the city officials and planners who make decisions about public space.',
  },
  {
    q: 'Does PLACER cost anything?',
    a: 'No. PLACER is free to use while it is being developed and tested.',
  },
  {
    q: 'Do I need an account?',
    a: 'You can explore the map and read what others have imagined without one. To post an imagination, follow people and projects, or run a project of your own, create a free account.',
  },
  {
    q: 'What is an imagination?',
    a: 'A picture of how a place could be. You pick a spot on the map, step into the street view, place things like benches, trees and planters, then describe your idea and post it to the map for others to see.',
  },
  {
    q: 'What is the Toolkit?',
    a: 'A collection of participatory methods, made by organisations working on public space, as tools you can use on your own or in a workshop. Understand tools show how a place is used today, Imagine tools explore how it could change, and Plan tools help a group decide on that change together.',
  },
  {
    q: 'Can my organisation add a tool to the Toolkit?',
    a: 'Yes. Use Contribute on the Toolkit page to tell us about your method, and we will get in touch about bringing it into PLACER, credited to your organisation.',
  },
  {
    q: 'Can my organisation use PLACER?',
    a: 'Yes. Create an organisation from Settings, add fellow admins, and run projects in its name, each with its own public page.',
  },
  {
    q: 'Who is behind PLACER?',
    a: 'PLACER is developed by STPLN in Malmö and Ankara Aks in Ankara, funded by the Swedish Institute.',
  },
];

export function FaqPage({ t }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '48px 40px 96px'
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 16, paddingBottom: 32, borderBottom: `1px solid ${t.line}` }}>
          <h1 className="placer-disp" style={{
            fontSize: 48,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 16,
            lineHeight: 1.1
          }}>
            Frequently Asked Questions
          </h1>
          <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6 }}>
            Can&rsquo;t find what you&rsquo;re looking for? Email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: t.ink, fontWeight: 500, textDecoration: 'underline' }}>
              {CONTACT_EMAIL}
            </a>.
          </p>
        </div>

        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="placer-faq-item" style={{ borderBottom: `1px solid ${t.line}` }}>
            <summary style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '20px 0',
              fontSize: 18,
              fontWeight: 700,
              color: t.ink,
              cursor: 'pointer',
              listStyle: 'none'
            }}>
              {q}
              <Icon name="chevDown" size={20} style={{ color: t.inkDim }} />
            </summary>
            <p style={{ paddingBottom: 20, fontSize: 16, lineHeight: 1.65, color: t.inkDim }}>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export default FaqPage;
