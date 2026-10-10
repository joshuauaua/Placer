import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ProjectDashboardPage } from '../ProjectDashboardPage';
import {
  addCollaborator,
  addLink,
  deleteProject,
  readCollaborators,
  readLinks,
  readProject,
  readProjectRooms,
  markProjectToolConfigured,
  readConfiguredProjectTools,
  readProjectTools,
  readProjectViews,
  readStats,
  removeCollaborator,
  removeLink,
  saveProjectTools,
  updateProject,
} from '../../services/projects';
import { closeRoom, createRoom, deleteRoom } from '../../services/rooms';
import { decideAccess, readAccessRequests, removeAccess } from '../../services/projects';
import { readPreferences, readProjectResponses, saveProjectResponses } from '../../services/notifications';
import { hostedRoom } from '../../toolkit/rooms';
import { THEME } from '../../theme';

// ProjectSetupPage is rendered in place for "Edit setup" (see the test below) and
// imports from this same module path, so its calls need covering here too.
vi.mock('../../services/projects', async (importOriginal) => ({
  PROJECT_TYPES: (await importOriginal()).PROJECT_TYPES,
  BUDGET_CURRENCIES: (await importOriginal()).BUDGET_CURRENCIES,
  readProjectBudget: vi.fn(() => Promise.resolve(null)),
  saveProjectBudget: vi.fn(() => Promise.resolve()),
  VISIBILITIES: (await importOriginal()).VISIBILITIES,
  readProject: vi.fn(),
  readStats: vi.fn(),
  readProjectViews: vi.fn(() => Promise.resolve({
    total: 158,
    daily: [{ day: '2026-09-26', views: 21 }, { day: '2026-09-27', views: 13 }],
  })),
  readCollaborators: vi.fn(),
  readLinks: vi.fn(),
  readProjectRooms: vi.fn(),
  addCollaborator: vi.fn(() => Promise.resolve({ success: true })),
  removeCollaborator: vi.fn(() => Promise.resolve({ success: true })),
  addLink: vi.fn(),
  removeLink: vi.fn(() => Promise.resolve({ success: true })),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  readProjectTools: vi.fn(() => Promise.resolve([])),
  readConfiguredProjectTools: vi.fn(() => Promise.resolve(new Set())),
  markProjectToolConfigured: vi.fn(() => Promise.resolve()),
  removeProjectImageFile: vi.fn(() => Promise.resolve()),
  readProjectToolConfig: vi.fn(() => Promise.resolve(null)),
  saveProjectToolConfig: vi.fn(() => Promise.resolve()),
  uploadSceneImage: vi.fn(() => Promise.resolve('scenes/proj-1/scene-1.webp')),
  readAccessRequests: vi.fn(() => Promise.resolve([])),
  decideAccess: vi.fn(() => Promise.resolve()),
  removeAccess: vi.fn(() => Promise.resolve()),
  saveProjectTools: vi.fn((projectId, tools) => Promise.resolve(tools)),
  deleteProject: vi.fn(() => Promise.resolve({ success: true })),
}));

// The Notifications card's: the account default is every answer, and this project
// follows it until a test says otherwise.
vi.mock('../../services/notifications', async (importOriginal) => ({
  ...(await importOriginal()),
  readPreferences: vi.fn(() => Promise.resolve({ project_responses: 'every' })),
  readProjectResponses: vi.fn(() => Promise.resolve(null)),
  saveProjectResponses: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rooms', () => ({
  createRoom: vi.fn(() => Promise.resolve({ id: 'room-9', pin: '123456', facilitatorToken: 'facilitator-9' })),
  closeRoom: vi.fn(() => Promise.resolve(true)),
  deleteRoom: vi.fn(() => Promise.resolve(true)),
}));

const PROJECT = {
  id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
  description: '', startDate: null, endDate: null, locations: [],
};

const STATS = { imaginationsCount: 4, imaginationsUpvotes: 19, toolkitRoomsCount: 2 };

