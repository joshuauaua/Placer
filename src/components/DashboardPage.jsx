/* PLACER — your dashboard: shortcuts to what to do next */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { LayeredCircles } from './LayeredCircles';
import { NotificationItem } from './NotificationItem';
import {
  PROJECT_TYPE_NAMES, isSupabaseConfigured as projectsAvailable, readMyProjects,
} from '../services/projects';
import { listNotifications } from '../services/notifications';
import { readInquiries } from '../services/inquiries';
import { mergeActivity } from '../lib/activityFeed';
import { nextSteps, projectProgress } from '../lib/projectTimeline';
import { PALETTE } from '../theme';
import { ARROW_ITEM, moveWithArrows } from '../lib/arrowKeys';
import { responsiveImage } from '../lib/responsiveImage';

// How many of each the dashboard shows before View All (projects scroll sideways, all of them).
const STEPS_SHOWN = 5;
const ACTIVITY_SHOWN = 5;

// Getting Started is for newcomers: it is shown for this many visits to the dashboard,
// counted per account on this device, and then goes away.
const GETTING_STARTED_VISITS = 5;

/** Counts this visit to the dashboard (once per browser session) and returns the total. */
function countDashboardVisit(accountId) {
  const key = `placer.dashboardVisits.${accountId ?? 'local'}`;
  try {
    const seen = Number(localStorage.getItem(key)) || 0;
    if (sessionStorage.getItem(key)) return seen;
    sessionStorage.setItem(key, '1');
    localStorage.setItem(key, String(seen + 1));
    return seen + 1;
  } catch {
    return 0; // storage blocked: keep showing it rather than guess
  }
}

// A project's picture stand-in, by kind: one theme colour for each kind of project.
const TYPE_TINTS = { steward: PALETTE.blue, advocate: PALETTE.orange, other: PALETTE.purple };

const STEP_KINDS = {
  deadline: { label: 'Deadline', colour: PALETTE.orange },
  milestone: { label: 'Milestone', colour: PALETTE.blue },
  action: { label: 'To do', colour: PALETTE.purple },
};

/** A Quick Actions button: a small grey tile with the icon beside the label. */
function Shortcut({ t, icon, label, onClick, expanded, controls }) {
  return (
    <button type="button" onClick={onClick} {...ARROW_ITEM} className="placer-quick-action"
      aria-expanded={expanded} aria-controls={controls}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        minHeight: 56, padding: '12px 20px', textAlign: 'center', background: t.surfaceAlt,
        border: 'none', borderRadius: 14, cursor: 'pointer',
        fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: 700, color: t.ink }}>
      <Icon name={icon} size={20} stroke={2} />
      {label}
    </button>
  );
}

/** A section's heading, set as a small label above its cards. */
function SectionLabel({ t, id, children, style }) {
  return (
    <h2 id={id} className="placer-caption" style={{ textTransform: 'uppercase',
      letterSpacing: '0.08em', fontWeight: 700, color: t.inkDim, marginBottom: 12, ...style }}>
      {children}
    </h2>
  );
}

/**
 * A large card in one of the three brand colours: a 50 field with overlapping circles
 * of the 100, 300 and 700 steps stacked into the lower right corner, a small label over
 * a bold line, and an arrow. The circles sit behind the words, and the dark 700 one is
 * kept in the corner, clear of them.
 */
function BasicsCard({ t, hue, label, title, onClick }) {
  return (
    <button type="button" onClick={onClick} {...ARROW_ITEM} className="placer-basics-card"
      style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32,
        minHeight: 200, padding: 28, textAlign: 'left', cursor: 'pointer', border: 'none', borderRadius: 16,
        background: hue.c50, color: t.ink, fontFamily: 'var(--placer-font)' }}>
      <LayeredCircles hue={hue} />
      <span style={{ position: 'relative' }}>
        <span className="placer-caption" style={{ display: 'block', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
          {label}
        </span>
        <span className="placer-disp" style={{ display: 'block', fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, maxWidth: 420 }}>
          {title}
        </span>
      </span>
      <span style={{ position: 'relative', display: 'flex' }}>
        <Icon name="arrowRight" size={24} stroke={2.2} />
      </span>
    </button>
  );
}

/**
 * One of the account's projects: its picture, what kind it is, its name, and a bar of
 * how much of its time has gone, with what is left in words beside it.
 */
