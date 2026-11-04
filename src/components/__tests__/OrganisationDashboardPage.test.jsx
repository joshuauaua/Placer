import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganisationDashboardPage } from '../OrganisationDashboardPage';
import {
  addAdmin, closeOrganisation, readAdmins, readOrganisation, removeAdmin,
} from '../../services/organisations';
import { readOrganisationProjects } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/organisations', () => ({
  addAdmin: vi.fn(() => Promise.resolve({ success: true })),
  closeOrganisation: vi.fn(() => Promise.resolve({ success: true })),
  createOrganisation: vi.fn(),
  readAdmins: vi.fn(),
  readOrganisation: vi.fn(),
  removeAdmin: vi.fn(() => Promise.resolve({ success: true })),
  updateOrganisation: vi.fn(),
}));

vi.mock('../../services/projects', () => ({
  readOrganisationProjects: vi.fn(() => Promise.resolve([])),
}));

const ORG = { id: 'org-1', name: 'Malmö Stad', contactEmail: '', website: '', location: 'Malmö',
  description: '', unadministeredSince: null };
const MARA = { userId: 'user-1', email: 'mara@example.com', displayName: 'Mara Quinn' };
const SAM = { userId: 'user-2', email: 'sam@example.com', displayName: 'Sam Berg' };

const setup = (props = {}) => {
  const handlers = { onNavigateToPublic: vi.fn(), onNewProject: vi.fn(), onOpenProjectDashboard: vi.fn(),
    onChanged: vi.fn(), onLeft: vi.fn() };
  render(<OrganisationDashboardPage t={THEME} accountId="user-1" organisationId="org-1" {...handlers} {...props} />);
  return handlers;
};

describe('OrganisationDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readOrganisation).mockResolvedValue(ORG);
    vi.mocked(readAdmins).mockResolvedValue([MARA, SAM]);
    vi.mocked(readOrganisationProjects).mockResolvedValue([]);
  });

  it('shows the organisation, its admins, and a way to start a project in its name', async () => {
    const { onNewProject } = setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Malmö Stad' })).toBeInTheDocument();
    expect(screen.getByText('Mara Quinn (you)')).toBeInTheDocument();
    expect(screen.getByText('Sam Berg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Start a project/ }));
    expect(onNewProject).toHaveBeenCalledWith('org-1');
  });

  it('adds an admin by email and shows the new roster', async () => {
    setup();
    await screen.findByText('Sam Berg');
    vi.mocked(readAdmins).mockResolvedValue([MARA, SAM, { userId: 'user-3', email: 'ali@example.com', displayName: 'Ali' }]);

    fireEvent.change(screen.getByLabelText('Add an admin by email'), { target: { value: ' ali@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add admin' }));

    expect(await screen.findByText('Ali')).toBeInTheDocument();
    expect(addAdmin).toHaveBeenCalledWith('org-1', 'ali@example.com');
  });

  it('lets an admin leave while somebody else is still an admin', async () => {
    const { onLeft } = setup();
    await screen.findByText('Sam Berg');

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    expect(removeAdmin).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('offers the only admin no way to leave, and says why', async () => {
    vi.mocked(readAdmins).mockResolvedValue([MARA]);
    setup();
    await screen.findByText('Mara Quinn (you)');

    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
    expect(screen.getByText(/There is always at least one/)).toBeInTheDocument();
  });

  it('closes the organisation only once its name is typed', async () => {
    const { onLeft } = setup();
    await screen.findByText('Sam Berg');
    const button = screen.getByRole('button', { name: /Close organisation/ });

    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type “Malmö Stad” to confirm'), { target: { value: 'Malmö Stad' } });
    fireEvent.click(button);

    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    expect(closeOrganisation).toHaveBeenCalledWith('org-1');
  });

  it('shows somebody who is not an admin nothing to manage', async () => {
    // The roster's read policy hands a non-admin no rows at all.
    vi.mocked(readAdmins).mockResolvedValue([]);
    setup();

    expect(await screen.findByText(/Only this organisation’s admins/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Close organisation/ })).not.toBeInTheDocument();
  });
});
