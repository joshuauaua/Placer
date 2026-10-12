/* PLACER — Pop Quiz: a quiz a room plays together, scored on being right and being quick.
 *
 * A quiz is up to twenty questions, each either four choices (A to D, one of them
 * right) or a blank to fill in. A right answer earns points, and more of them the
 * sooner it comes; a wrong one, a skipped one, or none before the time runs out earns
 * nothing.
 *
 * In a room the quiz is its setup — written before the room opens and fixed for its
 * life (supabase/rooms-config.sql) — and the facilitator sets the pace: which question
 * is on, when it went up, and whether its answer has been shown. That travels as `host`
 * on the facilitator's own contribution, since a room has no other way to tell
 * everybody in it something. Everybody else's contribution is their nickname and their
 * answers, and the scores are worked out from those against the setup.
 *
 * Nothing here is secret from somebody determined: the setup, right answers included,
 * reaches every browser in the room. It is a pop quiz, not an exam.
 */

/** The fewest and most questions a quiz can have. */
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 20;

/** How many choices a multiple-choice question has, and what they are lettered. */
export const CHOICE_COUNT = 4;
export const LETTERS = ['A', 'B', 'C', 'D'];

/** The longest question, choice, fill-in answer and nickname. */
export const MAX_QUESTION_LENGTH = 160;
export const MAX_CHOICE_LENGTH = 60;
export const MAX_BLANK_LENGTH = 40;
export const MAX_NICKNAME_LENGTH = 20;

/** How long a question can stay up, in seconds, and how long when nobody has said. */
export const TIME_OPTIONS = [10, 20, 30, 60];
export const DEFAULT_SECONDS = 20;

/** A right answer is worth this much however slow, and up to this much more for speed. */
export const BASE_POINTS = 500;
export const SPEED_POINTS = 500;

/** The two kinds of question, in the order they are offered. */
export const KINDS = [
  { id: 'choice', name: 'Four choices' },
  { id: 'blank', name: 'Fill in the blank' },
];

export function emptyQuestion(kind = 'choice') {
  return kind === 'blank'
    ? { kind: 'blank', text: '', answer: '' }
    : { kind: 'choice', text: '', choices: Array.from({ length: CHOICE_COUNT }, () => ''), correct: 0 };
}

/** A question changed to the other kind, keeping what was asked. */
export function withKind(question, kind) {
  if (question.kind === kind) return question;
  return { ...emptyQuestion(kind), text: question.text ?? '' };
}

export function defaultQuizSetup() {
  return { seconds: DEFAULT_SECONDS, questions: [emptyQuestion()] };
}

/** A short quiz to try the tool out with, before writing one. */
export function sampleQuiz() {
  return {
    seconds: DEFAULT_SECONDS,
    questions: [
      {
        kind: 'choice',
        text: 'Who wrote “The Death and Life of Great American Cities”?',
        choices: ['Jane Jacobs', 'Le Corbusier', 'Robert Moses', 'Jan Gehl'],
        correct: 0,
      },
      {
        kind: 'blank',
        text: 'A neighbourhood where daily needs are a short walk away is called the ___-minute city.',
        answer: '15',
      },
      {
        kind: 'choice',
        text: 'What is a “desire line”?',
        choices: [
          'A queue for a popular café',
          'A path worn where people actually walk',
          'A painted cycle lane',
          'The edge of a building plot',
        ],
        correct: 1,
      },
    ],
  };
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** How long each question of a quiz stays up, in seconds. */
export function quizSeconds(config) {
  return TIME_OPTIONS.includes(config?.seconds) ? config.seconds : DEFAULT_SECONDS;
}

/** The questions of a quiz, or none. */
export function quizQuestions(config) {
  return Array.isArray(config?.questions) ? config.questions : [];
}

/** What is wrong with one question, as sentences that name it by its number. */
function oneQuestionProblems(question, number) {
  const problems = [];
  const asked = text(question?.text);
  if (!asked) problems.push(`Write question ${number}.`);
  else if (asked.length > MAX_QUESTION_LENGTH) {
    problems.push(`Keep question ${number} under ${MAX_QUESTION_LENGTH} characters.`);
  }

  if (question?.kind === 'blank') {
    const answer = text(question.answer);
    if (!normaliseAnswer(answer)) problems.push(`Write the answer to question ${number}.`);
    else if (answer.length > MAX_BLANK_LENGTH) {
      problems.push(`Keep the answer to question ${number} under ${MAX_BLANK_LENGTH} characters.`);
    }
    return problems;
  }

  if (question?.kind !== 'choice') return [`Question ${number} is not a kind of question this quiz can ask.`];

  const choices = Array.isArray(question.choices) ? question.choices.map(text) : [];
  if (choices.length !== CHOICE_COUNT || choices.some((choice) => !choice)) {
    problems.push(`Fill in all ${CHOICE_COUNT} choices for question ${number}.`);
  } else {
    if (choices.some((choice) => choice.length > MAX_CHOICE_LENGTH)) {
      problems.push(`Keep each choice for question ${number} under ${MAX_CHOICE_LENGTH} characters.`);
    }
    if (new Set(choices.map((choice) => choice.toLowerCase())).size !== choices.length) {
      problems.push(`Make the choices for question ${number} different from each other.`);
    }
  }
  if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct >= CHOICE_COUNT) {
    problems.push(`Mark the right answer to question ${number}.`);
  }
  return problems;
}

/** What is wrong with the setup's questions: the first stage of writing a quiz. */
export function questionProblems(setup) {
  const questions = setup?.questions;
  if (!Array.isArray(questions) || questions.length < MIN_QUESTIONS) return ['Add at least one question.'];
  if (questions.length > MAX_QUESTIONS) return [`A quiz can have at most ${MAX_QUESTIONS} questions.`];
  return questions.flatMap((question, index) => oneQuestionProblems(question, index + 1));
}

