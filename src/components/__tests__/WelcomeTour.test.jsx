import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { WelcomeTour } from '../WelcomeTour';
import { markOnboarded, needsOnboarding } from '../../services/onboarding';
import { THEME } from '../../theme';

vi.mock('../../services/onboarding', () => ({
  needsOnboarding: vi.fn(() => Promise.resolve(false)),
  markOnboarded: vi.fn(() => Promise.resolve()),
}));

// A stand-in for App: a page that changes when the tour sends somebody somewhere, with
// the tour beside it rather than inside it.
function Harness({ path = '/dashboard', accountId = 'user-1' }) {
  const [page, setPage] = useState('dashboard');
  // One location for the life of the harness, not a fresh one each time the page changes.
  const [{ hook, searchHook, history }] = useState(() => memoryLocation({ path, record: true }));
  Harness.history = history;
  return (
    <Router hook={hook} searchHook={searchHook}>
      <h1>{`Page: ${page}`}</h1>
      <WelcomeTour t={THEME} accountId={accountId} name="Mara Quinn" autoOpen={page === 'dashboard'}
        onExplore={() => setPage('map')} onOpenToolkit={() => setPage('toolkit')}
        onNewProject={() => setPage('new project')} onEditProfile={() => setPage('settings')} />
    </Router>
  );
}

describe('WelcomeTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the first time an account reaches its dashboard, and records it once closed', async () => {
    vi.mocked(needsOnboarding).mockResolvedValueOnce(true);
    render(<Harness />);

    const tour = await screen.findByRole('dialog', { name: 'Welcome to PLACER, Mara Quinn' });
    expect(needsOnboarding).toHaveBeenCalledWith('user-1');

    fireEvent.click(within(tour).getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(markOnboarded).toHaveBeenCalledWith('user-1');
  });

  it('carries on over each page its steps lead to', async () => {
    vi.mocked(needsOnboarding).mockResolvedValueOnce(true);
    render(<Harness />);
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open the map' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Page: map' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('Step 3 of 5');

    fireEvent.click(screen.getByRole('button', { name: 'Browse the Toolkit' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Page: toolkit' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('Step 4 of 5');

    fireEvent.click(screen.getByRole('button', { name: 'Create a project' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Page: new project' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('Step 5 of 5');

    fireEvent.click(screen.getByRole('button', { name: 'Edit my profile' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Page: settings' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(markOnboarded).toHaveBeenCalledWith('user-1');
  });

  it('opens again at ?tour however often it has been seen, and drops the ?tour', async () => {
    render(<Harness path="/dashboard?tour" />);

    expect(await screen.findByRole('dialog', { name: 'Welcome to PLACER, Mara Quinn' })).toBeInTheDocument();
    expect(Harness.history.at(-1)).toBe('/dashboard');
  });

  it('does not open for an account that has seen it, or without an account', async () => {
    render(<Harness />);
    render(<Harness accountId={null} />);

    await waitFor(() => expect(needsOnboarding).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
