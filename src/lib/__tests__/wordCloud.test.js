import { describe, it, expect } from 'vite-plus/test';
import {
  DEFAULT_LIMIT, MAX_LIMIT, MAX_WORD_LENGTH, TIMER_OPTIONS, addWord, cleanWord, cloudTimer, cloudWords, countWords,
  emptyWords, formatCountdown, isPaused, pauseTimer, resumeTimer, roomTimer, secondsLeft, startTimer, stopTimer,
  wordLimit,
} from '../wordCloud';

describe('cleanWord', () => {
  it('counts a word by what it says, not how it was typed', () => {
    expect(cleanWord('  Green ')).toBe('green');
    expect(cleanWord('green!')).toBe('green');
    expect(cleanWord('"More   trees"')).toBe('more trees');
  });

  it('keeps accents, and punctuation inside a word', () => {
    expect(cleanWord('Möllevången')).toBe('möllevången');
    expect(cleanWord('car-free')).toBe('car-free');
  });

  it('is empty when there is no word in it', () => {
    expect(cleanWord('   ')).toBe('');
    expect(cleanWord('?!')).toBe('');
    expect(cleanWord(null)).toBe('');
    expect(cleanWord(7)).toBe('');
  });

  it('cuts a word off at the longest one allowed', () => {
    expect(cleanWord('x'.repeat(MAX_WORD_LENGTH + 10))).toHaveLength(MAX_WORD_LENGTH);
  });
});

describe('wordLimit', () => {
  it('is the default when a room was set up without one', () => {
    expect(wordLimit(null)).toBe(DEFAULT_LIMIT);
    expect(wordLimit({ prompt: 'One word?' })).toBe(DEFAULT_LIMIT);
    expect(wordLimit({ limit: 'many' })).toBe(DEFAULT_LIMIT);
  });

  it('is what the room was set up with, kept within bounds', () => {
    expect(wordLimit({ limit: 1 })).toBe(1);
    expect(wordLimit({ limit: 99 })).toBe(MAX_LIMIT);
    expect(wordLimit({ limit: 0 })).toBe(1);
  });
});

describe('addWord', () => {
  it('starts from no words', () => {
    expect(emptyWords()).toEqual({ words: [] });
  });

  it('adds a word, cleaned', () => {
    expect(addWord(['green'], ' Quiet. ', 3)).toEqual(['green', 'quiet']);
  });

  it('hands the same list back for an empty word, a repeat, or one past the limit', () => {
    const words = ['green', 'quiet'];
    expect(addWord(words, '  ', 3)).toBe(words);
    expect(addWord(words, 'GREEN', 3)).toBe(words);
    expect(addWord(words, 'busy', 2)).toBe(words);
  });
});

describe('countWords', () => {
  it('counts nothing when nobody has said anything', () => {
    expect(countWords([])).toEqual({ words: [], total: 0, people: 0 });
    expect(countWords(null)).toEqual({ words: [], total: 0, people: 0 });
  });

  it('counts a word once per person, however often they said it', () => {
    const result = countWords([{ words: ['green', 'Green', 'green!'] }, { words: ['green'] }]);

    expect(result.words).toEqual([{ word: 'green', count: 2 }]);
    expect(result.people).toBe(2);
  });

  it('puts the most said first, and ties in alphabetical order', () => {
    const result = countWords([{ words: ['quiet', 'busy'] }, { words: ['windy', 'quiet'] }]);

    expect(result.words.map((entry) => entry.word)).toEqual(['quiet', 'busy', 'windy']);
    expect(result.total).toBe(4);
  });

  it('does not count somebody who has taken all their words back', () => {
    expect(countWords([{ words: [] }, { words: ['green'] }]).people).toBe(1);
  });
});

