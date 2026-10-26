import { BudgetBallot } from '../../components/toolkit/BudgetBallot';
import { BudgetBallotOnPage } from '../../components/toolkit/BudgetBallotOnPage';
import { BudgetBallotSetup, BudgetStep, PostsStep } from '../../components/toolkit/BudgetBallotSetup';
import { PALETTE } from '../../theme';
import {
  ballotSetupProblems, budgetProblems, combineBallots, defaultBallotSetup, emptyBallot, postProblems,
} from '../../lib/budgetBallot';
import { counted, roomText, tone } from '../toolParts';

export default {
  id: 'budget-ballot',
  added: '2026-08-27',
  category: 'plan',
  name: 'Co-Budget',
  tagline: 'A fixed budget, more on the list than it buys. Choose.',
  blurb: 'Every post has a price per item, and the money runs out well before the list does. Spend the budget the way you would, and see what the room would fund together.',
  ...tone(PALETTE.orange),
  icon: 'coins',
  createdBy: 'PLACER',
  component: BudgetBallot,
  inquiry: {
    summary: (config) => {
      const posts = Object.entries(config ?? {}).filter(([key, value]) => key !== 'budget' && Number(value) > 0).length;
      return posts > 0 ? counted(posts, 'post funded', 'posts funded') : '';
    },
  },
  onProjectPage: {
    heading: 'How would you spend the budget?',
    Embed: BudgetBallotOnPage,
  },
  setup: {
    defaults: defaultBallotSetup,
    problems: ballotSetupProblems,
    Form: BudgetBallotSetup,
    steps: [
      { title: 'Budget', Form: BudgetStep, problems: budgetProblems },
      { title: 'Posts', Form: PostsStep, problems: postProblems },
    ],
  },
  room: {
    empty: emptyBallot,
    combine: combineBallots,
    label: (config) => roomText(Array.isArray(config?.posts)
      ? config.posts.map((post) => post?.label).filter((label) => typeof label === 'string').join(', ') : null),
  },
};
