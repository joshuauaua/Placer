import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SideNav } from '../SideNav';
import { THEME } from '../../theme';

function setup(props = {}) {
  const handlers = { onNavigate: vi.fn(), onExplore: vi.fn(), onNewProject: vi.fn() };
  render(<SideNav t={THEME} view="welcome" {...handlers} {...props} />);
  return handlers;
}

describe('SideNav', () => {
  it('lists the places an account goes back to, in order', () => {
    setup();

    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Explore', 'Sandbox', 'Profile', 'New project', 'Settings']);
  });

  it('wires each item to its own handler', () => {
    const { onNavigate, onExplore, onNewProject } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    expect(onExplore).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(onNewProject).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Sandbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onNavigate.mock.calls.map(([view]) => view)).toEqual(['sandbox', 'profile', 'settings']);
  });

  it('marks the current view, and keeps Profile marked on a project dashboard', () => {
    setup({ view: 'projectDashboard' });

    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });
});
