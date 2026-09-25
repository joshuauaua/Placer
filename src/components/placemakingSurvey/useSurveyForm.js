/* PLACER — survey flow state.
 *
 * Drives the whole survey: a cover page, one question per screen across four
 * modules, a closing step for the opt-ins and contact details, and a thank-you
 * screen. The component tree below only renders what this returns, so the
 * navigation rules live in one place and are testable without a DOM.
 */

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';

import { MODULES, otherOption, questionType } from './content';

// Deliberately loose: enough to catch a typed-in mistake, not a claim about
// which addresses exist. Anything stricter rejects valid addresses.
const EMAIL_PATTERN = /.+@.+\..+/;

const emptyByModule = () => Object.fromEntries(MODULES.map((module) => [module, {}]));

const isModuleStep = (step) => MODULES.includes(step);

const filled = (value) => typeof value === 'string' && value.trim() !== '';

/** Whether `optionValue` is among this question's answer. */
function isChosen(question, value, optionValue) {
  return question.multiple
    ? Array.isArray(value) && value.includes(optionValue)
    : value === optionValue;
}

/**
 * Whether a question has been answered well enough to move on. An `optional`
 * question always has been — that is what the flag buys — and a question whose
 * `other` option is chosen has not until the free text is typed, because "Other"
 * on its own tells us nothing.
 */
function isAnswered(question, value, otherText) {
  if (question.optional) return true;

  const type = questionType(question);

  if (type === 'text' || type === 'paragraph') return filled(value);
  if (type === 'scale') return value !== undefined && value !== '';

  if (question.multiple) {
    if (!Array.isArray(value) || value.length === 0) return false;
  } else if (value === undefined || value === '') {
    return false;
  }

  const other = otherOption(question);
  return other && isChosen(question, value, other.value) ? filled(otherText) : true;
}

/**
 * The free text worth keeping: typed, and against an `other` option that is still
 * chosen. Somebody who picks Other, types, then changes their mind leaves the text
 * behind in state — sending it would attach a specification to an answer that was
 * never given. Modules that collected nothing are dropped so the payload stays
 * readable.
 */
function pruneOtherText(content, answers, otherText) {
  const kept = {};

  MODULES.forEach((module) => {
    const entries = {};

    content[module].forEach((question) => {
      const other = otherOption(question);
      const written = otherText[module][question.key];
      if (!other || !filled(written)) return;
      if (isChosen(question, answers[module][question.key], other.value)) {
        entries[question.key] = written.trim();
      }
    });

    if (Object.keys(entries).length > 0) kept[module] = entries;
  });

  return kept;
}

/**
 * @param content  a validated survey, from `resolveSurveyContent`
 * @param submit   persists the finished response; rejects if it could not
 * @param source   tag recorded with the response, e.g. `community_survey`
 */
