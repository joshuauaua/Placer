import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PublicOrganisationPage } from '../PublicOrganisationPage';
import {
  canClaimOrganisation, claimOrganisation, readOrganisation,
} from '../../services/organisations';
import { readOrganisationProjects } from '../../services/projects';
import { THEME } from '../../theme';

vi.mock('../../services/organisations', () => ({
  canClaimOrganisation: vi.fn(() => Promise.resolve(false)),
  claimOrganisation: vi.fn(() => Promise.resolve({ success: true })),
  isSupabaseConfigured: vi.fn(() => true),
  readOrganisation: vi.fn(),
}));

vi.mock('../../services/projects', () => ({
  readOrganisationProjects: vi.fn(),
}));

const ORG = { id: 'org-1', name: 'Malmö Stad', contactEmail: 'hello@malmo.se', website: 'https://malmo.se/',
  location: 'Malmö', description: 'The city.', unadministeredSince: null };

const setup = (props = {}) =>
  render(<PublicOrganisationPage t={THEME} organisationId="org-1" {...props} />);

describe('PublicOrganisationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readOrganisation).mockResolvedValue(ORG);
    vi.mocked(readOrganisationProjects).mockResolvedValue([
      { id: 'proj-1', name: 'Riverside Greenway', description: '' },
    ]);
  });

  it('shows the details, the description and the projects run in its name', async () => {
    const onOpenProject = vi.fn();
    setup({ onOpenProject });

    expect(await screen.findByRole('heading', { level: 1, name: 'Malmö Stad' })).toBeInTheDocument();
    expect(screen.getByText('The city.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@malmo.se' })).toHaveAttribute('href', 'mailto:hello@malmo.se');
    expect(screen.getByRole('link', { name: 'malmo.se' })).toHaveAttribute('href', 'https://malmo.se/');

    fireEvent.click(screen.getByRole('button', { name: /Riverside Greenway/ }));
    expect(onOpenProject).toHaveBeenCalledWith('proj-1');
  });

  it('offers its admins the dashboard, and nobody else', async () => {
    const onOpenDashboard = vi.fn();
    const { unmount } = setup({ isAdmin: true, onOpenDashboard });

    fireEvent.click(await screen.findByRole('button', { name: /Open the dashboard/ }));
    expect(onOpenDashboard).toHaveBeenCalledWith('org-1');
    unmount();

    setup({ onOpenDashboard });
    await screen.findByRole('heading', { level: 1, name: 'Malmö Stad' });
    expect(screen.queryByRole('button', { name: /Open the dashboard/ })).not.toBeInTheDocument();
  });

  it('says when it has no admin, without offering a stranger the claim', async () => {
    vi.mocked(readOrganisation).mockResolvedValue({ ...ORG, unadministeredSince: '2026-09-30T10:00:00Z' });
    setup({ accountId: 'user-9' });

    expect(await screen.findByText('This organisation has no admin at the moment.')).toBeInTheDocument();
    await waitFor(() => expect(canClaimOrganisation).toHaveBeenCalledWith('org-1'));
    expect(screen.queryByRole('button', { name: /Claim this organisation/ })).not.toBeInTheDocument();
  });

  it('lets a former admin claim it back', async () => {
    vi.mocked(readOrganisation).mockResolvedValue({ ...ORG, unadministeredSince: '2026-09-30T10:00:00Z' });
    vi.mocked(canClaimOrganisation).mockResolvedValue(true);
    const onClaimed = vi.fn();
    setup({ accountId: 'user-1', onClaimed });

    fireEvent.click(await screen.findByRole('button', { name: /Claim this organisation/ }));

    await waitFor(() => expect(onClaimed).toHaveBeenCalled());
    expect(claimOrganisation).toHaveBeenCalledWith('org-1');
  });

  it('says so when there is no such organisation', async () => {
    vi.mocked(readOrganisation).mockResolvedValue(null);
    setup();

    expect(await screen.findByText('Organisation not found')).toBeInTheDocument();
  });
});
