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
  removeProjectImageFile,
  readProjectToolConfig,
  saveProjectTools,
  updateProject,
} from '../../services/projects';
import { closeRoom, createRoom, deleteRoom, rescheduleRoom, setRoomCloses } from '../../services/rooms';
import { decideAccess, readAccessRequests, removeAccess } from '../../services/projects';
import { readPreferences, readProjectResponses, saveProjectResponses } from '../../services/notifications';
import { hostedRoom } from '../../toolkit/rooms';
import { downloadQrSvg } from '../../lib/qrDownload';
import { THEME } from '../../theme';

// ProjectSetupPage is rendered in place for "Edit setup" (see the test below) and
// imports from this same module path, so its calls need covering here too.
vi.mock('../../services/projectPage', () => ({
  readProjectSummary: vi.fn(() => Promise.resolve({ views: 158, followers: 6, interactions: 31,
    owner: null, collaborators: [], canPostUpdate: true })),
  readUpdates: vi.fn(() => Promise.resolve([{ id: 'u1' }, { id: 'u2' }])),
  readComments: vi.fn(() => Promise.resolve([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }])),
}));

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
    // 30 days, oldest first: 1 a day, and 5 on each of the last 7.
    daily: Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, '0')}`,
      views: i >= 23 ? 5 : 1 })),
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
  uploadProjectGalleryImage: vi.fn(),
  GALLERY_MAX: 12,
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

vi.mock('../../lib/qrDownload', () => ({ downloadQrSvg: vi.fn(() => true) }));

vi.mock('../../services/rooms', () => ({
  createRoom: vi.fn(() => Promise.resolve({ id: 'room-9', pin: '123456', facilitatorToken: 'facilitator-9' })),
  rescheduleRoom: vi.fn(() => Promise.resolve({})),
  setRoomCloses: vi.fn(() => Promise.resolve('2026-11-21T00:00:00Z')),
  closeRoom: vi.fn(() => Promise.resolve(true)),
  deleteRoom: vi.fn(() => Promise.resolve(true)),
  readProjectOpenRooms: vi.fn(() => Promise.resolve([])),
}));

const PROJECT = {
  id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
  description: '', startDate: null, endDate: null, locations: [],
};

const STATS = { imaginationsCount: 4, imaginationsUpvotes: 19, toolkitRoomsCount: 2 };

// The tab the dashboard opens on: each group of tests below sets the one its part of
// the dashboard is under, and a test can set it for itself.
let tab = 'general';
beforeEach(() => { tab = 'general'; });

const setup = (overrides = {}) => {
  const props = {
    t: THEME, accountId: 'user-1', projectId: PROJECT.id, initialTab: tab,
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

  it('has Project Settings, My Toolkit and Project Insights tabs, opening on Project Settings', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    // As App opens it, with no tab asked for.
    render(<ProjectDashboardPage t={THEME} accountId="user-1" projectId={PROJECT.id}
      onOpenToolkit={vi.fn()} onOpenRoom={vi.fn()} onNavigateToPublic={vi.fn()} />);

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((each) => each.textContent)).toEqual(['Project Settings', 'My Toolkit', 'Project Insights']);
    expect(screen.getByRole('tab', { name: 'Project Settings' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Collaborators' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Project Insights' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reference Material' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Toolkit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Collaborators' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'My Toolkit' }));
    expect(screen.getByRole('heading', { name: 'My Toolkit' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reference Material' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Project Settings' }));
    const settings = within(screen.getByRole('tabpanel', { name: 'Project Settings' }));
    for (const heading of ['Project setup', 'Collaborators', 'Reference Material']) {
      expect(settings.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(settings.getByRole('button', { name: /Delete project/ })).toBeInTheDocument();
  });

  it('opens the setup from Project Settings', async () => {
    tab = 'settings';
    setup();

    fireEvent.click(within(await screen.findByRole('tabpanel', { name: 'Project Settings' }))
      .getByRole('button', { name: /Edit setup/ }));

    expect(await screen.findByRole('button', { name: /Save|Update/ })).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    tab = 'settings';
    setup();

    fireEvent.keyDown(await screen.findByRole('tab', { name: 'Project Settings' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'My Toolkit' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'My Toolkit' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Project Insights' })).toHaveAttribute('aria-selected', 'true');
  });

  // The value beside a row of the insights table, found by its label (its note aside).
  const insight = (label) => {
    const header = screen.getAllByRole('rowheader').find((th) => th.firstChild.textContent === label);
    return within(header.closest('tr')).getByRole('cell').textContent;
  };

  it('shows all its insights in one table', async () => {
    setup();

    const table = await screen.findByRole('table');
    await waitFor(() => expect(insight('Followers')).toBe('6'));
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent))
      .toEqual(['Audience', 'Participation', 'Project']);
    expect(insight('Page views')).toBe('158');
    // 23 days at 1, and 7 at 5.
    expect(insight('Page views, last 30 days')).toBe('58');
    expect(insight('Page views, last 7 days')).toBe('35');
    expect(insight('Interactions')).toBe('31');
    expect(insight('Toolkit sessions')).toBe('2');
    expect(insight('Imaginations')).toBe('4');
    expect(insight('Votes on imaginations')).toBe('19');
    expect(insight('Comments')).toBe('3');
    expect(insight('Updates posted')).toBe('2');
    expect(insight('People involved')).toBe('1');
    expect(readProjectViews).toHaveBeenCalledWith('proj-1', 30);

    // No chart or period switch any more.
    expect(screen.queryByRole('img', { name: /Views per day/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '7 days' })).not.toBeInTheDocument();
  });

  it('counts responses and open rooms from the project\'s rooms, and tools live of those added', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'street-mixer']);
    vi.mocked(readProjectRooms).mockResolvedValue([
      { id: 'r1', tool: 'open-vote', status: 'open', contributions: 12, createdAt: '2026-09-27T10:00:00Z',
        expiresAt: '2026-10-27T10:00:00Z', pin: '1', facilitatorToken: 'f', joinCode: 'a' },
      { id: 'r2', tool: 'open-vote', status: 'closed', contributions: 5, createdAt: '2026-09-01T10:00:00Z',
        expiresAt: '2026-09-02T10:00:00Z', pin: '2', facilitatorToken: 'g', joinCode: 'b' },
    ]);
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set());
    setup();

    await screen.findByRole('table');
    await waitFor(() => expect(insight('Toolkit responses')).toBe('17'));
    expect(insight('Rooms open now')).toBe('1');
    expect(insight('Tools live')).toBe('1 of 2');
  });

  it('shows a dash for what could not be read, and keeps the rest', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readProjectViews).mockRejectedValueOnce(new Error('network down'));
    setup();

    await screen.findByRole('table');
    await waitFor(() => expect(insight('Followers')).toBe('6'));
    expect(insight('Page views')).toBe('–');
    expect(insight('Page views, last 7 days')).toBe('–');
    expect(insight('Imaginations')).toBe('4');
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

  it('offers Edit setup to the owner, once, on Project Settings', async () => {
    tab = 'settings';
    setup({ accountId: 'user-1' });

    expect(await screen.findAllByRole('button', { name: /Edit setup/ })).toHaveLength(1);
    expect(within(screen.getByRole('tabpanel', { name: 'Project Settings' }))
      .getByRole('button', { name: /Edit setup/ })).toBeInTheDocument();
  });

  it('has no Edit setup on the other tabs', async () => {
    setup({ accountId: 'user-1' });
    await screen.findByText('Riverside Greenway');

    expect(screen.queryByRole('button', { name: /Edit setup/ })).not.toBeInTheDocument();
  });

  it('offers Edit setup to a collaborator too', async () => {
    tab = 'settings';
    setup({ accountId: 'user-2' });
    await screen.findByText('Riverside Greenway');

    expect(screen.getByRole('button', { name: /Edit setup/ })).toBeInTheDocument();
  });

  it('edits setup in place and returns to the dashboard with the saved project', async () => {
    tab = 'settings';
    vi.mocked(updateProject).mockResolvedValue({ ...PROJECT, name: 'New name' });
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('button', { name: /Edit setup/ }));
    expect(screen.getByRole('heading', { name: 'Edit project' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(await screen.findByRole('heading', { name: 'New name' })).toBeInTheDocument();
  });

  it('cancels out of editing back to the dashboard, unchanged', async () => {
    tab = 'settings';
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('button', { name: /Edit setup/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Riverside Greenway' })).toBeInTheDocument();
  });

  it('adds a tool from a dialog of the tools, to the list, without configuring it yet', async () => {
    tab = 'toolkit';
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    setup();
    await screen.findByRole('button', { name: 'Configure Poll' });

    const add = screen.getByRole('button', { name: 'Add a tool' });
    expect(add).toHaveTextContent('');
    fireEvent.click(add);
    const dialog = within(screen.getByRole('dialog', { name: 'Add a tool' }));
    // The tools the project does not have yet, in a list per category — and the Poll it
    // has, since a tool that runs in a room can be added again as another room.
    expect(dialog.getByRole('button', { name: /^Poll/ })).toBeInTheDocument();
    expect(dialog.getAllByRole('list').map((list) => list.getAttribute('aria-labelledby')))
      .toEqual(['add-tool-understand', 'add-tool-imagine', 'add-tool-plan']);
    expect(within(dialog.getByRole('list', { name: 'Plan' })).getByRole('button', { name: /^Co-Budget/ }))
      .toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: /^Co-Budget/ }));

    expect(saveProjectTools).toHaveBeenCalledWith('proj-1', ['open-vote', 'budget-ballot'], 'user-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Configure Co-Budget' })).toBeInTheDocument();
    expect(screen.getAllByText('Not configured')).toHaveLength(2);
  });

  it('closes the dialog of tools without adding one', async () => {
    tab = 'toolkit';
    vi.mocked(readProjectTools).mockResolvedValue([]);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Add a tool' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add a tool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(saveProjectTools).not.toHaveBeenCalled();
  });

  it('lists the tools chosen at setup, each waiting to be configured', async () => {
    tab = 'toolkit';
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'street-mixer']);
    setup();

    expect(await screen.findByRole('button', { name: 'Configure Poll' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure Street Section Mixer' })).toBeInTheDocument();
    expect(screen.getAllByText('Not configured')).toHaveLength(2);
    expect(readProjectTools).toHaveBeenCalledWith('proj-1');
  });

  it('removes a tool, once asked again, and Cancel keeps it', async () => {
    tab = 'toolkit';
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'street-mixer']);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Poll' }));
    expect(screen.getByText('Remove Poll and its setup?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(saveProjectTools).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Poll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Poll' }));

    await waitFor(() => expect(saveProjectTools).toHaveBeenCalledWith('proj-1', ['street-mixer'], 'user-1'));
    expect(screen.queryByRole('button', { name: 'Configure Poll' })).not.toBeInTheDocument();
    expect(removeProjectImageFile).not.toHaveBeenCalled();
  });

  it('deletes Idea Visualizer\'s base image when it is removed', async () => {
    tab = 'toolkit';
    vi.mocked(readProjectTools).mockResolvedValue(['reimagine-a-space']);
    vi.mocked(readProjectToolConfig).mockResolvedValue({ imagePath: 'scenes/proj-1/scene-0.webp' });
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Idea Visualizer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove Idea Visualizer' }));

    await waitFor(() => expect(removeProjectImageFile).toHaveBeenCalledWith('scenes/proj-1/scene-0.webp'));
    expect(saveProjectTools).toHaveBeenCalledWith('proj-1', [], 'user-1');
  });

  it('shows a configured tool, and a room tool with its room open, as live', async () => {
    tab = 'toolkit';
    vi.mocked(readProjectTools).mockResolvedValue(['street-mixer', 'open-vote']);
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set(['street-mixer']));
    vi.mocked(readProjectRooms).mockResolvedValue([{
      id: 'room-1', tool: 'open-vote', pin: '123456', facilitatorToken: 'facilitator-1', status: 'open',
      createdAt: '2026-09-27T10:00:00Z', expiresAt: '2026-10-27T10:00:00Z', contributors: 0, joinCode: 'abc',
    }]);
    setup();

    expect(await screen.findByRole('button', { name: 'Edit Street Section Mixer' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Live')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Configure Poll' })).not.toBeInTheDocument();
  });

  it('puts a tool with nothing to set up live from its dialog', async () => {
    tab = 'toolkit';
    vi.mocked(readProjectTools).mockResolvedValue(['street-mixer']);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Configure Street Section Mixer' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Get started' }));
    vi.mocked(readConfiguredProjectTools).mockResolvedValueOnce(new Set(['street-mixer']));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Go live' }));

    await waitFor(() => expect(markProjectToolConfigured).toHaveBeenCalledWith('proj-1', 'street-mixer'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Live')).toBeInTheDocument();
  });

  it('configures a room tool by opening the project\'s room with its setup', async () => {
    tab = 'toolkit';
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
    tab = 'toolkit';
    setup();

    expect(await screen.findByText(/No tools yet/)).toBeInTheDocument();
  });

  it('lists collaborators, defaulting to just the owner', async () => {
    tab = 'settings';
    setup();

    expect(await screen.findByText(/Just Mara Quinn so far/)).toBeInTheDocument();
  });

  it('invites a collaborator by email', async () => {
    tab = 'settings';
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
    tab = 'settings';
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
    tab = 'settings';
    vi.mocked(readCollaborators).mockResolvedValue([
      { userId: 'user-2', email: 'devon@example.com', displayName: 'Devon Park' },
    ]);
    setup({ accountId: 'user-1' });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(removeCollaborator).toHaveBeenCalledWith('proj-1', 'user-2'));
    expect(screen.queryByText('Devon Park')).not.toBeInTheDocument();
  });

  it('adds a link to the reference material', async () => {
    vi.mocked(addLink).mockResolvedValue({
      id: 'link-1', title: 'Council report', url: 'https://example.com/report', addedBy: 'user-1',
    });
    setup();
    await screen.findByText('Riverside Greenway');
    fireEvent.click(screen.getByRole('tab', { name: 'Project Settings' }));

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
    fireEvent.click(await screen.findByRole('tab', { name: 'Project Settings' }));
    const documentation = within(screen.getByRole('heading', { name: 'Reference Material' }).closest('section'));

    fireEvent.click(await documentation.findByRole('button', { name: 'Remove' }));

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
    tab = 'toolkit';
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
    expect(screen.getByRole('button', { name: 'Add a tool' })).toBeInTheDocument();

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
    // The code is not shown, only kept to download.
    expect(room.queryByRole('img', { name: /Join/ })).not.toBeInTheDocument();
    fireEvent.click(room.getByRole('button', { name: /download qr/i }));
    const [container, filename] = vi.mocked(downloadQrSvg).mock.calls[0];
    expect(container).not.toBeVisible();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(filename).toBe('placer-open-vote-qr.svg');

    fireEvent.click(row);
    expect(screen.queryByRole('region', { name: 'Poll rooms' })).not.toBeInTheDocument();
  });

  it('opens another room of a tool that has one live from the Add a tool dialog, set up on its own', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    setup();

    await screen.findByRole('button', { name: 'Edit Poll' });
    expect(screen.queryByRole('button', { name: /Open another/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a tool' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add a tool' })).getByRole('button', { name: /^Poll/ }));
    expect(saveProjectTools).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Configure Poll' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Get started' }));
    fireEvent.change(within(dialog).getByLabelText('The question'), { target: { value: 'Do we need more benches?' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and go live' }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith('open-vote', 'proj-1', '30d',
      { question: 'Do we need more benches?', answers: ['Yes', 'No', 'Undecided'] }, null));
    expect(closeRoom).not.toHaveBeenCalled();
  });

  it("edits a tool's only room straight from its row", async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Poll' }));

    expect(screen.getByRole('dialog', { name: 'Change when it closes' })).toBeInTheDocument();
  });

  it('opens the row out to its rooms when Edit has several to choose from', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectRooms).mockResolvedValue([
      { ...LONG_ROOM, config: { question: 'Should the square be car-free?' } },
      { ...LONG_ROOM, id: 'room-3', config: { question: 'Do we need more benches?' } },
    ]);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Poll' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const rooms = within(screen.getByRole('region', { name: 'Poll rooms' }));
    expect(rooms.getByRole('button', { name: 'Change when Should the square be car-free? closes' })).toBeInTheDocument();
    expect(rooms.getByRole('button', { name: 'Change when Do we need more benches? closes' })).toBeInTheDocument();
  });

  it('has only Configure or Edit on each row, never Open another', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote', 'street-mixer']);
    setup();

    expect(await screen.findByRole('button', { name: 'Edit Poll' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure Street Section Mixer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open another/ })).not.toBeInTheDocument();
  });

  it('tells a tool\'s live rooms apart by what each was set up with', async () => {
    vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
    vi.mocked(readProjectRooms).mockResolvedValue([
      { ...LONG_ROOM, config: { question: 'Should the square be car-free?' } },
      { ...LONG_ROOM, id: 'room-3', contributions: 4, config: { question: 'Do we need more benches?' } },
    ]);
    setup();

    expect(await screen.findByText('2 live')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Poll/, expanded: false }));

    const rooms = within(screen.getByRole('region', { name: 'Poll rooms' }));
    expect(rooms.getByText('Should the square be car-free?')).toBeInTheDocument();
    expect(rooms.getByText('Do we need more benches?')).toBeInTheDocument();
    expect(rooms.getAllByRole('button', { name: /download qr/i })).toHaveLength(2);
  });

  describe('changing a room', () => {
    // Local noon on 10 October 2026, so the calendar's days are the same everywhere.
    const NOW = new Date(2026, 9, 10, 12);
    const DAY = 86400000;
    const pollRow = async () => fireEvent.click(await screen.findByRole('button', { name: /Poll/, expanded: false }));

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it('edits all of a room that has not started yet: its setup, when it starts and for how long', async () => {
      const opens = new Date(2026, 10, 1);
      vi.mocked(readProject).mockResolvedValue({ ...PROJECT, startDate: '2026-11-01', endDate: '2026-12-31' });
      vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
      vi.mocked(readProjectRooms).mockResolvedValue([{
        id: 'room-5', tool: 'open-vote', pin: '123456', joinCode: 'b'.repeat(32), facilitatorToken: 'facilitator-5',
        status: 'scheduled', contributions: 0, createdAt: new Date(NOW.getTime() - DAY).toISOString(),
        opensAt: opens.toISOString(), expiresAt: new Date(opens.getTime() + 30 * DAY).toISOString(),
        config: { question: 'More benches?', answers: ['Yes', 'No'] },
      }]);
      setup();
      await pollRow();

      fireEvent.click(screen.getByRole('button', { name: 'Edit More benches?' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Edit Poll' }));
      expect(dialog.getByLabelText('The question')).toHaveValue('More benches?');
      fireEvent.change(dialog.getByLabelText('The question'), { target: { value: 'Even more benches?' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
      fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
      expect(dialog.getByLabelText('On a date')).toBeChecked();
      expect(dialog.getByLabelText('Open for')).toHaveValue('30d');
      fireEvent.change(dialog.getByLabelText('Open for'), { target: { value: '1w' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(rescheduleRoom).toHaveBeenCalledWith('room-5', {
        lifetime: '1w', config: { question: 'Even more benches?', answers: ['Yes', 'No'] }, opensOn: '2026-11-01',
      }));
      expect(createRoom).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('moves when a live room closes, within ninety days of when it opened, and nothing else', async () => {
      vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
      vi.mocked(readProjectRooms).mockResolvedValue([{
        ...LONG_ROOM, createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 30 * DAY).toISOString(),
        config: { question: 'Car-free Sundays?' },
      }]);
      setup();
      await pollRow();

      fireEvent.click(screen.getByRole('button', { name: 'Change when Car-free Sundays? closes' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Change when it closes' }));
      expect(dialog.queryByLabelText('The question')).not.toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

      fireEvent.click(dialog.getByLabelText('Closes at the end of'));
      const calendar = within(screen.getByRole('dialog', { name: 'Choose the closing day' }));
      expect(calendar.getByRole('button', { name: '7 January 2027' })).toBeEnabled();
      expect(calendar.getByRole('button', { name: '8 January 2027' })).toBeDisabled();
      fireEvent.click(calendar.getByRole('button', { name: '20 November 2026' }));
      fireEvent.click(dialog.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(setRoomCloses).toHaveBeenCalledWith('room-1', '2026-11-20'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('leaves a room joined by its PIN to its two hours', async () => {
      vi.mocked(readProjectTools).mockResolvedValue(['open-vote']);
      vi.mocked(readProjectRooms).mockResolvedValue([{
        ...LONG_ROOM, createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 2 * 3600000).toISOString(),
      }]);
      setup();
      await pollRow();

      const rooms = within(screen.getByRole('region', { name: 'Poll rooms' }));
      expect(rooms.getByRole('button', { name: /^open$/i })).toBeInTheDocument();
      expect(rooms.queryByRole('button', { name: /^Edit|^Change when/ })).not.toBeInTheDocument();
    });
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
    tab = 'general';

    setup();

    expect(await screen.findByText('4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'My Toolkit' }));
    expect(screen.getByRole('heading', { name: 'My Toolkit' })).toBeInTheDocument();
    expect(screen.queryByText('Open rooms')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe('ProjectDashboardPage, deleting the project', () => {
  beforeEach(() => {
    tab = 'settings';
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

  it('sits in a Danger zone card at the foot of Project Settings', async () => {
    tab = 'settings';
    setup();

    const zone = await screen.findByRole('region', { name: 'Danger zone' });
    expect(within(zone).getByRole('button', { name: /Delete project/ })).toBeInTheDocument();
    const panel = screen.getByRole('tabpanel', { name: 'Project Settings' });
    const cards = panel.querySelectorAll('section');
    expect(cards[cards.length - 1]).toBe(zone);
  });

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
    tab = 'settings';
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
    tab = 'settings';
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

    await screen.findByRole('heading', { name: 'Collaborators' });
    expect(screen.queryByText('Who can see this project')).not.toBeInTheDocument();
  });
});
