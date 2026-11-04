import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProjectToolCard } from '../toolkit/ProjectToolCard';
import { readProjectToolSetup } from '../../services/projects';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  readProjectToolSetup: vi.fn(() => Promise.resolve({
    area: [{ lat: 55.6, lng: 12.98 }, { lat: 55.6, lng: 13.0 }, { lat: 55.61, lng: 13.0 }],
    location: 'Stortorget',
  })),
}));

vi.mock('../../services/rooms', async (importOriginal) => ({
  ...(await importOriginal()),
  isSupabaseConfigured: () => true,
}));

describe('ProjectToolCard', () => {
  afterEach(() => cleanup());

  it('opens a tool the project set up as it was set up', async () => {
    render(<ProjectToolCard t={THEME} tool={findTool('stationary-activity-mapping')} projectId="proj-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Stationary Activity Mapping/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Get started' }));

    expect(readProjectToolSetup).toHaveBeenCalledWith('proj-1', 'stationary-activity-mapping');
    expect(screen.getByLabelText('Location')).toHaveValue('Stortorget');
  });
});
