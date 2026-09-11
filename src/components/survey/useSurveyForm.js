/* PLACER — survey flow state.
 *
 * Drives the whole survey: an intro, one question per screen across three
 * sections, an email step, and a thank-you screen. The component tree below only
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

/** The option a question marks as free text, if it has one. */
const otherOption = (question) => question?.options.find((option) => option.other);

/** Whether `value` holds `option`, for both single and multiple questions. */
const holds = (value, option) =>
  Array.isArray(value) ? value.includes(option.value) : value === option.value;

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
  const [step, setStep] = useState('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [email, setEmail] = useState('');
  // What was typed against a question's `other` option, keyed by question.
  const [otherText, setOtherText] = useState({});
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

  // Picking the free-text option without saying what it is answers nothing, so
  // it holds Next the same way an unanswered question does.
  const currentOther = otherOption(currentQuestion);
  const currentOtherText = currentQuestion ? (otherText[currentQuestion.key] ?? '') : '';
  const currentOtherPicked = Boolean(currentOther) && holds(currentAnswer, currentOther);
  const currentQuestionValid = currentQuestion
    ? isAnswered(currentQuestion, currentAnswer) &&
      (!currentOtherPicked || currentOtherText.trim() !== '')
    : true;

  const setCurrentOtherText = (typed) => {
    if (!currentQuestion) return;
    setOtherText((current) => ({ ...current, [currentQuestion.key]: typed }));
  };

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

  // Only questions that offer a `noCommitment` answer bear on this. Within one,
  // anything picked that is *not* that answer is a request to come back to
  // someone, which we cannot honour without an address — so it makes the closing
  // step required. Picking the no-commitment answer as well does not undo that:
  // on a multiple-choice question the two can both be ticked. A survey that
  // flags nothing leaves the step optional throughout.
  const askedForSomething = SECTIONS.some((section) =>
    content[section].some((question) => {
      if (!question.options.some((option) => option.noCommitment)) return false;
      const value = answers[section][question.key];
      return question.options.some((option) => !option.noCommitment && holds(value, option));
    }),
  );
  const emailRequired = askedForSomething;
  const canSubmit = emailRequired ? emailValid : trimmedEmail === '' || emailValid;

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
   * The free text for every `other` option that is actually selected, keyed by
   * question. Text typed and then deselected is left behind rather than sent.
   */
  const pickedOtherText = () => {
    const picked = {};
    SECTIONS.forEach((section) => {
      content[section].forEach((question) => {
        const option = otherOption(question);
        if (!option || !holds(answers[section][question.key], option)) return;
        const typed = (otherText[question.key] ?? '').trim();
        if (typed !== '') picked[question.key] = typed;
      });
    });
    return picked;
  };

  const onSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Nothing typed before the box was cleared is kept: no opt-in, no address.
      await submit({
        ...answers,
        email: trimmedEmail === '' ? null : trimmedEmail,
        // Only the free text for options actually picked, so a typed-then-
        // deselected answer is not carried along with the rest.
        otherText: pickedOtherText(),
        source,
      });
      posthog.capture('survey_submitted', {
        source,
        questions_answered: answeredCount,
        total_questions: totalQuestions,
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
    currentOtherPicked,
    currentOtherText,
    setCurrentOtherText,
    toggleOption,
    currentQuestionNumber,
    totalQuestions,
    progressValue,
    email,
    setEmail,
    emailRequired,
    canSubmit,
    isSubmitting,
    errorMessage,
    handleNext,
    handleBack,
    onSubmit,
    reset,
  };
}
