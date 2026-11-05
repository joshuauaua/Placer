import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MyTools } from '../MyTools';
import { listStartedTools, saveStartedTool } from '../../services/startedTools';
import { THEME } from '../../theme';

describe('MyTools', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the card to create a tool when nothing has been started', async () => {
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} />);

    const section = screen.getByRole('region', { name: 'My Tools' });
    const cards = within(section).getAllByRole('listitem');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByRole('button')).toHaveTextContent('Create a tool');
    expect(within(cards[0]).getByRole('button')).toHaveClass('placer-add-tool-card');
    // Just the words: the kinds are in what it opens.
    expect(within(cards[0]).getByRole('button')).not.toHaveTextContent('Understand');
  });

  it('opens Understand, Imagine and Plan from that card, and creates the kind chosen', async () => {
    const onCreateTool = vi.fn();
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} onCreateTool={onCreateTool} />);
    const add = screen.getByRole('button', { name: /Create a tool/ });

    fireEvent.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: /Understand/ }));

    expect(onCreateTool).toHaveBeenCalledWith('understand');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lists the account’s started tools by what they ask, and opens one', async () => {
    await saveStartedTool('a', { id: 'poll-1', tool: 'open-vote', slides: [
      { id: 's1', setup: { question: 'Trees or benches?', answers: ['Trees', 'Benches'] } },
      { id: 's2', setup: { question: 'More light?', answers: ['Yes', 'No'] } },
    ] });
    await saveStartedTool('a', { id: 'gone', tool: 'no-such-tool', slides: [] });
    await saveStartedTool('b', { id: 'other', tool: 'word-cloud', slides: [] });
    const onOpen = vi.fn();
    render(<MyTools t={THEME} accountId="a" onOpen={onOpen} />);

    const section = screen.getByRole('region', { name: 'My Tools' });
    await within(section).findByText('Trees or benches?');
    // The cards, not the row's ‹ › buttons.
    const cards = within(section).getAllByRole('listitem').map((item) => within(item).getAllByRole('button')[0]);
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

describe('MyTools, deleting a tool', () => {
  beforeEach(() => localStorage.clear());

  it('asks first, then deletes the tool from the row and from what is kept', async () => {
    await saveStartedTool('a', { id: 'poll-1', tool: 'open-vote', name: 'Tuesday workshop poll', slides: [] });
    await saveStartedTool('a', { id: 'cloud-1', tool: 'word-cloud', name: 'Street words', slides: [] });
    const onOpen = vi.fn();
    render(<MyTools t={THEME} accountId="a" onOpen={onOpen} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Tuesday workshop poll' }));
    // Once only asks.
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    const confirm = screen.getByRole('button', { name: /^Delete Tuesday workshop poll\? Press again/ });
    expect(confirm).toHaveTextContent('Delete?');

    fireEvent.click(confirm);
    expect(screen.queryByText('Tuesday workshop poll')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await waitFor(async () => expect((await listStartedTools('a')).map((entry) => entry.id)).toEqual(['cloud-1']));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('stops asking when you leave the bin', async () => {
    await saveStartedTool('a', { id: 'poll-1', tool: 'open-vote', name: 'Tuesday workshop poll', slides: [] });
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} />);

    const bin = await screen.findByRole('button', { name: 'Delete Tuesday workshop poll' });
    fireEvent.click(bin);
    fireEvent.blur(bin);

    expect(bin).toHaveAccessibleName('Delete Tuesday workshop poll');
    await expect(listStartedTools('a')).resolves.toHaveLength(1);
  });
});

describe('MyTools, a renamed tool', () => {
  beforeEach(() => localStorage.clear());

  it('goes by the name its owner gave it', async () => {
    await saveStartedTool('a', { id: 'poll-1', tool: 'open-vote', name: 'Tuesday workshop poll',
      slides: [{ id: 's1', setup: { question: 'Trees or benches?', answers: ['Trees', 'Benches'] } }] });
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} />);

    expect(await screen.findByText('Tuesday workshop poll')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Tuesday workshop poll');
  });
});

describe('MyTools, as a row of cards', () => {
  beforeEach(() => localStorage.clear());

  it('has its title as written, and ‹ › at its end that do nothing while it all fits', async () => {
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} />);

    const title = screen.getByRole('heading', { level: 2, name: 'My Tools' });
    expect(title).not.toHaveStyle({ textTransform: 'uppercase' });
    expect(screen.getByRole('button', { name: 'My Tools: back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'My Tools: more' })).toBeDisabled();
  });
});
