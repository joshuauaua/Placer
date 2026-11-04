import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MyTools } from '../MyTools';
import { saveStartedTool } from '../../services/startedTools';
import { THEME } from '../../theme';

describe('MyTools', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the card to create a tool when nothing has been started', () => {
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} />);

    const section = screen.getByRole('region', { name: 'My Tools' });
    const cards = within(section).getAllByRole('listitem');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByRole('button')).toHaveTextContent('Create a tool');
    expect(within(cards[0]).getByRole('button')).toHaveClass('placer-add-tool-card');
    // Just the words: the kinds are in what it opens.
    expect(within(cards[0]).getByRole('button')).not.toHaveTextContent('Understand');
  });

  it('opens Understand, Imagine and Plan from that card, and creates the kind chosen', () => {
    const onCreateTool = vi.fn();
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} onCreateTool={onCreateTool} />);
    const add = screen.getByRole('button', { name: /Create a tool/ });

    fireEvent.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: /Understand/ }));

    expect(onCreateTool).toHaveBeenCalledWith('understand');
    expect(screen.queryByRole('menu')).toBeNull();
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
    // The started tool, then the card to create another, to its right.
    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveTextContent('Create a tool');
    expect(cards[0]).toHaveTextContent('Trees or benches?');
    expect(cards[0]).toHaveTextContent('Poll');
    expect(cards[0]).toHaveTextContent('2 slides');

    fireEvent.click(cards[0]);
    expect(onOpen).toHaveBeenCalledWith('open-vote', 'poll-1');
  });
});

describe('MyTools, a renamed tool', () => {
  beforeEach(() => localStorage.clear());

  it('goes by the name its owner gave it', () => {
    saveStartedTool('a', { id: 'poll-1', tool: 'open-vote', name: 'Tuesday workshop poll',
      slides: [{ id: 's1', setup: { question: 'Trees or benches?', answers: ['Trees', 'Benches'] } }] });
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} />);

    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Tuesday workshop poll');
  });
});
