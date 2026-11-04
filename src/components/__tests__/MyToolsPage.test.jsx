import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { MyToolsPage } from '../MyToolsPage';
import { MyTools } from '../MyTools';
import { saveStartedTool } from '../../services/startedTools';
import { THEME } from '../../theme';

const startSome = (count) => {
  const tools = ['open-vote', 'word-cloud', 'budget-ballot', 'pop-quiz', 'desire-lines', 'street-mixer'];
  for (let i = 0; i < count; i += 1) {
    saveStartedTool('a', { id: `t${i}`, tool: tools[i % tools.length], name: `Workshop tool ${i + 1}`, slides: [] });
  }
};

describe('MyToolsPage', () => {
  beforeEach(() => localStorage.clear());

  it('lists every started tool in a grid, then the card to create another', () => {
    startSome(6);
    const onOpen = vi.fn();
    render(<MyToolsPage t={THEME} accountId="a" onOpen={onOpen} />);

    expect(screen.getByRole('heading', { level: 1, name: 'My Tools' })).toBeInTheDocument();
    expect(screen.getByText('6 tools you have started, the most recently changed first.')).toBeInTheDocument();
    const cards = within(screen.getByRole('list', { name: 'My Tools' })).getAllByRole('listitem');
    expect(cards).toHaveLength(7);
    expect(cards.at(-1)).toHaveTextContent('Create a tool');

    fireEvent.click(within(cards[0]).getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('street-mixer', 't5');
  });

  it('says so when nothing has been started, with the card to create one', () => {
    render(<MyToolsPage t={THEME} accountId="a" onOpen={vi.fn()} />);

    expect(screen.getByText('Nothing started yet. Create a tool to begin.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('is reached from the dashboard row\'s View all', () => {
    const onViewAll = vi.fn();
    render(<MyTools t={THEME} accountId="a" onOpen={vi.fn()} onViewAll={onViewAll} />);

    fireEvent.click(screen.getByRole('button', { name: 'View all' }));
    expect(onViewAll).toHaveBeenCalled();
  });

  it('has an address of its own, /my-tools, with the side nav marking it', async () => {
    const { hook } = memoryLocation({ path: '/my-tools' });
    render(<Router hook={hook}><App /></Router>);

    expect(await screen.findByRole('heading', { level: 1, name: 'My Tools' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'App' })).getByRole('button', { name: 'My Tools' }))
      .toHaveAttribute('aria-current', 'page');
  });
});
