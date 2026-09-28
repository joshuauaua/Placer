import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { saveProfile } from '../../services/profile';
import { removeProfileImageFile, updatePassword, uploadCover, uploadProfilePhoto } from '../../services/auth';
import { THEME } from '../../theme';

vi.mock('../../services/auth', () => ({
  ACCOUNT_TYPES: [
    { key: 'individual', label: 'Individual' },
    { key: 'organisation', label: 'Organisation' },
  ],
  updatePassword: vi.fn(() => Promise.resolve()),
  uploadCover: vi.fn(() => Promise.resolve('user-1/cover-2.jpg')),
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
  render(<SettingsPage {...props} />);
  return props;
};

const nameField = () => screen.getByLabelText('Your name');
const saveButton = () => screen.getByRole('button', { name: /Save name/ });

describe('SettingsPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the current display name', () => {
    setup();

    expect(nameField()).toHaveValue('Mara Quinn');
  });

  it('cannot be saved until the name actually changes', () => {
    setup();

    expect(saveButton()).toBeDisabled();
  });

  it('will not save a blank name', () => {
    setup();

    fireEvent.change(nameField(), { target: { value: '   ' } });

    expect(saveButton()).toBeDisabled();
  });

  it('persists a new display name and hands it back up', async () => {
    const { onSaveProfile } = setup();

    fireEvent.change(nameField(), { target: { value: 'Devon Park' } });
    fireEvent.click(saveButton());

    // Awaited rather than asserted straight away: the save is a promise now, because
    // on a configured project it is a round trip to the profiles table.
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
    expect(onSaveProfile).toHaveBeenCalledWith({ name: 'Devon Park' });
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY))).toMatchObject({ name: 'Devon Park' });
  });

  it('says so when the save fails instead of pretending it worked', async () => {
    setup({ onSaveProfile: vi.fn(() => Promise.reject(new Error('no network'))) });

    fireEvent.change(nameField(), { target: { value: 'Devon Park' } });
    fireEvent.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('records accepting analytics', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: /Accept analytics/ }));

    expect(localStorage.getItem(CONSENT_KEY)).toBe('granted');
  });

  it('records rejecting analytics', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: /Reject analytics/ }));

    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied');
  });

  it('sends you to the Terms and Privacy page for the full data rights', () => {
    const { onNavigate } = setup();

    fireEvent.click(screen.getByRole('link', { name: 'What is collected, and your rights' }));

    expect(onNavigate).toHaveBeenCalledWith('terms');
  });

  it('has no password to change for a local-only profile', () => {
    setup();

    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});

