import type { Meta, StoryObj } from '@storybook/react';

import { BenchmarkForm } from './benchmark-form';

const meta: Meta<typeof BenchmarkForm> = {
  title: 'Sections/BenchmarkForm',
  component: BenchmarkForm,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof BenchmarkForm>;

export const Default: Story = {};
