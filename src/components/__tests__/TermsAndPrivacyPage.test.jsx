import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { TermsAndPrivacyPage } from '../TermsAndPrivacyPage';
import { THEME } from '../../theme';

function renderAt(path) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <App />
    </Router>
  );
}

describe('terms and privacy page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders at /terms-and-privacy', async () => {
    renderAt('/terms-and-privacy');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Terms and Privacy' })
    ).toBeInTheDocument();
    // As headings, because the footer's legal links carry the same names.
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('GDPR')).toBeInTheDocument();
  });

  it('reaches the page from the footer link', async () => {
    renderAt('/');

    fireEvent.click(screen.getByRole('link', { name: 'Terms of Service' }));
    expect(await screen.findByText('Agreement to these terms')).toBeInTheDocument();
    expect(screen.getByText('Who this policy applies to')).toBeInTheDocument();
    expect(screen.getByText('Your rights')).toBeInTheDocument();
  });
});

describe('TermsAndPrivacyPage data controls', () => {
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

    render(<TermsAndPrivacyPage t={THEME} />);
    fireEvent.click(screen.getByRole('button', { name: /download my data/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/has been downloaded/i)).toBeInTheDocument();
  });

  it('records an analytics decision and lets it be withdrawn again', async () => {
    render(<TermsAndPrivacyPage t={THEME} />);

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
    render(<TermsAndPrivacyPage t={THEME} />);

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
