import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { AdminDashboard } from '../AdminDashboard';
import { THEME } from '../../theme';

describe('AdminDashboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the "Admin Dashboard" heading with the "Overview" tab active by default', () => {
    render(<AdminDashboard t={THEME} />);
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Weekly Traffic')).toBeInTheDocument();
  });

  it('displays stat cards on the Overview tab', () => {
    render(<AdminDashboard t={THEME} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Total Visits')).toBeInTheDocument();
    expect(screen.getAllByText('Survey Responses').length).toBeGreaterThan(0);
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
  });

  it('shows analytics content when the "Analytics" tab is clicked', () => {
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByText('Analytics'));
    expect(screen.getByText('Page Views')).toBeInTheDocument();
    expect(screen.getByText('Top Pages')).toBeInTheDocument();
  });

  it('shows survey stats and recent responses when the "Survey Responses" tab is clicked', () => {
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByRole('button', { name: 'Survey Responses' }));
    expect(screen.getByText('Most Common Answers')).toBeInTheDocument();
    expect(screen.getByText('Recent Responses')).toBeInTheDocument();
    expect(screen.getByText('Response #1')).toBeInTheDocument();
  });

  it('shows a user table with recent users when the "Users" tab is clicked', () => {
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByText('Users'));
    expect(screen.getByText('Recent Users')).toBeInTheDocument();
    expect(screen.getByText('Emma Larsson')).toBeInTheDocument();
  });

  it('shows the "Add New Article" form when the "Content" tab is clicked', () => {
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByText('Content'));
    expect(screen.getByText('Add New Article')).toBeInTheDocument();
  });

  it('adds a tag to the tag list when a tag button is clicked', () => {
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByText('Content'));
    fireEvent.click(screen.getByText('Guide'));
    // Appears in the removable tag pill, the (now-disabled) suggestion button, and the live preview.
    expect(screen.getAllByText('Guide')).toHaveLength(3);
  });

  it('removes a tag when its ✕ button is clicked', () => {
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByText('Content'));
    fireEvent.click(screen.getByText('Guide'));

    const pill = screen.getAllByText('Guide')[0].closest('span');
    fireEvent.click(within(pill).getByRole('button'));

    expect(screen.getAllByText('Guide')).toHaveLength(1);
  });

  it('does not add duplicate tags — the suggestion button becomes disabled', () => {
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByText('Content'));
    fireEvent.click(screen.getByText('Guide'));

    const suggestionButton = screen.getAllByText('Guide')[1];
    expect(suggestionButton).toBeDisabled();
    expect(screen.getAllByText('Guide')).toHaveLength(3);
  });

  it('calls window.alert with a success message and resets the form on submit', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<AdminDashboard t={THEME} />);
    fireEvent.click(screen.getByText('Content'));

    fireEvent.change(screen.getByPlaceholderText('e.g., How to Design Better Public Spaces'), {
      target: { value: 'My Article' },
    });
    fireEvent.change(screen.getByPlaceholderText('Brief description of the article...'), {
      target: { value: 'My excerpt' },
    });

    fireEvent.click(screen.getByText('Publish Article'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Article added successfully! (In production, this would save to database)'
    );
    expect(screen.getByPlaceholderText('e.g., How to Design Better Public Spaces').value).toBe('');
    expect(screen.getByPlaceholderText('Brief description of the article...').value).toBe('');
  });
});
