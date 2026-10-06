/* PLACER — a project's public page.
 *
 * Read top to bottom like an article: a way back to all projects, the date and who
 * started it, the title, an image (the project's area on the map), the description,
 * then the tools the project has added and its news and resources. A floating card on
 * the right carries a table of contents that follows the reader down the page, and
 * three related projects close it.
 *
 * The tools are only the ones its organisers chose for it (project_tools, see
 * supabase/project-setup.sql) and have set up, not the whole Toolkit, and each is
 * presented in its own section under a heading said to the visitor rather than a
 * "Tools" list: an Open Vote is "We want your opinion" with the poll right there
 * (onProjectPage in toolkit/tools.js). A tool that runs in a room counts as set up
 * once a room is open for it (supabase/project-open-rooms.sql). What people have
 * imagined is not a section of its own either: imagining is Reimagine a Space, so the
 * imaginations show in that tool's section, and only once the project has added it.
 *
 * The layout lives in index.css (.placer-project-*), since the card's stickiness and
 * the single column on a phone need a media query.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn, CatTag, LoadingMark, Vote } from './UI';
import { ProjectLocationMap, hasProjectMap } from './ProjectLocationMap';
import { findTool } from '../toolkit/tools';
import { readImaginationsByProject } from '../services/imaginations';
import {
  readLinks, readProject, readProjectTools, readPublicToolkitActivity, readRelatedProjects, recordProjectView,
} from '../services/projects';

// The tool whose results are the project's imaginations (toolkit/tools.js).
const REIMAGINE_TOOL = 'reimagine-a-space';
import { follow, isFollowing, unfollow } from '../services/follows';
import { readOrganisation } from '../services/organisations';
import { readProjectOpenRooms } from '../services/rooms';
import { CHARACTER } from '../theme';

// A fixed locale and UTC, so the label does not shift with the machine it renders on.
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function formatDate(iso) {
  if (typeof iso !== 'string' || !iso) return '';
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

/** The project's dates if it has any, and otherwise the day it was started on PLACER. */
function dateLabel({ startDate, endDate, createdAt }) {
  if (startDate && endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  if (startDate || endDate) return formatDate(startDate || endDate);
  return formatDate(createdAt);
}

// The hero: 16:9, as large as the Static Maps API serves (640 wide, at scale 2).
const HERO_SIZE = { width: 640, height: 360 };
const THUMB_SIZE = { width: 400, height: 225 };

/** Stands in for the map when a project has no drawn area, so the page keeps its shape. */
function ImagePlaceholder({ t, frame }) {
  return (
    <div aria-hidden="true" style={{ ...frame, borderRadius: 16, background: CHARACTER.cityWorker.c50,
      border: `1px solid ${t.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 72, height: 72, borderRadius: '50%', background: CHARACTER.cityWorker.c100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
        <Icon name="pin" size={32} stroke={1.5} />
      </span>
    </div>
  );
}

/**
 * The project's uploaded image, else its area on the map, else the placeholder — in
 * the same frame every way, so the page keeps its shape whichever it has.
 */
function ProjectImage({ t, project, size, frame }) {
  if (project.image) {
    return (
      <img src={project.image} alt="" style={{ display: 'block', borderRadius: 16,
        border: `1px solid ${t.line}`, objectFit: 'cover', ...frame }} />
    );
  }
  return hasProjectMap(project)
    ? <ProjectLocationMap t={t} project={project} size={size} style={{ ...frame, marginBottom: 0 }} />
    : <ImagePlaceholder t={t} frame={frame} />;
}

const HERO_FRAME = { width: '100%', height: 'auto', aspectRatio: '16 / 9' };
const THUMB_FRAME = { width: '100%', height: 160, borderRadius: 0, border: 'none' };

function ImaginationCard({ t, imagination }) {
  const { title, cat, blurb, loc, preview, upvotes = 0 } = imagination;
  return (
    <article className="placer-card" style={{ padding: 0, overflow: 'hidden' }}>
      {preview && (
        <img src={preview} alt={`Preview of ${title || 'this imagination'}`}
          style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 16, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cat && <div style={{ marginBottom: 8 }}><CatTag cat={cat} t={t} size="sm" /></div>}
          <h3 style={{ fontSize: 16, lineHeight: '24px', color: t.ink, marginBottom: 4 }}>
            {title || 'Untitled imagination'}
          </h3>
          {blurb && (
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: '20px', marginBottom: 6,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {blurb}
            </p>
          )}
          {loc && <span className="placer-caption" style={{ color: t.inkFaint }}>{loc}</span>}
        </div>
        <Vote t={t} count={upvotes} size="sm" />
      </div>
    </article>
  );
}

function LinkRow({ t, link }) {
  return (
    <a href={link.url} target="_blank" rel="noreferrer"
      style={{ display: 'block', padding: '12px 0', borderTop: `1px solid ${t.line}`,
        fontSize: 16, fontWeight: 700, color: t.ink, textDecoration: 'none' }}>
      {link.title}
      <span className="placer-caption" style={{ display: 'block', fontWeight: 400, color: t.inkDim, marginTop: 2 }}>
        {link.url}
      </span>
    </a>
  );
}

/** One Toolkit tool, opened with this project attached. */
function ToolCard({ t, tool, onOpen }) {
  return (
    <button onClick={onOpen} className="placer-card"
      style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'flex-start',
        padding: 16, fontFamily: 'var(--placer-font)', color: t.ink }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flex: '0 0 auto', background: tool.tint,
        boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={tool.icon} size={20} stroke={2} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, lineHeight: '24px', fontWeight: 700 }}>{tool.name}</span>
        <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: t.inkDim, marginTop: 2 }}>
          {tool.tagline}
        </span>
      </span>
    </button>
  );
}

function RelatedCard({ t, project, onOpen }) {
  return (
    <button onClick={onOpen} className="placer-card"
      style={{ textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden', display: 'flex',
        flexDirection: 'column', fontFamily: 'var(--placer-font)', color: t.ink }}>
      <ProjectImage t={t} project={project} size={THUMB_SIZE} frame={THUMB_FRAME} />
      <span style={{ display: 'block', padding: 16 }}>
        <span className="placer-caption" style={{ display: 'block', color: t.inkDim, marginBottom: 4 }}>
          {dateLabel(project)}
        </span>
        <span className="placer-h3" style={{ display: 'block' }}>{project.name}</span>
        {project.ownerName && (
          <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: t.inkDim, marginTop: 4 }}>
            By {project.ownerName}
          </span>
        )}
        {project.description && (
          <span style={{ fontSize: 14, lineHeight: '20px', color: t.inkDim, marginTop: 8,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {project.description}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Which section the reader is in: the last one whose top has passed a line a fifth
 * of the way down the window. An IntersectionObserver watching a thin band there,
 * so it works whichever element is doing the scrolling (MainApp's content area).
 * Without IntersectionObserver the first section simply stays marked.
 */
function useActiveSection(ids) {
  const [picked, setActive] = useState(null);
  // Until the reader has moved, or if the section they were in has gone, the first.
  const active = ids.includes(picked) ? picked : ids[0] ?? null;
  const key = ids.join('|');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || ids.length === 0) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const hit = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id);
    }, { rootMargin: '-20% 0px -75% 0px' });

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
    // `key` stands for `ids`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [active, setActive];
}

function TableOfContents({ t, sections, active, onPick }) {
  return (
    <nav aria-label="On this page" className="placer-project-toc placer-card" style={{ padding: 16 }}>
      <div className="placer-caption" style={{ fontWeight: 700, color: t.inkDim, textTransform: 'uppercase',
        padding: '0 12px', marginBottom: 8 }}>
        On this page
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections.map(({ id, label }) => {
          const current = id === active;
          return (
            <li key={id}>
              <a href={`#${id}`} aria-current={current ? 'location' : undefined}
                onClick={(event) => { event.preventDefault(); onPick(id); }}
                className="placer-project-toc-link"
                style={{ fontWeight: current ? 700 : 400, background: current ? t.surfaceAlt : 'transparent',
                  boxShadow: current ? `inset 2px 0 0 ${t.ink}` : 'none' }}>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * `projectId` is read fresh here rather than trusting a `project` prop from App.jsx:
 * this page is the one a shared link actually points at, so it has to work reached
 * cold with nothing but the id in the URL.
 */
export function PublicProjectPage({ t, projectId, accountId, onBack, onOpenProject,
  onOpenOrganisation, onOpenToolkit, onOpenRoom }) {
  const [project, setProject] = useState(null);
  // The tools its organisers added, as registry entries. A tool no longer in the
  // registry is skipped rather than shown broken.
  const [tools, setTools] = useState([]);
  // The rooms opened for it that are still open: what "set up" means for a tool that
  // runs in a room.
  const [openRooms, setOpenRooms] = useState([]);
  const [imaginations, setImaginations] = useState([]);
  const [links, setLinks] = useState([]);
  const [toolkitActivity, setToolkitActivity] = useState(0);
  const [related, setRelated] = useState([]);
  // The organisation it is run in the name of, if any — credited in place of the owner.
  const [organisation, setOrganisation] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error' | 'notFound'
  const [following, setFollowing] = useState(false);
  const topRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setRelated([]);
    setOrganisation(null);

    Promise.all([
      readProject(projectId),
      readImaginationsByProject(projectId),
      readLinks(projectId),
      readPublicToolkitActivity(projectId),
      // Before project-setup.sql has run there is no table to read, and a project page
      // with no tools listed is better than no project page.
      readProjectTools(projectId).catch((err) => {
        console.error("Could not load this project's tools:", err);
        return [];
      }),
      // The same before project-open-rooms.sql: the page stands, with nothing open on it.
      readProjectOpenRooms(projectId).catch((err) => {
        console.error("Could not load this project's open rooms:", err);
        return [];
      }),
    ])
      .then(([proj, imgs, docs, activity, toolIds, rooms]) => {
        if (cancelled) return;
        if (!proj) { setStatus('notFound'); return; }
        setProject(proj);
        setTools(toolIds.map(findTool).filter(Boolean));
        setOpenRooms(rooms);
        setImaginations(imgs);
        setLinks(docs);
        setToolkitActivity(activity);
        setStatus('ready');
        // Only once the project is known to exist, so a broken link is not a view.
        recordProjectView(proj.id);

        // Extra, not essential: the page stands without it, so a failure here is
        // logged and the byline falls back to the owner.
        if (proj.organisationId) {
          readOrganisation(proj.organisationId)
            .then((found) => { if (!cancelled) setOrganisation(found); })
            .catch((err) => console.error("Could not load this project's organisation:", err));
        }

        // Extra, not essential: the page stands without it, so a failure here is
        // logged and the section simply does not appear.
        readRelatedProjects(proj)
          .then((others) => { if (!cancelled) setRelated(others ?? []); })
          .catch((err) => console.error('Could not load related projects:', err));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load this project:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [projectId]);

  // A related project opens in this same component, so go back to the top for it.
  useEffect(() => {
    topRef.current?.scrollIntoView?.({ block: 'start' });
  }, [projectId]);

  useEffect(() => {
    if (!accountId || status !== 'ready') return;
    let cancelled = false;
    isFollowing('project', projectId)
      .then((value) => { if (!cancelled) setFollowing(value); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accountId, projectId, status]);

  // How the tools it added are put to the visitor: each in a section of its own, under
  // a heading said to them (onProjectPage in toolkit/tools.js). A tool that runs in a
  // room is only shown once a room is open for it — until then it has been added but
  // not set up. Reimagine a Space needs no room. Any other tool is there to try.
  const presented = tools.flatMap((tool) => {
    const room = openRooms.find((candidate) => candidate.tool === tool.id) ?? null;
    if (tool.room && !room) return [];
    return [{ id: `project-tool-${tool.id}`, heading: tool.onProjectPage?.heading ?? `Try ${tool.name}`, tool, room }];
  });

  const sections = [
    { id: 'project-overview', label: 'Overview' },
    ...(presented.length === 0 ? [{ id: 'project-take-part', label: 'Take part' }]
      : presented.map(({ id, heading }) => ({ id, label: heading }))),
    ...(links.length > 0 ? [{ id: 'project-resources', label: 'News & resources' }] : []),
    ...(related.length > 0 ? [{ id: 'project-related', label: 'Related projects' }] : []),
  ];
  const [active, setActive] = useActiveSection(status === 'ready' ? sections.map((section) => section.id) : []);

  const goTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    try {
      if (next) await follow('project', projectId, project.name);
      else await unfollow('project', projectId);
    } catch (err) {
      console.error('Could not update whether you follow this project:', err);
      setFollowing(!next);
    }
  };

  const backButton = (
    <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={() => onBack?.()}
      style={{ padding: '0 12px 0 6px', marginBottom: 24 }}>
      All Projects
    </Btn>
  );

  if (status === 'loading') {
    return <div ref={topRef} style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><LoadingMark /></div>;
  }

  if (status === 'notFound') {
    return (
      <div ref={topRef} className="placer-project" style={{ background: t.page }}>
        {backButton}
        <div style={{ textAlign: 'center', padding: 48 }}>
          <h1 style={{ color: t.ink, marginBottom: 8 }}>Project not found</h1>
          <p style={{ fontSize: 16, color: t.inkDim }}>It may have been removed.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div ref={topRef} role="alert" style={{ padding: 48, fontSize: 14, color: t.ink, fontWeight: 500 }}>
        Could not load this project. See the console for details.
      </div>
    );
  }

  const date = dateLabel(project);

  return (
    <div ref={topRef} className="placer-project" style={{ background: t.page }}>
      {backButton}

      <div className="placer-project-layout">
        <article style={{ minWidth: 0 }}>
          <header id="project-overview" className="placer-project-section">
            <div className="placer-label" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              gap: '4px 16px', color: t.inkDim, marginBottom: 12 }}>
              {date && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="clock" size={16} stroke={2} />{date}
                </span>
              )}
              {organisation ? (
                <span>
                  By{' '}
                  <a href={`/organisations/${organisation.id}`}
                    onClick={(e) => { e.preventDefault(); onOpenOrganisation?.(organisation.id); }}
                    style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {organisation.name}
                  </a>
                </span>
              ) : project.ownerName && <span>By {project.ownerName}</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
              <h1 style={{ color: t.ink, flex: '1 1 320px' }}>{project.name}</h1>
              {accountId && (
                <Btn t={t} variant={following ? 'outline' : 'primary'} icon="bookmark" onClick={toggleFollow}>
                  {following ? 'Following' : 'Follow'}
                </Btn>
              )}
            </div>

            <ProjectImage t={t} project={project} size={HERO_SIZE} frame={HERO_FRAME} />

            {project.locations.length > 0 && (
              <p className="placer-label" style={{ display: 'flex', alignItems: 'center', gap: 6,
                color: t.inkDim, marginTop: 12 }}>
                <Icon name="pin" size={16} stroke={2} />{project.locations.join(', ')}
              </p>
            )}

            {project.description && (
              <p className="placer-body-lg" style={{ color: t.ink, marginTop: 24, whiteSpace: 'pre-line' }}>
                {project.description}
              </p>
            )}
          </header>

          {presented.length === 0 && (
            <section id="project-take-part" className="placer-project-section" aria-labelledby="project-take-part-heading">
              <h2 id="project-take-part-heading" className="placer-h2" style={{ color: t.ink, marginBottom: 12 }}>
                Take part
              </h2>
              <div className="placer-card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, color: t.inkDim }}>Nothing to take part in yet. Check back soon.</p>
              </div>
            </section>
          )}

          {presented.map(({ id, heading, tool, room }) => (
            <section key={id} id={id} className="placer-project-section" aria-labelledby={`${id}-heading`}>
              <h2 id={`${id}-heading`} className="placer-h2" style={{ color: t.ink, marginBottom: 20 }}>
                {heading}
              </h2>

              {tool.id === REIMAGINE_TOOL ? (
                <>
                  <ToolCard t={t} tool={tool} onOpen={() => onOpenToolkit?.(project.id, tool.id)} />
                  <div style={{ marginTop: 24 }}>
                    {imaginations.length === 0 ? (
                      <p style={{ fontSize: 16, color: t.inkDim }}>Nothing imagined for this project yet.</p>
                    ) : (
                      <div className="placer-project-grid">
                        {imaginations.map((imagination) => (
                          <ImaginationCard key={imagination.id} t={t} imagination={imagination} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : room && tool.onProjectPage?.Embed ? (
                <tool.onProjectPage.Embed t={t} tool={tool} room={room} />
              ) : room ? (
                <ToolCard t={t} tool={tool} onOpen={() => onOpenRoom?.(tool.id, room.id)} />
              ) : (
                <ToolCard t={t} tool={tool} onOpen={() => onOpenToolkit?.(project.id, tool.id)} />
              )}
            </section>
          ))}

          {toolkitActivity > 0 && (
            <p className="placer-caption" style={{ color: t.inkFaint, marginTop: -8, marginBottom: 32 }}>
              {toolkitActivity} Toolkit {toolkitActivity === 1 ? 'session' : 'sessions'} run for this project so far.
            </p>
          )}

          {links.length > 0 && (
            <section id="project-resources" className="placer-project-section" aria-labelledby="project-resources-heading">
              <h2 id="project-resources-heading" className="placer-h2" style={{ color: t.ink, marginBottom: 12 }}>
                News &amp; resources
              </h2>
              <div>
                {links.map((link) => <LinkRow key={link.id} t={t} link={link} />)}
              </div>
            </section>
          )}
        </article>

        <aside className="placer-project-aside">
          <TableOfContents t={t} sections={sections} active={active} onPick={goTo} />
        </aside>
      </div>

      {related.length > 0 && (
        <section id="project-related" className="placer-project-section placer-project-related"
          aria-labelledby="project-related-heading">
          <h2 id="project-related-heading" className="placer-h2" style={{ color: t.ink, marginBottom: 20 }}>
            Related Projects
          </h2>
          <div className="placer-project-related-grid">
            {related.map((other) => (
              <RelatedCard key={other.id} t={t} project={other} onOpen={() => onOpenProject?.(other.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default PublicProjectPage;
