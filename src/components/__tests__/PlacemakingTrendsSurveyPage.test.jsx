import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { THEME } from '../../theme';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

const posthog = (await import('posthog-js')).default;
const { PlacemakingTrendsSurveyPage } = await import('../PlacemakingTrendsSurveyPage');
const { MODULES, questionType, resolveSurveyContent } = await import('../placemakingSurvey/content');

const content = resolveSurveyContent();
const TOTAL = MODULES.reduce((sum, module) => sum + content[module].length, 0);

const options = () => within(screen.getByRole('group')).getAllByRole('button');
const slider = () => screen.getByRole('slider');
const optIn = (label) => screen.getByRole('checkbox', { name: label });
const button = (name) => screen.getByRole('button', { name });
const heading = (name) => screen.getByRole('heading', { name });
const field = (name) => screen.getByRole('textbox', { name });

/** Answers whatever question is on screen, whichever kind it is. */
function answerCurrent(question, optionIndex = 0) {
  const type = questionType(question);

  if (type === 'text' || type === 'paragraph') {
    fireEvent.change(field(question.label), { target: { value: 'An answer' } });
    return;
  }

  if (type === 'scale') {
    fireEvent.change(slider(), { target: { value: String(question.scaleMin ?? 1) } });
    return;
  }

  fireEvent.click(options()[optionIndex]);
}

/** Walks from the cover to the closing step, answering every question. */
function walkToOptIn() {
  fireEvent.click(button(content.cover.startLabel));

  MODULES.forEach((module) => {
    content[module].forEach((question) => {
      answerCurrent(question);
      fireEvent.click(button(content.steps.nextLabel));
    });
  });
}

const firstQuestion = content[MODULES[0]][0];

