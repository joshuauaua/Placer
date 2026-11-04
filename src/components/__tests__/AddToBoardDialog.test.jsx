import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AddToBoardDialog } from '../AddToBoardDialog';
import {
  addCollaborator, addProjectTool, createProject, isSupabaseConfigured, readMyProjects,
} from '../../services/projects';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readMyProjects: vi.fn(() => Promise.resolve([])),
  createProject: vi.fn(({ name }) => Promise.resolve({ id: 'new-board', name })),
  addProjectTool: vi.fn(() => Promise.resolve([])),
  addCollaborator: vi.fn(() => Promise.resolve({ success: true })),
}));

const BOARDS = [{ id: 'b-1', name: 'Möllan' }, { id: 'b-2', name: 'Folkets Park' }];
const tool = findTool('budget-ballot');

const setup = (props = {}) => {
  const handlers = { onDone: vi.fn(), onBack: vi.fn(), onClose: vi.fn() };
  render(<AddToBoardDialog t={THEME} tool={tool} accountId="user-1" ownerName="Mara Quinn"
    {...handlers} {...props} />);
  return handlers;
};

const create = () => fireEvent.click(screen.getByRole('button', { name: 'Create' }));

describe('AddToBoardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readMyProjects).mockResolvedValue([]);
  });

  it('offers your projects in one dropdown, with Create a new project last, and adds the tool to the one picked', async () => {
    vi.mocked(readMyProjects).mockResolvedValue(BOARDS);
    const { onDone } = setup();

    const dropdown = await screen.findByRole('combobox', { name: 'Project' });
    expect(within(dropdown).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Möllan', 'Folkets Park', '+ Create a new project']);
    expect(dropdown).toHaveValue('b-1');
    // A board is picked, so nothing about a new one is asked.
    expect(screen.queryByLabelText('Project name')).toBeNull();
    fireEvent.change(dropdown, { target: { value: 'b-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to project' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('b-2'));
    expect(addProjectTool).toHaveBeenCalledWith('b-2', 'budget-ballot', 'user-1');
    expect(createProject).not.toHaveBeenCalled();
  });

  it('brings out the new project\'s options when Create a new project is picked, and puts them away again', async () => {
    vi.mocked(readMyProjects).mockResolvedValue(BOARDS);
    setup();
    const dropdown = await screen.findByRole('combobox', { name: 'Project' });

    fireEvent.change(dropdown, { target: { value: '__new__' } });
    expect(screen.getByLabelText('Project name')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Private' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Group project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();

    fireEvent.change(dropdown, { target: { value: 'b-1' } });
    expect(screen.queryByLabelText('Project name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add to project' })).toBeInTheDocument();
  });

  it('starts on a new project when there are none to add to', async () => {
    setup();

    const dropdown = await screen.findByRole('combobox', { name: 'Project' });
    expect(within(dropdown).getAllByRole('option').map((o) => o.textContent)).toEqual(['+ Create a new project']);
    expect(screen.getByLabelText('Project name')).toBeInTheDocument();
    expect(screen.getByText('You have no projects yet.')).toBeInTheDocument();
  });

  it('creates a public project by name, with the tool on it', async () => {
    const { onDone } = setup();
    fireEvent.change(await screen.findByLabelText('Project name'), { target: { value: '  Möllan  ' } });
    create();

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('new-board'));
    expect(createProject).toHaveBeenCalledWith({
      ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Möllan', visibility: 'public',
    });
    expect(addProjectTool).toHaveBeenCalledWith('new-board', 'budget-ballot', 'user-1');
    expect(addCollaborator).not.toHaveBeenCalled();
  });

  it('asks for a name before creating anything', async () => {
    const { onDone } = setup();
    await screen.findByLabelText('Project name');
    create();

    expect(await screen.findByRole('alert')).toHaveTextContent('Give the project a name.');
    expect(createProject).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('makes the project private from its switch', async () => {
    setup();
    fireEvent.change(await screen.findByLabelText('Project name'), { target: { value: 'Möllan' } });
    const toggle = screen.getByRole('switch', { name: 'Private' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    create();

    await waitFor(() => expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' })));
  });

  it('invites collaborators by email on a group project', async () => {
    const { onDone } = setup();
    fireEvent.change(await screen.findByLabelText('Project name'), { target: { value: 'Möllan' } });
    expect(screen.queryByLabelText('Invite collaborators to join this project')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Group project' }));

    const invite = screen.getByLabelText('Invite collaborators to join this project');
    fireEvent.change(invite, { target: { value: 'Ines@Example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(invite, { target: { value: 'sam@example.org' } });
    fireEvent.keyDown(invite, { key: 'Enter' });
    fireEvent.change(invite, { target: { value: 'not an email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That does not look like an email address.');

    const invited = screen.getByRole('list', { name: 'Invited' });
    expect(within(invited).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['ines@example.org', 'sam@example.org']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove sam@example.org' }));
    create();

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('new-board'));
    expect(addCollaborator.mock.calls).toEqual([['new-board', 'ines@example.org']]);
  });

  it('keeps the project when an invitation fails, says which, and carries on', async () => {
    vi.mocked(addCollaborator).mockRejectedValueOnce(new Error('No account with that email'));
    const { onDone } = setup();
    fireEvent.change(await screen.findByLabelText('Project name'), { target: { value: 'Möllan' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Group project' }));
    fireEvent.change(screen.getByLabelText('Invite collaborators to join this project'),
      { target: { value: 'nobody@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    create();

    expect(await screen.findByRole('alert')).toHaveTextContent('nobody@example.org');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith('new-board');
  });

  it('says what went wrong when the project cannot be made, and lets you try again', async () => {
    vi.mocked(createProject).mockRejectedValueOnce(new Error('Could not start that project: offline'));
    setup();
    fireEvent.change(await screen.findByLabelText('Project name'), { target: { value: 'Möllan' } });
    create();

    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();
  });

  it('goes back to the tools, or closes', async () => {
    const { onBack, onClose } = setup();
    await screen.findByLabelText('Project name');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('carries on without a project where there can be none', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    const { onDone } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Continue without a project' }));

    expect(onDone).toHaveBeenCalledWith(null);
    expect(readMyProjects).not.toHaveBeenCalled();
  });
});
