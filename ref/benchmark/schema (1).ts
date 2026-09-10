import { SurveyContentSchema, type SurveyContent } from '~/components/survey';

import defaultContent from './content/default.json';

/** The benchmark survey uses the shared three-section survey content shape. */
export const BenchmarkContentSchema = SurveyContentSchema;
export type BenchmarkContent = SurveyContent;

const fallbackContent: BenchmarkContent =
  BenchmarkContentSchema.parse(defaultContent);

/** CMS content when supplied, otherwise the local default. */
export function resolveBenchmarkContent(
  content?: BenchmarkContent,
): BenchmarkContent {
  return content ?? fallbackContent;
}
