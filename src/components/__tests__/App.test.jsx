import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '../../App';

vi.mock('../MapContainer', () => ({
  default: () => {
    throw new Error('Map failed to load');
  },
}));

function renderAt(path) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <App />
    </Router>
  );
}

describe('App', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders MainApp welcome view at root path', () => {
    renderAt('/');
    expect(screen.getByText('Reimagine Your City')).toBeInTheDocument();
  });

  it('renders SurveyPage at /survey', async () => {
    renderAt('/survey');
    expect(
      await screen.findByText(/how often do you visit public spaces/i)
    ).toBeInTheDocument();
  });

  it('renders AdminGate restricted view at /admin when admin is disabled', () => {
    renderAt('/admin');
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });

  it('ErrorBoundary catches errors thrown by route content instead of crashing the app', async () => {
    renderAt('/');

    fireEvent.click(screen.getByText('Start imagining'));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });
});