const setup = (overrides = {}) => {
  const props = {
    t: THEME, accountId: 'user-1', projectId: PROJECT.id,
    onOpenToolkit: vi.fn(), onOpenRoom: vi.fn(), onNavigateToPublic: vi.fn(),
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
    vi.mocked(readProjectRooms).mockResolvedValue([]);
    vi.mocked(readProjectTools).mockResolvedValue([]);
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

  it('shows the public page\'s total views, and the views per day', async () => {
    setup();

    expect(await screen.findByText('Page views', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('158')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page views' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Views per day/ })).toBeInTheDocument();
    // 21 + 13 across the days loaded.
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(readProjectViews).toHaveBeenCalledWith('proj-1', 30);
  });

  it('switches the chart to the last 7 days', async () => {
    setup();

    fireEvent.click(await screen.findByRole('radio', { name: '7 days' }));

    await waitFor(() => expect(readProjectViews).toHaveBeenCalledWith('proj-1', 7));
  });

  it('leaves the rest of the dashboard alone when the views cannot be read', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProjectViews).mockRejectedValueOnce(new Error('network down'));
    setup();

    expect(await screen.findByText('19')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Page views' })).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    consoleError.mockRestore();
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

  it('adds a tool from the dashboard and goes straight on to configuring it', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    setup();
    await screen.findByRole('button', { name: 'Configure Poll' });

    fireEvent.click(screen.getByRole('button', { name: /Add a Tool/ }));
    // Only the tools the project does not have yet.
    expect(screen.queryByRole('menuitem', { name: 'Poll' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Co-Budget' }));

    expect(saveProjectTools).toHaveBeenCalledWith('proj-1', ['open-vote', 'budget-ballot'], 'user-1');
    expect(await screen.findByRole('dialog', { name: 'Configure Co-Budget' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure Co-Budget' })).toBeInTheDocument();
  });

  it('lists the tools chosen at setup, each waiting to be configured', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'desire-lines']);
    setup();

    expect(await screen.findByRole('button', { name: 'Configure Poll' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure Desire Lines' })).toBeInTheDocument();
    expect(screen.getAllByText('Not configured')).toHaveLength(2);
    expect(readProjectTools).toHaveBeenCalledWith('proj-1');
  });

  it('shows a configured tool, and a room tool with its room open, as live', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['desire-lines', 'open-vote']);
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set(['desire-lines']));
    vi.mocked(readProjectRooms).mockResolvedValue([{
      id: 'room-1', tool: 'open-vote', pin: '123456', facilitatorToken: 'facilitator-1', status: 'open',
      createdAt: '2026-09-27T10:00:00Z', expiresAt: '2026-10-27T10:00:00Z', contributors: 0, joinCode: 'abc',
    }]);
    setup();

    expect(await screen.findByRole('button', { name: 'Configure Desire Lines again' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Live')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Configure Poll' })).not.toBeInTheDocument();
  });

  it('puts a tool with nothing to set up live from its dialog', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['desire-lines']);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Configure Desire Lines' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Get started' }));
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set(['desire-lines']));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Go live' }));

    await waitFor(() => expect(markProjectToolConfigured).toHaveBeenCalledWith('proj-1', 'desire-lines'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Live')).toBeInTheDocument();
  });

  it('configures a room tool by opening the project\'s room with its setup', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Configure Poll' }));
    const dialog = screen.getByRole('dialog', { name: 'Configure Poll' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Get started' }));
    fireEvent.change(within(dialog).getByLabelText('The question'), { target: { value: 'Should the square be car-free?' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    fireEvent.change(within(dialog).getByLabelText('Answer 3'), { target: { value: 'Only at weekends' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and go live' }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('open-vote', 'proj-1', '30d',
      { question: 'Should the square be car-free?', answers: ['Yes', 'No', 'Only at weekends'] }, null));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says so when no tools have been chosen', async () => {
    setup();

    expect(await screen.findByText(/No tools yet/)).toBeInTheDocument();
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

describe('ProjectDashboardPage, a project\'s open rooms', () => {
  const now = Date.now();
  const LONG_ROOM = {
    id: 'room-1', tool: 'open-vote', pin: '839201', joinCode: 'a'.repeat(32),
    facilitatorToken: 'facilitator-1', createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30 * 86400000).toISOString(), status: 'open', contributions: 12,
  };
  const ENDED_ROOM = { ...LONG_ROOM, id: 'room-2', status: 'closed' };

  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readStats).mockResolvedValue(STATS);
    vi.mocked(readCollaborators).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readProjectRooms).mockResolvedValue([LONG_ROOM, ENDED_ROOM]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('opens out a configured tool\'s row to its room, with what it is run with', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    setup();

    expect(await screen.findByRole('heading', { name: 'My Toolkit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add a Tool/ })).toBeInTheDocument();

    const row = await screen.findByRole('button', { name: /Poll/, expanded: false });
    expect(screen.queryByRole('button', { name: /download qr/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Other rooms')).not.toBeInTheDocument();

    fireEvent.click(row);

    const room = within(screen.getByRole('region', { name: 'Poll rooms' }));
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(room.getByText(/12 responses/)).toBeInTheDocument();
    for (const name of [/^open$/i, /download qr/i, /^close$/i, /^delete$/i]) {
      expect(room.getByRole('button', { name })).toBeInTheDocument();
    }

    fireEvent.click(row);
    expect(screen.queryByRole('region', { name: 'Poll rooms' })).not.toBeInTheDocument();
  });

  it('does not open out a tool with no room', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['budget-ballot']);
    setup();

    expect(await screen.findByRole('button', { name: 'Configure Co-Budget' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Co-Budget/, expanded: false })).not.toBeInTheDocument();
  });

  it('lists a room on its own when its tool is no longer on the list', async () => {
    setup();

    expect(await screen.findByText('Other rooms')).toBeInTheDocument();
  });

  it('lists the rooms still open, with how they are going', async () => {
    setup();

    expect(await screen.findByText('Poll')).toBeInTheDocument();
    expect(screen.getByText(/12 responses/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^open$/i })).toHaveLength(1);
  });

  it('lists a room scheduled to start later, with when it starts', async () => {
    vi.mocked(readProjectRooms).mockResolvedValue([{
      ...LONG_ROOM, status: 'scheduled', contributions: 0, opensAt: '2026-11-01T00:00:00Z',
    }]);
    setup();

    expect(await screen.findAllByText(/Starts 1 November 2026/)).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /^open$/i })).toHaveLength(1);
  });

  it('opens a room as its facilitator, from a browser that did not open it', async () => {
    const props = setup();

    fireEvent.click(await screen.findByRole('button', { name: /^open$/i }));

    expect(hostedRoom('room-1')).toEqual({ pin: '839201', token: 'facilitator-1', code: 'a'.repeat(32) });
    expect(props.onOpenRoom).toHaveBeenCalledWith('open-vote', 'room-1');
  });

  it('asks once before closing a room, then closes it with its token', async () => {
    setup();

    const close = await screen.findByRole('button', { name: /^close$/i });
    fireEvent.click(close);
    expect(closeRoom).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /close — confirm/i }));
    await waitFor(() => expect(closeRoom).toHaveBeenCalledWith('room-1', 'facilitator-1'));
  });

  it('asks once before deleting a room, then deletes it with its token', async () => {
    setup();

    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
    expect(deleteRoom).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /delete — confirm/i }));
    await waitFor(() => expect(deleteRoom).toHaveBeenCalledWith('room-1', 'facilitator-1'));
  });

  it('leaves the rest of the dashboard alone when the rooms cannot be read', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProjectRooms).mockRejectedValue(new Error('function project_rooms does not exist'));

    setup();

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.queryByText('Open rooms')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe('ProjectDashboardPage, deleting the project', () => {
  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readStats).mockResolvedValue(STATS);
    vi.mocked(readCollaborators).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readProjectRooms).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // The button on the page opens the dialog; the one inside it does the deleting.
  const openDialog = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /Delete project/ }));
    return screen.getByRole('dialog', { name: 'Delete project' });
  };
  const deleteButton = () =>
    within(screen.getByRole('dialog')).getByRole('button', { name: /Delete project/ });
  const nameField = () => screen.getByLabelText(/to confirm/);

  it('is offered to the owner only', async () => {
    setup({ accountId: 'user-2' });

    await screen.findByRole('heading', { name: PROJECT.name });
    expect(screen.queryByRole('button', { name: /Delete project/ })).not.toBeInTheDocument();
  });

  it('asks in a dialog, which Cancel closes without deleting', async () => {
    setup();
    await screen.findByRole('heading', { name: PROJECT.name });

    expect(screen.queryByLabelText(/to confirm/)).not.toBeInTheDocument();
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it('stays locked until the project name is typed exactly', async () => {
    setup();
    await screen.findByRole('heading', { name: PROJECT.name });
    await openDialog();

    expect(deleteButton()).toBeDisabled();
    fireEvent.change(nameField(), { target: { value: 'Riverside' } });
    expect(deleteButton()).toBeDisabled();
    fireEvent.change(nameField(), { target: { value: PROJECT.name } });
    expect(deleteButton()).not.toBeDisabled();
  });

  it('deletes the project and hands back to the caller', async () => {
    const { onDeleted } = setup({ onDeleted: vi.fn() });
    await screen.findByRole('heading', { name: PROJECT.name });
    await openDialog();

    fireEvent.change(nameField(), { target: { value: PROJECT.name } });
    fireEvent.click(deleteButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteProject).toHaveBeenCalledWith(PROJECT.id);
  });

  it('stays on the dashboard and says why when the delete is refused', async () => {
    vi.mocked(deleteProject).mockRejectedValueOnce(new Error('Could not remove that project: denied'));
    const { onDeleted } = setup({ onDeleted: vi.fn() });
    await screen.findByRole('heading', { name: PROJECT.name });
    await openDialog();

    fireEvent.change(nameField(), { target: { value: PROJECT.name } });
    fireEvent.click(deleteButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove that project');
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

describe('ProjectDashboardPage, notifications', () => {
  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    vi.mocked(readStats).mockResolvedValue(STATS);
    vi.mocked(readCollaborators).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readProjectRooms).mockResolvedValue([]);
  });

  afterEach(() => vi.clearAllMocks());

  const responses = () => screen.findByRole('group', { name: 'Responses' });

  it('follows the default from Settings until this project is set otherwise', async () => {
    vi.mocked(readPreferences).mockResolvedValueOnce({ project_responses: 'session' });
    setup();

    const group = await responses();
    expect(readProjectResponses).toHaveBeenCalledWith('proj-1');
    expect(screen.getByRole('radio', { name: /Use my default/ })).toBeChecked();
    // What the default is, in words, so "Use my default" is not a mystery.
    expect(group).toHaveTextContent('When a session closes, as set in Settings.');
  });

  it('saves a choice for this project, and clears it again with the default', async () => {
    setup();
    await responses();

    fireEvent.click(screen.getByRole('radio', { name: /^Off/ }));
    await waitFor(() => expect(saveProjectResponses).toHaveBeenCalledWith('proj-1', 'off'));
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /Use my default/ }));
    await waitFor(() => expect(saveProjectResponses).toHaveBeenCalledWith('proj-1', null));
  });

  it('puts the choice back and says so when it cannot be saved', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProjectResponses).mockResolvedValueOnce('every');
    vi.mocked(saveProjectResponses).mockRejectedValueOnce(new Error('network down'));
    setup();
    await responses();

    fireEvent.click(screen.getByRole('radio', { name: /^Off/ }));

    expect(await screen.findByText('Could not save that. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Every response/ })).toBeChecked();
    consoleError.mockRestore();
  });
});

