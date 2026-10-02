import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectExamplesPage } from '../ProjectExamplesPage';
import { isSupabaseConfigured, readAllProjects } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readAllProjects: vi.fn(() => Promise.resolve([])),
}));

describe('ProjectExamplesPage', () => {
  beforeEach(() => {
    isSupabaseConfigured.mockReturnValue(true);
    readAllProjects.mockReset();
    readAllProjects.mockResolvedValue([]);
  });

  it("lists everybody's projects, and opens one on its public page", async () => {
    readAllProjects.mockResolvedValue([
      { id: 'p1', name: 'Harbour steps', description: 'Seating by the water' },
      { id: 'p2', name: 'School street', description: '' },
    ]);
    const onOpenProject = vi.fn();
    render(<ProjectExamplesPage t={THEME} onOpenProject={onOpenProject} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Project Examples' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Harbour steps/ }));

    expect(screen.getByRole('button', { name: /School street/ })).toBeInTheDocument();
    expect(onOpenProject).toHaveBeenCalledWith('p1');
  });

  it('says so when there are none yet', async () => {
    render(<ProjectExamplesPage t={THEME} onOpenProject={vi.fn()} />);

    expect(await screen.findByText('No projects yet. Yours could be the first.')).toBeInTheDocument();
  });

  it('says so when they cannot be loaded', async () => {
    readAllProjects.mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ProjectExamplesPage t={THEME} onOpenProject={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load projects');
  });

  it('does not ask for projects where there is no database', () => {
    isSupabaseConfigured.mockReturnValue(false);
    render(<ProjectExamplesPage t={THEME} onOpenProject={vi.fn()} />);

    expect(screen.getByText('Projects are not available in this environment.')).toBeInTheDocument();
    expect(readAllProjects).not.toHaveBeenCalled();
  });
});
