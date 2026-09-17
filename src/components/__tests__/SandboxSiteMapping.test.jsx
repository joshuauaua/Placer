import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SiteMapping } from '../sandbox/SiteMapping';
import { findExperiment } from '../../sandbox/experiments';
import { THEME } from '../../theme';
import {
  MAP_MARKERS,
  SURVEY_QUESTIONS,
  answerQuestion,
  emptyAnswers,
  emptyContact,
  emptyProfile,
  emptyState,
  buildJSON,
  buildSummary,
  isSurveyComplete,
  isValidEmail,
  parseSiteSearch,
  placeMarker,
} from '../../lib/sandbox/siteMapping';

function mount() {
  return render(<SiteMapping t={THEME} experiment={findExperiment('site-spatial-mapping')} />);
}

function loadPresetSite() {
  fireEvent.click(screen.getByRole('button', { name: 'Lindenplatz' }));
}

function answerAll() {
  for (let i = 0; i < SURVEY_QUESTIONS.length; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  }
}

describe('Site-Specific Spatial Mapping Tool', () => {
  it('is registered with its map pin identity', () => {
    expect(findExperiment('site-spatial-mapping')).toMatchObject({
      id: 'site-spatial-mapping',
      name: 'Site-Specific Spatial Mapping Tool',
      icon: 'pin',
    });
  });

  it('opens on the site picker, with no survey yet', () => {
    mount();

    expect(screen.getByLabelText('Site name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lindenplatz' })).toBeInTheDocument();
    expect(screen.queryByText(/question 1 of 18/i)).not.toBeInTheDocument();
  });

  it('loads the site and opens section 1 as an ordered card stack', () => {
    mount();
    loadPresetSite();

    expect(screen.getByText(/question 1 of 18/i)).toBeInTheDocument();
    expect(screen.getByText('A variety of seating and resting places')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /site map/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open this site in google maps/i })).toBeInTheDocument();
  });

  it('walks the eighteen cards in order and then offers the two optional sections', () => {
    mount();
    loadPresetSite();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(screen.getByText(/question 2 of 18/i)).toBeInTheDocument();
    expect(screen.getByText('Nice views, or things to look at')).toBeInTheDocument();

    answerAllYesFrom(2);

    expect(screen.getByText(/eighteen of eighteen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add spatial mapping \(optional\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add qualitative reflection \(optional\)/i })).toBeInTheDocument();
    // Both the choice panel and the progress card offer the finish.
    expect(screen.getAllByRole('button', { name: /finish & export data/i }).length).toBeGreaterThan(0);
  });

  it('opens the spatial palette with five draggable icons that land on the map', () => {
    mount();
    loadPresetSite();
    answerAll();

    fireEvent.click(screen.getByRole('button', { name: /add spatial mapping \(optional\)/i }));

    const palette = screen.getByRole('group', { name: 'Marker palette' });
    for (const kind of MAP_MARKERS) {
      expect(within(palette).getByRole('button', { name: new RegExp(kind.label) })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('group', { name: /site map/i }));
    expect(screen.getAllByText(/1 placed/).length).toBeGreaterThan(0);
  });

  it('asks for age and gender on the site picker without blocking the survey', () => {
    mount();

    expect(screen.getByRole('group', { name: 'Age' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Gender' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '25–34' }));
    fireEvent.click(screen.getByRole('button', { name: 'Female' }));
    loadPresetSite();

    expect(screen.getByText(/question 1 of 18/i)).toBeInTheDocument();
  });

  it('prompts for contact details once the survey is complete and exports them', () => {
    const { container } = mount();
    loadPresetSite();
    answerAll();

    expect(screen.getByText(/want to stay involved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue — leave contact details/i }));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex Rivera' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.org' } });
    fireEvent.click(screen.getByLabelText(/happy to be contacted/i));

    const compiled = container.querySelector('pre');
    expect(compiled.textContent).toContain('Alex Rivera');
    expect(compiled.textContent).toContain('alex@example.org');
  });

  it('warns on a mistyped email but keeps the export working', () => {
    mount();
    loadPresetSite();
    answerAll();
    fireEvent.click(screen.getAllByRole('button', { name: /finish & export data/i })[0]);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/does not look right/i);
  });

  it('falls back to coordinates and presets when no Maps key is configured', () => {
    mount();
    expect(screen.getByLabelText(/or type coordinates/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use my location/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/or type coordinates/i), { target: { value: '52.52, 13.40' } });
    fireEvent.click(screen.getByRole('button', { name: /load site/i }));
    expect(screen.getByText(/question 1 of 18/i)).toBeInTheDocument();
  });

  it('carries profile and contact through the pure JSON and summary', () => {
    const state = {
      ...emptyState(),
      profile: { ageRange: '25-34', gender: 'female', genderSelf: '' },
      contact: { name: 'Alex', email: 'alex@example.org', phone: '', consent: true },
    };
    const site = { name: 'Lindenplatz', lat: 52.52, lng: 13.4 };
    const parsed = JSON.parse(buildJSON(site, state));
    expect(parsed.respondent).toMatchObject({ ageRange: '25-34', gender: 'female' });
    expect(parsed.contact).toMatchObject({ name: 'Alex', consent: true });
    const summary = buildSummary(site, state);
    expect(summary).toContain('25–34');
    expect(summary).toContain('Alex');

    expect(emptyProfile()).toEqual({ ageRange: '', gender: '', genderSelf: '' });
    expect(emptyContact()).toEqual({ name: '', email: '', phone: '', consent: false });
    expect(isValidEmail('')).toBe(true);
    expect(isValidEmail('alex@example.org')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('opens the reflection popup and carries a note into the export', () => {
    const { container } = mount();
    loadPresetSite();
    answerAll();

    fireEvent.click(screen.getByRole('button', { name: /add qualitative reflection \(optional\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Welcome' }));
    fireEvent.change(screen.getByLabelText('Who belongs here?'), { target: { value: 'Everyone at lunch' } });
    fireEvent.click(screen.getByRole('button', { name: /keep & export/i }));

    const compiled = container.querySelector('pre');
    expect(compiled.textContent).toContain('Everyone at lunch');
    expect(compiled.textContent).toContain('Welcome');
  });

  it('answers one question at a time in the pure logic', () => {
    let answers = emptyAnswers();
    expect(isSurveyComplete(answers)).toBe(false);

    for (const q of SURVEY_QUESTIONS) answers = answerQuestion(answers, q.key, true);
    expect(isSurveyComplete(answers)).toBe(true);
  });

  it('parses coordinate searches and refuses the rest', () => {
    expect(parseSiteSearch('52.52, 13.40')).toEqual({ lat: 52.52, lng: 13.4 });
    expect(parseSiteSearch('not a place')).toBeNull();
    expect(parseSiteSearch('200, 13')).toBeNull();
  });

  it('ignores unknown marker types', () => {
    expect(placeMarker([], 'nope', 0.5, 0.5)).toEqual([]);
    expect(placeMarker([], 'magnet', 0.5, 0.5)).toHaveLength(1);
  });
});

/** Answer-all helper split so the ordering test can assert mid-stack first. */
function answerAllYesFrom(questionNumber) {
  // questionNumber is 1-indexed; question 1 was already answered by the caller.
  for (let i = questionNumber; i <= SURVEY_QUESTIONS.length; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  }
}
