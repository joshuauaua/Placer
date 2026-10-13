import { describe, it, expect } from 'vite-plus/test';
import { findTool } from '../../tools';
import { emptyQuizState, sampleQuiz } from '../../../lib/popQuiz';

describe("the Pop Quiz's setup and room", () => {
  const { room, setup } = findTool('pop-quiz');
  const quiz = sampleQuiz();

  it('starts from one question still to be written, and accepts a finished quiz', () => {
    expect(setup.problems(setup.defaults())).toEqual(['Write question 1.', 'Fill in all 4 choices for question 1.']);
    expect(setup.problems(quiz)).toEqual([]);
  });

  it('starts a participant with no nickname and nothing answered', () => {
    expect(room.empty()).toEqual(emptyQuizState());
  });

  it('scores the players against the quiz, the highest first, and leaves out the facilitator', () => {
    const combined = room.combine([
      { host: { q: 1, at: 1000, shown: false } },
      { nickname: 'Mara', answers: { 0: { value: 1, ms: 2000 } } },
      { nickname: 'Sam', answers: { 0: { value: 0, ms: 10000 } } },
    ], quiz);

    expect(combined.pace).toEqual({ q: 1, at: 1000, shown: false });
    expect(combined.players.map(({ nickname, score, correct }) => ({ nickname, score, correct }))).toEqual([
      { nickname: 'Sam', score: 750, correct: 1 }, { nickname: 'Mara', score: 0, correct: 0 },
    ]);
  });

  it('is an empty lobby when nobody has joined', () => {
    expect(room.combine([], quiz)).toEqual({ pace: null, players: [] });
  });

  it('ignores a contribution that is missing or malformed', () => {
    // The state comes back from a database that other browsers wrote to.
    const combined = room.combine([null, { nickname: '   ' }, { nickname: 7 }, { host: { q: 'two' } },
      { nickname: 'Mara', answers: 'none' }], quiz);

    expect(combined.pace).toBeNull();
    expect(combined.players).toHaveLength(1);
    expect(combined.players[0]).toMatchObject({ nickname: 'Mara', score: 0 });
  });
});

describe('telling its rooms apart', () => {
  const { room } = findTool('pop-quiz');

  it('labels a room by what it was set up with', () => {
    expect(room.label({ seconds: 20, questions: [{ kind: 'blank', text: 'The square is called ___.', answer: 'Möllan' }] })).toBe('The square is called ___.');
  });

  it('has no label for a room set up with nothing it can use', () => {
    for (const config of [null, {}, 'garbage', { question: 7, prompt: '  ', questions: [], posts: 'none' }]) {
      expect(room.label(config), JSON.stringify(config)).toBeNull();
    }
  });
});
