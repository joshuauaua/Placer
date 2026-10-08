import { describe, it, expect, afterEach } from 'vite-plus/test';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { StationaryActivityMap } from '../toolkit/StationaryActivityMap';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';
import { clickMap, lastMap } from '../../test/maplibreStub';

function mount() {
  return render(<StationaryActivityMap t={THEME} tool={findTool('stationary-activity-mapping')} />);
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

  it('plots each observation where it was recorded on the map', () => {
    mount();
    act(() => clickMap(lastMap(), { lat: 55.601, lng: 12.99 }));

    fireEvent.click(screen.getByRole('button', { name: 'Standing' }));
    fireEvent.click(screen.getByLabelText('Waiting for Transport'));
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    const recorded = screen.getByRole('button', { name: 'Standing: Waiting for Transport' });
    const marker = lastMap().markers.find((item) => item.getElement() === recorded);
    expect(marker.getLngLat()).toEqual({ lat: 55.601, lng: 12.99 });

    // And says what it was when clicked.
    fireEvent.click(recorded);
    expect(lastMap().popups[0].node.textContent).toContain('Observation #1');
  });
});
