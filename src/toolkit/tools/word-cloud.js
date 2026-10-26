import { WordCloud } from '../../components/toolkit/WordCloud';
import { WordCloudOnPage } from '../../components/toolkit/WordCloudOnPage';
import { PromptStep, WordCloudSetup, WordsStep } from '../../components/toolkit/WordCloudSetup';
import { PALETTE } from '../../theme';
import {
  cloudSetupProblems, combineWords, defaultCloudSetup, emptyWords, promptProblems, wordsProblems,
} from '../../lib/wordCloud';
import { counted, roomText, tone } from '../toolParts';

export default {
  id: 'word-cloud',
  added: '2026-10-12',
  category: 'understand',
  name: 'Word Cloud',
  tagline: 'Ask anything, and watch the answers live.',
  blurb: 'Ask a question to a group of people and let everybody answer in a few words of their own. Each word joins the cloud as it is added, and grows every time another person says it.',
  ...tone(PALETTE.blue),
  icon: 'cloud',
  createdBy: 'PLACER',
  component: WordCloud,
  setup: {
    defaults: defaultCloudSetup,
    problems: cloudSetupProblems,
    Form: WordCloudSetup,
    steps: [
      { title: 'Prompt', Form: PromptStep, problems: promptProblems },
      { title: 'Words', Form: WordsStep, problems: wordsProblems },
    ],
  },
  inquiry: {
    summary: (config) => (config?.words?.length > 0 ? counted(config.words.length, 'word', 'words') : ''),
  },
  onProjectPage: {
    heading: 'Tell us in a word',
    Embed: WordCloudOnPage,
  },
  room: {
    empty: emptyWords,
    combine: combineWords,
    label: (config) => roomText(config?.prompt),
  },
};