export function useSurveyForm({ content, submit, source }) {
  const [step, setStep] = useState('cover');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(emptyByModule);
  // Free text typed against an `other` option, alongside the answers rather than
  // inside them so an answer is always a value from the content.
  const [otherText, setOtherText] = useState(emptyByModule);
  // Every opt-in is off to begin with. Leaving them all off is a complete
  // submission with no details attached, so the survey never withholds Submit.
  const [optIns, setOptIns] = useState(() =>
    Object.fromEntries(content.optIns.map((entry) => [entry.key, false])),
  );
  const [contact, setContact] = useState(() =>
    Object.fromEntries(content.contact.fields.map((field) => [field.key, ''])),
  );
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

  const currentQuestions = isModuleStep(step) ? content[step] : [];
  const currentQuestion = currentQuestions[questionIndex];
  const currentAnswer = currentQuestion ? answers[step][currentQuestion.key] : undefined;
  const currentOtherText = currentQuestion ? otherText[step][currentQuestion.key] : undefined;
  const currentQuestionValid = currentQuestion
    ? isAnswered(currentQuestion, currentAnswer, currentOtherText)
    : true;

  const moduleLengths = MODULES.map((module) => content[module].length);
  const totalQuestions = moduleLengths.reduce((sum, n) => sum + n, 0);

  // Questions completed before this module, plus the position within it. The
  // closing step reads as the last question so the bar arrives full.
  const currentQuestionNumber = isModuleStep(step)
    ? moduleLengths.slice(0, MODULES.indexOf(step)).reduce((sum, n) => sum + n, 0) +
      questionIndex +
      1
    : step === 'optIn'
      ? totalQuestions
      : 0;

  const progressValue = totalQuestions ? (currentQuestionNumber / totalQuestions) * 100 : 0;

  const answeredCount = MODULES.reduce(
    (sum, module) =>
      sum +
      content[module].filter((q) => isAnswered(q, answers[module][q.key], otherText[module][q.key]))
        .length,
    0,
  );

  const chosenOptIns = content.optIns.filter((entry) => optIns[entry.key]).map((entry) => entry.key);
  // The contact fields show unconditionally on the closing step (see SurveyForm),
  // not gated behind an opt-in checkbox — the checkboxes are now separate, further
  // asks. Whether the respondent has actually started leaving their details is
  // read off the fields themselves, the same "typed something" signal `isAnswered`
  // uses for a required text question.
  const trimmedContact = Object.fromEntries(
    Object.entries(contact).map(([key, value]) => [key, value.trim()]),
  );
  // An anonymous respondent leaves no details and asks for nothing else; the
  // fields and the other opt-ins are cleared and locked while it is ticked.
  const anonymousOptIn = content.optIns.find((entry) => entry.anonymous);
  const isAnonymous = Boolean(anonymousOptIn && optIns[anonymousOptIn.key]);
  const wantsContact = !isAnonymous && Object.values(trimmedContact).some(filled);
  const emailField = content.contact.fields.find((field) => field.type === 'email');
  const contactComplete = content.contact.fields.every((field) =>
    field.type === 'email'
      ? EMAIL_PATTERN.test(trimmedContact[field.key])
      : filled(trimmedContact[field.key]),
  );
  // Details are only required once the respondent has actually started leaving them.
  const canSubmit = !wantsContact || contactComplete;

  /**
   * Records the current question's answer. Single-choice and `scale` questions
   * replace it; `multiple` questions add or remove the value.
   */
  const toggleOption = (optionValue) => {
    if (!currentQuestion) return;
    const { key, multiple } = currentQuestion;

    setAnswers((current) => {
      const module = current[step];
      let next;

      if (multiple) {
        const selected = Array.isArray(module[key]) ? module[key] : [];
        next = selected.includes(optionValue)
          ? selected.filter((value) => value !== optionValue)
          : [...selected, optionValue];
      } else {
        next = optionValue;
      }

      return { ...current, [step]: { ...module, [key]: next } };
    });
  };

  /** Records a typed answer, for the `text` and `paragraph` questions. */
  const setWrittenAnswer = (written) => {
    if (!currentQuestion) return;
    setAnswers((current) => ({
      ...current,
      [step]: { ...current[step], [currentQuestion.key]: written },
    }));
  };

  /** Records the free text against this question's `other` option. */
  const setOtherAnswer = (written) => {
    if (!currentQuestion) return;
    setOtherText((current) => ({
      ...current,
      [step]: { ...current[step], [currentQuestion.key]: written },
    }));
  };

  const toggleOptIn = (key) => {
    if (key !== anonymousOptIn?.key) {
      setOptIns((current) => ({ ...current, [key]: !current[key] }));
      return;
    }

    const turningOn = !optIns[key];
    setOptIns((current) =>
      turningOn
        ? Object.fromEntries(Object.keys(current).map((other) => [other, other === key]))
        : { ...current, [key]: false },
    );
    if (turningOn) {
      setContact((current) => Object.fromEntries(Object.keys(current).map((field) => [field, ''])));
    }
  };

  const setContactField = (key, value) =>
    setContact((current) => ({ ...current, [key]: value }));

  const handleNext = () => {
    if (step === 'cover') {
      setStep(MODULES[0]);
      setQuestionIndex(0);
      scrollToTop();
      return;
    }

    if (questionIndex < currentQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else if (isModuleStep(step)) {
      const nextModule = MODULES[MODULES.indexOf(step) + 1];
      if (nextModule) {
        setStep(nextModule);
        setQuestionIndex(0);
      } else {
        setStep('optIn');
      }
    }

    scrollToTop();
  };

  const handleBack = () => {
    if (step === 'optIn') {
      const lastModule = MODULES[MODULES.length - 1];
      setStep(lastModule);
      setQuestionIndex(content[lastModule].length - 1);
    } else if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    } else if (isModuleStep(step)) {
      const previousModule = MODULES[MODULES.indexOf(step) - 1];
      if (previousModule) {
        setStep(previousModule);
        setQuestionIndex(content[previousModule].length - 1);
      } else {
        setStep('cover');
      }
    }

    setErrorMessage(null);
    scrollToTop();
  };

  const onSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Nothing typed before the last opt-in was cleared is kept: no opt-in, no
      // details. `email` is also sent on its own because it is a column of its
      // own on the responses table.
      await submit({
        ...answers,
        otherText: pruneOtherText(content, answers, otherText),
        optIns: chosenOptIns,
        contact: wantsContact ? trimmedContact : null,
        email: wantsContact && emailField ? trimmedContact[emailField.key] : null,
        source,
      });
      posthog.capture('survey_submitted', {
        source,
        questions_answered: answeredCount,
        total_questions: totalQuestions,
        opt_ins: chosenOptIns.length,
      });
      setStep('success');
    } catch {
      // The reason is never shown to the respondent; the copy in the content is.
      setErrorMessage(content.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * What Enter means on the step we are on: start the survey, take the answer
   * and move on, or submit. It does nothing when the step is not ready, which is
   * the same rule the Next and Submit buttons follow.
   */
  const advance = () => {
    if (isSubmitting) return;
    if (step === 'cover') handleNext();
    else if (step === 'optIn') onSubmit();
    else if (isModuleStep(step) && currentQuestionValid) handleNext();
  };

  // Read by the listener below, so it can be registered once and still call the
  // current step's rules rather than the ones that applied when it was added.
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });

  /**
   * Enter continues, the way it does in a Typeform. The listener is on the
   * document because there is usually nothing focused to hang it off — the
   * respondent has just clicked an option, or read the cover and not touched
   * anything.
   *
   * Everything that already treats Enter as its own is left alone: links
   * follow, and Back and Submit are buttons the browser activates without help.
   * An option button is the exception — Enter on one continues rather than toggling the option off again, which is what a
   * respondent who has just chosen it means by it.
   */
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      const tag = target?.tagName?.toLowerCase();

      if (tag === 'a' || tag === 'select' || tag === 'summary') return;
      if (target?.closest?.('summary')) return;
      if (target?.isContentEditable) return;
      if (tag === 'button' && !target.hasAttribute('data-survey-option')) return;

      // Stops the focused option toggling, and a newline landing in a paragraph.
      event.preventDefault();
      advanceRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /** Leaves the survey. A full navigation, so a reload cannot resubmit. */
  const reset = () => {
    window.location.href = '/';
  };

  return {
    step,
    scrollRef,
    currentQuestion,
    currentAnswer,
    currentOtherText,
    currentQuestionValid,
    toggleOption,
    setWrittenAnswer,
    setOtherAnswer,
    currentQuestionNumber,
    totalQuestions,
    progressValue,
    optIns,
    toggleOptIn,
    isAnonymous,
    anonymousOptInKey: anonymousOptIn?.key,
    wantsContact,
    contact,
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
