import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { THEME } from '../../theme';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

const posthog = (await import('posthog-js')).default;
const { SurveyPage } = await import('../SurveyPage');
const { SurveyForm } = await import('../survey/SurveyForm');
const { resolveSurveyContent } = await import('../survey/content');

const content = resolveSurveyContent();
const TOTAL = content.section1.length + content.section2.length + content.section3.length;

// One question per section, exercising the multiple and scale variants that the
// shipped survey does not currently use.
const fixture = {
  hero: { title: 'Fixture survey', subtitle: 'A short one.', startLabel: 'Begin' },
  steps: {
    section1Title: 'Section A',
    section2Title: 'Section B',
    section3Title: 'Section C',
    emailTitle: 'Your email',
    emailDescription: 'So we can write back.',
    emailRequiredDescription: 'We need an address for this.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    otherLabel: 'Which one?',
    otherPlaceholder: 'Name it',
    nextLabel: 'Next',
    backLabel: 'Back',
    submitLabel: 'Send',
    submittingLabel: 'Sending…',
  },
  section1: [
    {
      key: 'picks',
      label: 'Pick any of these',
      multiple: true,
      options: [
        { value: 'trees', label: 'Trees' },
        { value: 'benches', label: 'Benches' },
        { value: 'lights', label: 'Lights' },
        { value: 'other', label: 'Something else', other: true },
      ],
    },
  ],
  section2: [
    {
      key: 'rating',
      label: 'Rate it',
      scale: true,
      options: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
      ],
    },
  ],
  section3: [
    {
      key: 'last',
      label: 'One last thing',
      options: [
        // The answer that leaves the email step optional.
        { value: 'yes', label: 'Yes', noCommitment: true },
        { value: 'no', label: 'No' },
      ],
    },
  ],
  success: { title: 'All done', body: 'Saved.', closeLabel: 'Home' },
  errorMessage: 'Could not save your answers.',
};

const options = () => within(screen.getByRole('group')).getAllByRole('button');
const emailField = (labels) => screen.getByLabelText(new RegExp(`^${labels.emailLabel}`));
const button = (name) => screen.getByRole('button', { name });
const heading = (name) => screen.getByRole('heading', { name });

/** Answers the question on screen and moves on. */
function answerAndAdvance(labels, optionIndex = 0) {
  fireEvent.click(options()[optionIndex]);
  fireEvent.click(button(labels.nextLabel));
}

/**
 * Walks from the intro to the email step, taking the first option each time.
 * `lastOptionIndex` answers the closing question differently, which is what
 * decides whether an address is required: its first option is the one flagged
 * `noCommitment`, so the default walk leaves the email step optional.
 */
function walkToEmail(surveyContent, questionCount, lastOptionIndex = 0) {
  fireEvent.click(button(surveyContent.hero.startLabel));
  for (let i = 0; i < questionCount; i++) {
    answerAndAdvance(surveyContent.steps, i === questionCount - 1 ? lastOptionIndex : 0);
  }
}

