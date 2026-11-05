import { PopQuiz } from '../../components/toolkit/PopQuiz';
import { PopQuizSetup, QuestionsStep, TimeStep } from '../../components/toolkit/PopQuizSetup';
import { PALETTE } from '../../theme';
import {
  combineQuiz, defaultQuizSetup, emptyQuizState, questionPanelProblems, questionProblems as quizQuestionProblems,
  quizSetupProblems, timeProblems,
} from '../../lib/popQuiz';
import { counted, roomText, tone } from '../toolParts';

export default {
  id: 'pop-quiz',
  added: '2026-10-12',
  // Imagine rather than Understand: a playful prompt that challenges assumptions
  // and kicks off visioning ("Guess how many use this plaza daily — how could we double it?").
  category: 'imagine',
  setting: 'public',
  delivery: ['live'],
  name: 'Pop Quiz',
  tagline: 'Twenty questions, a clock, and a scoreboard.',
  blurb: 'Write a quiz of up to twenty questions, each with four choices or a blank to fill in. Everybody joins with a nickname, the questions go up one at a time, and a right answer scores more the sooner it comes — a quick way to find out what a room already knows about a place.',
  ...tone(PALETTE.blue),
  icon: 'flask',
  createdBy: 'PLACER',
  component: PopQuiz,
  setup: {
    defaults: defaultQuizSetup,
    problems: quizSetupProblems,
    Form: PopQuizSetup,
    steps: [
      { title: 'Questions', Form: QuestionsStep, problems: quizQuestionProblems, panelProblems: questionPanelProblems },
      { title: 'Time', Form: TimeStep, problems: timeProblems },
    ],
  },
  inquiry: {
    summary: (config) => (Array.isArray(config?.questions) ? counted(config.questions.length, 'question', 'questions') : ''),
  },
  onProjectPage: {
    heading: 'Take the pop quiz',
  },
  room: {
    empty: emptyQuizState,
    combine: combineQuiz,
    label: (config) => roomText(config?.questions?.[0]?.text),
  },
};
