import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SiteFooter } from '../SiteFooter';
import { THEME } from '../../theme';

describe('SiteFooter newsletter sign-up', () => {
  beforeEach(() => localStorage.clear());

  it('saves the address as a newsletter_signup survey response', async () => {
    render(<SiteFooter t={THEME} view="welcome" onNavigate={() => {}} />);

    fireEvent.change(screen.getByLabelText('Follow our newsletter'), { target: { value: ' ada@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText("Thanks — you're on the list.")).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('placemaking_survey_responses'));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ source: 'newsletter_signup', email: 'ada@example.com' });
  });
});

describe('SiteFooter layout', () => {
  it('lists Instagram and Email under About Us', () => {
    render(<SiteFooter t={THEME} view="welcome" onNavigate={() => {}} />);

    const aboutUs = screen.getByText('About Us').nextElementSibling;
    expect(within(aboutUs).getByRole('link', { name: 'Instagram ↗' })).toHaveAttribute('href', 'https://www.instagram.com/placertool');
    expect(within(aboutUs).getByRole('link', { name: 'Email ↗' })).toHaveAttribute('href', 'mailto:info@plcr.org');
    expect(screen.getAllByRole('link', { name: 'Instagram ↗' })).toHaveLength(1);
  });

  it('puts the newsletter, its heading beside the field, just above the rule', () => {
    const { container } = render(<SiteFooter t={THEME} view="welcome" onNavigate={() => {}} />);

    const row = container.querySelector('.placer-footer-newsletter');
    expect(within(row).getByText('Follow our newsletter')).toBeInTheDocument();
    expect(within(row).getByLabelText('Follow our newsletter')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Sign up' })).toBeInTheDocument();

    const bottom = container.querySelector('.placer-footer-bottom');
    expect(bottom.previousElementSibling).toContainElement(row);
    expect(container.querySelector('.placer-footer-grid')).not.toContainElement(row);
  });
});
