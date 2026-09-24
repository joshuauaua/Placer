import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectsPage } from '../ProjectsPage';
import { isSupabaseConfigured, readMyProjects } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readMyProjects: vi.fn(() => Promise.resolve([])),
}));

function setup(props = {}) {
  const handlers = { onNewProject: vi.fn(), onOpenProjectDashboard: vi.fn() };
  render(<ProjectsPage t={THEME} accountId="acct-1" {...handlers} {...props} />);
  return handlers;
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    isSupabaseConfigured.mockReturnValue(true);
    readMyProjects.mockReset();
    readMyProjects.mockResolvedValue([]);
  });

  it('lists the projects you own or collaborate on, and opens one on its dashboard', async () => {
    readMyProjects.mockResolvedValue([
      { id: 'p1', name: 'Harbour steps', description: 'Seating by the water' },
      { id: 'p2', name: 'School street', description: '' },
    ]);
    const { onOpenProjectDashboard } = setup();

    fireEvent.click(await screen.findByRole('button', { name: /Harbour steps/ }));

    expect(readMyProjects).toHaveBeenCalledWith('acct-1');
    expect(screen.getByRole('button', { name: /School street/ })).toBeInTheDocument();
    expect(onOpenProjectDashboard).toHaveBeenCalledWith('p1');
  });

  it('offers to start one when there are none', async () => {
    const { onNewProject } = setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Start a project' }));

    expect(onNewProject).toHaveBeenCalledTimes(1);
  });

  it('says so when your projects cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    readMyProjects.mockRejectedValue(new Error('boom'));
    setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your projects');
  });

  it('asks for nothing with no Supabase project', async () => {
    isSupabaseConfigured.mockReturnValue(false);
    setup();

    expect(await screen.findByText('Projects are not available in this environment.')).toBeInTheDocument();
    expect(readMyProjects).not.toHaveBeenCalled();
  });
});
