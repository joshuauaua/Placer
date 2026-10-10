import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { ToolkitPage, projectTrail } from '../ToolkitPage';
import { readProjectCrumb } from '../../services/projects';
import { THEME } from '../../theme';

// With a database, so the project behind ?project= is looked up for the breadcrumb.
vi.mock('../../services/rooms', async (importOriginal) => ({
  ...(await importOriginal()),
  isSupabaseConfigured: () => true,
}));

vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal()),
  readProjectCrumb: vi.fn(),
}));

const renderAt = (path, searchPath = '') => {
  const location = memoryLocation({ path, searchPath, record: true });
  render(<Router hook={location.hook}><ToolkitPage t={THEME} onLaunchTool={vi.fn()} /></Router>);
  return location;
};

const crumbs = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }));

describe('a tool opened for a project', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('leads an organiser back through My Workspace and Projects to the project\'s dashboard', async () => {
    vi.mocked(readProjectCrumb).mockResolvedValue({ name: 'Riverside Greenway', canEdit: true });
    const location = renderAt('/toolkit/reimagine-a-space', 'project=proj-1');

    const project = await screen.findByRole('link', { name: 'Riverside Greenway' });
    expect(crumbs().getByRole('link', { name: 'My Workspace' })).toHaveAttribute('href', '/dashboard');
    expect(crumbs().getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    expect(project).toHaveAttribute('href', '/projects/proj-1/dashboard');
    expect(crumbs().getByText('Idea Visualizer')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'All tools' })).not.toBeInTheDocument();
    expect(readProjectCrumb).toHaveBeenCalledWith('proj-1');

    fireEvent.click(project);
    expect(location.history.at(-1)).toBe('/projects/proj-1/dashboard');
  });

  it('keeps the breadcrumb past the cover, on the tool itself', async () => {
    vi.mocked(readProjectCrumb).mockResolvedValue({ name: 'Riverside Greenway', canEdit: true });
    renderAt('/toolkit/desire-lines', 'project=proj-1');
    await screen.findByRole('link', { name: 'Riverside Greenway' });

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

    expect(crumbs().getByRole('link', { name: 'Riverside Greenway' })).toBeInTheDocument();
    expect(crumbs().getByText('Desire Lines')).toBeInTheDocument();
  });

  it('leads anybody else back to the project\'s public page', async () => {
    vi.mocked(readProjectCrumb).mockResolvedValue({ name: 'Riverside Greenway', canEdit: false });
    renderAt('/toolkit/reimagine-a-space', 'project=proj-1');

    expect(await screen.findByRole('link', { name: 'Riverside Greenway' })).toHaveAttribute('href', '/projects/proj-1');
    expect(crumbs().queryByRole('link', { name: 'My Workspace' })).not.toBeInTheDocument();
  });

  it('still leads back when the project could not be read', async () => {
    vi.mocked(readProjectCrumb).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderAt('/toolkit/reimagine-a-space', 'project=proj-1');

    expect(await screen.findByRole('link', { name: 'Project' })).toHaveAttribute('href', '/projects/proj-1');
  });

  it('is All tools, as before, for a tool opened on its own', () => {
    renderAt('/toolkit/reimagine-a-space');

    expect(screen.getByRole('button', { name: 'All tools' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(readProjectCrumb).not.toHaveBeenCalled();
  });
});

describe('projectTrail', () => {
  it('names the project "Project" until its name is in', () => {
    expect(projectTrail('proj-1', null)).toEqual([{ label: 'Project', href: '/projects/proj-1' }]);
  });
});
