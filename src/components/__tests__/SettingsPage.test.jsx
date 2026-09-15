import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { saveProfile } from '../../services/profile';
import { THEME } from '../../theme';

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

  it('sends you to the GDPR page for the full data rights', () => {
    const { onNavigate } = setup();

    fireEvent.click(screen.getByRole('link', { name: 'GDPR page' }));

    expect(onNavigate).toHaveBeenCalledWith('gdpr');
  });
});
