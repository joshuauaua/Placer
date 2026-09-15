import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { THEME } from '../../theme';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

const posthog = (await import('posthog-js')).default;
const { SurveyPage } = await import('../SurveyPage');
const { PractitionersSurveyPage } = await import('../PractitionersSurveyPage');
const { SurveyForm } = await import('../survey/SurveyForm');
const { MODULES, questionType, resolveSurveyContent } = await import('../survey/content');

const content = resolveSurveyContent();
const TOTAL = MODULES.reduce((sum, module) => sum + content[module].length, 0);

// One question per module, exercising the variants the shipped survey uses: a
// multiple choice with an other option, a scale, a required line of text and an
// optional paragraph.
const fixture = {
  cover: {
    title: 'Fixture survey',
    body: ['A short one.'],
    startLabel: 'Begin',
  },
  steps: {
    module1Title: 'Module A',
    module2Title: 'Module B',
    module3Title: 'Module C',
    module4Title: 'Module D',
    optInTitle: 'Stay in touch',
    optInDescription: 'Only if you want to.',
    otherLabel: 'Please specify',
    otherPlaceholder: 'Tell us which',
    optionalHint: 'Optional — you can continue without answering.',
    enterKeyLabel: 'Enter ↵',
    enterHintStart: 'to begin',
    enterHint: 'to continue',
    enterHintSubmit: 'to submit',
    newLineHint: 'Shift + Enter adds a new line',
    nextLabel: 'Next',
    backLabel: 'Back',
    submitLabel: 'Send',
    submittingLabel: 'Sending…',
  },
  module1: [
    {
      key: 'picks',
      label: 'Pick any of these',
      multiple: true,
      options: [
        { value: 'trees', label: 'Trees' },
        { value: 'benches', label: 'Benches' },
        { value: 'lights', label: 'Lights' },
        { value: 'other', label: 'Other', other: true },
      ],
    },
  ],
  module2: [
    {
      key: 'rating',
      label: 'Rate it',
      type: 'scale',
      scaleMin: 1,
      scaleMax: 5,
      minLabel: '1 = Poor',
      maxLabel: '5 = Great',
    },
  ],
  module3: [
    {
      key: 'roleName',
      label: 'Name your role',
      type: 'text',
      placeholder: 'e.g. Planner',
    },
  ],
  module4: [
    {
      key: 'thoughts',
      label: 'Anything else?',
      type: 'paragraph',
      optional: true,
      placeholder: 'Take your time.',
    },
  ],
  optIns: [
    { key: 'report', label: 'Send me the report' },
    { key: 'beta', label: 'Sign us up for the beta' },
  ],
  contact: {
    title: 'Contact information',
    fields: [
      { key: 'name', label: 'Name', placeholder: 'Your name' },
      { key: 'email', label: 'Work email address', placeholder: 'you@city.gov', type: 'email' },
    ],
  },
  success: { title: 'All done', body: 'Saved.', closeLabel: 'Home' },
  errorMessage: 'Could not save your answers.',
};

// The same fixture with a lead-capture final step instead of the consent box.
const contactFixture = {
  ...fixture,
  steps: {
    ...fixture.steps,
    emailTitle: 'Shape what we build',
    emailDescription: 'Where to reach you.',
  },
  contact: {
    question: {
      key: 'betaInterest',
      label: 'Want a hand in what comes next?',
      options: [
        { value: 'beta', label: 'Yes, beta access' },
        { value: 'updates', label: 'Just keep me updated' },
        { value: 'no', label: 'No, thanks' },
      ],
    },
    revealOn: ['beta', 'updates'],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'organization', label: 'Organization' },
      { key: 'email', label: 'Work Email', type: 'email', required: true },
      { key: 'location', label: 'City / Country' },
    ],
  },
};

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
    // The low end, so a walked-through survey has a predictable rating in it.
    fireEvent.change(slider(), { target: { value: String(question.scaleMin ?? 1) } });
    return;
  }

  fireEvent.click(options()[optionIndex]);
}