/** What is wrong with the setup's time per question: the second stage. None said is the default. */
export function timeProblems(setup) {
  const seconds = setup?.seconds;
  if (seconds === undefined || TIME_OPTIONS.includes(seconds)) return [];
  return [`Give each question ${TIME_OPTIONS.join(', ')} seconds.`];
}

/** What is wrong with a setup, as sentences for whoever is writing it. Empty when it is ready. */
export function quizSetupProblems(setup) {
  return [...questionProblems(setup), ...timeProblems(setup)];
}

/**
 * A typed answer as it is compared: lower case, no accents, no punctuation and single
 * spaces, so "São Paulo.", "sao paulo" and " Sao  Paulo " are the same answer.
 */
export function normaliseAnswer(value) {
  return String(typeof value === 'string' || typeof value === 'number' ? value : '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A nickname as it is shown: single spaces, and no longer than the longest allowed. */
export function cleanNickname(value) {
  return String(typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim().slice(0, MAX_NICKNAME_LENGTH);
}

/**
 * Whether an answer to a question is right. An answer is `{ value, ms }` — the index of
 * the choice picked, or the text typed — or `{ skipped: true }`, which never is.
 */
export function isCorrect(question, answer) {
  if (!question || !answer || answer.skipped) return false;
  if (question.kind === 'blank') {
    const given = normaliseAnswer(answer.value);
    return Boolean(given) && given === normaliseAnswer(question.answer);
  }
  return Number.isInteger(answer.value) && answer.value === question.correct;
}

/**
 * The points an answer earns: none unless it is right, and then the base plus a share
 * of the speed points for however much of the time was left when it came.
 */
export function pointsFor(question, answer, seconds = DEFAULT_SECONDS) {
  if (!isCorrect(question, answer)) return 0;
  const limit = seconds * 1000;
  const taken = Math.min(limit, Math.max(0, Number.isFinite(answer.ms) ? answer.ms : limit));
  return BASE_POINTS + Math.round(SPEED_POINTS * (1 - taken / limit));
}

/** The state one participant starts from: no nickname, and nothing answered. */
export function emptyQuizState() {
  return { nickname: '', answers: {} };
}

/** One person's answers with one more recorded, for the question at `index`. */
export function withAnswer(state, index, answer) {
  return { ...state, answers: { ...state.answers, [index]: answer } };
}

/** What somebody answered to the question at `index`, or null if they have not. */
export function answerTo(state, index) {
  const answer = state?.answers?.[index];
  return answer && typeof answer === 'object' ? answer : null;
}

/** One person's score over a whole quiz: their points, and how many they got right. */
export function scoreOf(state, config) {
  const seconds = quizSeconds(config);
  let score = 0;
  let correct = 0;
  quizQuestions(config).forEach((question, index) => {
    const points = pointsFor(question, answerTo(state, index), seconds);
    score += points;
    if (points > 0) correct += 1;
  });
  return { score, correct };
}

/*
 * The pace of a quiz: `{ q, at, shown }` — the question that is on (by index; one past
 * the last means the quiz is over), when it went up in milliseconds, and whether its
 * answer has been shown. Null is the lobby, before the first question.
 */

/** A pace as it came back from somewhere else, or null if it is not one. */
export function readPace(value) {
  if (!Number.isInteger(value?.q) || value.q < 0 || !Number.isFinite(value?.at)) return null;
  return { q: value.q, at: value.at, shown: value.shown === true };
}

/** The pace with the question at `index` just put up. */
export function paceAt(index, now = Date.now()) {
  return { q: index, at: now, shown: false };
}

/** The pace with the current question's answer shown. */
export function paceShown(pace) {
  return { ...pace, shown: true };
}

/**
 * Where a quiz is, for somebody looking at it now: 'lobby' before the first question,
 * 'question' while one is up and open, 'answer' once it has closed — its answer shown,
 * or its time run out — and 'over' after the last. With how many whole seconds the
 * open question has left.
 */
export function quizStage(pace, config, now = Date.now()) {
  if (!pace) return { stage: 'lobby', index: -1, left: null };
  const total = quizQuestions(config).length;
  if (pace.q >= total) return { stage: 'over', index: total, left: null };

  const remaining = pace.at + quizSeconds(config) * 1000 - now;
  if (pace.shown || remaining <= 0) return { stage: 'answer', index: pace.q, left: 0 };
  return { stage: 'question', index: pace.q, left: Math.ceil(remaining / 1000) };
}

/** How long into the current question it is now, in milliseconds: what an answer is timed by. */
export function elapsed(pace, config, now = Date.now()) {
  return Math.min(quizSeconds(config) * 1000, Math.max(0, now - (pace?.at ?? now)));
}

/**
 * Everybody's contribution to a room, folded into what the quiz shows: the pace its
 * facilitator has set, and the players — anybody with a nickname — with their scores,
 * the highest first and alphabetical among equals.
 *
 * A malformed or missing contribution — the state comes back from a database other
 * browsers wrote to — is skipped rather than thrown on.
 */
export function combineQuiz(states, config) {
  let pace = null;
  const players = [];
  for (const state of states ?? []) {
    pace = pace ?? readPace(state?.host);
    const nickname = cleanNickname(state?.nickname);
    if (!nickname) continue;
    players.push({ nickname, answers: state.answers ?? {}, ...scoreOf(state, config) });
  }
  players.sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  return { pace, players };
}

/** How many of the players have answered or skipped the question at `index`. */
export function answeredCount(players, index) {
  return (players ?? []).filter((player) => answerTo(player, index)).length;
}
