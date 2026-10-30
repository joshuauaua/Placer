import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SiteFooter } from '../SiteFooter';
import { THEME } from '../../theme';

describe('SiteFooter layout', () => {
  it('has no newsletter sign-up or tagline', () => {
    render(<SiteFooter t={THEME} view="welcome" onNavigate={() => {}} />);

    expect(screen.queryByText('Follow our newsletter')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reimagine your city/)).not.toBeInTheDocument();
  });

  it('credits who builds and funds PLACER, with the funder lockup', () => {
    render(<SiteFooter t={THEME} view="welcome" onNavigate={() => {}} />);

    expect(screen.getByText(/funded by the Swedish Institute/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'STPLN' })).toHaveAttribute('href', 'https://stpln.se/');
    expect(screen.getByRole('link', { name: 'Ankara Aks' })).toHaveAttribute('href', 'https://ankaraaks.com/');
    expect(screen.getByRole('img', { name: 'Funded by Swedish Institute' })).toBeInTheDocument();
  });

  it('lists Instagram and Email under About Us', () => {
    render(<SiteFooter t={THEME} view="welcome" onNavigate={() => {}} />);

    const aboutUs = screen.getByText('About Us').nextElementSibling;
    expect(within(aboutUs).getByRole('link', { name: 'Instagram ↗' })).toHaveAttribute('href', 'https://www.instagram.com/placertool');
    expect(within(aboutUs).getByRole('link', { name: 'Email ↗' })).toHaveAttribute('href', 'mailto:info@plcr.org');
    expect(screen.getAllByRole('link', { name: 'Instagram ↗' })).toHaveLength(1);
  });
});
