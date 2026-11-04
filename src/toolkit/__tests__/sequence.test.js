import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { groupSequences, rememberSequence, rememberedSequence, roomSequence, withSequence } from '../sequence';

const slide = (id, index, next = null, run = 'run-1') => ({ id, config: withSequence({ prompt: id }, { id: run, index, count: 3, next }) });

describe('roomSequence', () => {
  it('reads where a room stands in its run', () => {
    expect(roomSequence(slide('a', 0, 'b').config)).toEqual({ id: 'run-1', index: 0, count: 3, next: 'b' });
    expect(roomSequence(slide('c', 2).config)).toEqual({ id: 'run-1', index: 2, count: 3, next: null });
  });

  it('is null for a room on its own, or one that makes no sense', () => {
    expect(roomSequence({ prompt: 'x' })).toBeNull();
    expect(roomSequence(null)).toBeNull();
    expect(roomSequence({ sequence: { id: 'r', index: 3, count: 3 } })).toBeNull();
    expect(roomSequence({ sequence: { id: 'r', index: 0, count: 1 } })).toBeNull();
  });
});

describe('groupSequences', () => {
  it('puts each run\'s rooms in slide order, and leaves rooms on their own out', () => {
    const runs = groupSequences([slide('c', 2), { id: 'alone', config: {} }, slide('a', 0, 'b'), slide('b', 1, 'c')]);
    expect([...runs.keys()]).toEqual(['run-1']);
    expect(runs.get('run-1').map((room) => room.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('rememberSequence', () => {
  beforeEach(() => localStorage.clear());

  it('keeps a run\'s rooms in this browser', () => {
    expect(rememberedSequence('run-1')).toEqual([]);
    rememberSequence('run-1', ['a', 'b']);
    rememberSequence('run-2', ['c']);
    expect(rememberedSequence('run-1')).toEqual(['a', 'b']);
  });
});
