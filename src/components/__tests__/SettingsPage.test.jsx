import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { saveProfile } from '../../services/profile';
import { removeProfileImageFile, updatePassword, uploadProfilePhoto } from '../../services/auth';
import { THEME } from '../../theme';

vi.mock('../../services/auth', () => ({
  updatePassword: vi.fn(() => Promise.resolve()),
  uploadProfilePhoto: vi.fn(() => Promise.resolve('avatars/user-1/avatar-2.jpg')),
  removeProfileImageFile: vi.fn(() => Promise.resolve()),
}));

const PROFILE_KEY = 'placemaking_profile';
const CONSENT_KEY = 'placer_analytics_consent';

// Saving is the parent's job now, and which parent decides where it lands: the real
// localStorage write on a checkout with no Supabase project, a request to the profiles
// table where there is one (see components/useIdentity.js). The default here is the
// local one, so the assertions below still get to check something actually persisted.
const setup = (overrides = {}) => {
  const props = {
    t: THEME,
    profile: { name: 'Mara Quinn', bio: '' },
    onSaveProfile: vi.fn((patch) => Promise.resolve(saveProfile(patch))),
    onNavigate: vi.fn(),
    ...overrides,
  };
  const { option, ...rest } = props;
  render(<SettingsPage {...rest} />);
  // Settings are edited behind the option that holds them, so open that one first.
  if (option) fireEvent.click(screen.getByRole('button', { name: option }));
  return rest;
};

const PROFILE = 'Edit your profile';
const PICTURES = 'Profile photo';
const PASSWORD = 'Change your password';
const ORGANISATIONS = 'Manage your organisations';
const ANALYTICS = 'Analytics';

const nameField = () => screen.getByLabelText('Your name');
const saveButton = () => screen.getByRole('button', { name: /Save name/ });

describe('SettingsPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the current display name', () => {
    setup({ option: PROFILE });

    expect(nameField()).toHaveValue('Mara Quinn');
  });

  it('cannot be saved until the name actually changes', () => {
    setup({ option: PROFILE });

    expect(saveButton()).toBeDisabled();
  });

  it('will not save a blank name', () => {
    setup({ option: PROFILE });

    fireEvent.change(nameField(), { target: { value: '   ' } });

    expect(saveButton()).toBeDisabled();
  });

  it('persists a new display name and hands it back up', async () => {
    const { onSaveProfile } = setup({ option: PROFILE });

    fireEvent.change(nameField(), { target: { value: 'Devon Park' } });
    fireEvent.click(saveButton());

    // Awaited rather than asserted straight away: the save is a promise now, because
    // on a configured project it is a round trip to the profiles table.
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
    expect(onSaveProfile).toHaveBeenCalledWith({ name: 'Devon Park' });
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY))).toMatchObject({ name: 'Devon Park' });
  });

  it('says so when the save fails instead of pretending it worked', async () => {
    setup({ option: PROFILE, onSaveProfile: vi.fn(() => Promise.reject(new Error('no network'))) });

    fireEvent.change(nameField(), { target: { value: 'Devon Park' } });
    fireEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('records accepting analytics', () => {
    setup({ option: ANALYTICS });

    fireEvent.click(screen.getByRole('button', { name: /Accept analytics/ }));

    expect(localStorage.getItem(CONSENT_KEY)).toBe('granted');
  });

  it('records rejecting analytics', () => {
    setup({ option: ANALYTICS });

    fireEvent.click(screen.getByRole('button', { name: /Reject analytics/ }));

    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
  });

  it('sends you to the Terms and Privacy page for the full data rights', () => {
    const { onNavigate } = setup({ option: ANALYTICS });

    fireEvent.click(screen.getByRole('link', { name: 'What is collected, and your rights' }));

    expect(onNavigate).toHaveBeenCalledWith('terms');
  });

  it('has no password to change for a local-only profile', () => {
    setup();

    expect(screen.queryByRole('button', { name: PASSWORD })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});

describe('SettingsPage, options', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('lists options under their categories rather than editing anything up front', () => {
    setup({ email: 'mara@example.com', onNewOrganisation: vi.fn() });

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Profile Settings', 'Account', 'Data and Privacy']);
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: PROFILE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PASSWORD })).toBeInTheDocument();
  });

  it('opens an option and goes back to the list', () => {
    setup({ option: PROFILE });

    expect(screen.getByLabelText('Your name')).toHaveValue('Mara Quinn');
    fireEvent.click(screen.getByRole('button', { name: /All settings/ }));
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: PROFILE })).toBeInTheDocument();
  });

  it('sends Your data straight to the Terms and Privacy page', () => {
    const { onNavigate } = setup({ option: 'Your data' });

    expect(onNavigate).toHaveBeenCalledWith('terms');
  });
});

