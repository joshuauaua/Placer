import { describe, it, expect } from 'vite-plus/test';
import { MODES, PROMPTS, addPrompt, deckPrompts, drawPrompt, shuffle, writesOwn } from '../dreamIt';

describe('the prompts', () => {
  it('are all different, and each a question', () => {
    expect(new Set(PROMPTS).size).toBe(PROMPTS.length);
    for (const prompt of PROMPTS) expect(prompt, prompt).toMatch(/\?$/);
  });

  it('include the ones the activity was written with', () => {
    expect(PROMPTS).toContain('If this place had a voice, what would it say?');
    expect(PROMPTS).toContain('Imagine this place in 2050 — what happens here?');
  });
});

describe('shuffle', () => {
  it('keeps every prompt, in a new array', () => {
    const deck = shuffle();

    expect(deck).not.toBe(PROMPTS);
    expect([...deck].sort()).toEqual([...PROMPTS].sort());
  });

  it('orders them by the random numbers it is given', () => {
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
  });
});

describe('drawPrompt', () => {
  it('deals from the top of the deck, and hands back the rest', () => {
    expect(drawPrompt(['a', 'b', 'c'], null)).toEqual({ prompt: 'a', deck: ['b', 'c'] });
  });

  it('reshuffles an empty deck', () => {
    const { prompt, deck } = drawPrompt([], null, { prompts: ['a', 'b', 'c'] });

    expect(['a', 'b', 'c']).toContain(prompt);
    expect(deck).toHaveLength(2);
  });

  it('never deals the prompt that is showing straight after a reshuffle', () => {
    // With these random numbers the shuffle puts 'b' on top.
    expect(drawPrompt([], 'b', { prompts: ['a', 'b', 'c'], random: () => 0 }))
      .toEqual({ prompt: 'c', deck: ['a', 'b'] });
  });

  it('has nothing to deal when there are no prompts', () => {
    expect(drawPrompt([], null, { prompts: [] })).toEqual({ prompt: null, deck: [] });
  });
});

describe('choosing the prompts', () => {
  it('offers the existing ones, your own, or both', () => {
    expect(MODES.map((mode) => mode.id)).toEqual(['existing', 'own', 'both']);
    expect(MODES.map((mode) => writesOwn(mode.id))).toEqual([false, true, true]);
  });

  it('adds a prompt, tidied', () => {
    expect(addPrompt([], '  What   would the trees ask for? ')).toEqual(['What would the trees ask for?']);
  });

  it('hands the same list back for nothing written, or a prompt it already has', () => {
    const own = ['What would the trees ask for?'];
    expect(addPrompt(own, '   ')).toBe(own);
    expect(addPrompt(own, 'what would the TREES ask for?')).toBe(own);
  });

  it('will not add one of the existing prompts again when both are in play', () => {
    expect(addPrompt([], PROMPTS[0], 'both')).toEqual([]);
    expect(addPrompt([], PROMPTS[0], 'own')).toEqual([PROMPTS[0]]);
  });

  it('makes the deck of the existing prompts, your own, or both', () => {
    const own = ['What would the trees ask for?'];
    expect(deckPrompts('existing', own)).toEqual(PROMPTS);
    expect(deckPrompts('own', own)).toEqual(own);
    expect(deckPrompts('both', own)).toEqual([...PROMPTS, ...own]);
    expect(deckPrompts(null, own)).toEqual(PROMPTS);
  });
});
