import { z } from 'zod';

const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const QuestionSchema = z.object({
  key: z.string(),
  label: z.string(),
  options: z.array(OptionSchema),
  multiple: z.boolean().optional(),
  scale: z.boolean().optional(),
});

export type SurveyQuestion = z.infer<typeof QuestionSchema>;

/**
 * Content shape shared by every three-section survey on the site (the
 * benchmark survey and the AI token survey). Each survey keeps its own
 * `content/default.json`; only the structure is shared.
 */
export const SurveyContentSchema = z.object({
  hero: z.object({
    title: z.string(),
    subtitle: z.string(),
    startLabel: z.string(),
  }),
  steps: z.object({
    section1Title: z.string(),
    section1Description: z.string(),
    section2Title: z.string(),
    section2Description: z.string(),
    section3Title: z.string(),
    section3Description: z.string(),
    emailTitle: z.string(),
    emailDescription: z.string(),
    emailLabel: z.string(),
    emailPlaceholder: z.string(),
    consentLabel: z.string(),
    nextLabel: z.string(),
    backLabel: z.string(),
    submitLabel: z.string(),
    submittingLabel: z.string(),
  }),
  section1: z.array(QuestionSchema),
  section2: z.array(QuestionSchema),
  section3: z.array(QuestionSchema),
  success: z.object({
    title: z.string(),
    body: z.string(),
    closeLabel: z.string(),
  }),
  errorMessage: z.string(),
});

export type SurveyContent = z.infer<typeof SurveyContentSchema>;

export const SurveySubmissionSchema = z.object({
  section1: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  section2: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  section3: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  email: z.string().email(),
  captchaToken: z.string().optional(),
});

export type SurveySubmission = z.infer<typeof SurveySubmissionSchema>;

export type SurveyStep =
  | 'intro'
  | 'section1'
  | 'section2'
  | 'section3'
  | 'email'
  | 'success';

/** Result shape every survey server action returns. */
export type SurveySubmitResult =
  | { ok: true }
  | { ok: false; stage: string; error: string };
