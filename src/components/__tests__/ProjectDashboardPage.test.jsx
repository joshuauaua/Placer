import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectDashboardPage } from '../ProjectDashboardPage';
import {
  addCollaborator,
  addLink,
  readCollaborators,
  readLinks,
  readProject,
  readStats,
  removeCollaborator,
  removeLink,
  updateProject,
} from '../../services/projects';
import { THEME } from '../../theme';

// ProjectSetupPage is rendered in place for "Edit setup" (see the test below) and
// imports from this same module path, so its calls need covering here too.
vi.mock('../../services/projects', () => ({
  readProject: vi.fn(),
  readStats: vi.fn(),
  readCollaborators: vi.fn(),
  readLinks: vi.fn(),
  addCollaborator: vi.fn(() => Promise.resolve({ success: true })),
  removeCollaborator: vi.fn(() => Promise.resolve({ success: true })),
  addLink: vi.fn(),
  removeLink: vi.fn(() => Promise.resolve({ success: true })),
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

const PROJECT = {
  id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
  description: '', startDate: null, endDate: null, locations: [],
};

const STATS = { imaginationsCount: 4, imaginationsUpvotes: 19, sandboxRoomsCount: 2 };

const setup = (overrides = {}) => {
  const props = {
    t: THEME, accountId: 'user-1', projectId: PROJECT.id,
    onOpenSandbox: vi.fn(), onNavigateToPublic: vi.fn(),
    ...overrides,
  };
  render(<ProjectDashboardPage {...props} />);
  return props;
};

describe('ProjectDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readStats).mockResolvedValue(STATS);
    vi.mocked(readCollaborators).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the dashboard numbers', async () => {
    setup();

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('says so when the dashboard cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readStats).mockRejectedValue(new Error('network down'));

    setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load this project's dashboard/);
    consoleError.mockRestore();
  });

  it('offers Edit setup to the owner', async () => {
    setup({ accountId: 'user-1' });

    expect(await screen.findByRole('button', { name: /Edit setup/ })).toBeInTheDocument();
  });

  it('has no Edit setup for a collaborator', async () => {
    setup({ accountId: 'user-2' });
    await screen.findByText('Riverside Greenway');

    expect(screen.queryByRole('button', { name: /Edit setup/ })).not.toBeInTheDocument();
  });

  it('edits setup in place and returns to the dashboard with the saved project', async () => {
    vi.mocked(updateProject).mockResolvedValue({ ...PROJECT, name: 'New name' });
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('button', { name: /Edit setup/ }));
    expect(screen.getByRole('heading', { name: 'Edit project' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(await screen.findByRole('heading', { name: 'New name' })).toBeInTheDocument();
  });

  it('cancels out of editing back to the dashboard, unchanged', async () => {
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('button', { name: /Edit setup/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Riverside Greenway' })).toBeInTheDocument();
  });

  it('lists the sandbox experiments and sends you to the one you pick, with the project attached', async () => {
    const { onOpenSandbox } = setup();
    await screen.findByText('Riverside Greenway');

    fireEvent.click(screen.getByRole('button', { name: /Add Sandbox Experiment/ }));
    expect(screen.getByRole('menuitem', { name: 'Budget Ballot' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Budget Ballot' }));

    expect(onOpenSandbox).toHaveBeenCalledWith('proj-1', 'budget-ballot');
  });

  it('lists collaborators, defaulting to just the owner', async () => {
    setup();

    expect(await screen.findByText(/Just Mara Quinn so far/)).toBeInTheDocument();
  });

  it('invites a collaborator by email', async () => {
    setup({ accountId: 'user-1' });
    vi.mocked(readCollaborators).mockResolvedValue([
      { userId: 'user-2', email: 'devon@example.com', displayName: 'Devon Park' },
    ]);
    await screen.findByText(/Just Mara Quinn so far/);

    fireEvent.change(screen.getByLabelText('Invite a collaborator by email'), { target: { value: 'devon@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add collaborator' }));

    await waitFor(() => expect(addCollaborator).toHaveBeenCalledWith('proj-1', 'devon@example.com'));
    expect(await screen.findByText('Devon Park')).toBeInTheDocument();
  });

  it('says so when inviting fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(addCollaborator).mockRejectedValue(new Error('no PLACER account is registered to that email address'));
    setup({ accountId: 'user-1' });
    await screen.findByText(/Just Mara Quinn so far/);

    fireEvent.change(screen.getByLabelText('Invite a collaborator by email'), { target: { value: 'nobody@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add collaborator' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no PLACER account/);
    consoleError.mockRestore();
  });

  it('has no invite form for a collaborator, only the owner', async () => {
    setup({ accountId: 'user-2' });
    await screen.findByText('Riverside Greenway');

    expect(screen.queryByLabelText('Invite a collaborator by email')).not.toBeInTheDocument();
  });

  it('removes a collaborator', async () => {
    vi.mocked(readCollaborators).mockResolvedValue([
      { userId: 'user-2', email: 'devon@example.com', displayName: 'Devon Park' },
    ]);
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(removeCollaborator).toHaveBeenCalledWith('proj-1', 'user-2'));
    expect(screen.queryByText('Devon Park')).not.toBeInTheDocument();
  });

  it('adds a documentation link', async () => {
    vi.mocked(addLink).mockResolvedValue({
      id: 'link-1', title: 'Council report', url: 'https://example.com/report', addedBy: 'user-1',
    });
    setup();
    await screen.findByText('Riverside Greenway');

    fireEvent.change(screen.getByLabelText('Link title'), { target: { value: 'Council report' } });
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://example.com/report' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));

    await waitFor(() => expect(addLink).toHaveBeenCalledWith('proj-1', {
      title: 'Council report', url: 'https://example.com/report', addedBy: 'user-1',
    }));
    expect(await screen.findByRole('link', { name: 'Council report' })).toBeInTheDocument();
  });

  it('removes a link', async () => {
    vi.mocked(readLinks).mockResolvedValue([
      { id: 'link-1', title: 'Council report', url: 'https://example.com/report' },
    ]);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(removeLink).toHaveBeenCalledWith('link-1'));
    expect(screen.queryByRole('link', { name: 'Council report' })).not.toBeInTheDocument();
  });
});