describe('ProjectDashboardPage, a private project', () => {
  beforeEach(() => {
    vi.mocked(readProject).mockResolvedValue({ ...PROJECT, visibility: 'private' });
    vi.mocked(readStats).mockResolvedValue(STATS);
    vi.mocked(readCollaborators).mockResolvedValue([]);
    vi.mocked(readLinks).mockResolvedValue([]);
    vi.mocked(readProjectRooms).mockResolvedValue([]);
    vi.mocked(readAccessRequests).mockResolvedValue([
      { userId: 'user-2', displayName: 'Ana', status: 'pending' },
      { userId: 'user-3', displayName: 'Ben', status: 'approved' },
      { userId: 'user-4', displayName: 'Cy', status: 'declined' },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists who is waiting and who is in, but not who was declined', async () => {
    setup();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.queryByText('Cy')).not.toBeInTheDocument();
  });

  it('lets somebody in, or declines them', async () => {
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Let in' }));
    await waitFor(() => expect(decideAccess).toHaveBeenCalledWith('proj-1', 'user-2', true));

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(decideAccess).toHaveBeenCalledWith('proj-1', 'user-2', false));
  });

  it('takes somebody\'s access away', async () => {
    setup();

    await screen.findByText('Ben');
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' }).at(-1));

    await waitFor(() => expect(removeAccess).toHaveBeenCalledWith('proj-1', 'user-3'));
  });

  it('has no access card on a public project', async () => {
    vi.mocked(readProject).mockResolvedValue(PROJECT);
    setup();

    await screen.findByText('4');
    expect(screen.queryByText('Who can see this project')).not.toBeInTheDocument();
  });
});
