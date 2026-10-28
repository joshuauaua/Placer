import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { THEME } from '../../theme';

const submitBugReport = vi.fn();
const canAttachScreenshot = vi.fn(() => true);
const readSignedIn = vi.fn(() => Promise.resolve(true));
vi.mock('../../services/bugReports', () => ({
  MAX_MESSAGE_LENGTH: 4000,
  isSupabaseConfigured: () => true,
  canAttachScreenshot: () => canAttachScreenshot(),
  readSignedIn: () => readSignedIn(),
  reportBugByEmailHref: () => 'mailto:x',
  submitBugReport: (...a) => submitBugReport(...a),
}));

import { BugReportButton } from '../BugReportButton';

const SHOT = new File(['png'], 'shot.png', { type: 'image/png' });
const openPanel = () => fireEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
const type = (text) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

describe('BugReportButton, with a screenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canAttachScreenshot.mockReturnValue(true);
    readSignedIn.mockResolvedValue(true);
    submitBugReport.mockResolvedValue();
    URL.createObjectURL = vi.fn(() => 'blob:shot');
    URL.revokeObjectURL = vi.fn();
  });

  it('is offered only to somebody signed in, in a build with somewhere to put it', async () => {
    readSignedIn.mockResolvedValue(false);
    const { unmount } = render(<BugReportButton t={THEME} />);
    openPanel();
    await waitFor(() => expect(readSignedIn).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Attach a screenshot' })).toBeNull();
    unmount();

    readSignedIn.mockResolvedValue(true);
    canAttachScreenshot.mockReturnValue(false);
    const second = render(<BugReportButton t={THEME} />);
    openPanel();
    expect(screen.queryByRole('button', { name: 'Attach a screenshot' })).toBeNull();
    second.unmount();

    canAttachScreenshot.mockReturnValue(true);
    render(<BugReportButton t={THEME} />);
    openPanel();
    expect(await screen.findByRole('button', { name: 'Attach a screenshot' })).toBeInTheDocument();
  });

  it('sends a picked screenshot with the report, and can take it off first', async () => {
    render(<BugReportButton t={THEME} />);
    openPanel();
    await screen.findByRole('button', { name: 'Attach a screenshot' });
    fireEvent.change(screen.getByLabelText('Screenshot'), { target: { files: [SHOT] } });
    expect(screen.getByRole('img', { name: 'The screenshot to send' })).toHaveAttribute('src', 'blob:shot');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('img', { name: 'The screenshot to send' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Screenshot'), { target: { files: [SHOT] } });
    type('The map is blank');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(submitBugReport).toHaveBeenCalledWith('The map is blank', { screenshot: SHOT }));
  });

  it('takes a screenshot pasted into the text box', async () => {
    render(<BugReportButton t={THEME} />);
    openPanel();
    await screen.findByRole('button', { name: 'Attach a screenshot' });
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [SHOT] } });
    expect(screen.getByRole('img', { name: 'The screenshot to send' })).toBeInTheDocument();
  });

  it('turns away a file that is not a picture', async () => {
    render(<BugReportButton t={THEME} />);
    openPanel();
    await screen.findByRole('button', { name: 'Attach a screenshot' });
    fireEvent.change(screen.getByLabelText('Screenshot'),
      { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('A screenshot has to be a photo');
    expect(screen.queryByRole('img', { name: 'The screenshot to send' })).toBeNull();
  });
});
