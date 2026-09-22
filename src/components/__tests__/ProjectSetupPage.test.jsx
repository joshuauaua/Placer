import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSetupPage } from '../ProjectSetupPage';
import { createProject, updateProject } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

const setup = (overrides = {}) => {
  const props = {
    t: THEME,
    accountId: 'user-1',
    accountName: 'Mara Quinn',
    onSaved: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<ProjectSetupPage {...props} />);
  return props;
};

describe('ProjectSetupPage, starting a project', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('cannot be submitted with no name', () => {
    setup();
    expect(screen.getByRole('button', { name: /Start project/ })).toBeDisabled();
  });

  it('starts a project with what was filled in', async () => {
    createProject.mockResolvedValue({ id: 'proj-1', name: 'Riverside Greenway' });
    const { onSaved } = setup();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Riverside Greenway' } });
    fireEvent.change(screen.getByLabelText('Goals'), { target: { value: 'Turn the old rail corridor into a park.' } });
    fireEvent.change(screen.getByLabelText('Locations'), { target: { value: 'Malmö\nFolkets Park' } });
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'proj-1', name: 'Riverside Greenway' }));
    expect(createProject).toHaveBeenCalledWith({
      ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
      description: 'Turn the old rail corridor into a park.',
      startDate: null, endDate: null, locations: ['Malmö', 'Folkets Park'],
    });
  });

  it('says so when starting the project fails', async () => {
    createProject.mockRejectedValue(new Error('name too long'));
    setup();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'x'.repeat(200) } });
    fireEvent.click(screen.getByRole('button', { name: /Start project/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('name too long');
  });

  it('cancels back out', () => {
    const { onCancel } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });
});

describe('ProjectSetupPage, editing a project', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const PROJECT = {
    id: 'proj-1', ownerId: 'user-1', ownerName: 'Mara Quinn', name: 'Riverside Greenway',
    description: 'Turn the old rail corridor into a park.', startDate: '2026-01-01', endDate: '2026-12-31',
    locations: ['Malmö', 'Folkets Park'],
  };

  it('starts filled in with the project already there', () => {
    setup({ project: PROJECT });

    expect(screen.getByLabelText('Name *')).toHaveValue('Riverside Greenway');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Locations')).toHaveValue('Malmö\nFolkets Park');
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeInTheDocument();
  });

  it('saves changes through updateProject rather than creating a new one', async () => {
    updateProject.mockResolvedValue({ ...PROJECT, name: 'New name' });
    const { onSaved } = setup({ project: PROJECT });

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...PROJECT, name: 'New name' }));
    expect(updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({ name: 'New name' }));
    expect(createProject).not.toHaveBeenCalled();
  });
});
