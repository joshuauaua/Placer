import { describe, it, expect, afterEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';
import { ToolPreviewFrame, PREVIEW_KEY } from '../ToolPreviewFrame';
import { THEME } from '../../theme';

const renderAt = (path, Page) => {
  const { hook } = memoryLocation({ path });
  return render(<Router hook={hook}>{Page ? <Page t={THEME} /> : <App />}</Router>);
};

describe('ToolPreviewFrame', () => {
  afterEach(() => { delete window[PREVIEW_KEY]; });

  it('shows the slide handed over by the page that opened it, inert', () => {
    window[PREVIEW_KEY] = { toolId: 'word-cloud', setup: { prompt: 'One word for the square?', limit: 3, timer: null } };
    const { container } = renderAt('/toolkit/word-cloud/preview-frame', ToolPreviewFrame);

    expect(screen.getByText('One word for the square?')).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Preview of the slide"]')).toHaveAttribute('inert');
  });

  it('shows the tool\'s defaults when nothing was handed over for it', () => {
    window[PREVIEW_KEY] = { toolId: 'open-vote', setup: { question: 'Not this one' } };
    renderAt('/toolkit/word-cloud/preview-frame', ToolPreviewFrame);

    expect(screen.queryByText('Not this one')).toBeNull();
    // Word Cloud with a setup, even an empty one, offers no prompt of its own to write.
    expect(screen.queryByPlaceholderText('One word for this place?')).toBeNull();
  });

  it('is all the app draws at its address: no nav bar, cookie banner or bug button', async () => {
    renderAt('/toolkit/word-cloud/preview-frame');

    expect(await screen.findByLabelText('Preview of the slide')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button', { name: /report a bug/i })).toBeNull();
    expect(screen.queryByText(/Analytics/)).toBeNull();
  });
});