describe('SurveyPage', () => {
  beforeEach(() => {
    localStorage.clear();
    posthog.capture.mockClear();
  });

  describe('intro', () => {
    it('opens on the hero rather than the first question', () => {
      render(<SurveyPage t={THEME} />);

      expect(heading(content.hero.title)).toBeInTheDocument();
      expect(screen.getByText(content.hero.subtitle)).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('opens with a street drawing as its only picture', () => {
      const { container } = render(<SurveyPage t={THEME} />);

      const images = container.querySelectorAll('img');
      expect(images).toHaveLength(1);
      expect(images[0].getAttribute('src')).toMatch(/street-/);
      // Decoration: the hero title beside it already says what this screen is.
      expect(images[0]).toHaveAttribute('alt', '');
      expect(images[0]).toHaveAttribute('aria-hidden', 'true');
    });

    it('shows the first question of section 1 once started', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));

      expect(heading(content.steps.section1Title)).toBeInTheDocument();
      expect(heading(content.section1[0].label)).toBeInTheDocument();
      expect(screen.getByText(`1 / ${TOTAL}`)).toBeInTheDocument();
    });

    it('puts no blurb above the question, only its own heading', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));

      // The closing step explains itself; a question does not need to.
      expect(screen.queryByText(content.steps.emailDescription)).not.toBeInTheDocument();
      const paragraphs = document.querySelectorAll('p');
      expect(paragraphs).toHaveLength(0);
    });

    it('goes back to the hero from the first question', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      fireEvent.click(button(content.steps.backLabel));

      expect(heading(content.hero.title)).toBeInTheDocument();
    });
  });

  describe('answering a single-choice question', () => {
    beforeEach(() => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
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
      answerAndAdvance(content.steps);

      expect(screen.getByText(`2 / ${TOTAL}`)).toBeInTheDocument();
      // section 1 holds a single question, so the second is the first of section 2.
      expect(heading(content.section2[0].label)).toBeInTheDocument();
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

  describe('moving between sections', () => {
    it('changes the heading when section 1 runs out of questions', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      for (let i = 0; i < content.section1.length; i++) answerAndAdvance(content.steps);

      expect(heading(content.steps.section2Title)).toBeInTheDocument();
      expect(heading(content.section2[0].label)).toBeInTheDocument();
      expect(
        screen.getByText(`${content.section1.length + 1} / ${TOTAL}`),
      ).toBeInTheDocument();
    });

    it('steps back into the last question of the previous section', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      for (let i = 0; i < content.section1.length; i++) answerAndAdvance(content.steps);
      fireEvent.click(button(content.steps.backLabel));

      expect(heading(content.steps.section1Title)).toBeInTheDocument();
      const last = content.section1[content.section1.length - 1];
      expect(heading(last.label)).toBeInTheDocument();
    });
  });

  describe('the email step', () => {
    beforeEach(() => {
      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL);
    });

    it('replaces the counter with the final step and a full progress bar', () => {
      expect(screen.getByText('Final step')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
      expect(heading(content.steps.emailTitle)).toBeInTheDocument();
    });

    it('asks for an address, and nothing else', () => {
      expect(emailField(content.steps)).toHaveValue('');
      // The updates opt-in is gone: question 5 already covers involvement.
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('offers Submit right away when nothing further was asked for', () => {
      // The walk answered the closing question with its no-commitment option, so
      // there is nothing to follow up and no address needed.
      expect(screen.getByText(content.steps.emailDescription)).toBeInTheDocument();
      expect(emailField(content.steps)).not.toBeRequired();
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
    });

    it('still rejects a half-typed address when one is optional', () => {
      fireEvent.change(emailField(content.steps), { target: { value: 'not-an-email' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      // Clearing it is enough: an empty optional field is not an error.
      fireEvent.change(emailField(content.steps), { target: { value: '' } });
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
    });

    it('numbers the ranked question in the order answers are picked', () => {
      cleanup();
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      // Question 4 is the ranked one, so stop one short of the last.
      for (let i = 0; i < TOTAL - 2; i++) answerAndAdvance(content.steps);

      expect(screen.getByText('Choose in order of priority, most important first.'))
        .toBeInTheDocument();

      fireEvent.click(options()[2]);
      fireEvent.click(options()[0]);

      // Picked second and first: the badge is the position, not a tick.
      expect(options()[2]).toHaveTextContent('1');
      expect(options()[0]).toHaveTextContent('2');
      // And the position is said out loud, since the badge is decorative.
      expect(options()[2]).toHaveAccessibleName(
        `${content.section3[0].options[2].label}, priority 1`,
      );
    });

    it('closes the ranking up again when an answer is dropped', () => {
      cleanup();
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      for (let i = 0; i < TOTAL - 2; i++) answerAndAdvance(content.steps);

      fireEvent.click(options()[0]);
      fireEvent.click(options()[1]);
      fireEvent.click(options()[3]);
      expect(options()[3]).toHaveTextContent('3');

      // Dropping the first promotes the two behind it.
      fireEvent.click(options()[0]);

      expect(options()[1]).toHaveTextContent('1');
      expect(options()[3]).toHaveTextContent('2');
      expect(options()[0]).toHaveAttribute('aria-pressed', 'false');
    });

    it('holds the ranking at its ceiling until an answer is let go', () => {
      cleanup();
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      for (let i = 0; i < TOTAL - 2; i++) answerAndAdvance(content.steps);

      const max = content.section3[0].maxChoices;
      for (let i = 0; i < max; i++) fireEvent.click(options()[i]);

      // Full: everything unpicked goes inert, and the count says why rather than
      // leaving a tap that appears to do nothing.
      expect(options()[max]).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent(`${max} chosen`);

      // Clicking one changes nothing, and the ranking behind it is undisturbed.
      fireEvent.click(options()[max]);
      expect(options()[max]).toHaveAttribute('aria-pressed', 'false');
      expect(options()[max - 1]).toHaveTextContent(String(max));

      // The ceiling is not a requirement: one pick is still enough to move on.
      expect(button(content.steps.nextLabel)).not.toBeDisabled();

      // Letting one go opens the rest back up.
      fireEvent.click(options()[0]);
      expect(options()[max]).not.toBeDisabled();
    });

    it('stores the ranking as an ordered list', async () => {
      cleanup();
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      for (let i = 0; i < TOTAL - 2; i++) answerAndAdvance(content.steps);

      fireEvent.click(options()[3]);
      fireEvent.click(options()[1]);
      fireEvent.click(button(content.steps.nextLabel));
      answerAndAdvance(content.steps);
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored[0].section3[content.section3[0].key]).toEqual([
        content.section3[0].options[3].value,
        content.section3[0].options[1].value,
      ]);
    });

    it('takes several answers to the closing question', () => {
      cleanup();
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      for (let i = 0; i < TOTAL - 1; i++) answerAndAdvance(content.steps);

      // Question 5 is select-all-that-apply, so it says so and keeps both.
      expect(screen.getByText('Select all that apply.')).toBeInTheDocument();
      fireEvent.click(options()[0]);
      fireEvent.click(options()[2]);
      expect(options()[0]).toHaveAttribute('aria-pressed', 'true');
      expect(options()[2]).toHaveAttribute('aria-pressed', 'true');
    });

    it('requires an address when a commitment sits alongside the no-commitment answer', () => {
      cleanup();
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));
      for (let i = 0; i < TOTAL - 1; i++) answerAndAdvance(content.steps);

      // Both ticked: asking for an interview is still asking, so the address is
      // needed whether or not "no further commitment" is ticked too.
      fireEvent.click(options()[0]);
      fireEvent.click(options()[2]);
      fireEvent.click(button(content.steps.nextLabel));

      expect(screen.getByText(content.steps.emailRequiredDescription)).toBeInTheDocument();
      expect(button(content.steps.submitLabel)).toBeDisabled();
    });

    it('requires an address once the visitor asks to be involved further', () => {
      // Rewalked, this time answering the closing question with a commitment.
      cleanup();
      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL, 1);

      expect(screen.getByText(content.steps.emailRequiredDescription)).toBeInTheDocument();
      expect(emailField(content.steps)).toBeRequired();
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(emailField(content.steps), { target: { value: 'planner@example.com' } });
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
    });

    it('steps back into the last question of section 3', () => {
      fireEvent.click(button(content.steps.backLabel));

      const last = content.section3[content.section3.length - 1];
      expect(heading(content.steps.section3Title)).toBeInTheDocument();
      expect(heading(last.label)).toBeInTheDocument();
    });
  });

  describe('submitting', () => {
    it('stores the response, reports it, and shows the thank you screen', async () => {
      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL);

      fireEvent.change(emailField(content.steps), {
        target: { value: 'resident@example.com' },
      });
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();
      expect(screen.getByText(content.success.body)).toBeInTheDocument();

      // The thank-you screen closes on a drawing, the same way the intro opened.
      const images = document.querySelectorAll('img');
      expect(images).toHaveLength(1);
      expect(images[0].getAttribute('src')).toMatch(/street-/);

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        email: 'resident@example.com',
        source: 'community_survey',
        section1: { [content.section1[0].key]: content.section1[0].options[0].value },
      });
      expect(stored[0].submittedAt).toBeTruthy();

      expect(posthog.capture).toHaveBeenCalledWith('survey_submitted', {
        source: 'community_survey',
        questions_answered: TOTAL,
        total_questions: TOTAL,
      });
    });

    it('stores a response with no address when the field is left empty', async () => {
      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL);

      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored).toHaveLength(1);
      expect(stored[0].email).toBeNull();
      expect(stored[0].section3[content.section3[0].key]).toEqual([
        content.section3[0].options[0].value,
      ]);
    });

    it('drops an address that was typed and then cleared', async () => {
      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL);

      fireEvent.change(emailField(content.steps), {
        target: { value: 'resident@example.com' },
      });
      fireEvent.change(emailField(content.steps), { target: { value: '' } });
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored[0].email).toBeNull();
    });

    it('sends the visitor home from the thank you screen', async () => {
      delete window.location;
      window.location = { href: '' };

      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL);
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

  it('lets a multiple-choice question hold several answers', () => {
    renderFixture(vi.fn());
    fireEvent.click(button(fixture.hero.startLabel));

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
    renderFixture(vi.fn());
    fireEvent.click(button(fixture.hero.startLabel));
    fireEvent.click(options()[0]);
    fireEvent.click(options()[0]);

    expect(options()[0]).toHaveAttribute('aria-pressed', 'false');
    expect(button(fixture.steps.nextLabel)).toBeDisabled();
  });

  it('lays a scale question out in a row and other questions in a column', () => {
    renderFixture(vi.fn());
    fireEvent.click(button(fixture.hero.startLabel));
    expect(screen.getByRole('group')).toHaveStyle({ flexDirection: 'column' });

    answerAndAdvance(fixture.steps);
    expect(heading(fixture.section2[0].label)).toBeInTheDocument();
    expect(screen.getByRole('group')).toHaveStyle({ flexDirection: 'row' });
  });

  it('hands the grouped answers and the trimmed email to submit', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'saved' });
    renderFixture(submit);

    fireEvent.click(button(fixture.hero.startLabel));
    fireEvent.click(options()[0]);
    fireEvent.click(options()[1]);
    fireEvent.click(button(fixture.steps.nextLabel));
    answerAndAdvance(fixture.steps, 2);
    answerAndAdvance(fixture.steps, 0);

    fireEvent.change(emailField(fixture.steps), {
      target: { value: '  resident@example.com  ' },
    });
    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith({
      section1: { picks: ['trees', 'benches'] },
      section2: { rating: '3' },
      section3: { last: 'yes' },
      email: 'resident@example.com',
      // Nothing was typed against a free-text option.
      otherText: {},
      source: 'fixture_survey',
    });
  });

  it('holds Next until a picked free-text option is filled in', () => {
    renderFixture(vi.fn());
    fireEvent.click(button(fixture.hero.startLabel));

    // The last option of the fixture's first question is the free-text one.
    const other = options()[options().length - 1];
    fireEvent.click(other);

    const field = screen.getByLabelText(fixture.steps.otherLabel);
    expect(button(fixture.steps.nextLabel)).toBeDisabled();

    // Whitespace is not an answer.
    fireEvent.change(field, { target: { value: '   ' } });
    expect(button(fixture.steps.nextLabel)).toBeDisabled();

    fireEvent.change(field, { target: { value: 'A shade structure' } });
    expect(button(fixture.steps.nextLabel)).not.toBeDisabled();
  });

  it('hides the free-text field again when its option is deselected', () => {
    renderFixture(vi.fn());
    fireEvent.click(button(fixture.hero.startLabel));

    const other = () => options()[options().length - 1];
    fireEvent.click(other());
    expect(screen.getByLabelText(fixture.steps.otherLabel)).toBeInTheDocument();

    fireEvent.click(other());
    expect(screen.queryByLabelText(fixture.steps.otherLabel)).not.toBeInTheDocument();
  });

  it('sends the free text for a picked option, and drops it once deselected', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'saved' });
    renderFixture(submit);

    fireEvent.click(button(fixture.hero.startLabel));
    const other = () => options()[options().length - 1];
    fireEvent.click(other());
    fireEvent.change(screen.getByLabelText(fixture.steps.otherLabel), {
      target: { value: '  A shade structure  ' },
    });
    fireEvent.click(button(fixture.steps.nextLabel));
    answerAndAdvance(fixture.steps);
    answerAndAdvance(fixture.steps);
    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ otherText: { picks: 'A shade structure' } }),
    );
  });

  it('submits a null email when nothing further is asked for', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'saved' });
    renderFixture(submit);

    fireEvent.click(button(fixture.hero.startLabel));
    answerAndAdvance(fixture.steps);
    answerAndAdvance(fixture.steps);
    // The closing question's first option is the no-commitment one.
    answerAndAdvance(fixture.steps);
    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ email: null, source: 'fixture_survey' }),
    );
  });

  it('submits when Enter is pressed in the email field', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'saved' });
    renderFixture(submit);

    fireEvent.click(button(fixture.hero.startLabel));
    answerAndAdvance(fixture.steps);
    answerAndAdvance(fixture.steps);
    answerAndAdvance(fixture.steps);

    const field = emailField(fixture.steps);
    fireEvent.change(field, { target: { value: 'resident@example.com' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
  });

  it('keeps the visitor on the email step and explains a failed save', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('quota exceeded'));
    renderFixture(submit);

    fireEvent.click(button(fixture.hero.startLabel));
    answerAndAdvance(fixture.steps);
    answerAndAdvance(fixture.steps);
    answerAndAdvance(fixture.steps);

    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('alert')).toHaveTextContent(fixture.errorMessage);
    expect(screen.queryByRole('heading', { name: fixture.success.title })).not.toBeInTheDocument();
    expect(button(fixture.steps.submitLabel)).not.toBeDisabled();
    expect(emailField(fixture.steps)).toBeInTheDocument();
  });
});
