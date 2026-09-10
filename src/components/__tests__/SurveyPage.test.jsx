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
const { resolveSurveyContent } = await import('../survey/content');

const content = resolveSurveyContent();
const practitioners = (await import('../survey/content/practitioners.json')).default;
const TOTAL = content.section1.length + content.section2.length + content.section3.length;

// One question per section, exercising the multiple and scale variants that the
// shipped survey does not currently use.
const fixture = {
  hero: { title: 'Fixture survey', subtitle: 'A short one.', startLabel: 'Begin' },
  steps: {
    section1Title: 'Section A',
    section1Description: 'The first one.',
    section2Title: 'Section B',
    section2Description: 'The second one.',
    section3Title: 'Section C',
    section3Description: 'The third one.',
    emailTitle: 'Your email',
    emailDescription: 'So we can write back.',
    consentLabel: 'Send me the report',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
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
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ],
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
const optIn = (labels) => screen.getByRole('checkbox', { name: labels.consentLabel });
const button = (name) => screen.getByRole('button', { name });
const heading = (name) => screen.getByRole('heading', { name });

/** Answers the question on screen and moves on. */
function answerAndAdvance(labels, optionIndex = 0) {
  fireEvent.click(options()[optionIndex]);
  fireEvent.click(button(labels.nextLabel));
}

/** Walks from the intro to the email step, taking the first option each time. */
function walkToEmail(surveyContent, questionCount) {
  fireEvent.click(button(surveyContent.hero.startLabel));
  for (let i = 0; i < questionCount; i++) answerAndAdvance(surveyContent.steps);
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

    it('shows the first question of section 1 once started', () => {
      render(<SurveyPage t={THEME} />);
      fireEvent.click(button(content.hero.startLabel));

      expect(heading(content.steps.section1Title)).toBeInTheDocument();
      expect(screen.getByText(content.steps.section1Description)).toBeInTheDocument();
      expect(heading(content.section1[0].label)).toBeInTheDocument();
      expect(screen.getByText(`1 / ${TOTAL}`)).toBeInTheDocument();
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
      expect(heading(content.section1[1].label)).toBeInTheDocument();
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

    it('offers Submit right away, with no email asked for', () => {
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
      expect(optIn(content.steps)).not.toBeChecked();
      expect(screen.queryByLabelText(content.steps.emailLabel)).not.toBeInTheDocument();
    });

    it('asks for an address only once the report is opted into', () => {
      fireEvent.click(optIn(content.steps));

      const field = screen.getByLabelText(content.steps.emailLabel);
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(field, { target: { value: 'not-an-email' } });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.change(field, { target: { value: 'resident@example.com' } });
      expect(button(content.steps.submitLabel)).not.toBeDisabled();
    });

    it('frees Submit again when the opt-in is cleared', () => {
      fireEvent.click(optIn(content.steps));
      fireEvent.change(screen.getByLabelText(content.steps.emailLabel), {
        target: { value: 'still-typing' },
      });
      expect(button(content.steps.submitLabel)).toBeDisabled();

      fireEvent.click(optIn(content.steps));

      expect(button(content.steps.submitLabel)).not.toBeDisabled();
      expect(screen.queryByLabelText(content.steps.emailLabel)).not.toBeInTheDocument();
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

      fireEvent.click(optIn(content.steps));
      fireEvent.change(screen.getByLabelText(content.steps.emailLabel), {
        target: { value: 'resident@example.com' },
      });
      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();
      expect(screen.getByText(content.success.body)).toBeInTheDocument();

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

    it('stores a response with no address when the report is declined', async () => {
      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL);

      fireEvent.click(button(content.steps.submitLabel));

      expect(await screen.findByRole('heading', { name: content.success.title })).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
      expect(stored).toHaveLength(1);
      expect(stored[0].email).toBeNull();
      expect(stored[0].section3[content.section3[0].key]).toBe(
        content.section3[0].options[0].value,
      );
    });

    it('drops an address typed before the opt-in was cleared', async () => {
      render(<SurveyPage t={THEME} />);
      walkToEmail(content, TOTAL);

      fireEvent.click(optIn(content.steps));
      fireEvent.change(screen.getByLabelText(content.steps.emailLabel), {
        target: { value: 'resident@example.com' },
      });
      fireEvent.click(optIn(content.steps));
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

    fireEvent.click(optIn(fixture.steps));
    fireEvent.change(screen.getByLabelText(fixture.steps.emailLabel), {
      target: { value: '  resident@example.com  ' },
    });
    fireEvent.click(button(fixture.steps.submitLabel));

    expect(await screen.findByRole('heading', { name: fixture.success.title })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith({
      section1: { picks: ['trees', 'benches'] },
      section2: { rating: '3' },
      section3: { last: 'yes' },
      email: 'resident@example.com',
      source: 'fixture_survey',
    });
  });

  it('submits a null email when the report is not opted into', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'saved' });
    renderFixture(submit);

    fireEvent.click(button(fixture.hero.startLabel));
    answerAndAdvance(fixture.steps);
    answerAndAdvance(fixture.steps);
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

    fireEvent.click(optIn(fixture.steps));
    const field = screen.getByLabelText(fixture.steps.emailLabel);
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
    expect(optIn(fixture.steps)).toBeInTheDocument();
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
