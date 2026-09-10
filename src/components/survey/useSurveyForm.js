/* PLACER — survey flow state.
 *
 * Drives the whole survey: an intro, one question per screen across three
 * sections, a final step, and a thank-you screen. The final step asks for an
 * address behind a consent box, or — when the content carries a `contact` block
 * — for contact details behind an opt-in question. The component tree below only
 * renders what this returns, so the navigation rules live in one place and are
 * testable without a DOM.
 */

import { useRef, useState } from 'react';
import posthog from 'posthog-js';

import { SECTIONS } from './content';

// Deliberately loose: enough to catch a typed-in mistake, not a claim about
// which addresses exist. Anything stricter rejects valid addresses.
const EMAIL_PATTERN = /.+@.+\..+/;

const emptyAnswers = () => Object.fromEntries(SECTIONS.map((section) => [section, {}]));

const isSectionStep = (step) => SECTIONS.includes(step);

function isAnswered(question, value) {
  if (question.multiple) return Array.isArray(value) && value.length > 0;
  return value !== undefined && value !== '';
}

/**
 * @param content  a validated survey, from `resolveSurveyContent`
 * @param submit   persists the finished response; rejects if it could not
 * @param source   tag recorded with the response, e.g. `community_survey`
 */
export function useSurveyForm({ content, submit, source }) {
  // Present when the final step is lead capture — an opt-in question plus the
  // fields it reveals — rather than the consent checkbox and one address.
  const contact = content.contact ?? null;

  const [step, setStep] = useState('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [email, setEmail] = useState('');
  // The report is an opt-in. Leaving it off is a complete submission with no
  // address attached, so the survey never withholds Submit over an empty field.
  const [wantsReport, setWantsReport] = useState(false);
  const [contactChoice, setContactChoice] = useState(undefined);
  const [contactValues, setContactValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // The survey scrolls inside its own pane rather than the window, so moving
  // between questions has to reset that pane and not the page.
  const scrollRef = useRef(null);

  const scrollToTop = () => {
    const pane = scrollRef.current;
    if (!pane) return;
    if (typeof pane.scrollTo === 'function') pane.scrollTo({ top: 0, behavior: 'smooth' });
    else pane.scrollTop = 0;
  };

  const currentQuestions = isSectionStep(step) ? content[step] : [];
  const currentQuestion = currentQuestions[questionIndex];
  const currentAnswer = currentQuestion ? answers[step][currentQuestion.key] : undefined;
  const currentQuestionValid = currentQuestion
    ? isAnswered(currentQuestion, currentAnswer)
    : true;

  const sectionLengths = SECTIONS.map((section) => content[section].length);
  const totalQuestions = sectionLengths.reduce((sum, n) => sum + n, 0);

  // Questions completed before this section, plus the position within it. The
  // email step reads as the last question so the bar arrives full.
  const currentQuestionNumber = isSectionStep(step)
    ? sectionLengths.slice(0, SECTIONS.indexOf(step)).reduce((sum, n) => sum + n, 0) +
      questionIndex +
      1
    : step === 'email'
      ? totalQuestions
      : 0;

  const progressValue = totalQuestions ? (currentQuestionNumber / totalQuestions) * 100 : 0;

  const answeredCount = SECTIONS.reduce(
    (sum, section) =>
      sum + content[section].filter((q) => isAnswered(q, answers[section][q.key])).length,
    0,
  );

  const trimmedEmail = email.trim();
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);

  const setContactField = (key, value) =>
    setContactValues((current) => ({ ...current, [key]: value }));

  const contactField = (key) => (contactValues[key] ?? '').trim();

  // Only some answers ask for contact details; "no thanks" is a complete
  // submission that collects none.
  const contactRevealed = Boolean(contact) && contact.revealOn.includes(contactChoice);

  /** A required field has to be filled, and an email field has to look like one. */
  const contactFieldValid = (field) => {
    const value = contactField(field.key);
    if (value === '') return !field.required;
    return field.type !== 'email' || EMAIL_PATTERN.test(value);
  };

  // With lead capture the opt-in is a question like any other and has to be
  // answered; otherwise an address is only required by the visitor asking for
  // the report.
  const canSubmit = contact
    ? contactChoice !== undefined &&
      (!contactRevealed || contact.fields.every(contactFieldValid))
    : !wantsReport || emailValid;

  /**
   * Records the current question's answer. Single-choice questions replace it;
   * `multiple` questions add or remove the value.
   */
  const toggleOption = (optionValue) => {
    if (!currentQuestion) return;
    const { key, multiple } = currentQuestion;

    setAnswers((current) => {
      const section = current[step];
      let next;

      if (multiple) {
        const selected = Array.isArray(section[key]) ? section[key] : [];
        next = selected.includes(optionValue)
          ? selected.filter((value) => value !== optionValue)
          : [...selected, optionValue];
      } else {
        next = optionValue;
      }

      return { ...current, [step]: { ...section, [key]: next } };
    });
  };

  const handleNext = () => {
    if (step === 'intro') {
      setStep(SECTIONS[0]);
      setQuestionIndex(0);
      scrollToTop();
      return;
    }

    if (questionIndex < currentQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else if (isSectionStep(step)) {
      const nextSection = SECTIONS[SECTIONS.indexOf(step) + 1];
      if (nextSection) {
        setStep(nextSection);
        setQuestionIndex(0);
      } else {
        setStep('email');
      }
    }

    scrollToTop();
  };

  const handleBack = () => {
    if (step === 'email') {
      const lastSection = SECTIONS[SECTIONS.length - 1];
      setStep(lastSection);
      setQuestionIndex(content[lastSection].length - 1);
    } else if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    } else if (isSectionStep(step)) {
      const previousSection = SECTIONS[SECTIONS.indexOf(step) - 1];
      if (previousSection) {
        setStep(previousSection);
        setQuestionIndex(content[previousSection].length - 1);
      } else {
        setStep('intro');
      }
    }

    setErrorMessage(null);
    scrollToTop();
  };

  /**
   * The opt-in answer, plus the fields if it asked for them. Values are trimmed,
   * and an empty optional field is left out rather than stored as ''.
   */
  const contactResponse = () => {
    if (!contactRevealed) return { choice: contactChoice };

    const filled = contact.fields
      .map((field) => [field.key, contactField(field.key)])
      .filter(([, value]) => value !== '');

    return { choice: contactChoice, ...Object.fromEntries(filled) };
  };

  const contactEmailKey = contact?.fields.find((field) => field.type === 'email')?.key;

  /**
   * The captured address, repeated at the top level of the response so anything
   * reading a response's `email` — the shape every response has had so far —
   * still finds one. Null unless the opt-in asked for contact details.
   */
  const contactEmail = () => {
    if (!contactRevealed || !contactEmailKey) return null;
    return contactField(contactEmailKey) || null;
  };

  const onSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Nothing typed before the box was cleared, or before "no thanks" was
      // picked, is kept: no opt-in, no address.
      await submit(
        contact
          ? { ...answers, email: contactEmail(), contact: contactResponse(), source }
          : { ...answers, email: wantsReport ? trimmedEmail : null, source },
      );
      posthog.capture('survey_submitted', {
        source,
        questions_answered: answeredCount,
        total_questions: totalQuestions,
        ...(contact ? { contact_opt_in: contactChoice } : {}),
      });
      setStep('success');
    } catch {
      // The reason is never shown to the visitor; the copy in the content is.
      setErrorMessage(content.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Leaves the survey. A full navigation, so a reload cannot resubmit. */
  const reset = () => {
    window.location.href = '/';
  };

  return {
    step,
    scrollRef,
    currentQuestion,
    currentAnswer,
    currentQuestionValid,
    toggleOption,
    currentQuestionNumber,
    totalQuestions,
    progressValue,
    email,
    setEmail,
    wantsReport,
    setWantsReport,
    contact,
    contactChoice,
    setContactChoice,
    contactRevealed,
    contactValues,
    setContactField,
    canSubmit,
    isSubmitting,
    errorMessage,
    handleNext,
    handleBack,
    onSubmit,
    reset,
  };
}
