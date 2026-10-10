/* PLACER — Poll: ask anything, and choose the answers people pick from.
 *
 * The simplest room there is: a question, the answers the organiser wrote for it
 * (Yes, No and Undecided to begin with) and a headcount, nothing to calibrate. The
 * question and answers are fixed when a room opens; only the vote is sent after that,
 * so what a room's tally reports is exactly the split people actually cast.
 */

export const DEFAULT_QUESTION = 'Yes or No?';

/*
 * The answers a poll offers when nobody has written any: a room opened before answers
 * could be written, or one opened without a setup. Their keys are what those rooms'
 * votes were saved as, so they stay as they are.
 */
export const OPTIONS = [
  { key: 'yes', label: 'Yes', color: '#1E7B3A' },
  { key: 'no', label: 'No', color: '#B3261E' },
  { key: 'undecided', label: 'Undecided', color: '#6E6E6E' },
];

export const DEFAULT_ANSWERS = OPTIONS.map((option) => option.label);

/** The fewest and most answers a poll can offer, and the longest one. */
export const MIN_ANSWERS = 2;
export const MAX_ANSWERS = 10;
export const MAX_ANSWER_LENGTH = 80;

// Yes, No and Undecided keep their colours wherever they appear; any other answer
// takes the next of these, in order.
const SEMANTIC_COLORS = new Map(OPTIONS.map((option) => [option.key, option.color]));
const PALETTE = ['#2F5BD3', '#C2410C', '#7C3AED', '#0F766E', '#B45309', '#BE185D', '#4D7C0F', '#0E7490', '#6D28D9', '#9F1239'];

/**
 * The options a poll offers, from the answers written for it: each answer is its own
 * key, which is why answers have to differ (voteSetupProblems). With no answers
 * written, the poll offers Yes, No and Undecided as it always has.
 */
export function pollOptions(answers) {
  const written = (Array.isArray(answers) ? answers : [])
    .map((answer) => (typeof answer === 'string' ? answer.trim() : ''))
    .filter(Boolean);
  if (written.length === 0) return OPTIONS;

  let next = 0;
  return written.map((label) => ({
    key: label,
    label,
    color: SEMANTIC_COLORS.get(label.toLowerCase()) ?? PALETTE[next++ % PALETTE.length],
  }));
}

/** The state one participant starts from: no vote cast yet. */
export function emptyVote() {
  return { choice: null };
}

/**
 * Everybody's vote, folded into counts and shares. This is also what a solo vote
 * (outside a room) is shown through, so the numbers mean the same thing either way.
 *
 * A malformed or missing contribution — the state comes back from a database other
 * browsers wrote to — is skipped rather than thrown on.
 */
export function tally(votes, options = OPTIONS) {
  const counts = Object.fromEntries(options.map((option) => [option.key, 0]));
  for (const vote of votes ?? []) {
    const choice = vote?.choice;
    if (typeof choice === 'string' && Object.hasOwn(counts, choice)) counts[choice] += 1;
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const shares = Object.fromEntries(
    options.map((option) => [option.key, total === 0 ? 0 : counts[option.key] / total]),
  );

  return { counts, shares, total };
}

/*
 * Setting a vote up for a room. Opened for a project, the question and its answers are
 * the point of the room — they are what the project's page shows — so they are written
 * once, before the room opens, and fixed for its life (supabase/rooms-config.sql).
 * Outside a room, and in a room opened without one, they stay what they always were:
 * typed on screen and never sent anywhere.
 */

/** The longest question a room can be set up with. */
export const MAX_QUESTION_LENGTH = 200;

export function defaultVoteSetup() {
  return { question: '', answers: [...DEFAULT_ANSWERS] };
}

/** What is wrong with a setup, as sentences for the organiser. Empty when it is ready. */
export function voteSetupProblems(setup) {
  return [...questionProblems(setup), ...answerProblems(setup)];
}

/** What is wrong with the setup's question: the first stage of setting a poll up. */
export function questionProblems(setup) {
  const question = typeof setup?.question === 'string' ? setup.question.trim() : '';
  if (!question) return ['Write the question you want people to vote on.'];
  if (question.length > MAX_QUESTION_LENGTH) return [`Keep the question under ${MAX_QUESTION_LENGTH} characters.`];
  return [];
}

/*
 * What is wrong with the setup's answers: the second stage. A room set up before
 * answers could be written has none in its setup, and still offers Yes, No and
 * Undecided — so no answers at all is fine; answers written badly are not.
 */
export function answerProblems(setup) {
  const answers = setup?.answers;
  if (answers === undefined) return [];
  if (!Array.isArray(answers)) return ['Write the answers people can choose from.'];

  const written = answers.map((answer) => (typeof answer === 'string' ? answer.trim() : ''));
  const problems = [];
  if (written.some((answer) => !answer)) problems.push('Fill in every answer, or remove the empty ones.');
  if (written.length < MIN_ANSWERS) problems.push(`Give people at least ${MIN_ANSWERS} answers to choose from.`);
  if (written.length > MAX_ANSWERS) problems.push(`Offer at most ${MAX_ANSWERS} answers.`);
  if (written.some((answer) => answer.length > MAX_ANSWER_LENGTH)) {
    problems.push(`Keep each answer under ${MAX_ANSWER_LENGTH} characters.`);
  }
  const seen = written.filter(Boolean).map((answer) => answer.toLowerCase());
  if (new Set(seen).size !== seen.length) problems.push('Make each answer different from the others.');
  return problems;
}

/** Everybody's vote in a room, counted against the answers it was set up with. */
export function combineVotes(states, config) {
  return tally(states, pollOptions(config?.answers));
}
