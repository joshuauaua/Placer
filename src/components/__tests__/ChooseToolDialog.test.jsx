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

    const dialog = screen.getByRole('dialog', { name: 'Understand tools' });
    const names = within(dialog).getAllByRole('listitem').map((item) => item.querySelector('button span + span span').textContent);
    expect(names).toEqual(toolsIn('understand').map((tool) => tool.name).sort((a, b) => a.localeCompare(b)));
    for (const tool of TOOLS.filter((entry) => entry.category !== 'understand')) {
      expect(within(dialog).queryByText(tool.name)).toBeNull();
    }
  });

  it('calls Imagine Re-Imagine, as Create a tool does', () => {
    setup({ category: 'imagine' });

    expect(screen.getByRole('dialog', { name: 'Re-Imagine tools' })).toBeInTheDocument();
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
  it('opens the tools of the kind picked, and a tool into its configuration', async () => {
    const location = memoryLocation({ path: '/dashboard', record: true });
    render(<Router hook={location.hook}><App /></Router>);
    const nav = within(await screen.findByRole('navigation', { name: 'App' }));

    fireEvent.click(nav.getByRole('button', { name: 'Create a tool' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Plan/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Plan tools' });
    // Still on the dashboard underneath: no trip through a gallery.
    expect(location.history.at(-1)).toBe('/dashboard');
    fireEvent.click(within(dialog).getByRole('button', { name: /Co-Budget/ }));

    expect(location.history.at(-1)).toBe('/toolkit/budget-ballot/configure');
    expect(screen.queryByRole('dialog', { name: 'Plan tools' })).toBeNull();
  });
});
