/* PLACER — where a project is in its time, and what is coming up across an account's
 * projects. The dashboard's project cards draw their bar from projectProgress, and
 * its Next Steps are nextSteps.
 *
 * A project only has a start and an end date (supabase/projects.sql); there are no
 * milestones or tasks to read yet. So Next Steps is put together from those dates —
 * a project starting soon, a project ending soon — and from what a project or the
 * account is still missing that the rest of the app needs, like an outline for the
 * map or a location for Explore to open over.
 */

const DAY = 24 * 60 * 60 * 1000;

// How far ahead a start or an end counts as coming up.
export const SOON_DAYS = 30;

/** A 'YYYY-MM-DD' date as the start of that day, local time, or null. */
function dayOf(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from `from` to `to`, both taken as days rather than instants. */
function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

export function pluralDays(days) {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * Where a project is in its time: `state` is 'undated', 'upcoming', 'ongoing' or
 * 'ended'; `percent` is how much of its time has passed, 0–100, or null when there is
 * no span to measure; `daysLeft` is the days to its end while it runs; `label` says
 * it in words.
 */
export function projectProgress(project, now = new Date()) {
  const start = dayOf(project?.startDate);
  const end = dayOf(project?.endDate);
  const today = startOfDay(now);

  if (!end) {
    if (start && today < start) {
      const days = daysBetween(today, start);
      return { state: 'upcoming', percent: 0, daysLeft: null, label: `Starts in ${pluralDays(days)}` };
    }
    return { state: 'undated', percent: null, daysLeft: null, label: 'No end date set' };
  }

  if (today > end) return { state: 'ended', percent: 100, daysLeft: 0, label: 'Ended' };

  if (start && today < start) {
    const days = daysBetween(today, start);
    return { state: 'upcoming', percent: 0, daysLeft: null, label: `Starts in ${pluralDays(days)}` };
  }

  const daysLeft = daysBetween(today, end);
  // With no start date the span cannot be measured, only the time left counted down.
  const span = start ? daysBetween(start, end) : null;
  const percent = span > 0 ? Math.min(100, Math.max(0, Math.round(((span - daysLeft) / span) * 100))) : null;
  const label = daysLeft === 0 ? 'Ends today' : `${pluralDays(daysLeft)} left`;
  return { state: 'ongoing', percent, daysLeft, label };
}

// The order projects are worth looking at in: what is running, soonest to end first;
// then what is about to start; then what has no dates; then what is over.
const STATE_ORDER = { ongoing: 0, upcoming: 1, undated: 2, ended: 3 };

/** `projects`, most pressing first — the dashboard shows the first few. */
export function byUrgency(projects, now = new Date()) {
  return projects
    .map((project) => ({ project, progress: projectProgress(project, now) }))
    .sort((a, b) => {
      const order = STATE_ORDER[a.progress.state] - STATE_ORDER[b.progress.state];
      if (order) return order;
      if (a.progress.state === 'ongoing') return a.progress.daysLeft - b.progress.daysLeft;
      if (a.progress.state === 'upcoming') return (a.project.startDate ?? '').localeCompare(b.project.startDate ?? '');
      return 0;
    })
    .map(({ project }) => project);
}

/**
 * What an account has coming up or still to do, soonest first. Each step is
 * { id, kind: 'deadline' | 'milestone' | 'action', title, detail, days, projectId? ,
 * target }, where `target` says where acting on it happens: 'project' (its
 * dashboard), 'settings' or 'newProject'. `days` orders them; actions, which have no
 * date, come after everything that does.
 */
export function nextSteps(projects, profile, now = new Date()) {
  const steps = [];
  const today = startOfDay(now);

  projects.forEach((project) => {
    const start = dayOf(project.startDate);
    const end = dayOf(project.endDate);
    const progress = projectProgress(project, now);

    if (progress.state === 'ongoing' && progress.daysLeft <= SOON_DAYS) {
      steps.push({ id: `${project.id}-end`, kind: 'deadline', projectId: project.id, target: 'project',
        title: `${project.name} ends ${progress.daysLeft === 0 ? 'today' : `in ${pluralDays(progress.daysLeft)}`}`,
        detail: 'Wrap up what is still open with the people taking part.', days: progress.daysLeft });
    }
    if (start && today < start && daysBetween(today, start) <= SOON_DAYS) {
      const days = daysBetween(today, start);
      steps.push({ id: `${project.id}-start`, kind: 'milestone', projectId: project.id, target: 'project',
        title: `${project.name} starts ${days === 0 ? 'today' : `in ${pluralDays(days)}`}`,
        detail: 'Get its first activity ready.', days });
    }
    if (progress.state === 'ended') return;
    if (!end) {
      steps.push({ id: `${project.id}-dates`, kind: 'action', projectId: project.id, target: 'project',
        title: `Set an end date for ${project.name}`, detail: 'So everyone knows how long they have.',
        days: Infinity });
    }
    if ((project.locationShapes ?? []).length === 0) {
      steps.push({ id: `${project.id}-outline`, kind: 'action', projectId: project.id, target: 'project',
        title: `Draw where ${project.name} is`, detail: 'Its outline is what puts it on Explore.',
        days: Infinity });
    }
    if (!project.image) {
      steps.push({ id: `${project.id}-image`, kind: 'action', projectId: project.id, target: 'project',
        title: `Add a picture to ${project.name}`, detail: 'It leads its card and its preview on the map.',
        days: Infinity });
    }
  });

  if (projects.length === 0) {
    steps.push({ id: 'first-project', kind: 'action', target: 'newProject', title: 'Start your first project',
      detail: 'Set out a place and what you want to find out about it.', days: Infinity });
  }
  if (profile && !profile.location) {
    steps.push({ id: 'profile-location', kind: 'action', target: 'settings', title: 'Add your location',
      detail: 'Explore opens over it, and people can see where you are based.', days: Infinity });
  }

  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => (a.step.days - b.step.days) || (a.index - b.index))
    .map(({ step }) => step);
}