/** Walks from the cover to the closing step, answering every question. */
function walkToOptIn(surveyContent) {
  fireEvent.click(button(surveyContent.cover.startLabel));

  MODULES.forEach((module) => {
    surveyContent[module].forEach((question) => {
      answerCurrent(question);
      fireEvent.click(button(surveyContent.steps.nextLabel));
    });
  });
}

const firstQuestion = content[MODULES[0]][0];

describe('SurveyPage', () => {
  beforeEach(() => {
    localStorage.clear();
    posthog.capture.mockClear();
  });

  describe('the cover page', () => {
    it('opens on the cover rather than the first question', () => {
      render(<SurveyPage t={THEME} />);

      expect(heading(content.cover.title)).toBeInTheDocument();
      expect(screen.getByText(content.cover.body[0])).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('states how long the survey takes and how answers are handled', () => {
      render(<SurveyPage t={THEME} />);

      expect(screen.getByText(/about 7 minutes/)).toBeInTheDocument();
      expect(screen.getByText(/only in aggregate/)).toBeInTheDocument();
    });

    it('explains the words the survey uses', () => {
      render(<SurveyPage t={THEME} />);

      expect(heading(content.cover.glossaryTitle)).toBeInTheDocument();
      content.cover.glossary.forEach((entry) => {
        expect(screen.getByText(entry.term)).toBeInTheDocument();
      });
    });

    it('folds each definition away until its term is opened', () => {
      render(<SurveyPage t={THEME} />);
      const [first, second] = content.cover.glossary;

      expect(screen.getByText(first.definition)).not.toBeVisible();

      fireEvent.click(screen.getByText(first.term));

      expect(screen.getByText(first.definition)).toBeVisible();
      // Each term opens on its own, so reading one does not close another.
      expect(screen.getByText(second.definition)).not.toBeVisible();
    });

    it('carries a decorative image, named by nothing', () => {
      const { container } = render(<SurveyPage t={THEME} />);
      const art = container.querySelector('img');

      // Empty alt on purpose: the artwork repeats what the title already says, so
      // a screen reader should skip it rather than describe it.
      expect(art).toBeInTheDocument();
      expect(art).toHaveAttribute('alt', '');
    });

    it('shows the first question of module 1 once started', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));

      expect(heading(content.steps.module1Title)).toBeInTheDocument();
      expect(heading(firstQuestion.label)).toBeInTheDocument();
      expect(screen.getByText(`1 / ${TOTAL}`)).toBeInTheDocument();
    });

    it('goes back to the cover from the first question', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));
      fireEvent.click(button(content.steps.backLabel));

      expect(heading(content.cover.title)).toBeInTheDocument();
    });
  });

  describe('answering a single-choice question', () => {
    beforeEach(() => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));
    });

    it('keeps Next disabled until an option is chosen', () => {
      expect(button(content.steps.nextLabel)).toBeDisabled();
      fireEvent.click(options()[0]);
      expect(button(content.steps.nextLabel)).not.toBeDisabled();
    });

    it('marks the chosen option as pressed', () => {
      fireEvent.click(options()[1]);

      expect(options()[1]).toHaveAttribute('aria-pressed', 'true');
      expect(options()[0]).toHaveAttribute('aria-pressed', 'false');
    });

    it('replaces the answer when a second option is chosen', () => {
      fireEvent.click(options()[0]);
      fireEvent.click(options()[1]);

      expect(options()[0]).toHaveAttribute('aria-pressed', 'false');
      expect(options()[1]).toHaveAttribute('aria-pressed', 'true');
    });

    it('advances to the next question and updates the counter', () => {
      answerCurrent(firstQuestion);
      fireEvent.click(button(content.steps.nextLabel));

      expect(screen.getByText(`2 / ${TOTAL}`)).toBeInTheDocument();
      expect(heading(content.module1[1].label)).toBeInTheDocument();
    });

    it('preserves the answer when stepping back', () => {
      fireEvent.click(options()[1]);
      fireEvent.click(button(content.steps.nextLabel));
      fireEvent.click(button(content.steps.backLabel));

      expect(screen.getByText(`1 / ${TOTAL}`)).toBeInTheDocument();
      expect(options()[1]).toHaveAttribute('aria-pressed', 'true');
      expect(button(content.steps.nextLabel)).not.toBeDisabled();
    });
  });

  describe('moving between modules', () => {
    it('changes the heading when module 1 runs out of questions', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));
      content.module1.forEach((question) => {
        answerCurrent(question);
        fireEvent.click(button(content.steps.nextLabel));
      });

      expect(heading(content.steps.module2Title)).toBeInTheDocument();
      expect(heading(content.module2[0].label)).toBeInTheDocument();
      expect(screen.getByText(`${content.module1.length + 1} / ${TOTAL}`)).toBeInTheDocument();
    });

    it('steps back into the last question of the previous module', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));
      content.module1.forEach((question) => {
        answerCurrent(question);
        fireEvent.click(button(content.steps.nextLabel));
      });
      fireEvent.click(button(content.steps.backLabel));

      expect(heading(content.steps.module1Title)).toBeInTheDocument();
      expect(heading(content.module1[content.module1.length - 1].label)).toBeInTheDocument();
    });

    it('walks all four modules to the closing step', () => {
      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);

      expect(heading(content.steps.optInTitle)).toBeInTheDocument();
      expect(screen.getByText('Final step')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('the closing step', () => {
    beforeEach(() => {
      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);
    });

    it('offers Submit right away, with no details asked for', () => {
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
      content.optIns.forEach((entry) => expect(optIn(entry.label)).not.toBeChecked());
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    });

    it('asks for contact details once anything is opted into', () => {
      fireEvent.click(optIn(content.optIns[0].label));

      expect(heading(content.contact.title)).toBeInTheDocument();
      content.contact.fields.forEach((entry) => {
        expect(field(entry.label)).toBeInTheDocument();
      });
      expect(button(content.steps.submitLabel)).toBeDisabled();
    });

    it('holds Submit until every detail is there and the address is plausible', () => {
      fireEvent.click(optIn(content.optIns[1].label));

      fireEvent.change(field('Name'), { target: { value: 'A. Planner' } });
      fireEvent.change(field('City'), { target: { value: 'Rotterdam' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(field('Department'), { target: { value: 'Zoning' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(field('Work email address'), { target: { value: 'not-an-email' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(field('Work email address'), { target: { value: 'planner@city.gov' } });
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
    });

    it('frees Submit again when the last opt-in is cleared', () => {
      fireEvent.click(optIn(content.optIns[0].label));
      fireEvent.change(field('Name'), { target: { value: 'A. Planner' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.click(optIn(content.optIns[0].label));

      expect(button(content.steps.submitLabel)).not.toBeDisabled();
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    });

    it('steps back into the last question of module 4', () => {
      fireEvent.click(button(content.steps.backLabel));

      const last = content.module4[content.module4.length - 1];
      expect(heading(content.steps.module4Title)).toBeInTheDocument();
      expect(heading(last.label)).toBeInTheDocument();
    });
  });

  describe('pressing Enter', () => {
    const enter = (target = document.body, init = {}) =>
      fireEvent.keyDown(target, { key: 'Enter', ...init });

    it('starts the survey from the cover', () => {
      render(<SurveyPage t={THEME} />);
      enter();

      expect(heading(firstQuestion.label)).toBeInTheDocument();
    });

    it('is left to the glossary while a term has focus', () => {
      render(<SurveyPage t={THEME} />);
      enter(screen.getByText(content.cover.glossary[0].term));

      expect(heading(content.cover.title)).toBeInTheDocument();
    });

    it('says so on the cover, and on a question once it can be left', () => {
      render(<SurveyPage t={THEME} />);
      expect(screen.getByText(content.steps.enterHintStart)).toBeInTheDocument();

      fireEvent.click(button(content.cover.startLabel));
      expect(screen.queryByText(content.steps.enterHint)).not.toBeInTheDocument();

      fireEvent.click(options()[0]);
      expect(screen.getByText(content.steps.enterHint)).toBeInTheDocument();
    });

    it('waits for an answer before it moves on', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));

      enter();
      expect(heading(firstQuestion.label)).toBeInTheDocument();

      fireEvent.click(options()[0]);
      enter();
      expect(heading(content.module1[1].label)).toBeInTheDocument();
    });

    it('continues from the option just chosen rather than unchoosing it', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));

      const chosen = options()[0];
      fireEvent.click(chosen);
      enter(chosen);

      expect(heading(content.module1[1].label)).toBeInTheDocument();
    });

    it('is left to the Back button while it has focus', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));
      fireEvent.click(options()[0]);
      enter(button(content.steps.backLabel));

      expect(heading(firstQuestion.label)).toBeInTheDocument();
    });

    it('moves on from a typed line of text', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.cover.startLabel));
      fireEvent.click(options()[0]);
      fireEvent.click(button(content.steps.nextLabel));

      const typed = content.module1[1];
      fireEvent.change(field(typed.label), { target: { value: 'Area Planner' } });
      enter(field(typed.label));

      expect(heading(content.module1[2].label)).toBeInTheDocument();
    });

    it('submits from the closing step', async () => {
      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);
      enter();

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();
    });

    it('will not submit while opted-in details are missing', () => {
      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);
      fireEvent.click(optIn(content.optIns[0].label));
      enter();

      expect(heading(content.steps.optInTitle)).toBeInTheDocument();
      expect(screen.queryByText(content.steps.enterHintSubmit)).not.toBeInTheDocument();
    });
  });

  describe('submitting', () => {
    it('stores the response, reports it, and shows the thank you screen', async () => {
      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);

      fireEvent.click(optIn(content.optIns[0].label));
      fireEvent.change(field('Name'), { target: { value: 'A. Planner' } });
      fireEvent.change(field('City'), { target: { value: 'Rotterdam' } });
      fireEvent.change(field('Department'), { target: { value: 'Zoning' } });
      fireEvent.change(field('Work email address'), { target: { value: 'planner@city.gov' } });
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();
      expect(screen.getByText(content.success.body)).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        email: 'planner@city.gov',
        source: 'community_survey',
        optIns: ['report'],
        contact: {
          name: 'A. Planner',
          city: 'Rotterdam',
          department: 'Zoning',
          email: 'planner@city.gov',
        },
        module1: { [firstQuestion.key]: firstQuestion.options[0].value },
      });
      expect(stored[0].submittedAt).toBeTruthy();

      expect(posthog.capture).toHaveBeenCalledWith('survey_submitted', {
        source: 'community_survey',
        questions_answered: TOTAL,
        total_questions: TOTAL,
        opt_ins: 1,
      });
    });

    it('stores a response with no details when nothing is opted into', async () => {
      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);

      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored).toHaveLength(1);
      expect(stored[0].email).toBeNull();
      expect(stored[0].contact).toBeNull();
      expect(stored[0].optIns).toEqual([]);
      expect(stored[0].module4[content.module4[0].key]).toBe('1');
    });

    it('drops details typed before the opt-in was cleared', async () => {
      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);

      fireEvent.click(optIn(content.optIns[0].label));
      fireEvent.change(field('Work email address'), { target: { value: 'planner@city.gov' } });
      fireEvent.click(optIn(content.optIns[0].label));
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored[0].email).toBeNull();
      expect(stored[0].contact).toBeNull();
    });

    it('sends the respondent home from the thank you screen', async () => {
      delete window.location;
      window.location = { href: '' };

      render(<SurveyPage t={THEME} />);
      walkToOptIn(content);
      fireEvent.click(button(content.steps.submitLabel));

      fireEvent.click(await screen.findByRole('button', { name: content.success.closeLabel }));
      expect(window.location.href).toBe('/');
    });
  });
});

