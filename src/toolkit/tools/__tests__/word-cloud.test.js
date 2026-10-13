import { describe, it, expect } from 'vite-plus/test';
import { findTool } from '../../tools';
import { emptyWords } from '../../../lib/wordCloud';

describe("the Word Cloud's setup", () => {
  it('asks the organiser for the Word Cloud prompt, and keeps the words per person within bounds', () => {
    const { setup } = findTool('word-cloud');
    expect(setup.problems(setup.defaults())).toEqual(['Write what you want people to answer.']);
    expect(setup.problems({ prompt: 'x'.repeat(201) })).toHaveLength(1);
    expect(setup.problems({ prompt: 'One word for the square?' })).toEqual([]);
    expect(setup.problems({ prompt: 'One word for the square?', limit: 5 })).toEqual([]);
    expect(setup.problems({ prompt: 'One word for the square?', limit: 6 })).toHaveLength(1);
    expect(setup.problems({ prompt: 'One word for the square?', limit: 'many' })).toHaveLength(1);
  });

  it('takes a Word Cloud with no timer, or one of 10 to 200 seconds in tens', () => {
    const { setup } = findTool('word-cloud');
    const problems = (timer) => setup.problems({ prompt: 'One word for the square?', limit: 3, timer });

    expect(setup.defaults().timer).toBeNull();
    for (const timer of [null, undefined, 10, 60, 200]) expect(problems(timer), String(timer)).toEqual([]);
    for (const timer of [0, 5, 15, 210, '60']) expect(problems(timer), String(timer)).toHaveLength(1);
  });
});

describe("the Word Cloud's room", () => {
  const { room } = findTool('word-cloud');

  it('starts a participant with no words', () => {
    expect(room.empty()).toEqual(emptyWords());
  });

  it('counts each word by the people who said it, the most said first', () => {
    const combined = room.combine([{ words: ['green', 'quiet'] }, { words: ['Green'] }, { words: ['busy'] }]);

    expect(combined.words).toEqual([
      { word: 'green', count: 2 }, { word: 'busy', count: 1 }, { word: 'quiet', count: 1 },
    ]);
    expect(combined.total).toBe(4);
    expect(combined.people).toBe(3);
  });

  it('is an empty count when nobody has added a word', () => {
    expect(room.combine([])).toEqual({ words: [], total: 0, people: 0 });
  });

  it('ignores a contribution that is missing or malformed', () => {
    // The state comes back from a database that other browsers wrote to.
    const combined = room.combine([{ words: ['green'] }, null, { words: 'green' }, { words: [4, null, '  '] }]);

    expect(combined.words).toEqual([{ word: 'green', count: 1 }]);
    expect(combined.people).toBe(1);
  });

  it('counts no more words from one person than the room was set up to take', () => {
    const config = { prompt: 'One word for the square?', limit: 1 };
    const combined = room.combine([{ words: ['green', 'quiet', 'busy'] }], config);

    expect(combined.words).toEqual([{ word: 'green', count: 1 }]);
  });
});
