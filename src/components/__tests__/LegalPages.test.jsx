import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { GdprPage } from '../GdprPage';
import { THEME } from '../../theme';

function renderAt(path) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <App />
    </Router>
  );
}

describe('legal pages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders PrivacyPage at /privacy', async () => {
    renderAt('/privacy');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })
    ).toBeInTheDocument();
    expect(screen.getByText('The short version')).toBeInTheDocument();
  });

  it('renders GdprPage at /gdpr', async () => {
    renderAt('/gdpr');
    expect(await screen.findByRole('heading', { level: 1, name: 'GDPR' })).toBeInTheDocument();
    expect(screen.getByText('Data controller')).toBeInTheDocument();
  });

  it('reaches both pages from the footer links', async () => {
    renderAt('/');

    fireEvent.click(screen.getByRole('link', { name: 'Privacy Policy' }));
    expect(await screen.findByText('Who this policy applies to')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'GDPR' }));
    expect(await screen.findByText('Your rights')).toBeInTheDocument();
  });

  it('says on the privacy page that the survey is submitted and stored', async () => {
    renderAt('/privacy');

    expect(await screen.findByText(/stored in our database so we can read them/i)).toBeInTheDocument();
    expect(screen.getByText(/keep names and other personal details out of the free-text boxes/i))
      .toBeInTheDocument();
    // The old copy promised the opposite, and would be a false statement now.
    expect(screen.queryByText(/nothing is submitted anywhere/i)).not.toBeInTheDocument();
  });

  it('names the database processor and its region on the GDPR page', async () => {
    renderAt('/gdpr');

    expect(await screen.findByText(/hosted by Supabase in the EU/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Supabase.s privacy policy/i })).toBeInTheDocument();
  });

  it('warns that erasing this browser does not reach a submitted survey', async () => {
    renderAt('/gdpr');

    fireEvent.click(await screen.findByRole('button', { name: /erase my data/i }));

    expect(await screen.findByText(/does not reach survey answers you have already submitted/i))
      .toBeInTheDocument();
  });

  it('cross-links from the privacy page to the GDPR page', async () => {
    renderAt('/privacy');
    await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' });

    fireEvent.click(screen.getByRole('link', { name: 'GDPR page' }));
    expect(await screen.findByText('International transfers')).toBeInTheDocument();
  });
});

describe('GdprPage data controls', () => {
  beforeEach(() => {
    localStorage.setItem('placemaking_imaginations', JSON.stringify([{ id: 'img-1' }]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('downloads an export containing the locally stored data', async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function () {
        expect(this.download).toBe('placer-data-export.json');
        expect(decodeURIComponent(this.href)).toContain('placemaking_imaginations');
      });

    render(<GdprPage t={THEME} onNavigate={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /download my data/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/has been downloaded/i)).toBeInTheDocument();
  });

  it('records an analytics decision and lets it be withdrawn again', async () => {
    render(<GdprPage t={THEME} onNavigate={() => {}} />);

    expect(screen.getByText(/no choice recorded yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /accept analytics/i }));
    await waitFor(() =>
      expect(localStorage.getItem('placer_analytics_consent')).toBe('granted')
    );
    expect(screen.getByText(/analytics are on for this browser/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept analytics/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /reject analytics/i }));
    await waitFor(() =>
      expect(localStorage.getItem('placer_analytics_consent')).toBe('denied')
    );
    expect(screen.getByText(/analytics are off/i)).toBeInTheDocument();
  });

  it('requires a second click before erasing, then clears PLACER storage', async () => {
    render(<GdprPage t={THEME} onNavigate={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /erase my data/i }));
    expect(await screen.findByText(/press erase again to confirm/i)).toBeInTheDocument();
    expect(localStorage.getItem('placemaking_imaginations')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /erase — confirm/i }));
    await waitFor(() =>
      expect(localStorage.getItem('placemaking_imaginations')).toBeNull()
    );
    expect(screen.getByText(/has been deleted/i)).toBeInTheDocument();
  });
});
