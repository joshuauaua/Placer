import { PopQuiz } from '../../components/toolkit/PopQuiz';
import { PopQuizSetup, QuestionsStep, TimeStep } from '../../components/toolkit/PopQuizSetup';
import { CHARACTER } from '../../theme';
import {
  combineQuiz, defaultQuizSetup, emptyQuizState, questionProblems as quizQuestionProblems, quizSetupProblems,
  timeProblems,
} from '../../lib/popQuiz';
import { tone } from '../toolParts';

export default {
  id: 'pop-quiz',
  added: '2026-10-12',
  category: 'understand',
  name: 'Pop Quiz',
  tagline: 'Twenty questions, a clock, and a scoreboard.',
  blurb: 'Write a quiz of up to twenty questions, each with four choices or a blank to fill in. Everybody joins with a nickname, the questions go up one at a time, and a right answer scores more the sooner it comes — a quick way to find out what a room already knows about a place.',
  ...tone(CHARACTER.cityWorker),
  icon: 'flask',
  createdBy: 'PLACER',
  component: PopQuiz,
  setup: {
    defaults: defaultQuizSetup,
    problems: quizSetupProblems,
    Form: PopQuizSetup,
    steps: [
      { title: 'Questions', Form: QuestionsStep, problems: quizQuestionProblems },
      { title: 'Time', Form: TimeStep, problems: timeProblems },
    ],
  },
  onProjectPage: {
    heading: 'Take the pop quiz',
  },
  room: {
    empty: emptyQuizState,
    combine: combineQuiz,
  },
};
