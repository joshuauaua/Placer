import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';

vi.mock('../MapContainer', () => ({
  default: () => {
    throw new Error('Map failed to load');
  },
}));

describe('App', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders MainApp welcome view at root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Reimagine Your City')).toBeInTheDocument();
  });

  it('renders SurveyPage at /survey', async () => {
    render(
      <MemoryRouter initialEntries={['/survey']}>
        <App />
      </MemoryRouter>
    );
    expect(
      await screen.findByText(/how often do you visit public spaces/i)
    ).toBeInTheDocument();
  });

  it('renders AdminGate restricted view at /admin when admin is disabled', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });

  it('ErrorBoundary catches errors thrown by route content instead of crashing the app', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Start imagining'));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });
});