describe('SettingsPage, bio and location', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('no longer asks whether the account is an organisation — organisations are their own pages', () => {
    setup({ profile: { name: 'Mara Quinn', bio: '', accountType: 'organisation' } });

    expect(screen.queryByText('Account type')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Organisation' })).not.toBeInTheDocument();
  });

  it('saves a contact email and a website', async () => {
    const { onSaveProfile } = setup({ option: PROFILE, profile: { name: 'Mara Quinn', bio: '', contactEmail: '', website: '' } });

    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'hi@mara.se' } });
    fireEvent.click(screen.getByRole('button', { name: /Save contact email/ }));
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'mara.se' } });
    fireEvent.click(screen.getByRole('button', { name: /Save website/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ contactEmail: 'hi@mara.se' }));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ website: 'mara.se' }));
  });

  it('offers no cover image at all, only the profile photo', () => {
    setup({ option: PICTURES, email: 'mara@example.com' });

    expect(screen.queryByText('Cover image')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload a cover')).not.toBeInTheDocument();
  });

  it('offers no profile photo for a local-only profile', () => {
    setup();

    expect(screen.queryByText('Profile photo')).not.toBeInTheDocument();
  });

  it('uploads a profile photo, points the profile at it, and deletes the old one', async () => {
    const onSaveProfile = vi.fn(() => Promise.resolve());
    setup({ option: PICTURES, email: 'mara@example.com', onSaveProfile,
      profile: { name: 'Mara Quinn', bio: '', photoPath: 'avatars/user-1/avatar-1.jpg', photo: 'https://cdn/a.jpg' } });

    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByText('Replace photo').querySelector('input'), { target: { files: [file] } });

    await waitFor(() => expect(removeProfileImageFile).toHaveBeenCalledWith('avatars/user-1/avatar-1.jpg'));
    expect(uploadProfilePhoto).toHaveBeenCalledWith(file);
    expect(onSaveProfile).toHaveBeenCalledWith({ photoPath: 'avatars/user-1/avatar-2.jpg' });
  });

  it('removes the profile photo, falling back to the initials', async () => {
    const onSaveProfile = vi.fn(() => Promise.resolve());
    setup({ option: PICTURES, email: 'mara@example.com', onSaveProfile,
      profile: { name: 'Mara Quinn', bio: '', photoPath: 'avatars/user-1/avatar-1.jpg', photo: 'https://cdn/a.jpg' } });

    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ photoPath: null }));
    expect(removeProfileImageFile).toHaveBeenCalledWith('avatars/user-1/avatar-1.jpg');
  });

  it('shows the current bio and location', () => {
    setup({ option: PROFILE, profile: { name: 'Mara Quinn', bio: 'Cyclist', location: 'Malmö' } });

    expect(screen.getByLabelText('Bio')).toHaveValue('Cyclist');
    expect(screen.getByLabelText('Location')).toHaveValue('Malmö');
  });

  it('cannot save a field until it actually changes', () => {
    setup({ option: PROFILE, profile: { name: 'Mara Quinn', bio: 'Cyclist', location: '' } });

    expect(screen.getByRole('button', { name: /Save bio/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save location/ })).toBeDisabled();
  });

  it('saves a bio, blank being a valid value since it is optional', async () => {
    const { onSaveProfile } = setup({ option: PROFILE, profile: { name: 'Mara Quinn', bio: 'Cyclist', location: '' } });

    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Save bio/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ bio: '' }));
  });

  it('saves a location', async () => {
    const { onSaveProfile } = setup({ option: PROFILE, profile: { name: 'Mara Quinn', bio: '', location: '' } });

    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Malmö' } });
    fireEvent.click(screen.getByRole('button', { name: /Save location/ }));

    expect(await screen.findAllByRole('status')).not.toHaveLength(0);
    // Typed rather than chosen from the suggestions, so there is no place to open Explore at.
    expect(onSaveProfile).toHaveBeenCalledWith({ location: 'Malmö', locationPoint: null });
    expect(screen.getByText(/Not a place from the suggestions/)).toBeInTheDocument();
  });

  it('keeps the place a suggestion was chosen from, and opens Explore there', async () => {
    // A stand-in for Google Places: the Autocomplete it builds is handed back here so
    // the test can "choose" a suggestion the way the real list would.
    let placeChanged;
    const place = { formatted_address: 'Malmö, Sweden',
      geometry: { location: { lat: () => 55.6, lng: () => 13 } } };
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'maps-key');
    window.google = { maps: { places: { Autocomplete: vi.fn(function Autocomplete() {
      this.getPlace = () => place;
      this.addListener = (event, handler) => { placeChanged = handler; return { remove: vi.fn() }; };
    }) } } };

    try {
      const { onSaveProfile } = setup({ option: PROFILE, profile: { name: 'Mara Quinn', bio: '', location: '' } });
      await waitFor(() => expect(placeChanged).toBeTypeOf('function'));
      expect(window.google.maps.places.Autocomplete).toHaveBeenCalledWith(
        screen.getByLabelText('Location'), expect.objectContaining({ types: ['(regions)'] }));

      act(() => placeChanged());
      expect(screen.getByLabelText('Location')).toHaveValue('Malmö, Sweden');
      expect(screen.getByText('Explore opens here.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Save location/ }));

      await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({
        location: 'Malmö, Sweden', locationPoint: { lat: 55.6, lng: 13 } }));
    } finally {
      delete window.google;
      vi.unstubAllEnvs();
    }
  });
});

