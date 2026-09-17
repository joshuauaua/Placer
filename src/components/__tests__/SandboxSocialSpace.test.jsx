import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SocialSpaceSurvey } from '../sandbox/SocialSpaceSurvey';
import { findExperiment } from '../../sandbox/experiments';
import { THEME } from '../../theme';
import { buildJSON, buildSummary, emptySurvey } from '../../lib/sandbox/socialSpaceSurvey';

function mount() {
  return render(<SocialSpaceSurvey t={THEME} experiment={findExperiment('social-space-survey')} />);
}

function completeStep1() {
  fireEvent.click(screen.getByRole('button', { name: 'Complete step 1' }));
}

describe('Social Space Survey', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens on the site setup with all eighteen checklist items', () => {
    mount();

    expect(screen.getByText(/bring clothes for the weather and take at least 5 minutes to observe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Park' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('checkbox')).toHaveLength(18);
    expect(screen.getByLabelText('A variety of seating and resting places')).toBeInTheDocument();
    expect(screen.getByLabelText('Unnecessary permanent fences or barriers')).toBeInTheDocument();
    expect(screen.getByText('items 1–14 · 0/14')).toBeInTheDocument();
    expect(screen.getByText('items 15–18 · 0/4')).toBeInTheDocument();
  });

  it('reveals a detail field when an inviting feature is ticked', () => {
    mount();

    fireEvent.click(screen.getByLabelText('Nice views, or things to look at'));
    const detail = screen.getByLabelText(/nice views.*what did you find/i);
    expect(detail).toBeInTheDocument();

    fireEvent.change(detail, { target: { value: 'The river bend' } });
    expect(detail.value).toBe('The river bend');
  });

  it('completes step 1 and offers the two optional steps plus the finish', () => {
    mount();
    fireEvent.click(screen.getByLabelText('Unnecessary permanent fences or barriers'));

    completeStep1();

    expect(screen.getByText(/step 1 recorded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish & export data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add spatial mapping \(optional\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add qualitative reflection \(optional\)/i })).toBeInTheDocument();
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('logs a magnet with a strength rating and carries it into the export', () => {
    const { container } = mount();
    completeStep1();

    fireEvent.click(screen.getByRole('button', { name: /add spatial mapping \(optional\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a magnet' }));

    const feature = screen.getByLabelText('What draws people in?');
    fireEvent.change(feature, { target: { value: 'Temporary market stalls' } });
    fireEvent.click(screen.getByRole('button', { name: 'Strength 4 of 5' }));

    expect(screen.getByText('4/5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finish & export data' }));

    const compiled = container.querySelector('pre');
    expect(compiled.textContent).toContain('Temporary market stalls — 4/5');
  });

  it('records the four-point ratings and the qualitative notes', () => {
    const { container } = mount();
    completeStep1();

    fireEvent.click(screen.getByRole('button', { name: /add qualitative reflection \(optional\)/i }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Totally' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Maybe' })[1]);

    const demographics = screen.getByLabelText('Demographics you noticed');
    fireEvent.change(demographics, { target: { value: 'All ages, mostly local' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Keep & export' })[0]);

    const compiled = container.querySelector('pre');
    expect(compiled.textContent).toContain('SOCIAL COHESION & INCLUSION');
    expect(compiled.textContent).toContain('Totally — Is this place good for people-watching');
    expect(compiled.textContent).toContain('All ages, mostly local');
  });

  it('copies the compiled summary when the clipboard allows it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    mount();
    completeStep1();

    fireEvent.click(screen.getByRole('button', { name: 'Finish & export data' }));
    fireEvent.click(screen.getByRole('button', { name: /copy summary/i }));

    expect(await screen.findByRole('button', { name: /summary copied/i })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('SOCIAL SPACE SURVEY — PLACER Sandbox'));
  });

  it('leaves the optional top-level keys out of the JSON until they hold something', () => {
    const bare = JSON.parse(buildJSON(emptySurvey()));
    expect(bare.inventory.inviting).toHaveProperty('seating');
    expect(bare.spatialPatterns).toBeUndefined();
    expect(bare.qualitativeReflection).toBeUndefined();

    const full = JSON.parse(buildJSON({
      ...emptySurvey(),
      inventory: {
        inviting: { seating: { checked: true, detail: 'Long benches' } },
        hindering: { fences: true },
      },
      spatialPatterns: {
        magnets: [{ feature: 'Stage', strength: 4, note: '' }],
        compression: [],
        participation: [],
      },
      qualitativeReflection: {
        ratings: { peopleWatching: 2 },
        notes: { demographics: 'All ages' },
      },
    }));

    expect(full.inventory.inviting.seating).toEqual({ checked: true, detail: 'Long benches' });
    expect(full.inventory.hindering.fences).toBe(true);
    expect(full.spatialPatterns.magnets).toHaveLength(1);
    expect(full.spatialPatterns.magnets[0].strength).toBe(4);
    expect(full.qualitativeReflection.ratings.peopleWatching).toBe(2);

    const summary = buildSummary({
      ...emptySurvey(),
      meta: { siteName: 'Lindenplatz', spaceType: 'Plaza', date: '2026-09-17', time: '11:00', weather: 'Sunny' },
    });
    expect(summary).toContain('Name: Lindenplatz');
    expect(summary).toContain('Space type: Plaza');
    expect(summary).toContain('Observed: 2026-09-17 at 11:00');
  });
});