describe('SurveyForm', () => {
  const renderFixture = (submit) =>
    render(
      <SurveyForm
        t={THEME}
        content={fixture}
        submit={submit}
        source="fixture_survey"
        idPrefix="fixture"
      />,
    );

  const start = (submit = vi.fn()) => {
    renderFixture(submit);
    fireEvent.click(button(fixture.cover.startLabel));
    return submit;
  };

  /**
   * Answers the fixture's scale question, which is a slider rather than buttons.
   * Asking for the rating the thumb already rests on changes no value and so fires
   * no event — that rating arrives by pressing the slider instead, which is the
   * same path a respondent takes to it.
   */
  const rate = (value = '3') => {
    const input = slider();
    if (input.value === value) fireEvent.mouseDown(input);
    else fireEvent.change(input, { target: { value } });
  };

  it('lets a multiple-choice question hold several answers', () => {
    start();

    expect(screen.getByText('Select all that apply.')).toBeInTheDocument();
    expect(button(fixture.steps.nextLabel)).toBeDisabled();

    fireEvent.click(options()[0]);
    fireEvent.click(options()[2]);

    expect(options()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(options()[1]).toHaveAttribute('aria-pressed', 'false');
    expect(options()[2]).toHaveAttribute('aria-pressed', 'true');
    expect(button(fixture.steps.nextLabel)).not.toBeDisabled();
  });

  it('unselects a multiple-choice option on a second click', () => {
    start();
    fireEvent.click(options()[0]);
    fireEvent.click(options()[0]);

    expect(options()[0]).toHaveAttribute('aria-pressed', 'false');
    expect(button(fixture.steps.nextLabel)).toBeDisabled();
  });

  describe('an other option', () => {
    it('asks what the other thing is, and waits for it', () => {
      start();

      expect(screen.queryByRole('textbox', { name: fixture.steps.otherLabel })).not.toBeInTheDocument();

      fireEvent.click(options()[3]);
      expect(button(fixture.steps.nextLabel)).toBeDisabled();

      fireEvent.change(screen.getByLabelText(fixture.steps.otherLabel), {
        target: { value: 'Cycle parking' },
      });
      expect(button(fixture.steps.nextLabel)).not.toBeDisabled();
    });

    it('does not send free text left behind by a changed mind', async () => {
      const submit = start(vi.fn().mockResolvedValue({ id: 'saved' }));

      fireEvent.click(options()[3]);
      fireEvent.change(screen.getByLabelText(fixture.steps.otherLabel), {
        target: { value: 'Cycle parking' },
      });
      fireEvent.click(options()[3]);
      fireEvent.click(options()[0]);
      fireEvent.click(button(fixture.steps.nextLabel));

      rate();
      fireEvent.click(button(fixture.steps.nextLabel));
      fireEvent.change(field(fixture.module3[0].label), { target: { value: 'Area Planner' } });
      fireEvent.click(button(fixture.steps.nextLabel));
      fireEvent.click(button(fixture.steps.nextLabel));
      fireEvent.click(button(fixture.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ module1: { picks: ['trees'] }, otherText: {} }),
      );
    });

    it('takes the field away again when other is unselected', () => {
      start();
      fireEvent.click(options()[0]);
      fireEvent.click(options()[3]);
      fireEvent.change(screen.getByLabelText(fixture.steps.otherLabel), {
        target: { value: 'Cycle parking' },
      });
      fireEvent.click(options()[3]);

      expect(screen.queryByLabelText(fixture.steps.otherLabel)).not.toBeInTheDocument();
      expect(button(fixture.steps.nextLabel)).not.toBeDisabled();
    });
  });

  describe('a scale question', () => {
    const toScale = () => {
      start();
      fireEvent.click(options()[0]);
      fireEvent.click(button(fixture.steps.nextLabel));
    };

    it('offers a slider over the range, labelled at both ends', () => {
      toScale();

      expect(slider()).toHaveAttribute('min', '1');
      expect(slider()).toHaveAttribute('max', '5');
      expect(slider()).toHaveAccessibleName(fixture.module2[0].label);
      expect(screen.getByText(fixture.module2[0].minLabel)).toBeInTheDocument();
      expect(screen.getByText(fixture.module2[0].maxLabel)).toBeInTheDocument();
    });

    it('holds no rating until the slider is used', () => {
      toScale();

      expect(screen.getByText('—')).toBeInTheDocument();
      expect(slider()).toHaveAttribute('aria-valuetext', 'No rating chosen yet');
      expect(button(fixture.steps.nextLabel)).toBeDisabled();
    });

    it('takes the rating the slider is moved to', () => {
      toScale();
      fireEvent.change(slider(), { target: { value: '4' } });

      expect(slider()).toHaveValue('4');
      expect(slider()).toHaveAttribute('aria-valuetext', '4 out of 5');
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(button(fixture.steps.nextLabel)).not.toBeDisabled();
    });

    it('counts a press that never moves the thumb as the middle rating', () => {
      toScale();
      fireEvent.mouseDown(slider());

      // The midpoint of 1-5, which is the one rating a drag could not produce
      // from a resting thumb.
      expect(slider()).toHaveValue('3');
      expect(button(fixture.steps.nextLabel)).not.toBeDisabled();
    });

    it('replaces the rating rather than collecting several', () => {
      toScale();
      fireEvent.change(slider(), { target: { value: '2' } });
      fireEvent.change(slider(), { target: { value: '5' } });

      expect(slider()).toHaveValue('5');
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });
  });

  describe('a written question', () => {
    const toText = () => {
      start();
      fireEvent.click(options()[0]);
      fireEvent.click(button(fixture.steps.nextLabel));
      rate();
      fireEvent.click(button(fixture.steps.nextLabel));
    };

    it('holds Next until something is typed', () => {
      toText();

      expect(button(fixture.steps.nextLabel)).toBeDisabled();
      fireEvent.change(field(fixture.module3[0].label), { target: { value: 'Area Planner' } });
      expect(button(fixture.steps.nextLabel)).not.toBeDisabled();
    });

    it('does not accept blank space as an answer', () => {
      toText();
      fireEvent.change(field(fixture.module3[0].label), { target: { value: '   ' } });

      expect(button(fixture.steps.nextLabel)).toBeDisabled();
    });

    it('lets an optional paragraph be skipped, and keeps it when typed', () => {
      toText();
      fireEvent.change(field(fixture.module3[0].label), { target: { value: 'Area Planner' } });
      fireEvent.click(button(fixture.steps.nextLabel));

      expect(screen.getByText(fixture.steps.optionalHint)).toBeInTheDocument();
      expect(button(fixture.steps.nextLabel)).not.toBeDisabled();

      const paragraph = field(fixture.module4[0].label);
      fireEvent.change(paragraph, { target: { value: 'Funding, mostly.' } });
      expect(paragraph).toHaveValue('Funding, mostly.');
    });
  });

  describe('Enter in a paragraph', () => {
    const toParagraph = () => {
      start();
      fireEvent.click(options()[0]);
      fireEvent.click(button(fixture.steps.nextLabel));
      rate();
      fireEvent.click(button(fixture.steps.nextLabel));
      fireEvent.change(field(fixture.module3[0].label), { target: { value: 'Area Planner' } });
      fireEvent.click(button(fixture.steps.nextLabel));
    };

    it('says how to get a new line', () => {
      toParagraph();

      expect(screen.getByText(fixture.steps.newLineHint)).toBeInTheDocument();
    });

    it('stays put on Shift + Enter and moves on without it', () => {
      toParagraph();
      const box = field(fixture.module4[0].label);

      fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
      expect(heading(fixture.module4[0].label)).toBeInTheDocument();

      fireEvent.keyDown(box, { key: 'Enter' });
      expect(heading(fixture.steps.optInTitle)).toBeInTheDocument();
    });
  });

  it('hands the grouped answers, the free text and the contact details to submit', async () => {
    const submit = start(vi.fn().mockResolvedValue({ id: 'saved' }));

    fireEvent.click(options()[0]);
    fireEvent.click(options()[3]);
    fireEvent.change(screen.getByLabelText(fixture.steps.otherLabel), {
      target: { value: 'Cycle parking' },
    });
    fireEvent.click(button(fixture.steps.nextLabel));

    rate('3');
    fireEvent.click(button(fixture.steps.nextLabel));

    fireEvent.change(field(fixture.module3[0].label), { target: { value: '  Area Planner  ' } });
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.click(button(fixture.steps.nextLabel));

    fireEvent.click(optIn(fixture.optIns[0].label));
    fireEvent.change(field('Name'), { target: { value: 'A. Planner' } });
    fireEvent.change(field('Work email address'), {
      target: { value: '  planner@city.gov  ' },
    });
    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith({
      module1: { picks: ['trees', 'other'] },
      module2: { rating: '3' },
      module3: { roleName: '  Area Planner  ' },
      module4: {},
      otherText: { module1: { picks: 'Cycle parking' } },
      optIns: ['report'],
      contact: { name: 'A. Planner', email: 'planner@city.gov' },
      email: 'planner@city.gov',
      source: 'fixture_survey',
    });
  });

  it('sends no free text when no other option was chosen', async () => {
    const submit = start(vi.fn().mockResolvedValue({ id: 'saved' }));

    fireEvent.click(options()[0]);
    fireEvent.click(button(fixture.steps.nextLabel));
    rate();
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.change(field(fixture.module3[0].label), { target: { value: 'Area Planner' } });
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ otherText: {}, contact: null, email: null, optIns: [] }),
    );
  });

  it('submits when Enter is pressed in a contact field', async () => {
    const submit = start(vi.fn().mockResolvedValue({ id: 'saved' }));

    fireEvent.click(options()[0]);
    fireEvent.click(button(fixture.steps.nextLabel));
    rate();
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.change(field(fixture.module3[0].label), { target: { value: 'Area Planner' } });
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.click(button(fixture.steps.nextLabel));

    fireEvent.click(optIn(fixture.optIns[0].label));
    fireEvent.change(field('Name'), { target: { value: 'A. Planner' } });
    const address = field('Work email address');
    fireEvent.change(address, { target: { value: 'planner@city.gov' } });
    fireEvent.keyDown(address, { key: 'Enter' });

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
    expect(submit).toHaveBeenCalled();
  });

  it('keeps the respondent on the closing step and explains a failed save', async () => {
    start(vi.fn().mockRejectedValue(new Error('quota exceeded')));

    fireEvent.click(options()[0]);
    fireEvent.click(button(fixture.steps.nextLabel));
    rate();
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.change(field(fixture.module3[0].label), { target: { value: 'Area Planner' } });
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.click(button(fixture.steps.nextLabel));
    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('alert')).toHaveTextContent(fixture.errorMessage);
    expect(screen.queryByRole('heading', { name: fixture.success.title })).not.toBeInTheDocument();
    expect(button(fixture.steps.submitLabel)).not.toBeDisabled();
    expect(optIn(fixture.optIns[0].label)).toBeInTheDocument();
  });
});