describe('SettingsPage, avatar', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('offers no avatar icons to pick from, only the profile photo', () => {
    setup({ option: PICTURES, email: 'mara@example.com' });

    expect(screen.queryByRole('radiogroup', { name: 'Avatar icon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save avatar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Profile photo' })).toBeInTheDocument();
  });

  it('shows the initials in the photo circle until a photo is added', () => {
    setup({ option: PICTURES, email: 'mara@example.com' });

    expect(screen.getByText('MQ')).toBeInTheDocument();
  });
});

describe('SettingsPage, changing a password', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const newPassword = () => screen.getByLabelText('New password');
  const saveNewPassword = () => screen.getByRole('button', { name: /Save new password/ });

  it('cannot be submitted until the password is long enough', () => {
    setup({ option: PASSWORD, email: 'mara@example.com' });

    expect(saveNewPassword()).toBeDisabled();

    fireEvent.change(newPassword(), { target: { value: 'short' } });

    expect(saveNewPassword()).toBeDisabled();
  });

  it('changes the password', async () => {
    setup({ option: PASSWORD, email: 'mara@example.com' });

    fireEvent.change(newPassword(), { target: { value: 'longenough' } });
    fireEvent.click(saveNewPassword());

    expect(await screen.findByRole('status')).toHaveTextContent('Changed.');
    expect(updatePassword).toHaveBeenCalledWith('longenough');
  });

  it('says so when the change fails instead of pretending it worked', async () => {
    vi.mocked(updatePassword).mockRejectedValue(new Error('Could not change your password: nope'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setup({ option: PASSWORD, email: 'mara@example.com' });

    fireEvent.change(newPassword(), { target: { value: 'longenough' } });
    fireEvent.click(saveNewPassword());

    expect(await screen.findByRole('alert')).toHaveTextContent(/nope/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe('SettingsPage, organisations', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('lists the organisations this account runs, and opens one', () => {
    const onOpenOrganisationDashboard = vi.fn();
    setup({ option: ORGANISATIONS, email: 'mara@example.com', onNewOrganisation: vi.fn(), onOpenOrganisationDashboard,
      organisations: [{ id: 'org-1', name: 'Malmö Stad' }] });

    fireEvent.click(screen.getByRole('link', { name: 'Malmö Stad' }));
    expect(onOpenOrganisationDashboard).toHaveBeenCalledWith('org-1');
  });

  it('is where an organisation is created', () => {
    const onNewOrganisation = vi.fn();
    setup({ option: ORGANISATIONS, email: 'mara@example.com', onNewOrganisation });

    fireEvent.click(screen.getByRole('button', { name: /Create an organisation/ }));
    expect(onNewOrganisation).toHaveBeenCalled();
  });

  it('is not offered without an account', () => {
    setup({ onNewOrganisation: vi.fn() });

    expect(screen.queryByRole('button', { name: ORGANISATIONS })).not.toBeInTheDocument();
  });
});
