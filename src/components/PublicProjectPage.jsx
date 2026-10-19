/* PLACER — a project's public page.
 *
 * A header first: the title and, under it, the project's summary as a subtitle; then
 * its image, with its dates, who it is by and where underneath, and a column beside
 * it, level with its top — the time it has left, its views and its followers, each a
 * big number over its words, and a Follow button. Then a bar of tabs that sticks to
 * the top of the window — Project, Updates, Comments and Reference Material — each a view
 * of its own, the Project tab opening with the project's description and goals, and any
 * photos its organisers added beside the header image (supabase/project-gallery.sql). Under
 * whichever is showing, always: the Organizer (the organisation it is run for, or the
 * account that started it) beside its Collaborators, then three related projects.
 *
 * Updates are posted by the project's organisers, comments by anybody signed in; an
 * organiser of a project run for an organisation chooses to post either as the
 * organisation or as themselves.
 *
 * The numbers, the owner's details, the collaborators, the updates and the comments
 * come from supabase/project-public-page.sql (services/projectPage.js). Each is extra:
 * if it cannot be read, the page stands without it.
 *
 * The Project tab's sections come in the order its organisers put them in, under the
 * titles they gave them, from Edit project (lib/projectSections.js,
 * supabase/project-page-layout.sql); a project nobody arranged keeps the order below.
 *
 * The tools are only the ones its organisers chose for it (project_tools, see
 * supabase/project-setup.sql) and have set up, not the whole Toolkit, and each is
 * presented in its own section under a heading said to the visitor rather than a
 * "Tools" list: a Poll is "We want your opinion" with the poll right there
 * (onProjectPage in toolkit/tools.js). Every other tool is taken part in right there
 * too, in a card that opens out with the tool inside (ProjectToolCard). Only live tools are shown: configured for the
 * project from its dashboard, or for one that runs in a room, with a room open for it
 * (isToolLive in toolkit/tools.js, supabase/project-open-rooms.sql). What people have
 * imagined is not a section of its own either: imagining is the Idea Visualizer, so what
 * was posted to the map for the project shows in that tool's section, under the tool.
 *
 * The layout lives in index.css (.placer-project-*), since the tab bar's stickiness and
 * the single column on a phone need a media query.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn, CatTag, PageLoader, Vote } from './UI';
import { ProjectLocationMap, hasProjectMap } from './ProjectLocationMap';
import { ProjectToolCard } from './toolkit/ProjectToolCard';
import { findTool } from '../toolkit/tools';
import { arrangeSections, projectIntro, projectSections } from '../lib/projectSections';
import { readImaginationsByProject } from '../services/imaginations';
import {
  readConfiguredProjectTools, readLinks, readOrganisationProjects, readProject, readProjectAccess, readProjectTools,
  requestProjectAccess, readPublicToolkitActivity, readRelatedProjects, recordProjectView,
} from '../services/projects';
import {
  COMMENT_MAX, UPDATE_MAX, postComment, postUpdate, readComments, readProjectSummary, readUpdates, removeComment,
  removeUpdate,
} from '../services/projectPage';
import { follow, isFollowing, unfollow } from '../services/follows';
import { readOrganisation } from '../services/organisations';
import { readProjectOpenRooms } from '../services/rooms';
import { projectProgress } from '../lib/projectTimeline';
import { ProjectPeople } from './ProjectPeople';
import { ProjectPosts } from './ProjectPosts';
import { ProjectGallery } from './ProjectGallery';
import { PALETTE } from '../theme';

// The tool whose results are the project's imaginations (toolkit/tools.js).
const REIMAGINE_TOOL = 'reimagine-a-space';

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
    <div aria-hidden="true" style={{ ...frame, borderRadius: 16, background: PALETTE.blue.c50,
      border: `1px solid ${t.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 72, height: 72, borderRadius: '50%', background: PALETTE.blue.c100,
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

/**
 * What a tool is and why this project is using it, in a paragraph under its heading: the
 * tool's own (`onProjectPage.intro`) and, when it has one, the organisers' reason
 * (`onProjectPage.why`, from the room's setup). Nothing for a tool with neither.
 */
