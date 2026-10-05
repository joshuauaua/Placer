/* PLACER — your dashboard: shortcuts to what to do next */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ImaginationCard } from './ImaginationCard';
import { ImaginationPreview } from './ImaginationPreview';
import { NotificationItem } from './NotificationItem';
import { postsAreShared, readLocalImaginations } from '../services/imaginations';
import {
  PROJECT_TYPE_NAMES, isSupabaseConfigured as projectsAvailable, readMyProjects,
} from '../services/projects';
import { listNotifications } from '../services/notifications';
import { byUrgency, nextSteps, projectProgress } from '../lib/projectTimeline';
import { CHARACTER } from '../theme';

// How many of each the dashboard shows before View All.
const PROJECTS_SHOWN = 3;
const STEPS_SHOWN = 5;
const ACTIVITY_SHOWN = 5;

// A project's picture stand-in, by kind: the character the kind of project is closest to.
const TYPE_TINTS = { steward: CHARACTER.cityWorker, advocate: CHARACTER.citizen, other: CHARACTER.practitioner };

const STEP_KINDS = {
  deadline: { label: 'Deadline', character: CHARACTER.citizen },
  milestone: { label: 'Milestone', character: CHARACTER.cityWorker },
  action: { label: 'To do', character: CHARACTER.practitioner },
};

// One of the three things the dashboard offers to do next, as a card-sized button.
/** A Quick Actions card: a grey tile with the icon above the label, both centred. */
function Shortcut({ t, icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="placer-quick-action"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, minHeight: 160, padding: 24, textAlign: 'center', background: t.surfaceAlt,
        border: 'none', borderRadius: 16, cursor: 'pointer',
        fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 700, color: t.ink }}>
      <Icon name={icon} size={30} stroke={2} />
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
 * A large card with a gradient between two of the three brand colours, a small
 * label over a bold line, and an arrow. The colours are the 300 steps, which ink
 * reads well on from one end to the other.
 */
function BasicsCard({ t, from, to, label, title, onClick }) {
  return (
    <button type="button" onClick={onClick} className="placer-basics-card"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32,
        minHeight: 200, padding: 28, textAlign: 'left', cursor: 'pointer', border: 'none', borderRadius: 16,
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, color: t.ink,
        fontFamily: 'var(--placer-font)' }}>
      <span>
        <span className="placer-caption" style={{ display: 'block', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
          {label}
        </span>
        <span className="placer-disp" style={{ display: 'block', fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, maxWidth: 420 }}>
          {title}
        </span>
      </span>
      <Icon name="arrowRight" size={24} stroke={2.2} />
    </button>
  );
}

/**
 * One of the account's projects: its picture, what kind it is, its name, and a bar of
 * how much of its time has gone, with what is left in words beside it.
 */
