import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { ChooseToolDialog } from '../ChooseToolDialog';
import { TOOLS } from '../../toolkit/tools';
import { THEME } from '../../theme';

const setup = (props = {}) => {
  const handlers = { onPick: vi.fn(), onClose: vi.fn() };
  render(<ChooseToolDialog t={THEME} category="plan" {...handlers} {...props} />);
  return handlers;
};

const toolsIn = (category) => TOOLS.filter((tool) => tool.category === category);

describe('ChooseToolDialog', () => {
  it('lists every tool of the kind picked, A-Z, and none of the others', () => {
    setup({ category: 'understand' });

    const dialog = screen.getByRole('dialog', { name: 'Understand' });
    const names = within(dialog).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(toolsIn('understand').map((tool) => tool.name).sort((a, b) => a.localeCompare(b)));
    for (const tool of TOOLS.filter((entry) => entry.category !== 'understand')) {
      expect(within(dialog).queryByText(tool.name)).toBeNull();
    }
  });

  it('shows the tools as cards in a large panel, each with its tagline and maker', () => {
    setup({ category: 'plan' });

    const dialog = screen.getByRole('dialog', { name: 'Plan' });
    expect(dialog).toHaveStyle({ maxWidth: '960px' });
    // The kind as a small heading, and what its tools are for under it, in bold.
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Plan' })).toHaveStyle({ fontSize: '15px' });
    expect(within(dialog).getByText('Tools for planning the change, together, in one place.'))
      .toHaveStyle({ fontWeight: '700' });
    expect(within(dialog).getByRole('list', { name: 'Tools' })).toHaveClass('placer-choose-tool-grid');
    const card = within(dialog).getByRole('button', { name: /Co-Budget/ });
    expect(card).toHaveClass('placer-choose-tool-card');
    const budget = TOOLS.find((tool) => tool.id === 'budget-ballot');
    expect(card).toHaveTextContent(budget.tagline);
    expect(card).toHaveTextContent(`By ${budget.createdBy}`);
  });

  it('calls Imagine Re-Imagine, as Create a tool does', () => {
    setup({ category: 'imagine' });

    expect(screen.getByRole('dialog', { name: 'Re-Imagine' })).toBeInTheDocument();
  });

  it('picks a tool by its id', () => {
    const { onPick } = setup();

    fireEvent.click(screen.getByRole('button', { name: /Co-Budget/ }));

    expect(onPick).toHaveBeenCalledWith('budget-ballot');
  });

  it('focuses the first tool, so the list works from the keyboard', () => {
    setup();

    expect(within(screen.getByRole('list', { name: 'Tools' })).getAllByRole('button')[0]).toHaveFocus();
  });

  it('closes from its close button, Escape or a click outside', () => {
    const { onClose } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('Create a tool, in the app', () => {
  it('opens the tools of the kind picked, then which board, then the tool\'s configuration', async () => {
    const location = memoryLocation({ path: '/dashboard', record: true });
    render(<Router hook={location.hook}><App /></Router>);
    const nav = within(await screen.findByRole('navigation', { name: 'App' }));

    fireEvent.click(nav.getByRole('button', { name: 'Create a tool' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Plan/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Plan' });
    // Still on the dashboard underneath: no trip through a gallery.
    expect(location.history.at(-1)).toBe('/dashboard');
    fireEvent.click(within(dialog).getByRole('button', { name: /Co-Budget/ }));

    // Then which board it goes on. Without a Supabase project here, there can be none.
    const board = await screen.findByRole('dialog', { name: 'Add Co-Budget to a board' });
    expect(screen.queryByRole('dialog', { name: 'Plan' })).toBeNull();
    fireEvent.click(within(board).getByRole('button', { name: 'Back' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Plan' }))
      .getByRole('button', { name: /Co-Budget/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add Co-Budget to a board' }))
      .getByRole('button', { name: 'Continue without a board' }));

    expect(location.history.at(-1)).toBe('/toolkit/budget-ballot/configure');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
