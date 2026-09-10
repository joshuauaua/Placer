'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';

import { Button } from '@kit/ui/button';

import { FlexBox, Text } from '~/components/primitives';

import type { SurveyQuestion, SurveySubmission } from './schema';

interface SurveyQuestionFieldProps {
  question: SurveyQuestion;
  section: 'section1' | 'section2' | 'section3';
  form: UseFormReturn<SurveySubmission>;
}

/**
 * Renders one survey question as a group of option buttons. `scale` questions
 * lay their options out in a wrapping row (a 1-5 rating strip); everything
 * else stacks them full-width.
 */
export function SurveyQuestionField({
  question,
  section,
  form,
}: SurveyQuestionFieldProps) {
  const fieldName = `${section}.${question.key}` as FieldPath<SurveySubmission>;
  const value = form.watch(fieldName);

  const toggle = (optionValue: string) => {
    if (question.multiple) {
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(optionValue)
        ? current.filter((v: string) => v !== optionValue)
        : [...current, optionValue];
      form.setValue(fieldName, next, { shouldValidate: true });
    } else {
      form.setValue(fieldName, optionValue, { shouldValidate: true });
    }
  };

  return (
    <FlexBox direction="col" gap={2}>
      <Text variant="sm" as="label" className="font-medium">
        {question.label}{' '}
        {question.multiple && (
          <Text as="span" variant="xs" className="text-muted-foreground ml-1 font-normal">
            (Select all that apply)
          </Text>
        )}
      </Text>

      <FlexBox
        direction={question.scale ? 'row' : 'col'}
        wrap={question.scale ? 'wrap' : undefined}
        gap={2}
        className={question.scale ? 'w-full' : ''}
      >
        {question.options.map((option) => {
          const selected = question.multiple
            ? Array.isArray(value) && value.includes(option.value)
            : value === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              variant={selected ? 'default' : 'outline'}
              aria-pressed={selected}
              className={
                question.scale
                  ? 'min-w-[3rem] flex-1 text-center'
                  : 'h-auto justify-start py-3 text-left'
              }
              onClick={() => toggle(option.value)}
            >
              <span className={question.scale ? '' : 'whitespace-normal'}>
                {option.label}
              </span>
            </Button>
          );
        })}
      </FlexBox>
    </FlexBox>
  );
}
