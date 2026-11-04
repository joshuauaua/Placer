import { describe, it, expect } from 'vite-plus/test';
import { byUrgency, nextSteps, projectProgress } from '../projectTimeline';

// Noon, so no time zone can tip it onto another day.
const NOW = new Date(2026, 9, 5, 12);

const project = (fields) => ({ id: fields.name, locationShapes: [{ path: [] }], image: 'x.webp', ...fields });

describe('projectProgress', () => {
  it('measures how much of a running project\'s time has gone', () => {
    expect(projectProgress(project({ startDate: '2026-10-01', endDate: '2026-10-11' }), NOW))
      .toEqual({ state: 'ongoing', percent: 40, daysLeft: 6, label: '6 days left' });
  });

  it('counts down a project with an end but no start, with no percentage', () => {
    expect(projectProgress(project({ endDate: '2026-10-06' }), NOW))
      .toEqual({ state: 'ongoing', percent: null, daysLeft: 1, label: '1 day left' });
  });

  it('says a project ends today on its last day', () => {
    expect(projectProgress(project({ startDate: '2026-09-05', endDate: '2026-10-05' }), NOW).label).toBe('Ends today');
  });

  it('says how long until a project starts', () => {
    expect(projectProgress(project({ startDate: '2026-10-15', endDate: '2026-11-15' }), NOW))
      .toMatchObject({ state: 'upcoming', percent: 0, label: 'Starts in 10 days' });
  });

  it('fills the bar once a project is over', () => {
    expect(projectProgress(project({ startDate: '2026-01-01', endDate: '2026-02-01' }), NOW))
      .toMatchObject({ state: 'ended', percent: 100, label: 'Ended' });
  });

  it('has nothing to measure without an end date', () => {
    expect(projectProgress(project({ startDate: '2026-01-01' }), NOW))
      .toMatchObject({ state: 'undated', percent: null, label: 'No end date set' });
  });
});

describe('byUrgency', () => {
  it('puts running projects first, soonest to end, then upcoming, undated and ended', () => {
    const ordered = byUrgency([
      project({ name: 'Ended', startDate: '2026-01-01', endDate: '2026-02-01' }),
      project({ name: 'Undated' }),
      project({ name: 'Later', startDate: '2026-10-01', endDate: '2026-12-01' }),
      project({ name: 'Upcoming', startDate: '2026-11-01', endDate: '2026-12-01' }),
      project({ name: 'Sooner', startDate: '2026-10-01', endDate: '2026-10-10' }),
    ], NOW);
    expect(ordered.map(({ name }) => name)).toEqual(['Sooner', 'Later', 'Upcoming', 'Undated', 'Ended']);
  });
});

describe('nextSteps', () => {
  const profile = { name: 'Mara', location: 'Malmö' };

  it('lists ends and starts coming up, soonest first, before anything undated', () => {
    const steps = nextSteps([
      project({ name: 'Greenway', startDate: '2026-10-20', endDate: '2026-12-01' }),
      project({ name: 'Square', startDate: '2026-09-01', endDate: '2026-10-08' }),
    ], profile, NOW);
    expect(steps.map(({ kind, title }) => [kind, title])).toEqual([
      ['deadline', 'Square ends in 3 days'],
      ['milestone', 'Greenway starts in 15 days'],
    ]);
  });

  it('leaves out ends and starts more than a month away', () => {
    expect(nextSteps([project({ name: 'Far', startDate: '2026-09-01', endDate: '2027-03-01' })], profile, NOW))
      .toEqual([]);
  });

  it('asks for what a project is still missing', () => {
    const steps = nextSteps([project({ name: 'Bare', locationShapes: [], image: null })], profile, NOW);
    expect(steps.map(({ title }) => title)).toEqual([
      'Set an end date for Bare', 'Draw where Bare is', 'Add a picture to Bare',
    ]);
    expect(steps.every(({ target, projectId }) => target === 'project' && projectId === 'Bare')).toBe(true);
  });

  it('asks nothing more of a project that is over', () => {
    expect(nextSteps([project({ name: 'Done', endDate: '2026-01-01', image: null })], profile, NOW)).toEqual([]);
  });

  it('suggests a first project, and a location for an account without one', () => {
    expect(nextSteps([], { name: 'Mara', location: '' }, NOW).map(({ target }) => target))
      .toEqual(['newProject', 'settings']);
  });
});
