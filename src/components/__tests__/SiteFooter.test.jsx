import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
