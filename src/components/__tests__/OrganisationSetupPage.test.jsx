import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { photonFeature, stubPhoton } from '../../test/photon';
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

const ORG = { id: 'org-1', name: 'Malmö Stad', description: '', location: '', address: '', locationPoint: null,
  contactEmail: '', website: '',
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

describe('OrganisationSetupPage, address', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => vi.unstubAllGlobals());

  // Photon's answer for STPLN's address: a house, so no name of its own, only its parts.
  const STPLN = photonFeature({ type: 'house', housenumber: '5', street: 'Malmöhusvägen',
    postcode: '211 18', city: 'Malmö', state: 'Skåne', country: 'Sweden', lat: 55.6054, lng: 12.9854 });

  it('saves a chosen address with its point, and fills in the town and country from it', async () => {
    vi.mocked(createOrganisation).mockResolvedValue(ORG);
    stubPhoton([STPLN]);
    const { onSaved } = setup();

    // Any address, not only towns.
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Malmöhusvägen 5' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Malmöhusvägen 5/ }));

    expect(screen.getByLabelText('Address')).toHaveValue('Malmöhusvägen 5, 211 18 Malmö, Skåne, Sweden');
    expect(screen.getByLabelText('Town and country')).toHaveValue('Malmö, Sweden');

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'STPLN' } });
    fireEvent.click(screen.getByRole('button', { name: /Create organisation/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createOrganisation).toHaveBeenCalledWith(expect.objectContaining({
      address: 'Malmöhusvägen 5, 211 18 Malmö, Skåne, Sweden',
      locationPoint: { lat: 55.6054, lng: 12.9854 },
      location: 'Malmö, Sweden',
    }));
  });

  it('drops the point once the address is edited by hand, keeping the town and country', async () => {
    vi.mocked(updateOrganisation).mockResolvedValue(ORG);
    setup({ organisation: { ...ORG, address: 'Malmöhusvägen 5, Malmö', location: 'Malmö, Sweden',
      locationPoint: { lat: 55.6054, lng: 12.9854 } } });

    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Malmöhusvägen 7, Malmö' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateOrganisation).toHaveBeenCalledWith('org-1', expect.objectContaining({
      address: 'Malmöhusvägen 7, Malmö', locationPoint: null, location: 'Malmö, Sweden',
    })));
  });

  it('lets the town and country be corrected by hand', async () => {
    vi.mocked(updateOrganisation).mockResolvedValue(ORG);
    setup({ organisation: ORG });

    fireEvent.change(screen.getByLabelText('Town and country'), { target: { value: 'Rosengård, Malmö' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() => expect(updateOrganisation).toHaveBeenCalledWith('org-1', expect.objectContaining({
      location: 'Rosengård, Malmö', address: '', locationPoint: null,
    })));
  });
});
