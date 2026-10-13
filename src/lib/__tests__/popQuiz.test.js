import { describe, it, expect } from 'vite-plus/test';
import {
  BASE_POINTS, MAX_QUESTIONS, SPEED_POINTS, answerTo, answeredCount, cleanNickname, defaultQuizSetup, elapsed,
  emptyQuestion, isCorrect, normaliseAnswer, paceAt, paceShown, pointsFor, questionProblems, quizSeconds,
  quizSetupProblems, quizStage, readPace, sampleQuiz, scoreOf, timeProblems, withAnswer, withKind,
} from '../popQuiz';

const CHOICE = { kind: 'choice', text: 'Which?', choices: ['One', 'Two', 'Three', 'Four'], correct: 2 };
const BLANK = { kind: 'blank', text: 'The city is ___.', answer: 'São Paulo' };
const QUIZ = { seconds: 20, questions: [CHOICE, BLANK] };

describe('writing a quiz', () => {
  it('starts from one four-choice question, and ships a sample that is ready to play', () => {
    expect(defaultQuizSetup().questions).toEqual([emptyQuestion('choice')]);
    expect(quizSetupProblems(sampleQuiz())).toEqual([]);
    expect(sampleQuiz().questions.map((question) => question.kind)).toContain('blank');
  });

  it('needs at least one question, and takes no more than twenty', () => {
    expect(questionProblems({ questions: [] })).toEqual(['Add at least one question.']);
    expect(questionProblems({ questions: Array.from({ length: MAX_QUESTIONS }, () => CHOICE) })).toEqual([]);
    expect(questionProblems({ questions: Array.from({ length: MAX_QUESTIONS + 1 }, () => CHOICE) }))
      .toEqual(['A quiz can have at most 20 questions.']);
  });

  it('says what is missing from a four-choice question, by its number', () => {
    const problems = (question) => questionProblems({ questions: [CHOICE, question] });

    expect(problems({ ...CHOICE, text: ' ' })).toEqual(['Write question 2.']);
    expect(problems({ ...CHOICE, choices: ['One', '', 'Three', 'Four'] })).toEqual(['Fill in all 4 choices for question 2.']);
    expect(problems({ ...CHOICE, choices: ['One', 'one', 'Three', 'Four'] }))
      .toEqual(['Make the choices for question 2 different from each other.']);
    expect(problems({ ...CHOICE, correct: 4 })).toEqual(['Mark the right answer to question 2.']);
    expect(problems({ ...CHOICE, text: 'x'.repeat(161) })).toHaveLength(1);
    expect(problems({ ...CHOICE, choices: ['One', 'Two', 'Three', 'x'.repeat(61)] })).toHaveLength(1);
  });

  it('says what is missing from a fill-in-the-blank question', () => {
    const problems = (question) => questionProblems({ questions: [question] });

    expect(problems(BLANK)).toEqual([]);
    expect(problems({ ...BLANK, answer: ' ' })).toEqual(['Write the answer to question 1.']);
    expect(problems({ ...BLANK, answer: '?!' })).toEqual(['Write the answer to question 1.']);
    expect(problems({ ...BLANK, answer: 'x'.repeat(41) })).toHaveLength(1);
    expect(problems({ kind: 'essay', text: 'Discuss.' })).toHaveLength(1);
  });

  it('keeps what was asked when a question changes kind', () => {
    expect(withKind(CHOICE, 'blank')).toEqual({ kind: 'blank', text: 'Which?', answer: '' });
    expect(withKind(BLANK, 'choice')).toEqual({ ...emptyQuestion('choice'), text: 'The city is ___.' });
    expect(withKind(CHOICE, 'choice')).toBe(CHOICE);
  });

  it('gives each question 10, 20, 30 or 60 seconds, and 20 when nobody has said', () => {
    expect(timeProblems({})).toEqual([]);
    expect(timeProblems({ seconds: 60 })).toEqual([]);
    expect(timeProblems({ seconds: 45 })).toHaveLength(1);
    expect(quizSeconds({})).toBe(20);
    expect(quizSeconds({ seconds: 30 })).toBe(30);
    expect(quizSeconds({ seconds: 45 })).toBe(20);
  });
});

describe('answering', () => {
  it('compares a typed answer without capitals, accents, punctuation or extra spaces', () => {
    expect(normaliseAnswer('  São  Paulo. ')).toBe('sao paulo');
    expect(normaliseAnswer(15)).toBe('15');
    expect(normaliseAnswer(null)).toBe('');
  });

  it('marks a choice right by its place, and a blank by what it says', () => {
    expect(isCorrect(CHOICE, { value: 2, ms: 100 })).toBe(true);
    expect(isCorrect(CHOICE, { value: 1, ms: 100 })).toBe(false);
    expect(isCorrect(CHOICE, { value: '2', ms: 100 })).toBe(false);
    expect(isCorrect(BLANK, { value: 'sao paulo!', ms: 100 })).toBe(true);
    expect(isCorrect(BLANK, { value: 'Rio', ms: 100 })).toBe(false);
    expect(isCorrect(BLANK, { value: '', ms: 100 })).toBe(false);
  });

  it('never marks a skipped or missing answer right', () => {
    expect(isCorrect(CHOICE, { skipped: true })).toBe(false);
    expect(isCorrect(CHOICE, null)).toBe(false);
  });

  it('keeps a nickname short and tidy', () => {
    expect(cleanNickname('  Mara   the  Great ')).toBe('Mara the Great');
    expect(cleanNickname('x'.repeat(40))).toHaveLength(20);
    expect(cleanNickname(7)).toBe('');
  });
});

