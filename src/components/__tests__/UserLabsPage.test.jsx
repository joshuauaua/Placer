import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserLabsPage } from '../UserLabsPage';
import { saveSurveyResponse } from '../../services/api';
import { THEME } from '../../theme';

vi.mock('../../services/api', () => ({ saveSurveyResponse: vi.fn() }));

function fillIn() {
  fireEvent.click(screen.getByRole('radio', { name: /Ankara/ }));
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: ' Ada Lovelace ' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('What do you do?'), { target: { value: 'Urban planner' } });
  fireEvent.change(screen.getByLabelText('What would you like to get out of the User Lab?'),
    { target: { value: 'Try the toolkit on my street' } });
}

describe('UserLabsPage', () => {
  beforeEach(() => {
    saveSurveyResponse.mockReset();
  });

  it('shows the upcoming lab above Apply', () => {
    render(<UserLabsPage t={THEME} />);

    expect(screen.getByText('Upcoming User Lab, October 21')).toBeInTheDocument();
    expect(screen.getByText('Malmö 12:30 – 15:30 · Ankara 13:30 – 16:30')).toBeInTheDocument();
  });

  it('opens the application form from Apply, and goes back to the pitch', () => {
    render(<UserLabsPage t={THEME} />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Apply for a User Lab' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone number/)).not.toBeRequired();
    expect(screen.getByLabelText(/Food allergies/)).not.toBeRequired();
    expect(screen.getByRole('checkbox', { name: /newsletter/ })).not.toBeChecked();
    expect(screen.getByLabelText('Email')).toBeRequired();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { level: 1, name: 'User Labs' })).toBeInTheDocument();
  });

  it('saves the application and thanks the applicant', async () => {
    saveSurveyResponse.mockResolvedValue({});
    render(<UserLabsPage t={THEME} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    fillIn();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send me PLACER news and the newsletter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Thank you for your interest' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(saveSurveyResponse).toHaveBeenCalledWith({
      source: 'user_labs_application',
      labDate: '2026-10-21',
      lab: 'ankara',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '',
      role: 'Urban planner',
      motivation: 'Try the toolkit on my street',
      dietary: '',
      newsletter: true,
    });
  });

  it('keeps the answers and offers email when saving fails', async () => {
    saveSurveyResponse.mockRejectedValue(new Error('offline'));
    render(<UserLabsPage t={THEME} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be sent');
    expect(screen.getByRole('link', { name: 'info@plcr.org' })).toHaveAttribute(
      'href', expect.stringMatching(/^mailto:info@plcr\.org/)
    );
    expect(screen.getByLabelText('Full name')).toHaveValue(' Ada Lovelace ');
  });
});