describe('SettingsPage, bio and location', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('saves the account type as soon as one is picked', async () => {
    const { onSaveProfile } = setup({ profile: { name: 'Mara Quinn', bio: '', accountType: 'individual' } });

    expect(screen.getByRole('radio', { name: 'Individual' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Organisation' }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ accountType: 'organisation' }));
  });

  it('saves a contact email and a website', async () => {
    const { onSaveProfile } = setup({ profile: { name: 'Mara Quinn', bio: '', contactEmail: '', website: '' } });

    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'hi@mara.se' } });
    fireEvent.click(screen.getByRole('button', { name: /Save contact email/ }));
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'mara.se' } });
    fireEvent.click(screen.getByRole('button', { name: /Save website/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ contactEmail: 'hi@mara.se' }));
    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ website: 'mara.se' }));
  });

  it('offers no cover image for a local-only profile, which has nowhere to store one', () => {
    setup();

    expect(screen.queryByText('Cover image')).not.toBeInTheDocument();
  });

  it('uploads a cover, points the profile at it, and deletes the old one', async () => {
    const onSaveProfile = vi.fn(() => Promise.resolve());
    setup({ email: 'mara@example.com', onSaveProfile,
      profile: { name: 'Mara Quinn', bio: '', coverPath: 'user-1/cover-1.jpg', cover: 'https://cdn/x.jpg' } });

    const file = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByText('Replace cover').querySelector('input'), { target: { files: [file] } });

    await waitFor(() => expect(removeProfileImageFile).toHaveBeenCalledWith('user-1/cover-1.jpg'));
    expect(uploadCover).toHaveBeenCalledWith(file);
    expect(onSaveProfile).toHaveBeenCalledWith({ coverPath: 'user-1/cover-2.jpg' });
  });

  it('offers no profile photo for a local-only profile either', () => {
    setup();

    expect(screen.queryByText('Profile photo')).not.toBeInTheDocument();
  });

  it('uploads a profile photo, points the profile at it, and deletes the old one', async () => {
    const onSaveProfile = vi.fn(() => Promise.resolve());
    setup({ email: 'mara@example.com', onSaveProfile,
      profile: { name: 'Mara Quinn', bio: '', photoPath: 'avatars/user-1/avatar-1.jpg', photo: 'https://cdn/a.jpg' } });

    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByText('Replace photo').querySelector('input'), { target: { files: [file] } });

    await waitFor(() => expect(removeProfileImageFile).toHaveBeenCalledWith('avatars/user-1/avatar-1.jpg'));
    expect(uploadProfilePhoto).toHaveBeenCalledWith(file);
    expect(onSaveProfile).toHaveBeenCalledWith({ photoPath: 'avatars/user-1/avatar-2.jpg' });
  });

  it('removes the profile photo, falling back to the icon or initials', async () => {
    const onSaveProfile = vi.fn(() => Promise.resolve());
    setup({ email: 'mara@example.com', onSaveProfile,
      profile: { name: 'Mara Quinn', bio: '', photoPath: 'avatars/user-1/avatar-1.jpg', photo: 'https://cdn/a.jpg' } });

    // The cover card has no cover, so the only Remove button is the photo's.
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ photoPath: null }));
    expect(removeProfileImageFile).toHaveBeenCalledWith('avatars/user-1/avatar-1.jpg');
  });

  it('shows the current bio and location', () => {
    setup({ profile: { name: 'Mara Quinn', bio: 'Cyclist', location: 'Malmö' } });

    expect(screen.getByLabelText('Bio')).toHaveValue('Cyclist');
    expect(screen.getByLabelText('Location')).toHaveValue('Malmö');
  });

  it('cannot save a field until it actually changes', () => {
    setup({ profile: { name: 'Mara Quinn', bio: 'Cyclist', location: '' } });

    expect(screen.getByRole('button', { name: /Save bio/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save location/ })).toBeDisabled();
  });

  it('saves a bio, blank being a valid value since it is optional', async () => {
    const { onSaveProfile } = setup({ profile: { name: 'Mara Quinn', bio: 'Cyclist', location: '' } });

    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Save bio/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ bio: '' }));
  });

  it('saves a location', async () => {
    const { onSaveProfile } = setup({ profile: { name: 'Mara Quinn', bio: '', location: '' } });

    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Malmö' } });
    fireEvent.click(screen.getByRole('button', { name: /Save location/ }));

    expect(await screen.findAllByRole('status')).not.toHaveLength(0);
    expect(onSaveProfile).toHaveBeenCalledWith({ location: 'Malmö' });
  });
});

describe('SettingsPage, avatar', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts on the initials option when no icon is set', () => {
    setup({ profile: { name: 'Mara Quinn', bio: '', avatar: null } });

    expect(screen.getByRole('radio', { name: /show my initials/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /Save avatar/ })).toBeDisabled();
  });

  it('shows the currently chosen icon as selected', () => {
    setup({ profile: { name: 'Mara Quinn', bio: '', avatar: 'tree' } });

    expect(screen.getByRole('radio', { name: 'Tree' })).toHaveAttribute('aria-checked', 'true');
  });

  it('picks an icon and saves it', async () => {
    const { onSaveProfile } = setup({ profile: { name: 'Mara Quinn', bio: '', avatar: null } });

    fireEvent.click(screen.getByRole('radio', { name: 'Tree' }));
    fireEvent.click(screen.getByRole('button', { name: /Save avatar/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ avatar: 'tree' }));
  });

  it('can clear a chosen icon back to initials', async () => {
    const { onSaveProfile } = setup({ profile: { name: 'Mara Quinn', bio: '', avatar: 'tree' } });

    fireEvent.click(screen.getByRole('radio', { name: /show my initials/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save avatar/ }));

    await waitFor(() => expect(onSaveProfile).toHaveBeenCalledWith({ avatar: null }));
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
    setup({ email: 'mara@example.com' });

    expect(saveNewPassword()).toBeDisabled();

    fireEvent.change(newPassword(), { target: { value: 'short' } });

    expect(saveNewPassword()).toBeDisabled();
  });

  it('changes the password', async () => {
    setup({ email: 'mara@example.com' });

    fireEvent.change(newPassword(), { target: { value: 'longenough' } });
    fireEvent.click(saveNewPassword());

    expect(await screen.findByRole('status')).toHaveTextContent('Changed.');
    expect(updatePassword).toHaveBeenCalledWith('longenough');
  });

  it('says so when the change fails instead of pretending it worked', async () => {
    vi.mocked(updatePassword).mockRejectedValue(new Error('Could not change your password: nope'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setup({ email: 'mara@example.com' });

    fireEvent.change(newPassword(), { target: { value: 'longenough' } });
    fireEvent.click(saveNewPassword());

    expect(await screen.findByRole('alert')).toHaveTextContent(/nope/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
