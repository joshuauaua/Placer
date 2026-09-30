import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganisationSetupPage } from '../OrganisationSetupPage';
import {
  createOrganisation, removeOrganisationCoverFile, updateOrganisation, uploadOrganisationCover,
} from '../../services/organisations';
import { THEME } from '../../theme';

vi.mock('../../services/organisations', () => ({
  createOrganisation: vi.fn(),
  updateOrganisation: vi.fn(),
  uploadOrganisationCover: vi.fn(),
  removeOrganisationCoverFile: vi.fn(() => Promise.resolve()),
}));

const ORG = { id: 'org-1', name: 'Malmö Stad', description: '', location: '', contactEmail: '', website: '',
  coverPath: 'organisations/org-1/cover-1.webp', cover: 'https://media.example/organisations/org-1/cover-1.webp' };

const photo = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
const pick = (file) => fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });

const setup = (props = {}) => {
  const handlers = { onSaved: vi.fn(), onCancel: vi.fn() };
  render(<OrganisationSetupPage t={THEME} accountId="user-1" {...handlers} {...props} />);
  return handlers;
};

describe('OrganisationSetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('creates an organisation, then uploads the cover picked for it', async () => {
    vi.mocked(createOrganisation).mockResolvedValue({ ...ORG, coverPath: null, cover: null });
    vi.mocked(uploadOrganisationCover).mockResolvedValue('organisations/org-1/cover-2.webp');
    vi.mocked(updateOrganisation).mockResolvedValue(ORG);
    const { onSaved } = setup();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Malmö Stad' } });
    pick(photo());
    await screen.findByText('Choose another');
    fireEvent.click(screen.getByRole('button', { name: /Create organisation/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ORG));
    expect(uploadOrganisationCover).toHaveBeenCalledWith('org-1', expect.any(File));
    expect(updateOrganisation).toHaveBeenCalledWith('org-1', { coverPath: 'organisations/org-1/cover-2.webp' });
  });

  it('refuses a file that is not a photo when it is picked', async () => {
    setup();

    pick(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }));

    expect(await screen.findByText(/has to be a photo/)).toBeInTheDocument();
  });

  it('keeps the new organisation when its cover fails, rather than creating a second', async () => {
    vi.mocked(createOrganisation).mockResolvedValue({ ...ORG, coverPath: null, cover: null });
    vi.mocked(uploadOrganisationCover).mockRejectedValue(new Error('A picture can be at most 3 MB.'));
    const { onSaved } = setup();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Malmö Stad' } });
    pick(photo());
    await screen.findByText('Choose another');
    fireEvent.click(screen.getByRole('button', { name: /Create organisation/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('at most 3 MB');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Edit organisation' })).toBeInTheDocument();
  });

  it('takes a picked cover away again without creating the organisation', async () => {
    setup();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Malmö Stad' } });
    pick(photo());
    await screen.findByText('Choose another');
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));

    expect(await screen.findByText('Upload a cover')).toBeInTheDocument();
    expect(createOrganisation).not.toHaveBeenCalled();
  });

  it('replaces the cover straight away when editing, and deletes the old file', async () => {
    vi.mocked(uploadOrganisationCover).mockResolvedValue('organisations/org-1/cover-2.webp');
    vi.mocked(updateOrganisation).mockResolvedValue({ ...ORG, coverPath: 'organisations/org-1/cover-2.webp' });
    setup({ organisation: ORG });

    pick(photo());

    await waitFor(() => expect(removeOrganisationCoverFile).toHaveBeenCalledWith('organisations/org-1/cover-1.webp'));
    expect(updateOrganisation).toHaveBeenCalledWith('org-1', { coverPath: 'organisations/org-1/cover-2.webp' });
  });
});
