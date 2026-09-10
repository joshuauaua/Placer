'use client';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Progress } from '@kit/ui/progress';

import { PageHero } from '~/components/page-hero';
import { FlexBox, Text } from '~/components/primitives';

import type { SurveyContent, SurveyStep, SurveySubmission, SurveySubmitResult } from './schema';
import { SurveyQuestionField } from './survey-question';
import { useSurveyForm } from './use-survey-form';

const SECTION_STEPS = ['section1', 'section2', 'section3'] as const;
type SectionStep = (typeof SECTION_STEPS)[number];

const isSectionStep = (step: SurveyStep): step is SectionStep =>
  SECTION_STEPS.includes(step as SectionStep);

export interface SurveyFormProps {
  content: SurveyContent;
  /** Server action that persists this survey's submission. */
  submit: (values: SurveySubmission) => Promise<SurveySubmitResult>;
  /** Subscriber-list source tag, e.g. `benchmark_survey`. */
  subscriberSource: string;
  /** Prefix for the email field's DOM ids, so two surveys never collide. */
  idPrefix: string;
  subtitleClassName?: string;
}

/**
 * Shared three-section survey: intro hero, one question per screen across
 * three sections, an email capture step, and a success dialog. The benchmark
 * survey and the AI token survey are the same flow over different content and
 * server actions, so both render through this component.
 */
export function SurveyForm({
  content,
  submit,
  subscriberSource,
  idPrefix,
  subtitleClassName,
}: SurveyFormProps) {
  const {
    content: c,
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
    emailValid,
    headerAnimation,
    cardAnimation,
  } = useSurveyForm({ content, submit, subscriberSource });

  const emailId = `${idPrefix}-email`;
  const emailErrorId = `${emailId}-error`;

  const sectionLengths = [
    c.section1.length,
    c.section2.length,
    c.section3.length,
  ];
  const totalQuestions = sectionLengths.reduce((sum, n) => sum + n, 0);

  // Questions completed before the current section, plus the position within it.
  const currentQuestionNumber = isSectionStep(step)
    ? sectionLengths
        .slice(0, SECTION_STEPS.indexOf(step))
        .reduce((sum, n) => sum + n, 0) +
      questionIndex +
      1
    : step === 'email'
      ? totalQuestions
      : 0;

  const progressValue = totalQuestions
    ? (currentQuestionNumber / totalQuestions) * 100
    : 0;

  const counterText =
    step === 'email'
      ? 'Final Step'
      : `Question ${currentQuestionNumber} of ${totalQuestions}`;

  const sectionCopy = {
    section1: { title: c.steps.section1Title, description: c.steps.section1Description },
    section2: { title: c.steps.section2Title, description: c.steps.section2Description },
    section3: { title: c.steps.section3Title, description: c.steps.section3Description },
  } as const;

  const currentQuestion = isSectionStep(step)
    ? c[step][questionIndex]
    : undefined;

  return (
    <FlexBox direction="col" align="center" className="min-h-[100dvh] w-full">
      {step === 'intro' ? (
        <PageHero
          title={c.hero.title}
          subtitle={c.hero.subtitle}
          subtitleClassName={subtitleClassName}
          plain
        >
          <Button onClick={handleNext} size="lg">
            {c.hero.startLabel}
          </Button>
        </PageHero>
      ) : (
        <FlexBox
          direction="col"
          align="center"
          gap={3}
          ref={headerAnimation.ref}
          style={headerAnimation.style}
          className={`${headerAnimation.className} container max-w-2xl pt-16 text-center md:pt-24`}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="container mt-8 w-full max-w-2xl pb-16 md:pb-24"
      >
        <FlexBox
          direction="col"
          gap={4}
          ref={cardAnimation.ref}
          style={cardAnimation.style}
        >
          {step !== 'intro' && step !== 'success' && (
            <FlexBox direction="col" gap={2} className={cardAnimation.className}>
              <FlexBox justify="between" align="center">
                <Text variant="xs" className="text-muted-foreground">
                  {counterText}
                </Text>
                <Text variant="xs" className="text-muted-foreground">
                  {Math.round(progressValue)}%
                </Text>
              </FlexBox>
              <Progress value={progressValue} />
            </FlexBox>
          )}

          {step !== 'intro' && (
            <Card className={cardAnimation.className}>
              <CardContent className="p-6 md:p-8">
                {isSectionStep(step) && (
                  <FlexBox direction="col" gap={6}>
                    <FlexBox direction="col" gap={1}>
                      <Text variant="h3">{sectionCopy[step].title}</Text>
                      <Text variant="muted">{sectionCopy[step].description}</Text>
                    </FlexBox>

                    {currentQuestion && (
                      <SurveyQuestionField
                        key={currentQuestion.key}
                        question={currentQuestion}
                        section={step}
                        form={form}
                      />
                    )}

                    <FlexBox justify="between" gap={2} className="mt-2">
                      <Button type="button" variant="ghost" onClick={handleBack}>
                        {c.steps.backLabel}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleNext}
                        disabled={!currentQuestionValid}
                      >
                        {c.steps.nextLabel}
                      </Button>
                    </FlexBox>
                  </FlexBox>
                )}

                {(step === 'email' || step === 'success') && (
                  <FlexBox direction="col" gap={6}>
                    <FlexBox direction="col" gap={1}>
                      <Text variant="h3">{c.steps.emailTitle}</Text>
                      <Text variant="muted">{c.steps.emailDescription}</Text>
                    </FlexBox>

                    <FlexBox direction="col" gap={2}>
                      <Text
                        variant="sm"
                        as="label"
                        htmlFor={emailId}
                        className="font-medium"
                      >
                        {c.steps.emailLabel}
                      </Text>
                      <Input
                        id={emailId}
                        type="email"
                        autoComplete="email"
                        placeholder={c.steps.emailPlaceholder}
                        {...form.register('email')}
                        disabled={step === 'success'}
                        aria-invalid={errorMessage ? true : undefined}
                        aria-describedby={errorMessage ? emailErrorId : undefined}
                      />
                    </FlexBox>

                    {errorMessage && (
                      <Text
                        id={emailErrorId}
                        role="alert"
                        variant="sm"
                        className="text-destructive"
                      >
                        {errorMessage}
                      </Text>
                    )}

                    <FlexBox justify="between" gap={2} className="mt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => goTo('section3')}
                        disabled={isPending || step === 'success'}
                      >
                        {c.steps.backLabel}
                      </Button>
                      <Button
                        type="submit"
                        disabled={!emailValid || isPending || step === 'success'}
                      >
                        {isPending ? c.steps.submittingLabel : c.steps.submitLabel}
                      </Button>
                    </FlexBox>
                  </FlexBox>
                )}

                {step === 'success' && (
                  <FlexBox
                    align="center"
                    justify="center"
                    className="bg-background/80 fixed inset-0 z-50 backdrop-blur-sm"
                  >
                    <Card className="animate-in fade-in zoom-in-95 mx-4 w-full max-w-md p-6 duration-200 md:p-8">
                      <FlexBox direction="col" gap={6} align="start">
                        <FlexBox direction="col" gap={2}>
                          <Text variant="h3" className="text-foreground">
                            {c.success.title}
                          </Text>
                          <Text variant="muted" className="whitespace-pre-line">
                            {c.success.body}
                          </Text>
                        </FlexBox>
                        <Button type="button" onClick={reset} className="w-full">
                          {c.success.closeLabel}
                        </Button>
                      </FlexBox>
                    </Card>
                  </FlexBox>
                )}
              </CardContent>
            </Card>
          )}
        </FlexBox>
      </form>
    </FlexBox>
  );
}