describe('PlacemakingTrendsSurveyPage', () => {
  beforeEach(() => {
    localStorage.clear();
    posthog.capture.mockClear();
  });

  it('opens on the cover', () => {
    render(<PlacemakingTrendsSurveyPage t={THEME} />);

    expect(heading(content.cover.title)).toBeInTheDocument();
    expect(screen.queryByText('Placemaking Trends Survey 2026/2027')).not.toBeInTheDocument();
    expect(screen.getByText(content.cover.body[0])).toBeInTheDocument();
  });

  it('shows the first question of module 1 once started', () => {
    render(<PlacemakingTrendsSurveyPage t={THEME} />);
    fireEvent.click(button(content.cover.startLabel));

    expect(heading(content.steps.module1Title)).toBeInTheDocument();
    expect(heading(firstQuestion.label)).toBeInTheDocument();
    expect(screen.getByText(`1 / ${TOTAL}`)).toBeInTheDocument();
  });

  it('walks all four modules to the closing step', () => {
    render(<PlacemakingTrendsSurveyPage t={THEME} />);
    walkToOptIn();

    expect(heading(content.steps.optInTitle)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  describe('the closing step', () => {
    beforeEach(() => {
      render(<PlacemakingTrendsSurveyPage t={THEME} />);
      walkToOptIn();
    });

    it('offers Submit right away, with the contact fields present but empty', () => {
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
      content.optIns.forEach((entry) => expect(optIn(entry.label)).not.toBeChecked());
      expect(heading(content.contact.title)).toBeInTheDocument();
      content.contact.fields.forEach((entry) => expect(field(entry.label)).toHaveValue(''));
    });

    it('holds Submit once any detail is typed, until it is all there and the address is plausible', () => {
      fireEvent.change(field('Full Name'), { target: { value: 'A. Planner' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(field('Municipality / City & Country'), {
        target: { value: 'Rotterdam, Netherlands' },
      });
      fireEvent.change(field('Department'), { target: { value: 'Zoning' } });
      fireEvent.change(field('Work Email Address'), { target: { value: 'not-an-email' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(field('Work Email Address'), { target: { value: 'planner@city.gov' } });
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
    });

    it('does not require contact details just because an opt-in is ticked', () => {
      fireEvent.click(optIn(content.optIns[0].label));

      expect(button(content.steps.submitLabel)).not.toBeDisabled();
    });

    it('clears and locks the details and other opt-ins when anonymous is ticked', () => {
      const anonymous = content.optIns.find((entry) => entry.anonymous);
      const others = content.optIns.filter((entry) => !entry.anonymous);

      fireEvent.change(field('Full Name'), { target: { value: 'A. Planner' } });
      fireEvent.click(optIn(others[0].label));
      fireEvent.click(optIn(anonymous.label));

      content.contact.fields.forEach((entry) => {
        expect(field(entry.label)).toHaveValue('');
        expect(field(entry.label)).toBeDisabled();
      });
      others.forEach((entry) => {
        expect(optIn(entry.label)).not.toBeChecked();
        expect(optIn(entry.label)).toBeDisabled();
      });
      expect(button(content.steps.submitLabel)).not.toBeDisabled();

      fireEvent.click(optIn(anonymous.label));
      expect(field('Full Name')).not.toBeDisabled();
      others.forEach((entry) => expect(optIn(entry.label)).not.toBeDisabled());
    });

    it('steps back into the last question of module 4', () => {
      fireEvent.click(button(content.steps.backLabel));

      const last = content.module4[content.module4.length - 1];
      expect(heading(content.steps.module4Title)).toBeInTheDocument();
      expect(heading(last.label)).toBeInTheDocument();
    });
  });

  describe('submitting', () => {
    it('stores the response under the placemaking_trends_survey source, and reports it', async () => {
      render(<PlacemakingTrendsSurveyPage t={THEME} />);
      walkToOptIn();

      fireEvent.click(optIn(content.optIns[0].label));
      fireEvent.change(field('Full Name'), { target: { value: 'A. Planner' } });
      fireEvent.change(field('Work Email Address'), { target: { value: 'planner@city.gov' } });
      fireEvent.change(field('Municipality / City & Country'), {
        target: { value: 'Rotterdam, Netherlands' },
      });
      fireEvent.change(field('Department'), { target: { value: 'Zoning' } });
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        email: 'planner@city.gov',
        source: 'placemaking_trends_survey',
        optIns: [content.optIns[0].key],
        contact: {
          name: 'A. Planner',
          email: 'planner@city.gov',
          municipality: 'Rotterdam, Netherlands',
          department: 'Zoning',
        },
        module1: { [firstQuestion.key]: firstQuestion.options[0].value },
      });

      expect(posthog.capture).toHaveBeenCalledWith('survey_submitted', {
        source: 'placemaking_trends_survey',
        questions_answered: TOTAL,
        total_questions: TOTAL,
        opt_ins: 1,
      });
    });

    it('stores a response with no details when nothing is filled in', async () => {
      render(<PlacemakingTrendsSurveyPage t={THEME} />);
      walkToOptIn();

      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored[0].email).toBeNull();
      expect(stored[0].contact).toBeNull();
      expect(stored[0].optIns).toEqual([]);
    });

    it('stores an anonymous response with no details', async () => {
      render(<PlacemakingTrendsSurveyPage t={THEME} />);
      walkToOptIn();

      const anonymous = content.optIns.find((entry) => entry.anonymous);
      fireEvent.click(optIn(anonymous.label));
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored[0].email).toBeNull();
      expect(stored[0].contact).toBeNull();
      expect(stored[0].optIns).toEqual([anonymous.key]);
    });

    it('keeps two surveys apart in the same local store', async () => {
      render(<PlacemakingTrendsSurveyPage t={THEME} />);
      walkToOptIn();
      fireEvent.click(button(content.steps.submitLabel));
      await screen.findByRole('heading', { name: content.success.title });

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored.every((response) => response.source === 'placemaking_trends_survey')).toBe(true);
    });
  });

  describe('pressing Enter', () => {
    it('starts the survey from the cover', () => {
      render(<PlacemakingTrendsSurveyPage t={THEME} />);
      fireEvent.keyDown(document.body, { key: 'Enter' });

      expect(heading(firstQuestion.label)).toBeInTheDocument();
    });

    it('submits when Enter is pressed on the closing step', async () => {
      render(<PlacemakingTrendsSurveyPage t={THEME} />);
      walkToOptIn();
      fireEvent.keyDown(document.body, { key: 'Enter' });

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();
    });
  });
});
