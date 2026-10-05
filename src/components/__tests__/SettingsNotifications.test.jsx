import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { readPreferences, savePreferences, DEFAULT_PREFERENCES } from '../../services/notifications';
import { THEME } from '../../theme';

// Notification preferences live in Supabase, so the card only shows with a project
// configured; this file stands one in, apart from SettingsPage.test.jsx, whose other
// settings are tested against the local fallback.
vi.mock('../../services/notifications', async (importOriginal) => ({
  ...(await importOriginal()),
  isSupabaseConfigured: () => true,
  readPreferences: vi.fn(),
  savePreferences: vi.fn(() => Promise.resolve()),
}));

const open = async () => {
  render(<SettingsPage t={THEME} profile={{ name: 'Mara Quinn', bio: '' }} email="mara@example.com" onSaveProfile={vi.fn()}
    onNavigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Notification preferences' }));
  return screen.findByRole('group', { name: 'Responses on your projects' });
};

describe('SettingsPage, responses on your projects', () => {
  afterEach(() => vi.clearAllMocks());

  it('defaults to every response', async () => {
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES });
    await open();

    expect(screen.getByRole('radio', { name: /^Every response/ })).toBeChecked();
    // Settings is the default itself, so it has no "use my default" of its own.
    expect(screen.queryByRole('radio', { name: /Use my default/ })).not.toBeInTheDocument();
  });

  it('saves a new default for every project', async () => {
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES });
    await open();

    fireEvent.click(screen.getByRole('radio', { name: /^When a session closes/ }));

    await waitFor(() => expect(savePreferences).toHaveBeenCalledWith({ project_responses: 'session' }));
    expect(screen.getByRole('radio', { name: /^When a session closes/ })).toBeChecked();
  });

  it('puts the choice back when it cannot be saved', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, project_responses: 'off' });
    vi.mocked(savePreferences).mockRejectedValueOnce(new Error('network down'));
    await open();

    fireEvent.click(screen.getByRole('radio', { name: /^Every response/ }));

    expect(await screen.findByText('Could not save that. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeChecked();
    consoleError.mockRestore();
  });

  it('says who hears about followers now', async () => {
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES });
    await open();

    expect(screen.getByText(/a project you run, or an organisation you are an admin of/)).toBeInTheDocument();
  });
});