function DashboardProjectCard({ t, project, onOpen }) {
  const progress = projectProgress(project);
  const tint = TYPE_TINTS[project.projectType] ?? PALETTE.blue;
  return (
    <button type="button" onClick={() => onOpen(project.id)} {...ARROW_ITEM} className="placer-dashboard-project"
      style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 0, overflow: 'hidden',
        scrollSnapAlign: 'start',
        background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, cursor: 'pointer',
        fontFamily: 'var(--placer-font)', color: t.ink }}>
      {/* One portrait frame for every card. Without minHeight and overflow, a tall picture
          stretches its frame past the ratio and the cards come out uneven; a wide one is
          cropped to fit. */}
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
        height: 220, overflow: 'hidden', flexShrink: 0,
        background: tint.c50, color: tint.c700 }}>
        {project.image
          ? <img {...responsiveImage(project.image, '(max-width: 640px) 100vw, 320px')} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          : <Icon name="grid" size={30} stroke={1.8} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20, width: '100%', boxSizing: 'border-box' }}>
        <span className="placer-caption" style={{ textTransform: 'uppercase', letterSpacing: '0.08em',
          fontWeight: 700, color: t.inkDim }}>
          {PROJECT_TYPE_NAMES[project.projectType] ?? 'Project'}
        </span>
        <span style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25 }}>{project.name}</span>
        <span style={{ marginTop: 8 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: t.inkDim,
            marginBottom: 6 }}>
            <span>{progress.label}</span>
            {progress.percent !== null && <span>{progress.percent}%</span>}
          </span>
          <span role="progressbar" aria-label={`Time gone on ${project.name}`}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent ?? undefined}
            aria-valuetext={progress.label}
            style={{ display: 'block', height: 8, borderRadius: 999, background: t.surfaceAlt, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${progress.percent ?? 0}%`,
              borderRadius: 999, background: progress.state === 'ended' ? t.inkFaint : t.ink }} />
          </span>
        </span>
      </span>
    </button>
  );
}

/** A small count on a tab: how many items are waiting. Read out after the tab's name. */
function TabBadge({ count, noun }) {
  if (!count) return null;
  return (
    <>
      <span aria-hidden="true" style={{ marginLeft: 8, minWidth: 18, height: 18, padding: '0 5px',
        borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, background: PALETTE.orange.c300, color: PALETTE.orange.c900 }}>
        {count}
      </span>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {` ${count} ${noun}`}
      </span>
    </>
  );
}

/** A card with a heading, an optional button at the far end of it, and a body. */
function PanelCard({ t, id, title, action, children }) {
  return (
    <section aria-labelledby={id} style={{ background: t.surface, border: `1px solid ${t.line}`,
      borderRadius: 16, padding: 24, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        marginBottom: 12, minHeight: 40 }}>
        <h2 id={id} style={{ fontSize: 20, fontWeight: 700, color: t.ink }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardPage({ t, profile, accountId = null, onNavigate, onNewProject,
  onSignOut, onExplore, onOpenPublicProfile, onOpenProject, onOpenProjectPage,
  onOpenOrganisationPage }) {
  // The account's projects, for the Projects row and Next Steps. Projects need a
  // Supabase project, so without one there are simply none.
  const [projects, setProjects] = useState([]);
  const [projectsStatus, setProjectsStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    if (!accountId || !projectsAvailable()) {
      setProjectsStatus('ready');
      return undefined;
    }
    let cancelled = false;
    readMyProjects(accountId)
      .then((found) => {
        if (cancelled) return;
        setProjects(found);
        setProjectsStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your projects:', err);
        setProjectsStatus('error');
      });
    return () => { cancelled = true; };
  }, [accountId]);

  // The latest few notifications, with the inquiries kept from the Toolkit's standalone
  // tools mixed in (lib/activityFeed.js). Like projects, there are none to have without a
  // Supabase project — and none before supabase/notifications.sql has run, which is
  // treated the same way rather than as something wrong.
  const [activity, setActivity] = useState([]);
  const [activityStatus, setActivityStatus] = useState('loading'); // 'loading' | 'ready' | 'unavailable'

  useEffect(() => {
    if (!accountId || !projectsAvailable()) {
      setActivityStatus('unavailable');
      return undefined;
    }
    let cancelled = false;
    // Inquiries are extra: if they cannot be read, the notifications still show.
    const inquiries = readInquiries().catch((err) => {
      console.error('Could not load your saved inquiries:', err);
      return [];
    });
    Promise.all([listNotifications({ limit: ACTIVITY_SHOWN }), inquiries])
      .then(([found, kept]) => {
        if (cancelled) return;
        setActivity(mergeActivity(found, kept, accountId, ACTIVITY_SHOWN));
        setActivityStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your activity:', err);
        setActivityStatus('unavailable');
      });
    return () => { cancelled = true; };
  }, [accountId]);

  // Getting Started shows for the first few visits; after that it lives in the Guide shortcut.
  const [visits] = useState(() => countDashboardVisit(accountId));
  const [guideOpen, setGuideOpen] = useState(visits <= GETTING_STARTED_VISITS);
  const [tab, setTab] = useState('steps'); // 'steps' | 'activity'

  const name = profile?.name ?? '';
  const recentProjects = [...projects].sort((a, b) =>
    (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
  const unreadActivity = activity.filter((n) => !n.readAt).length;
  const steps = projectsStatus === 'ready' ? nextSteps(projects, profile).slice(0, STEPS_SHOWN) : [];

  const actOn = (step) => {
    if (step.target === 'project') onOpenProject?.(step.projectId);
    else if (step.target === 'newProject') onNewProject?.();
    else onNavigate(step.target);
  };

  const tabStyle = (active) => ({
    position: 'relative', padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--placer-font)', fontSize: 14, fontWeight: 700,
    background: active ? t.ink : 'transparent', color: active ? t.page : t.inkDim,
  });

  // The arrow keys move between every card on the page, section to section, as they
  // are laid out (lib/arrowKeys.js).
  return (
    <div onKeyDown={moveWithArrows} style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '96px 40px 48px' }} className="placer-scroll">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.03em', lineHeight: 1.15, overflowWrap: 'anywhere', minWidth: 0 }}>
            Welcome back,{' '}
            {/* Your name opens your public profile. No account id in the local, no-project
                mode, and so no public page to go to. */}
            {accountId && onOpenPublicProfile ? (
              <a href={`/people/${accountId}`} className="placer-name-link"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onOpenPublicProfile(accountId);
                }}>
                {name}
              </a>
            ) : name}
          </h1>
          {onSignOut && (
            <Btn t={t} variant="outline" size="sm" icon="logout" onClick={onSignOut}>
              Log Out
            </Btn>
          )}
        </div>

        <section aria-label="Quick Actions" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {onNewProject && (
              <Shortcut t={t} icon="plus" label="Create a Project" onClick={onNewProject} />
            )}
            <Shortcut t={t} icon="pin" label="Explore the map"
              onClick={() => (onExplore ? onExplore() : onNavigate('map'))} />
            <Shortcut t={t} icon="pencil" label="Edit your profile" onClick={() => onNavigate('settings')} />
            <Shortcut t={t} icon="bookmark" label="Guide" expanded={guideOpen} controls="dashboard-basics"
              onClick={() => setGuideOpen((open) => !open)} />
          </div>
        </section>

        {guideOpen && (
          <section id="dashboard-basics" aria-labelledby="dashboard-basics-title" style={{ marginBottom: 32 }}>
            <SectionLabel t={t} id="dashboard-basics-title">Getting Started</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <BasicsCard t={t} hue={PALETTE.purple}
                label="Quickstart tutorial" title="Create your first Project"
                onClick={() => onNavigate('quickstart')} />
              <BasicsCard t={t} hue={PALETTE.blue}
                label="Project Examples" title="Explore what other projects exist on the platform"
                onClick={() => onNavigate('projects')} />
              <BasicsCard t={t} hue={PALETTE.orange}
                label="FAQ" title="Answers to common questions about Placer"
                onClick={() => onNavigate('faq')} />
            </div>
          </section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16,
          marginBottom: 48 }}>
          <PanelCard t={t} id="dashboard-tasks" title="Up Next"
            action={tab === 'activity' ? (
              <Btn t={t} variant="outline" size="sm" icon="arrowRight" onClick={() => onNavigate('activity')}>
                View All
              </Btn>
            ) : null}>
            <div role="tablist" aria-label="Next steps and activity"
              style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <button type="button" role="tab" id="tab-steps" aria-selected={tab === 'steps'}
                aria-controls="panel-steps" onClick={() => setTab('steps')} style={tabStyle(tab === 'steps')}>
                Your Next Steps
                <TabBadge count={steps.length} noun="to do" />
              </button>
              <button type="button" role="tab" id="tab-activity" aria-selected={tab === 'activity'}
                aria-controls="panel-activity" onClick={() => setTab('activity')} style={tabStyle(tab === 'activity')}>
                Your Activity
                <TabBadge count={unreadActivity} noun="unread" />
              </button>
            </div>
            {tab === 'steps' && (
              <div role="tabpanel" id="panel-steps" aria-labelledby="tab-steps">
              {projectsStatus === 'loading' && <p style={{ fontSize: 14, color: t.inkDim }}>Loading…</p>}
              {projectsStatus !== 'loading' && steps.length === 0 && (
                <p style={{ fontSize: 14, color: t.inkDim }}>You are all caught up.</p>
              )}
              {steps.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {steps.map((step) => {
                    const kind = STEP_KINDS[step.kind];
                    return (
                      <li key={step.id} style={{ borderTop: `1px solid ${t.line}` }}>
                        <button type="button" onClick={() => actOn(step)} {...ARROW_ITEM}
                          className="placer-notification-row"
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: 'calc(100% + 20px)',
                            margin: '0 -10px', padding: '12px 10px', border: 'none', background: 'transparent',
                            borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--placer-font)' }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.ink }}>
                              {step.title}
                            </span>
                            <span style={{ display: 'block', fontSize: 13.5, color: t.inkDim, marginTop: 2 }}>
                              {step.detail}
                            </span>
                          </span>
                          <span className="placer-mono" style={{ flex: '0 0 auto', fontSize: 10.5, letterSpacing: '0.06em',
                            textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, marginTop: 1,
                            background: kind.colour.c100, color: kind.colour.c900 }}>
                            {kind.label}
                          </span>
                          <Icon name="chevRight" size={16} stroke={2} style={{ color: t.inkFaint, marginTop: 2 }} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              </div>
            )}
            {tab === 'activity' && (
              <div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
              {activityStatus === 'loading' && <p style={{ fontSize: 14, color: t.inkDim }}>Loading…</p>}
              {activityStatus === 'unavailable' && (
                <p style={{ fontSize: 14, color: t.inkDim }}>Your activity is not available right now.</p>
              )}
              {activityStatus === 'ready' && activity.length === 0 && (
                <p style={{ fontSize: 14, color: t.inkDim }}>
                  Nothing yet. Comments, follows, news from your projects and the tools you save
                  from the Toolkit will show up here.
                </p>
              )}
              {activityStatus === 'ready' && activity.length > 0 && (
                <ul aria-label="Recent activity" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {activity.map((notification) => (
                    <li key={notification.id} style={{ borderTop: `1px solid ${t.line}` }}>
                      <NotificationItem t={t} notification={notification} onOpenProject={onOpenProjectPage}
                        onOpenOrganisation={onOpenOrganisationPage} onOpenProfile={onOpenPublicProfile} compact />
                    </li>
                  ))}
                </ul>
              )}
              </div>
            )}
          </PanelCard>

          <PanelCard t={t} id="dashboard-projects" title="Projects"
            action={(
              <Btn t={t} variant="outline" size="sm" icon="arrowRight" onClick={() => onNavigate('projects')}>
                View all projects
              </Btn>
            )}>
            {projectsStatus === 'loading' && (
              <p style={{ fontSize: 14, color: t.inkDim }}>Loading your projects…</p>
            )}
            {projectsStatus === 'error' && (
              <p style={{ fontSize: 14, color: t.inkDim }}>Your projects could not be loaded. Try again in a moment.</p>
            )}
            {projectsStatus === 'ready' && recentProjects.length === 0 && (
              <p style={{ fontSize: 14, color: t.inkDim }}>
                No projects yet. Projects you run or collaborate on will show up here.
              </p>
            )}
            {recentProjects.length > 0 && (
              <div role="group" aria-label="Your projects, latest update first" className="placer-scroll"
                style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(220px, 1fr)', gap: 12,
                  overflowX: 'auto', scrollSnapType: 'x proximity' }}>
                {recentProjects.map((project) => (
                  <DashboardProjectCard key={project.id} t={t} project={project}
                    onOpen={(id) => onOpenProject?.(id)} />
                ))}
              </div>
            )}
          </PanelCard>
        </div>

      </div>
    </div>
  );
}

export default DashboardPage;
