import { OpenVote } from '../../components/toolkit/OpenVote';
import { OpenVoteOnPage } from '../../components/toolkit/OpenVoteOnPage';
import { AnswersStep, OpenVoteSetup, QuestionStep } from '../../components/toolkit/OpenVoteSetup';
import { PALETTE } from '../../theme';
import {
  answerProblems, combineVotes, defaultVoteSetup, emptyVote, questionProblems, voteSetupProblems,
} from '../../lib/openVote';
import { roomText, tone } from '../toolParts';

export default {
  id: 'open-vote',
  added: '2026-09-22',
  category: 'plan',
  name: 'Poll',
  tagline: 'Ask anything, with the answers you choose.',
  blurb: 'Type whatever you want to put to a room, write the answers people can pick from, then let them vote. There is no scale to calibrate — just a question, your answers, and a live tally as people pick.',
  ...tone(PALETTE.blue),
  icon: 'flag',
  createdBy: 'PLACER',
  component: OpenVote,
  setup: {
    defaults: defaultVoteSetup,
    problems: voteSetupProblems,
    Form: OpenVoteSetup,
    steps: [
      { title: 'Question', Form: QuestionStep, problems: questionProblems },
      { title: 'Answers', Form: AnswersStep, problems: answerProblems },
    ],
  },
  onProjectPage: {
    heading: 'We want your opinion',
    Embed: OpenVoteOnPage,
  },
  room: {
    empty: emptyVote,
    combine: combineVotes,
    label: (config) => roomText(config?.question),
  },
};