describe('cloudWords', () => {
  const result = countWords([
    { words: ['green', 'quiet', 'busy'] }, { words: ['green', 'quiet'] }, { words: ['green'] },
  ]);

  it('weighs each word from 0, said once, to 1, said the most', () => {
    const weights = Object.fromEntries(cloudWords(result).map((entry) => [entry.word, entry.weight]));

    expect(weights.green).toBe(1);
    expect(weights.busy).toBe(0);
    expect(weights.quiet).toBeGreaterThan(0);
    expect(weights.quiet).toBeLessThan(1);
  });

  it('draws the most said word in the middle, with the rest to either side', () => {
    expect(cloudWords(result).map((entry) => entry.word)).toEqual(['quiet', 'green', 'busy']);
  });

  it('gives every word the same weight when each was said once', () => {
    const flat = cloudWords(countWords([{ words: ['green', 'quiet'] }]));

    expect(new Set(flat.map((entry) => entry.weight)).size).toBe(1);
    expect(flat[0].weight).toBeGreaterThan(0);
    expect(flat[0].weight).toBeLessThan(1);
  });

  it('draws no more than the words it is asked for, keeping the most said', () => {
    const top = cloudWords(result, 2).map((entry) => entry.word);

    expect(top).toHaveLength(2);
    expect(top).toContain('green');
    expect(top).not.toContain('busy');
  });

  it('is empty when there is nothing to draw', () => {
    expect(cloudWords(null)).toEqual([]);
  });
});

describe('the timer', () => {
  it('can be set from 10 to 200 seconds, in tens', () => {
    expect(TIMER_OPTIONS).toHaveLength(20);
    expect(TIMER_OPTIONS[0]).toBe(10);
    expect(TIMER_OPTIONS[1]).toBe(20);
    expect(TIMER_OPTIONS.at(-1)).toBe(200);
  });

  it('is none for a room set up without one, or with one it cannot be', () => {
    expect(cloudTimer(null)).toBeNull();
    expect(cloudTimer({ timer: null })).toBeNull();
    expect(cloudTimer({ timer: 15 })).toBeNull();
    expect(cloudTimer({ timer: 60 })).toBe(60);
  });

  it('has not started until somebody in the room says it has', () => {
    expect(roomTimer([])).toBeNull();
    expect(roomTimer([{ words: ['green'] }, null, { timer: 'soon' }, { timer: { endsAt: 'later' } }])).toBeNull();
  });

  it('is whatever a contribution in the room carries, running or paused', () => {
    expect(roomTimer([{ words: ['green'] }, { words: [], timer: { endsAt: 90000 } }])).toEqual({ endsAt: 90000 });
    expect(roomTimer([{ timer: { pausedLeft: 12000 } }])).toEqual({ pausedLeft: 12000 });
  });

  it('counts down in whole seconds from the start, and stops at none', () => {
    const timer = startTimer(60, 1000);

    expect(secondsLeft(null, 5000)).toBeNull();
    expect(secondsLeft(timer, 1000)).toBe(60);
    expect(secondsLeft(timer, 1500)).toBe(60);
    expect(secondsLeft(timer, 31000)).toBe(30);
    expect(secondsLeft(timer, 61000)).toBe(0);
    expect(secondsLeft(timer, 999999)).toBe(0);
  });

  it('holds still while paused, and carries on from there', () => {
    const paused = pauseTimer(startTimer(60, 1000), 21000);

    expect(isPaused(paused)).toBe(true);
    expect(secondsLeft(paused, 21000)).toBe(40);
    expect(secondsLeft(paused, 999999)).toBe(40);

    const resumed = resumeTimer(paused, 500000);
    expect(isPaused(resumed)).toBe(false);
    expect(secondsLeft(resumed, 500000)).toBe(40);
    expect(secondsLeft(resumed, 510000)).toBe(30);
  });

  it('is over the moment it is stopped, however much it had left', () => {
    expect(secondsLeft(stopTimer(21000), 21000)).toBe(0);
    expect(isPaused(stopTimer(21000))).toBe(false);
  });

  it('shows the time left as minutes and seconds', () => {
    expect(formatCountdown(200)).toBe('3:20');
    expect(formatCountdown(75)).toBe('1:15');
    expect(formatCountdown(9)).toBe('0:09');
  });
});
