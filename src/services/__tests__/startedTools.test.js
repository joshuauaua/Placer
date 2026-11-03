import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { listStartedTools, readStartedTool, removeStartedTool, saveStartedTool } from '../startedTools';

describe('startedTools', () => {
  beforeEach(() => localStorage.clear());

  it('keeps a started tool per account, the most recently changed first', () => {
    saveStartedTool('a', { id: 'one', tool: 'open-vote', slides: [{ id: 's1', setup: null }] });
    saveStartedTool('a', { id: 'two', tool: 'word-cloud', slides: [] });
    saveStartedTool('b', { id: 'three', tool: 'pop-quiz', slides: [] });
    saveStartedTool('a', { id: 'one', tool: 'open-vote', slides: [{ id: 's1', setup: { question: 'Hi?' } }] });

    expect(listStartedTools('a').map((entry) => entry.id)).toEqual(['one', 'two']);
    expect(listStartedTools('b').map((entry) => entry.id)).toEqual(['three']);
    expect(readStartedTool('a', 'one').slides[0].setup).toEqual({ question: 'Hi?' });
    expect(readStartedTool('b', 'one')).toBeNull();
  });

  it('keeps the date it was first kept when it is kept again', () => {
    const first = saveStartedTool(null, { id: 'one', tool: 'open-vote', slides: [] });
    const again = saveStartedTool(null, { id: 'one', tool: 'open-vote', slides: [] });

    expect(again.createdAt).toBe(first.createdAt);
    expect(listStartedTools(null)).toHaveLength(1);
  });

  it('forgets one, and treats unreadable storage as nothing kept', () => {
    saveStartedTool('a', { id: 'one', tool: 'open-vote', slides: [] });
    removeStartedTool('a', 'one');
    expect(listStartedTools('a')).toEqual([]);

    localStorage.setItem('placer_started_tools.a', 'not json');
    expect(listStartedTools('a')).toEqual([]);
  });
});
