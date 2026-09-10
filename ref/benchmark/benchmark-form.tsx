'use client';

import { SurveyForm } from '~/components/survey';

import { submitBenchmark } from '~/(marketing)/benchmark/_lib/server/server-actions';

import { resolveBenchmarkContent, type BenchmarkContent } from './schema';

interface BenchmarkFormProps {
  content?: BenchmarkContent;
}

export function BenchmarkForm({ content }: BenchmarkFormProps) {
  return (
    <SurveyForm
      content={resolveBenchmarkContent(content)}
      submit={submitBenchmark}
      subscriberSource="benchmark_survey"
      idPrefix="benchmark"
    />
  );
}