describe('SurveyForm with lead capture', () => {
  const labels = contactFixture.steps;

  const renderFixture = (submit) =>
    render(
      <SurveyForm
        t={THEME}
        content={contactFixture}
        submit={submit}
        source="practitioner_fixture"
        idPrefix="practitioner-fixture"
      />,
    );

  /** Answers the three questions and lands on the lead-capture step. */
  const walkToContact = () => {
    const submit = vi.fn().mockResolvedValue({ id: 'saved' });
    renderFixture(submit);
    walkToEmail(contactFixture, 3);
    return submit;
  };

  it('asks the opt-in as a question instead of a consent box', () => {
    walkToContact();

    expect(heading(labels.emailTitle)).toBeInTheDocument();
    expect(heading(contactFixture.contact.question.label)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Final step')).toBeInTheDocument();
  });

  it('holds Submit until the opt-in is answered', () => {
    walkToContact();
    expect(button(labels.submitLabel)).toBeDisabled();

    fireEvent.click(options()[2]);
    expect(button(labels.submitLabel)).not.toBeDisabled();
  });

  it('asks for nothing more when the opt-in is declined', async () => {
    const submit = walkToContact();
    fireEvent.click(options()[2]);

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    fireEvent.click(button(labels.submitLabel));

    expect(
      await screen.findByRole('heading', { name: contactFixture.success.title }),
    ).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ email: null, contact: { choice: 'no' } }),
    );
  });

  it('reveals the fields and holds Submit until the required ones are valid', () => {
    walkToContact();
    fireEvent.click(options()[0]);

    expect(screen.getByLabelText('Organization')).toBeInTheDocument();
    expect(screen.getByLabelText('City / Country')).toBeInTheDocument();
    expect(button(labels.submitLabel)).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    expect(button(labels.submitLabel)).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'not-an-email' } });
    expect(button(labels.submitLabel)).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'ada@studio.com' } });
    expect(button(labels.submitLabel)).not.toBeDisabled();
  });

  it('submits the trimmed fields, leaving empty optional ones out', async () => {
    const submit = walkToContact();
    fireEvent.click(options()[1]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ada Lovelace  ' } });
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: ' Analytical Engines ' },
    });
    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: '  ada@studio.com ' },
    });
    fireEvent.click(button(labels.submitLabel));

    expect(
      await screen.findByRole('heading', { name: contactFixture.success.title }),
    ).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith({
      section1: { picks: ['trees'] },
      section2: { rating: '1' },
      section3: { last: 'yes' },
      // Kept at the top level too, so anything reading a response's email finds one.
      email: 'ada@studio.com',
      contact: {
        choice: 'updates',
        name: 'Ada Lovelace',
        organization: 'Analytical Engines',
        email: 'ada@studio.com',
      },
      source: 'practitioner_fixture',
    });
  });

  it('drops the details when the opt-in switches to declining', async () => {
    const submit = walkToContact();
    fireEvent.click(options()[0]);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'ada@studio.com' } });

    fireEvent.click(options()[2]);
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();

    fireEvent.click(button(labels.submitLabel));

    expect(
      await screen.findByRole('heading', { name: contactFixture.success.title }),
    ).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ email: null, contact: { choice: 'no' } }),
    );
  });

  it('submits when Enter is pressed in a contact field', async () => {
    walkToContact();
    fireEvent.click(options()[0]);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });

    const field = screen.getByLabelText('Work Email');
    fireEvent.change(field, { target: { value: 'ada@studio.com' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(
      await screen.findByRole('heading', { name: contactFixture.success.title }),
    ).toBeInTheDocument();
  });

  it('ignores Enter while a required field is still empty', () => {
    const submit = walkToContact();
    fireEvent.click(options()[0]);

    const field = screen.getByLabelText('Work Email');
    fireEvent.change(field, { target: { value: 'ada@studio.com' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(submit).not.toHaveBeenCalled();
  });

  it('steps back into the last question of section 3', () => {
    walkToContact();
    fireEvent.click(button(labels.backLabel));

    expect(heading(contactFixture.section3[0].label)).toBeInTheDocument();
  });
});

describe('PractitionersSurveyPage', () => {
  const labels = practitioners.steps;
  const PRACTITIONER_TOTAL =
    practitioners.section1.length + practitioners.section2.length + practitioners.section3.length;

  beforeEach(() => {
    localStorage.clear();
    posthog.capture.mockClear();
  });

  it('asks the practitioner questions and stores a tagged lead', async () => {
    render(<PractitionersSurveyPage t={THEME} />);

    expect(heading(practitioners.hero.title)).toBeInTheDocument();
    walkToEmail(practitioners, PRACTITIONER_TOTAL);

    expect(heading(labels.emailTitle)).toBeInTheDocument();
    fireEvent.click(options()[0]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'ada@studio.com' } });
    fireEvent.click(button(labels.submitLabel));

    expect(
      await screen.findByRole('heading', { name: practitioners.success.title }),
    ).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      source: 'practitioners_survey',
      email: 'ada@studio.com',
      contact: { choice: 'beta', name: 'Ada Lovelace', email: 'ada@studio.com' },
      section1: { orgRole: 'ngo' },
      // The one multi-select in the survey stores an array.
      section2: { currentTools: ['gis'] },
      section3: { toolBudget: 'none' },
    });

    expect(posthog.capture).toHaveBeenCalledWith('survey_submitted', {
      source: 'practitioners_survey',
      questions_answered: PRACTITIONER_TOTAL,
      total_questions: PRACTITIONER_TOTAL,
      contact_opt_in: 'beta',
    });
  });
});
