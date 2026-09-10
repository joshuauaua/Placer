import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { THEME } from '../../theme';

const PROFILE_KEY = 'placemaking_profile';
const CONSENT_KEY = 'placer_analytics_consent';

const setup = (overrides = {}) => {
  const props = {
    t: THEME,
    profile: { name: 'Mara Quinn', bio: '' },
    onProfileChange: vi.fn(),
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

  it('persists a new display name and hands it back up', () => {
    const { onProfileChange } = setup();

    fireEvent.change(nameField(), { target: { value: 'Devon Park' } });
    fireEvent.click(saveButton());

    expect(JSON.parse(localStorage.getItem(PROFILE_KEY))).toMatchObject({ name: 'Devon Park' });
    expect(onProfileChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Devon Park' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
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
