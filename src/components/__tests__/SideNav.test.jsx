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

  it('puts the collapse toggle and New project first, then the dashboard, then the other places', () => {
    setup();

    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Collapse side nav', 'New project', 'Dashboard', 'Explore', 'Projects', 'Toolkit', 'Settings']);
  });

  it('shows Organisations only for an account that runs one', () => {
    const { onNavigate } = setup({ showOrganisations: true });

    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Collapse side nav', 'New project', 'Dashboard', 'Explore', 'Projects', 'Organisations', 'Toolkit', 'Settings']);
    fireEvent.click(screen.getByRole('button', { name: 'Organisations' }));
    expect(onNavigate).toHaveBeenCalledWith('organisations');
  });

  it('marks Organisations as the current place on an organisation dashboard', () => {
    setup({ showOrganisations: true, view: 'organisationDashboard' });

    expect(screen.getByRole('button', { name: 'Organisations' })).toHaveAttribute('aria-current', 'page');
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
    fireEvent.click(screen.getByRole('button', { name: 'Toolkit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onNavigate.mock.calls.map(([view]) => view)).toEqual(['projects', 'toolkit', 'dashboard', 'settings']);
  });

  it('marks the current view, and keeps Projects marked on a project dashboard', () => {
    setup({ view: 'projectDashboard' });

    expect(screen.getByRole('button', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });
});

describe('SideNav on a phone', () => {
  // jsdom applies no stylesheet: both forms of a label are in the page here, and
  // index.css shows the short one only in the tab bar below 1024px.
  it('has a short label for each tab whose full one would not fit, keeping the full name for screen readers', () => {
    setup({ showOrganisations: true });

    for (const [full, short] of [['New project', 'New'], ['Dashboard', 'Home'], ['Organisations', 'Orgs']]) {
      const button = screen.getByRole('button', { name: full });
      expect(button.querySelector('.placer-side-nav-label-long')).toHaveTextContent(full);
      expect(button.querySelector('.placer-side-nav-label-short')).toHaveTextContent(short);
    }
  });

  it('gives no short form to a label that already fits', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Explore' }).querySelector('.placer-side-nav-label-short')).toBeNull();
  });
});
