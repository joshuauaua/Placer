'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';

import { useCaptchaToken } from '@kit/auth/captcha/client';

import { useAnimation } from '~/hooks/use-animation';
import { postSubscriberToTendril } from '~/lib/tendril-subscribe';

import {
  SurveySubmissionSchema,
  type SurveyContent,
  type SurveyQuestion,
  type SurveyStep,
  type SurveySubmission,
  type SurveySubmitResult,
} from './schema';

const SECTIONS = ['section1', 'section2', 'section3'] as const;
type SectionKey = (typeof SECTIONS)[number];

interface UseSurveyFormArgs {
  content: SurveyContent;
  /** Server action that persists this survey's submission. */
  submit: (values: SurveySubmission) => Promise<SurveySubmitResult>;
  /** Subscriber-list source tag, e.g. `benchmark_survey`. */
  subscriberSource: string;
}

/**
 * Drives the shared three-section survey flow: question-at-a-time navigation,
 * per-section validity, captcha-guarded submit, and the entrance animations.
 * Each survey supplies its own content and server action; everything else here
 * is identical between them.
 */
export function useSurveyForm({
  content,
  submit,
  subscriberSource,
}: UseSurveyFormArgs) {
  const [step, setStep] = useState<SurveyStep>('intro');
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { getToken } = useCaptchaToken();

  const form = useForm<SurveySubmission>({
    resolver: zodResolver(SurveySubmissionSchema),
    mode: 'onChange',
  });

  const headerAnimation = useAnimation({
    type: 'fade-up',
    duration: 600,
    delay: 100,
    animateOnScroll: false,
  });

  const cardAnimation = useAnimation({
    type: 'fade-up',
    duration: 600,
    delay: 250,
    animateOnScroll: false,
  });

  const isQuestionValid = (q: SurveyQuestion, prefix: string) => {
    const fieldName = `${prefix}.${q.key}` as FieldPath<SurveySubmission>;
    const val = form.watch(fieldName);
    if (q.multiple) {
      return Array.isArray(val) && val.length > 0;
    }
    return val !== undefined && val !== '';
  };

  const isSectionValid = (section: SectionKey) =>
    content[section].every((q) => isQuestionValid(q, section));

  const section1Valid = isSectionValid('section1');
  const section2Valid = isSectionValid('section2');
  const section3Valid = isSectionValid('section3');

  const email = form.watch('email');
  const emailValid = typeof email === 'string' && /.+@.+\..+/.test(email);

  const isSectionStep = (s: SurveyStep): s is SectionKey =>
    SECTIONS.includes(s as SectionKey);

  const currentQuestions = isSectionStep(step) ? content[step] : [];
  const currentQuestion = currentQuestions[questionIndex];
  const currentQuestionValid = currentQuestion
    ? isQuestionValid(currentQuestion, step)
    : true;

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleNext = () => {
    if (step === 'intro') {
      setStep('section1');
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
      setStep('section3');
      setQuestionIndex(content.section3.length - 1);
    } else if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    } else if (isSectionStep(step)) {
      const prevSection = SECTIONS[SECTIONS.indexOf(step) - 1];
      if (prevSection) {
        setStep(prevSection);
        setQuestionIndex(content[prevSection].length - 1);
      } else {
        setStep('intro');
      }
    }

    scrollToTop();
  };

  const goTo = (next: SurveyStep) => {
    setErrorMessage(null);
    setStep(next);
    setQuestionIndex(0);
    scrollToTop();
  };

  const onSubmit = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const values = form.getValues();
        // Always request a fresh token - a stale one fails verification.
        const token = await getToken();
        const result = await submit({ ...values, captchaToken: token });

        if (result.ok) {
          void postSubscriberToTendril(values.email, subscriberSource);
          setStep('success');
        } else {
          setErrorMessage(`[${result.stage}] ${result.error}`);
        }
      } catch (error) {
        setErrorMessage(
          `[unexpected] ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  };

  const reset = () => {
    window.location.href = '/';
  };

  return {
    content,
    form,
    step,
    questionIndex,
    currentQuestionValid,
    handleNext,
    handleBack,
    goTo,
    onSubmit,
    reset,
    isPending,
    errorMessage,
    section1Valid,
    section2Valid,
    section3Valid,
    emailValid,
    headerAnimation,
    cardAnimation,
  };
}
