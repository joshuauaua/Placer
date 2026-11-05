import { describe, it, expect } from 'vite-plus/test';
import { hasAnswer } from '../toolkit/useRoom';

describe('hasAnswer', () => {
  it('counts words, a pin or a layout as an answer, and not a cleared one or only a timer', () => {
    expect(hasAnswer({ words: ['green'] })).toBe(true);
    expect(hasAnswer({ pin: { x: 0.1, y: 0.2 } })).toBe(true);
    expect(hasAnswer({ layout: { a: { x: 1, y: 1 } } })).toBe(true);
    expect(hasAnswer({ choice: 2 })).toBe(true);
    expect(hasAnswer({ words: [] })).toBe(false);
    expect(hasAnswer({ pin: null })).toBe(false);
    expect(hasAnswer({ words: [], timer: { endsAt: 1 } })).toBe(false);
    expect(hasAnswer(null)).toBe(false);
  });
});
