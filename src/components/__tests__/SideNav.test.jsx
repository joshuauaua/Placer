import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SideNav } from '../SideNav';
import { THEME } from '../../theme';

function setup(props = {}) {
  const handlers = { onNavigate: vi.fn(), onExplore: vi.fn(), onNewProject: vi.fn() };
  render(<SideNav t={THEME} view="welcome" {...handlers} {...props} />);
  return handlers;
}

describe('SideNav', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('puts the collapse toggle and New project first, then the places an account goes back to', () => {
    setup();

    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Collapse side nav', 'New project', 'Explore', 'Projects', 'Sandbox', 'Profile', 'Settings']);
  });

  it('collapses to icons and back, and remembers which', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'App' });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse side nav' }));
    expect(nav).toHaveClass('is-collapsed');
    expect(screen.getByRole('button', { name: 'Expand side nav' })).toHaveAttribute('aria-expanded', 'false');
    // Still named for assistive tech with the labels hidden.
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(localStorage.getItem('placer_side_nav_collapsed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Expand side nav' }));
    expect(nav).not.toHaveClass('is-collapsed');
  });

  it('starts collapsed when it was left that way', () => {
    localStorage.setItem('placer_side_nav_collapsed', 'true');
    setup();

    expect(screen.getByRole('navigation', { name: 'App' })).toHaveClass('is-collapsed');
  });

  it('wires each item to its own handler', () => {
    const { onNavigate, onExplore, onNewProject } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    expect(onExplore).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(onNewProject).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sandbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onNavigate.mock.calls.map(([view]) => view)).toEqual(['projects', 'sandbox', 'profile', 'settings']);
  });

  it('marks the current view, and keeps Projects marked on a project dashboard', () => {
    setup({ view: 'projectDashboard' });

    expect(screen.getByRole('button', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });
});
