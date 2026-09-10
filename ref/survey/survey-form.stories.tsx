import type { Meta, StoryObj } from '@storybook/react';

import benchmarkContent from '~/components/benchmark/content/default.json';

import { SurveyForm } from './survey-form';
import type { SurveyContent } from './schema';

const meta: Meta<typeof SurveyForm> = {
  title: 'Sections/SurveyForm',
  component: SurveyForm,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof SurveyForm>;

export const Default: Story = {
  args: {
    content: benchmarkContent as SurveyContent,
    submit: async () => ({ ok: true }),
    subscriberSource: 'storybook',
    idPrefix: 'storybook-survey',
  },
};
