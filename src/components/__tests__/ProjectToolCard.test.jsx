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
    // No tool in the register is kept on the project's tool any more (they run in rooms),
    // so a stand-in that is.
    const kept = {
      ...findTool('stationary-activity-mapping'), id: 'kept-tool', name: 'Kept tool', room: undefined,
      component: ({ setup }) => <p>Set up at {setup?.location}</p>,
    };
    render(<ProjectToolCard t={THEME} tool={kept} projectId="proj-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Kept tool/ }));

    expect(await screen.findByText('Set up at Stortorget')).toBeInTheDocument();
    expect(readProjectToolSetup).toHaveBeenCalledWith('proj-1', 'kept-tool');
  });

  it("opens a Gehl field tool's room on who is observing, for its project's team only", () => {
    render(<ProjectToolCard t={THEME} tool={findTool('people-moving-count')} projectId="proj-1"
      room={{ id: 'room-1' }} identity={{ status: 'signedOut', accountId: null, name: null }} />);
    fireEvent.click(screen.getByRole('button', { name: /People Moving Count/ }));

    expect(screen.getByRole('heading', { name: 'Sign in to take part' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
  });
});