describe('scoring', () => {
  it('gives a right answer the base points, and more the sooner it comes', () => {
    expect(pointsFor(CHOICE, { value: 2, ms: 0 }, 20)).toBe(BASE_POINTS + SPEED_POINTS);
    expect(pointsFor(CHOICE, { value: 2, ms: 10000 }, 20)).toBe(BASE_POINTS + SPEED_POINTS / 2);
    expect(pointsFor(CHOICE, { value: 2, ms: 20000 }, 20)).toBe(BASE_POINTS);
    expect(pointsFor(CHOICE, { value: 2, ms: 5000 }, 20)).toBeGreaterThan(pointsFor(CHOICE, { value: 2, ms: 6000 }, 20));
  });

  it('gives nothing for a wrong, skipped or missing answer', () => {
    expect(pointsFor(CHOICE, { value: 0, ms: 0 }, 20)).toBe(0);
    expect(pointsFor(CHOICE, { skipped: true }, 20)).toBe(0);
    expect(pointsFor(CHOICE, null, 20)).toBe(0);
  });

  it('gives only the base for a time it cannot believe', () => {
    expect(pointsFor(CHOICE, { value: 2, ms: -500 }, 20)).toBe(BASE_POINTS + SPEED_POINTS);
    expect(pointsFor(CHOICE, { value: 2, ms: 999999 }, 20)).toBe(BASE_POINTS);
    expect(pointsFor(CHOICE, { value: 2 }, 20)).toBe(BASE_POINTS);
  });

  it('adds a person up over the whole quiz', () => {
    let state = { nickname: 'Mara', answers: {} };
    state = withAnswer(state, 0, { value: 2, ms: 10000 });
    state = withAnswer(state, 1, { skipped: true });

    expect(answerTo(state, 0)).toEqual({ value: 2, ms: 10000 });
    expect(answerTo(state, 5)).toBeNull();
    expect(scoreOf(state, QUIZ)).toEqual({ score: 750, correct: 1 });
    expect(scoreOf({ nickname: 'Sam' }, QUIZ)).toEqual({ score: 0, correct: 0 });
  });

  it('counts who has answered a question, skips included', () => {
    const players = [{ answers: { 0: { value: 1, ms: 5 } } }, { answers: { 0: { skipped: true } } }, { answers: {} }];
    expect(answeredCount(players, 0)).toBe(2);
    expect(answeredCount(players, 1)).toBe(0);
  });
});

describe('the pace', () => {
  it('is the lobby until the first question goes up', () => {
    expect(quizStage(null, QUIZ, 5000)).toEqual({ stage: 'lobby', index: -1, left: null });
  });

  it('has a question open for its time, counting down in whole seconds', () => {
    const pace = paceAt(0, 1000);

    expect(quizStage(pace, QUIZ, 1000)).toEqual({ stage: 'question', index: 0, left: 20 });
    expect(quizStage(pace, QUIZ, 15500)).toEqual({ stage: 'question', index: 0, left: 6 });
  });

  it('closes a question when its time runs out, or its answer is shown', () => {
    const pace = paceAt(0, 1000);

    expect(quizStage(pace, QUIZ, 21000)).toEqual({ stage: 'answer', index: 0, left: 0 });
    expect(quizStage(paceShown(pace), QUIZ, 3000)).toEqual({ stage: 'answer', index: 0, left: 0 });
  });

  it('is over once it is past the last question', () => {
    expect(quizStage(paceAt(2, 1000), QUIZ, 1500)).toEqual({ stage: 'over', index: 2, left: null });
  });

  it('times an answer from when its question went up, within the time allowed', () => {
    const pace = paceAt(0, 1000);

    expect(elapsed(pace, QUIZ, 4500)).toBe(3500);
    expect(elapsed(pace, QUIZ, 500)).toBe(0);
    expect(elapsed(pace, QUIZ, 999999)).toBe(20000);
  });

  it('reads a pace back from a contribution, or not at all', () => {
    expect(readPace({ q: 1, at: 1000, shown: true })).toEqual({ q: 1, at: 1000, shown: true });
    expect(readPace({ q: 1, at: 1000 })).toEqual({ q: 1, at: 1000, shown: false });
    expect(readPace({ q: -1, at: 1000 })).toBeNull();
    expect(readPace({ q: 1 })).toBeNull();
    expect(readPace(undefined)).toBeNull();
  });
});
