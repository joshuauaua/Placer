import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { THEME } from '../../theme';

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from }) }));

import { BugReportButton } from '../BugReportButton';
import { reportBugByEmailHref } from '../../services/bugReports';

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
const type = (text) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

describe('BugReportButton', () => {
  beforeEach(() => {
    insert.mockReset();
    from.mockClear();
  });

  it('opens and closes the panel', () => {
    render(<BugReportButton t={THEME} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    openPanel();
    expect(screen.getByRole('dialog', { name: 'Report a bug' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('will not send an empty report', () => {
    render(<BugReportButton t={THEME} />);
    openPanel();
    type('   ');
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('files the report with the page it came from', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    insert.mockResolvedValue({ error: null });

    render(<BugReportButton t={THEME} />);
    openPanel();
    type('  The map is blank  ');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByRole('status');
    expect(from).toHaveBeenCalledWith('bug_reports');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      message: 'The map is blank', page: window.location.pathname,
    }));
  });

  it('shows the error and keeps the text when the insert is refused', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    insert.mockResolvedValue({ error: { message: 'nope' } });

    render(<BugReportButton t={THEME} />);
    openPanel();
    type('Broken');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nope'));
    expect(screen.getByRole('textbox')).toHaveValue('Broken');
  });

  it('offers email instead when there is no Supabase project', () => {
    render(<BugReportButton t={THEME} />);
    openPanel();
    type('Broken');
    expect(screen.getByRole('button', { name: 'Send by email' })).toBeEnabled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('reportBugByEmailHref', () => {
  it('carries the message and the page', () => {
    const href = reportBugByEmailHref('It broke');
    expect(href).toMatch(/^mailto:/);
    const body = decodeURIComponent(href.split('body=')[1]);
    expect(body).toContain('It broke');
    expect(body).toContain(`Page: ${window.location.pathname}`);
  });
});
