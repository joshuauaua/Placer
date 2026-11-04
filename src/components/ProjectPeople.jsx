/* PLACER — who is behind a project, on its public page.
 *
 * Organizer on the left: the organisation the project is run in the name of, if it
 * has one, and otherwise the account that started it — with how many projects it
 * runs, when it joined PLACER, what it says about itself, where it is, and a Follow
 * button. Collaborators on the right: the owner, everyone working on the project with
 * them, and the organisations collaborating on it, each a link to their public page.
 */

import { Icon } from './Icon';
import { Avatar } from './UI';
import { FollowButton } from './FollowButton';

const JOINED_FORMAT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

function joinedOn(iso) {
  const date = new Date(iso ?? '');
  return Number.isNaN(date.getTime()) ? '' : JOINED_FORMAT.format(date);
}

function Fact({ t, icon, children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: t.inkDim }}>
      <Icon name={icon} size={16} stroke={2} />{children}
    </li>
  );
}

/**
 * `organiser` is { kind: 'organisation' | 'user', id, name, photo, description, location,
 * joinedAt, projects }, or null while it loads or when there is nothing to show.
 */
function Organizer({ t, organiser, accountId, onOpen }) {
  const href = organiser.kind === 'organisation' ? `/organisations/${organiser.id}` : `/people/${organiser.id}`;
  const joined = joinedOn(organiser.joinedAt);
  return (
    <div className="placer-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Avatar name={organiser.name} photo={organiser.photo} size={56} />
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <a href={href} onClick={(e) => { e.preventDefault(); onOpen(organiser); }}
            style={{ display: 'block', fontSize: 18, fontWeight: 700, color: t.ink, textDecoration: 'none',
              overflowWrap: 'anywhere' }}>
            {organiser.name}
          </a>
          <span className="placer-caption" style={{ color: t.inkDim }}>
            {organiser.kind === 'organisation' ? 'Organisation' : 'Individual'}
          </span>
        </div>
        {accountId && accountId !== organiser.id && (
          <FollowButton t={t} type={organiser.kind} targetId={organiser.id} label={organiser.name} size="sm" />
        )}
      </div>
      {organiser.description && (
        <p style={{ fontSize: 15, lineHeight: 1.6, color: t.ink, marginBottom: 16, whiteSpace: 'pre-line',
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {organiser.description}
        </p>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {typeof organiser.projects === 'number' && (
          <Fact t={t} icon="grid">
            {organiser.projects} {organiser.projects === 1 ? 'project' : 'projects'} created
          </Fact>
        )}
        {joined && <Fact t={t} icon="calendar">On PLACER since {joined}</Fact>}
        {organiser.location && <Fact t={t} icon="pin">{organiser.location}</Fact>}
      </ul>
    </div>
  );
}

/**
 * `people` is [{ id, name, photo, role, kind }], the owner first. `kind` is
 * 'organisation' for a collaborating organisation, and absent for a person.
 */
function Collaborators({ t, people, onOpenProfile, onOpenOrganisation }) {
  return (
    <div className="placer-card" style={{ padding: 24 }}>
      {people.length === 0 ? (
        <p style={{ fontSize: 15, color: t.inkDim }}>No collaborators yet.</p>
      ) : (
        <ul aria-label="Collaborators" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {people.map((person, index) => (
            <li key={`${person.kind ?? 'person'}-${person.id}`}
              style={{ borderTop: index === 0 ? 'none' : `1px solid ${t.line}` }}>
              <a href={person.kind === 'organisation' ? `/organisations/${person.id}` : `/people/${person.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (person.kind === 'organisation') onOpenOrganisation?.(person.id);
                  else onOpenProfile?.(person.id);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', color: t.ink,
                  textDecoration: 'none' }}>
                <Avatar name={person.name} photo={person.photo} size={40} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {person.name}
                  </span>
                  <span className="placer-caption" style={{ display: 'block', color: t.inkDim }}>{person.role}</span>
                </span>
                <Icon name="chevRight" size={16} stroke={2} style={{ color: t.inkFaint }} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectPeople({ t, organiser, people, accountId, onOpenOrganisation, onOpenProfile }) {
  const openOrganiser = (who) => (who.kind === 'organisation' ? onOpenOrganisation?.(who.id) : onOpenProfile?.(who.id));
  return (
    <div className="placer-project-people">
      <section aria-labelledby="project-organizer-heading">
        <h2 id="project-organizer-heading" className="placer-h2" style={{ color: t.ink, marginBottom: 16 }}>
          Organizer
        </h2>
        {organiser
          ? <Organizer t={t} organiser={organiser} accountId={accountId} onOpen={openOrganiser} />
          : <p style={{ fontSize: 15, color: t.inkDim }}>Loading…</p>}
      </section>
      <section aria-labelledby="project-collaborators-heading">
        <h2 id="project-collaborators-heading" className="placer-h2" style={{ color: t.ink, marginBottom: 16 }}>
          Collaborators
        </h2>
        <Collaborators t={t} people={people} onOpenProfile={onOpenProfile} onOpenOrganisation={onOpenOrganisation} />
      </section>
    </div>
  );
}

export default ProjectPeople;
