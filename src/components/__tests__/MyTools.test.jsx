import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MyTools } from '../MyTools';
import { saveStartedTool } from '../../services/startedTools';
import { THEME } from '../../theme';

describe('MyTools', () => {
  beforeEach(() => localStorage.clear());

  it('says so when nothing has been started', () => {
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'My Tools' })).toHaveTextContent('Nothing started yet.');
  });

  it('lists the account’s started tools by what they ask, and opens one', () => {
    saveStartedTool('a', { id: 'poll-1', tool: 'open-vote', slides: [
      { id: 's1', setup: { question: 'Trees or benches?', answers: ['Trees', 'Benches'] } },
      { id: 's2', setup: { question: 'More light?', answers: ['Yes', 'No'] } },
    ] });
    saveStartedTool('a', { id: 'gone', tool: 'no-such-tool', slides: [] });
    saveStartedTool('b', { id: 'other', tool: 'word-cloud', slides: [] });
    const onOpen = vi.fn();
    render(<MyTools t={THEME} accountId="a" onOpen={onOpen} />);

    const section = screen.getByRole('region', { name: 'My Tools' });
    const cards = within(section).getAllByRole('button');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Trees or benches?');
    expect(cards[0]).toHaveTextContent('Poll');
    expect(cards[0]).toHaveTextContent('2 slides');

    fireEvent.click(cards[0]);
    expect(onOpen).toHaveBeenCalledWith('open-vote', 'poll-1');
  });
});