function DashboardProjectCard({ t, project, onOpen }) {
  const progress = projectProgress(project);
  const tint = TYPE_TINTS[project.projectType] ?? CHARACTER.cityWorker;
  return (
    <button type="button" onClick={() => onOpen(project.id)} className="placer-dashboard-project"
      style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 0, overflow: 'hidden',
        background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, cursor: 'pointer',
        fontFamily: 'var(--placer-font)', color: t.ink }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
        aspectRatio: '16 / 9', background: tint.c50, color: tint.c700 }}>
        {project.image
          ? <img src={project.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
  onSignIn, onSignOut, onExplore, onOpenPublicProfile, onOpenProject, onOpenProjectPage,
  onOpenOrganisationPage }) {
  // The imagination open in the modal, if any — set from any card on this page.
  const [selected, setSelected] = useState(null);
  // Imaginations still only in this browser, made before there were accounts: nobody
  // else can see them. Only a separate store where a project is configured — without
  // one, the local store is the only store and there is nothing to set apart.
  const [onlyHere, setOnlyHere] = useState([]);

  const shared = postsAreShared();

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

  // The latest few notifications. Like projects, there are none to have without a
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
    listNotifications({ limit: ACTIVITY_SHOWN })
      .then((found) => {
        if (cancelled) return;
        setActivity(found);
        setActivityStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your activity:', err);
        setActivityStatus('unavailable');
      });
    return () => { cancelled = true; };
  }, [accountId]);

  useEffect(() => {
    if (!shared) return undefined;

    let cancelled = false;

    readLocalImaginations()
      .then((local) => {
        if (!cancelled) setOnlyHere(local);
      })
      .catch((err) => {
        if (!cancelled) console.error('Could not load imaginations saved on this device:', err);
      });

    return () => { cancelled = true; };
  }, [shared]);

  // Escape closes the modal, matching the map's own Escape behaviour.
  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const name = profile?.name ?? '';
  const shownProjects = byUrgency(projects).slice(0, PROJECTS_SHOWN);
  const steps = projectsStatus === 'ready' ? nextSteps(projects, profile).slice(0, STEPS_SHOWN) : [];

  const actOn = (step) => {
    if (step.target === 'project') onOpenProject?.(step.projectId);
    else if (step.target === 'newProject') onNewProject?.();
    else onNavigate(step.target);
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '96px 40px 48px' }} className="placer-scroll">
      {selected && (
        <ImaginationPreview t={t} imagination={selected} onClose={() => setSelected(null)}
          accountId={accountId} authorName={name} onSignIn={onSignIn}
          onDeleted={(id) => {
            setOnlyHere((current) => current.filter((item) => item.id !== id));
            setSelected(null);
          }} />
      )}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 64 }}>
          {/* The heading and the profile link share a line, on their baselines, and the
              link drops under the heading when there is not room for both. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px 20px', flexWrap: 'wrap', minWidth: 0 }}>
            <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
              Welcome back, {name}
            </h1>
            {/* No account id in the local, no-project mode, and so no public page to go to. */}
            {accountId && onOpenPublicProfile && (
              <a href={`/people/${accountId}`}
                onClick={(e) => { e.preventDefault(); onOpenPublicProfile(accountId); }}
                style={{ fontSize: 16, color: t.ink, fontWeight: 500, textDecoration: 'underline' }}>
                View your public profile
              </a>
            )}
          </div>
          {onSignOut && (
            <Btn t={t} variant="outline" size="sm" icon="logout" onClick={onSignOut}>
              Log Out
            </Btn>
          )}
        </div>

        <section aria-labelledby="dashboard-basics" style={{ marginBottom: 48 }}>
          <SectionLabel t={t} id="dashboard-basics">Getting Started</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <BasicsCard t={t} from={CHARACTER.cityWorker.c300} to={CHARACTER.practitioner.c300}
              label="Quickstart tutorial" title="Create your first Project"
              onClick={() => onNavigate('quickstart')} />
            <BasicsCard t={t} from={CHARACTER.practitioner.c300} to={CHARACTER.citizen.c300}
              label="Project Examples" title="Explore what other projects exist on the platform"
              onClick={() => onNavigate('projectExamples')} />
          </div>
        </section>

        <section aria-labelledby="dashboard-quick-actions" style={{ marginBottom: 48 }}>
          <SectionLabel t={t} id="dashboard-quick-actions">Quick Actions</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Shortcut t={t} icon="pencil" label="Edit my profile" onClick={() => onNavigate('settings')} />
            <Shortcut t={t} icon="pin" label="Explore the map"
              onClick={() => (onExplore ? onExplore() : onNavigate('map'))} />
            {onNewProject && (
              <Shortcut t={t} icon="plus" label="Create a Project" onClick={onNewProject} />
            )}
          </div>
        </section>

        <section aria-labelledby="dashboard-projects" style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            marginBottom: 12 }}>
            <SectionLabel t={t} id="dashboard-projects" style={{ marginBottom: 0 }}>Projects</SectionLabel>
            <Btn t={t} variant="outline" size="sm" icon="arrowRight" onClick={() => onNavigate('projects')}>
              View all projects
            </Btn>
          </div>
          {projectsStatus === 'loading' && (
            <p style={{ fontSize: 15, color: t.inkDim }}>Loading your projects…</p>
          )}
          {projectsStatus === 'error' && (
            <p style={{ fontSize: 15, color: t.inkDim }}>Your projects could not be loaded. Try again in a moment.</p>
          )}
          {projectsStatus === 'ready' && shownProjects.length === 0 && (
            // No button of its own: Create a Project is right above, in Quick Actions.
            <p style={{ padding: 24, borderRadius: 16, border: `1px dashed ${t.lineStrong}`,
              fontSize: 15, color: t.inkDim }}>
              No projects yet. Projects you run or collaborate on will show up here.
            </p>
          )}
          {shownProjects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {shownProjects.map((project) => (
                <DashboardProjectCard key={project.id} t={t} project={project}
                  onOpen={(id) => onOpenProject?.(id)} />
              ))}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16,
          marginBottom: 48 }}>
          <PanelCard t={t} id="dashboard-next-steps" title="Your Next Steps">
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
                      <button type="button" onClick={() => actOn(step)} className="placer-notification-row"
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: 'calc(100% + 20px)',
                          margin: '0 -10px', padding: '12px 10px', border: 'none', background: 'transparent',
                          borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--placer-font)' }}>
                        <span className="placer-mono" style={{ flex: '0 0 auto', fontSize: 10.5, letterSpacing: '0.06em',
                          textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, marginTop: 1,
                          background: kind.character.c100, color: kind.character.c900 }}>
                          {kind.label}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.ink }}>
                            {step.title}
                          </span>
                          <span style={{ display: 'block', fontSize: 13.5, color: t.inkDim, marginTop: 2 }}>
                            {step.detail}
                          </span>
                        </span>
                        <Icon name="chevRight" size={16} stroke={2} style={{ color: t.inkFaint, marginTop: 2 }} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelCard>

          <PanelCard t={t} id="dashboard-activity" title="Your Activity"
            action={(
              <Btn t={t} variant="outline" size="sm" icon="arrowRight" onClick={() => onNavigate('activity')}>
                View All
              </Btn>
            )}>
            {activityStatus === 'loading' && <p style={{ fontSize: 14, color: t.inkDim }}>Loading…</p>}
            {activityStatus === 'unavailable' && (
              <p style={{ fontSize: 14, color: t.inkDim }}>Your activity is not available right now.</p>
            )}
            {activityStatus === 'ready' && activity.length === 0 && (
              <p style={{ fontSize: 14, color: t.inkDim }}>
                Nothing yet. Comments, follows and news from your projects will show up here.
              </p>
            )}
            {activityStatus === 'ready' && activity.length > 0 && (
              <ul aria-label="Recent activity" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {activity.map((notification) => (
                  <li key={notification.id} style={{ borderTop: `1px solid ${t.line}` }}>
                    <NotificationItem t={t} notification={notification} onOpenProject={onOpenProjectPage}
                      onOpenOrganisation={onOpenOrganisationPage} compact />
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>

        {/* Anything made before there were accounts. Left where it is rather than uploaded:
            it was made under a privacy policy that said it would never leave the device,
            and publishing it to a shared map without being asked would break that. */}
        {shared && onlyHere.length > 0 && (
          <>
            <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.02em', marginBottom: 8 }}>
              Saved on this device
            </h2>
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 20 }}>
              Made before you had an account, so they live in this browser and nobody else
              can see them. They stay here until you clear your browsing data — they are not
              on the community map, and nothing has been uploaded.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 24, paddingBottom: 40 }}>
              {onlyHere.map((imagination) => (
                <ImaginationCard key={imagination.id} t={t} imagination={imagination} onOpen={setSelected} />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default DashboardPage;
