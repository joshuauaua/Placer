import { describe, it, expect, afterEach } from 'vite-plus/test';
import { render, screen, cleanup } from '@testing-library/react';
import { StationaryActivityMap } from '../sandbox/StationaryActivityMap';
import { findExperiment } from '../../sandbox/experiments';
import { THEME } from '../../theme';

function mount() {
  return render(<StationaryActivityMap t={THEME} experiment={findExperiment('stationary-activity-mapping')} />);
}

describe('Stationary Activity Mapping', () => {
  afterEach(() => cleanup());

  it('lays out the map, recording card, tally, and legend', () => {
    mount();
    expect(screen.getByText('Record Observation')).toBeInTheDocument();
    expect(screen.getByText('Observation Tally')).toBeInTheDocument();
  });

  it('requires a map location before recording is enabled', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Record' })).toBeDisabled();
    expect(screen.getByText(/Click a spot on the map/i)).toBeInTheDocument();
  });

  it('shows posture options and activity sub-columns in the recording card', () => {
    mount();
    const card = screen.getByText('Record Observation').closest('section');
    expect(card.textContent).toContain('Standing');
    expect(card.textContent).toContain('Sitting in Public');
  });

  it('shows the tally table with all posture rows', () => {
    mount();
    const tallyCard = screen.getByText('Observation Tally').closest('section');
    expect(tallyCard.textContent).toContain('Standing');
    expect(tallyCard.textContent).toContain('Lying Down');
    expect(tallyCard.textContent).toContain('Multiple / Movement');
  });
});