function ToolIntro({ t, tool, room }) {
  const { intro, why } = tool.onProjectPage ?? {};
  const reason = room ? why?.(room.config) : null;
  if (!intro && !reason) return null;
  return (
    <p className="placer-tool-intro" style={{ fontSize: 16, lineHeight: 1.65, color: t.inkDim, margin: '-8px 0 24px',
      maxWidth: 720, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>
      {[intro, reason].filter(Boolean).join(' ')}
    </p>
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
        {(project.summary || project.description) && (
          <span style={{ fontSize: 14, lineHeight: '20px', color: t.inkDim, marginTop: 8,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {project.summary || project.description}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * What a private project's link shows somebody who cannot see it: the name, and a way
 * to ask to be let in — signing in first, if they have not. The database decides what
 * they may know (project_access_preview in supabase/project-privacy.sql); nothing else
 * about the project reaches this browser.
 */
function LockedProject({ t, preview, accountId, accountName, onSignIn, projectId }) {
  const [status, setStatus] = useState(preview.requestStatus);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const ask = async () => {
    setSending(true);
    setError(null);
    try {
      setStatus(await requestProjectAccess(projectId, accountName));
    } catch (err) {
      console.error('Could not ask to see the project:', err);
      setError('That did not go through. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="placer-card" style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center', padding: 32 }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px', background: t.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
        <Icon name="lock" size={26} stroke={2} />
      </span>
      <h1 style={{ color: t.ink, marginBottom: 8 }}>{preview.name}</h1>
      <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6, marginBottom: 24 }}>
        This is a private project. Only the people its organisers let in can see it and take part.
      </p>

      {!accountId ? (
        <Btn t={t} variant="primary" icon="user" onClick={onSignIn}>Sign in to ask to see it</Btn>
      ) : status === 'pending' ? (
        <p role="status" style={{ fontSize: 15, color: t.ink, fontWeight: 500 }}>
          You have asked to see this project. Its organisers will let you know.
        </p>
      ) : status === 'declined' ? (
        <p role="status" style={{ fontSize: 15, color: t.ink, fontWeight: 500 }}>
          Its organisers have not let you in.
        </p>
      ) : (
        <Btn t={t} variant="primary" icon="lock" onClick={ask} disabled={sending}>
          {sending ? 'Asking…' : 'Ask to see this project'}
        </Btn>
      )}

      {error && <p role="alert" style={{ fontSize: 14, color: t.ink, marginTop: 12 }}>{error}</p>}
    </div>
  );
}


/** One line of the header's panel: a big number, and what it counts beneath it. */
function Stat({ t, value, label }) {
  return (
    <div className="placer-project-stat" style={{ borderTop: `1px solid ${t.line}` }}>
      <span style={{ display: 'block', fontSize: 40, fontWeight: 700, lineHeight: 1.1, color: t.ink,
        letterSpacing: '-0.03em' }}>
        {value}
      </span>
      <span style={{ display: 'block', fontSize: 15, color: t.inkDim, marginTop: 4 }}>{label}</span>
    </div>
  );
}

/** The time a project has left as a number and its words: 7 / days left. */
function timeLeft(progress) {
  const days = (n) => (n === 1 ? 'day' : 'days');
  if (progress.state === 'ongoing') return { value: progress.daysLeft, label: `${days(progress.daysLeft)} left` };
  if (progress.state === 'upcoming') return { value: progress.daysToStart, label: `${days(progress.daysToStart)} until it starts` };
  if (progress.state === 'ended') return { value: 'Ended', label: 'this project has finished' };
  return { value: 'Open', label: 'no end date set' };
}

const TABS = [
  { id: 'project', label: 'Project' },
  { id: 'updates', label: 'Updates' },
  { id: 'comments', label: 'Comments' },
  { id: 'links', label: 'Reference Material' },
];

const NUMBER = new Intl.NumberFormat('en-GB');

/**
 * `projectId` is read fresh here rather than trusting a `project` prop from App.jsx:
 * this page is the one a shared link actually points at, so it has to work reached
 * cold with nothing but the id in the URL.
 */
export function PublicProjectPage({ t, projectId, accountId, accountName = null, accountPhoto = null, onSignIn,
  onBack, onOpenProject, onOpenOrganisation, onOpenProfile, onEdit }) {
  const [project, setProject] = useState(null);
  // The tools its organisers added, as registry entries. A tool no longer in the
  // registry is skipped rather than shown broken.
  const [tools, setTools] = useState([]);
  // The rooms opened for it that are still open: what "set up" means for a tool that
  // runs in a room.
  const [openRooms, setOpenRooms] = useState([]);
  const [configuredTools, setConfiguredTools] = useState(new Set());
  const [imaginations, setImaginations] = useState([]);
  const [links, setLinks] = useState([]);
  const [toolkitActivity, setToolkitActivity] = useState(0);
  const [related, setRelated] = useState([]);
  // The organisation it is run in the name of, if any — credited in place of the owner.
  const [organisation, setOrganisation] = useState(null);
  const [organisationProjects, setOrganisationProjects] = useState(null);
  // Its numbers, owner and collaborators (services/projectPage.js). Null until they
  // arrive, and for good if they cannot be read: the page stands without them.
  const [summary, setSummary] = useState(null);
  const [updates, setUpdates] = useState({ status: 'loading', posts: [] });
  const [comments, setComments] = useState({ status: 'loading', posts: [] });
  const [tab, setTab] = useState('project');
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error' | 'notFound' | 'locked'
  // For 'locked': what the visitor may know about a private project they cannot see.
  const [preview, setPreview] = useState(null);
  const [following, setFollowing] = useState(false);
  // Set once the visitor clicks Follow, so a slower isFollowing answer cannot undo it.
  const followTouchedRef = useRef(false);
  const topRef = useRef(null);
  const tabsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setRelated([]);
    setOrganisation(null);
    setOrganisationProjects(null);
    setSummary(null);
    setUpdates({ status: 'loading', posts: [] });
    setComments({ status: 'loading', posts: [] });
    setTab('project');

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
      // Which tools have been configured for the project, and so are live.
      readConfiguredProjectTools(projectId).catch((err) => {
        console.error("Could not load how this project's tools are set up:", err);
        return new Set();
      }),
    ])
      .then(([proj, imgs, docs, activity, toolIds, rooms, configured]) => {
        if (cancelled) return;
        if (!proj) {
          // A private project reads as no project at all to somebody who cannot see
          // it, so ask which of the two this is.
          readProjectAccess(projectId)
            .then((found) => {
              if (cancelled) return;
              if (found && !found.canView) {
                setPreview(found);
                setStatus('locked');
              } else {
                setStatus('notFound');
              }
            })
            .catch(() => { if (!cancelled) setStatus('notFound'); });
          return;
        }
        setProject(proj);
        setTools(toolIds.map(findTool).filter(Boolean));
        setOpenRooms(rooms);
        setConfiguredTools(configured);
        setImaginations(imgs);
        setLinks(docs);
        setToolkitActivity(activity);
        setStatus('ready');
        // Only once the project is known to exist, so a broken link is not a view.
        recordProjectView(proj.id);

        // The rest is extra, not essential: the page stands without any of it, so a
        // failure is logged and that part falls back or stays empty.
        if (proj.organisationId) {
          readOrganisation(proj.organisationId)
            .then((found) => { if (!cancelled) setOrganisation(found); })
            .catch((err) => console.error("Could not load this project's organisation:", err));
          readOrganisationProjects(proj.organisationId)
            .then((found) => { if (!cancelled) setOrganisationProjects(found.length); })
            .catch((err) => console.error("Could not load the organisation's projects:", err));
        }

        readProjectSummary(proj.id)
          .then((found) => { if (!cancelled) setSummary(found); })
          .catch((err) => console.error("Could not load this project's numbers:", err));

        readUpdates(proj.id)
          .then((posts) => { if (!cancelled) setUpdates({ status: 'ready', posts }); })
          .catch((err) => {
            console.error("Could not load this project's updates:", err);
            if (!cancelled) setUpdates({ status: 'error', posts: [] });
          });

        readComments(proj.id)
          .then((posts) => { if (!cancelled) setComments({ status: 'ready', posts }); })
          .catch((err) => {
            console.error("Could not load this project's comments:", err);
            if (!cancelled) setComments({ status: 'error', posts: [] });
          });

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
    followTouchedRef.current = false;
    isFollowing('project', projectId)
      .then((value) => { if (!cancelled && !followTouchedRef.current) setFollowing(value); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accountId, projectId, status]);

  const pickTab = (id) => {
    setTab(id);
    // Back to the top of the tabs if the reader had scrolled past them, so the new
    // view starts at its beginning rather than wherever the last one was.
    const bar = tabsRef.current;
    if (bar && bar.getBoundingClientRect().top <= 1) bar.scrollIntoView?.({ block: 'start' });
  };

  const onTabKey = (event) => {
    const index = TABS.findIndex(({ id }) => id === tab);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length].id;
    pickTab(next);
    document.getElementById(`project-tab-${next}`)?.focus();
  };

  const toggleFollow = async () => {
    const next = !following;
    followTouchedRef.current = true;
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
    return <div ref={topRef}><PageLoader /></div>;
  }

  if (status === 'locked') {
    return (
      <div ref={topRef} className="placer-project" style={{ background: t.page }}>
        {backButton}
        <LockedProject t={t} preview={preview} projectId={projectId} accountId={accountId}
          accountName={accountName} onSignIn={onSignIn} />
      </div>
    );
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
  const left = timeLeft(projectProgress(project));
  // Where it is, under the image: its place names, or else the address it was set up with.
  const place = project.locations.length > 0 ? project.locations.join(', ') : project.address;
  // The Project tab's sections — About, Goals, Photos and one per live tool — in the
  // order its organisers put them, under their titles (lib/projectSections.js).
  const { intro, goals } = projectIntro(project);
  const sections = arrangeSections(
    projectSections({ project, tools, openRooms, configured: configuredTools }), project.pageLayout);
  const hasTools = sections.some((section) => section.kind === 'tool');
  // A tool in a room that asks for the page's full width (onProjectPage.wide) widens it.
  const isWide = (section) => Boolean(section.room && section.tool?.onProjectPage?.wide);

  const owner = summary?.owner ?? { id: project.ownerId, name: project.ownerName, photo: null };
  const collaborators = summary?.collaborators ?? [];
  // May remove any comment: the owner and the collaborators. May post and remove
  // updates: the organisers only — the owner, and the admins of the organisation it is
  // run for, which only the database can tell. It checks both again
  // (supabase/project-public-page.sql); this only decides what to offer.
  const isTeam = Boolean(accountId)
    && (accountId === project.ownerId || collaborators.some((person) => person.id === accountId));
  const isOrganiser = Boolean(accountId) && (summary ? summary.canPostUpdate : accountId === project.ownerId);

  const organiser = organisation ? {
    kind: 'organisation', id: organisation.id, name: organisation.name, photo: organisation.avatar,
    description: organisation.description, location: organisation.location || organisation.address,
    joinedAt: organisation.createdAt, projects: organisationProjects,
  } : (project.organisationId ? null : {
    kind: 'user', id: owner.id, name: owner.name || project.ownerName, photo: owner.photo,
    description: owner.bio, location: owner.location, joinedAt: owner.joinedAt, projects: owner.projects,
  });

  const people = [
    { id: owner.id, name: owner.name || project.ownerName, photo: owner.photo, role: 'Project owner' },
    ...collaborators.filter((person) => person.id !== owner.id).map((person) => ({ ...person, role: 'Collaborator' })),
  ];

  const counts = { updates: updates.posts.length, comments: comments.posts.length, links: links.length };

  // An organiser of a project run for an organisation may post as either
  // (supabase/project-posts-as-organisation.sql).
  const postsOrganisation = organisation ? { id: organisation.id, name: organisation.name, photo: organisation.avatar } : null;
  const postAs = postsOrganisation && isOrganiser
    ? { organisation: postsOrganisation, me: { name: accountName || 'You', photo: accountPhoto } }
    : null;

  const signInPrompt = (
    <div className="placer-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      <p style={{ fontSize: 15, color: t.inkDim }}>Sign in to join the conversation.</p>
      <Btn t={t} size="sm" icon="user" onClick={onSignIn}>Sign in to comment</Btn>
    </div>
  );

  const addPost = (setList, post) => setList((current) => ({ ...current, posts: [post, ...current.posts] }));
  const dropPost = (setList, id) => setList((current) => ({ ...current, posts: current.posts.filter((p) => p.id !== id) }));

  return (
    <div ref={topRef} className="placer-project" style={{ background: t.page }}>
      {backButton}

      <header>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <h1 style={{ color: t.ink, overflowWrap: 'anywhere', minWidth: 0 }}>{project.name}</h1>
          {/* For the people who can change it — its owner and collaborators, the ones the
              database lets edit a project (supabase/projects.sql) — the way to its
              dashboard. */}
          {isTeam && onEdit && (
            <Btn t={t} variant="outline" icon="pencil" onClick={() => onEdit(project.id)}
              style={{ flex: '0 0 auto', marginTop: 4 }}>
              Edit project
            </Btn>
          )}
        </div>
        {project.summary && (
          <p className="placer-body-lg placer-project-subtitle" style={{ color: t.inkDim, whiteSpace: 'pre-line' }}>
            {project.summary}
          </p>
        )}

        <div className="placer-project-header">
          <div style={{ minWidth: 0 }}>
            <ProjectImage t={t} project={project} size={HERO_SIZE} frame={HERO_FRAME} />
            <div className="placer-label" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              gap: '8px 20px', color: t.inkDim, marginTop: 16 }}>
              {date && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="calendar" size={16} stroke={2} />{date}
                </span>
              )}
              {organisation ? (
                <span>
                  By{' '}
                  <a href={`/organisations/${organisation.id}`}
                    onClick={(e) => { e.preventDefault(); onOpenOrganisation?.(organisation.id); }}
                    style={{ color: t.ink, fontWeight: 700, textDecoration: 'underline' }}>
                    {organisation.name}
                  </a>
                </span>
              ) : project.ownerName && (
                <span>
                  By{' '}
                  <a href={`/people/${project.ownerId}`}
                    onClick={(e) => { e.preventDefault(); onOpenProfile?.(project.ownerId); }}
                    style={{ color: t.ink, fontWeight: 700, textDecoration: 'underline' }}>
                    {project.ownerName}
                  </a>
                </span>
              )}
              {place && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="pin" size={16} stroke={2} />{place}
                </span>
              )}
              {project.visibility === 'private' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="lock" size={16} stroke={2} />Private project
                </span>
              )}
            </div>
          </div>

          <aside aria-label="Project at a glance" className="placer-project-glance">
            <Stat t={t} value={left.value} label={left.label} />
            <Stat t={t} value={summary ? NUMBER.format(summary.views) : '–'}
              label={summary?.views === 1 ? 'view' : 'views'} />
            <Stat t={t} value={summary ? NUMBER.format(summary.followers) : '–'}
              label={summary?.followers === 1 ? 'follower' : 'followers'} />
            {/* Signed out, it asks them to sign in first: following needs an account. */}
            <Btn t={t} size="lg" full variant={following ? 'outline' : 'primary'} icon="bookmark"
              onClick={accountId ? toggleFollow : onSignIn} style={{ marginTop: 20, height: 56, fontSize: 16 }}>
              {following ? 'Following this project' : 'Follow this project'}
            </Btn>
          </aside>
        </div>
      </header>

      <div ref={tabsRef} className="placer-project-tabs" style={{ background: t.page, borderBottom: `1px solid ${t.line}` }}>
        <div role="tablist" aria-label="Project sections" onKeyDown={onTabKey}
          style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {TABS.map(({ id, label }) => {
            const current = id === tab;
            const count = counts[id];
            return (
              <button key={id} id={`project-tab-${id}`} type="button" role="tab" aria-selected={current}
                aria-controls={`project-panel-${id}`} aria-label={count > 0 ? `${label} (${count})` : undefined}
                tabIndex={current ? 0 : -1} onClick={() => pickTab(id)}
                className="placer-project-tab"
                style={{ color: current ? t.ink : t.inkDim, fontWeight: current ? 700 : 500,
                  boxShadow: current ? `inset 0 -3px 0 ${t.ink}` : 'none' }}>
                {label}
                {count > 0 && (
                  <span aria-hidden="true" style={{ marginLeft: 8, fontSize: 12, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999, background: t.surfaceAlt, color: t.ink }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`project-panel-${tab}`} role="tabpanel" aria-labelledby={`project-tab-${tab}`}
        className={`placer-project-panel${tab === 'project' && sections.some(isWide) ? ' placer-project-panel--wide' : ''}`}>
        {tab === 'project' && (
          <>
            {sections.map((section) => (
              <section key={section.key} id={section.domId} aria-labelledby={`${section.domId}-heading`}
                className={`placer-project-section${isWide(section) ? ' placer-project-section--wide' : ''}`}>
                <h2 id={`${section.domId}-heading`} className="placer-h2"
                  style={{ color: t.ink, marginBottom: section.kind === 'about' || section.kind === 'goals' ? 12 : 20 }}>
                  {section.title}
                </h2>
                {section.kind === 'tool' && <ToolIntro t={t} tool={section.tool} room={section.room} />}

                {section.kind === 'about' && (
                  <p className="placer-body-lg" style={{ color: t.ink, whiteSpace: 'pre-line' }}>{intro}</p>
                )}

                {section.kind === 'goals' && (
                  <p className="placer-body-lg" style={{ color: t.ink, whiteSpace: 'pre-line' }}>{goals}</p>
                )}

                {section.kind === 'photos' && <ProjectGallery t={t} photos={project.gallery} />}

                {section.kind === 'tool' && (section.room && section.tool.onProjectPage?.Embed ? (
                  <>
                    <section.tool.onProjectPage.Embed t={t} tool={section.tool} room={section.room} />
                    {/* Ideas posted to the map for the project, from the Toolkit's own flow. */}
                    {section.tool.id === REIMAGINE_TOOL && imaginations.length > 0 && (
                      <div style={{ marginTop: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: t.ink, margin: '0 0 12px' }}>
                          Posted to the map
                        </h3>
                        <div className="placer-project-grid">
                          {imaginations.map((imagination) => (
                            <ImaginationCard key={imagination.id} t={t} imagination={imagination} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <ProjectToolCard t={t} tool={section.tool} room={section.room} displayName={accountName} />
                ))}
              </section>
            ))}

            {!hasTools && (
              <section id="project-take-part" className="placer-project-section" aria-labelledby="project-take-part-heading">
                <h2 id="project-take-part-heading" className="placer-h2" style={{ color: t.ink, marginBottom: 12 }}>
                  Take part
                </h2>
                <div className="placer-card" style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 16, color: t.inkDim }}>Nothing to take part in yet. Check back soon.</p>
                </div>
              </section>
            )}

            {toolkitActivity > 0 && (
              <p className="placer-caption" style={{ color: t.inkFaint, marginTop: -8, marginBottom: 32 }}>
                {toolkitActivity} Toolkit {toolkitActivity === 1 ? 'session' : 'sessions'} run for this project so far.
              </p>
            )}
          </>
        )}

        {tab === 'updates' && (
          <ProjectPosts t={t} kind="update" posts={updates.posts} status={updates.status} canPost={isOrganiser}
            max={UPDATE_MAX} onOpenProfile={onOpenProfile} onOpenOrganisation={onOpenOrganisation}
            postAs={postAs} organisation={postsOrganisation}
            onPost={async (body, asOrganisation) => addPost(setUpdates, await postUpdate(project.id, body, asOrganisation))}
            canRemove={() => isOrganiser}
            onRemove={async (post) => { await removeUpdate(post.id); dropPost(setUpdates, post.id); }} />
        )}

        {tab === 'comments' && (
          <ProjectPosts t={t} kind="comment" posts={comments.posts} status={comments.status}
            canPost={Boolean(accountId)} prompt={onSignIn ? signInPrompt : null}
            max={COMMENT_MAX} onOpenProfile={onOpenProfile} onOpenOrganisation={onOpenOrganisation}
            postAs={postAs} organisation={postsOrganisation}
            onPost={async (body, asOrganisation) => addPost(setComments, await postComment(project.id, body, asOrganisation))}
            canRemove={(post) => isTeam || (Boolean(accountId) && post.authorId === accountId)}
            onRemove={async (post) => { await removeComment(post.id); dropPost(setComments, post.id); }} />
        )}

        {tab === 'links' && (links.length === 0 ? (
          <div className="placer-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: t.inkDim }}>No links shared yet.</p>
          </div>
        ) : (
          <div>{links.map((link) => <LinkRow key={link.id} t={t} link={link} />)}</div>
        ))}
      </div>

      <ProjectPeople t={t} organiser={organiser} people={people} accountId={accountId}
        onOpenOrganisation={onOpenOrganisation} onOpenProfile={onOpenProfile} />

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
