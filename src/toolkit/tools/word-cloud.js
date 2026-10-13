import { WordCloud } from '../../components/toolkit/WordCloud';
import { WordCloudOnPage } from '../../components/toolkit/WordCloudOnPage';
import { PromptStep, WordCloudSetup, WordsStep } from '../../components/toolkit/WordCloudSetup';
import { CHARACTER } from '../../theme';
import {
  cloudSetupProblems, combineWords, defaultCloudSetup, emptyWords, promptProblems, wordsProblems,
} from '../../lib/wordCloud';
import { tone } from '../toolParts';

export default {
  id: 'word-cloud',
  added: '2026-10-12',
  category: 'understand',
  name: 'Word Cloud',
  tagline: 'Ask anything, and watch the answers gather.',
  blurb: 'Type whatever you want to put to a room and let everybody answer in a few words of their own. Each word joins the cloud as it is added, and grows every time another person says it — so what the room agrees on is the first thing you read.',
  ...tone(CHARACTER.cityWorker),
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
  onProjectPage: {
    heading: 'Tell us in a word',
    Embed: WordCloudOnPage,
  },
  room: {
    empty: emptyWords,
    combine: combineWords,
  },
};
