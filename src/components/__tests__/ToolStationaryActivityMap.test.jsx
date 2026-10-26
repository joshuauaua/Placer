import { describe, it, expect, afterEach } from 'vite-plus/test';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { StationaryActivityMap } from '../toolkit/StationaryActivityMap';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';
import { clickMap, lastMap } from '../../test/maplibreStub';

function open() {
  return render(<StationaryActivityMap t={THEME} tool={findTool('stationary-activity-mapping')} />);
}

// A square around the map's centre, in Malmö.
const AREA = [
  { lat: 55.6, lng: 12.98 }, { lat: 55.6, lng: 13.0 }, { lat: 55.61, lng: 13.0 }, { lat: 55.61, lng: 12.98 },
];

// Past the instructions to setting up the session: the area outlined and the header filled in.
function configure({ area = AREA } = {}) {
  const view = open();
  fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  area.forEach((corner) => act(() => clickMap(lastMap(), corner)));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Stortorget' } });
  fireEvent.change(screen.getByLabelText('Weather'), { target: { value: 'Sunny' } });
  return view;
}

// All the way onto the map.
function mount() {
  const view = configure();
  fireEvent.click(screen.getByRole('button', { name: 'Start mapping' }));
  return view;
}

describe('Stationary Activity Mapping', () => {
  afterEach(() => cleanup());

  it('lays out the map, recording card, tally, and legend', () => {
    mount();
    expect(screen.getByText('Record Observation')).toBeInTheDocument();
    expect(screen.getByText('Observation Tally')).toBeInTheDocument();
  });

  it('opens on the field sheet\'s directions and its key, without the map', () => {
    open();
    expect(screen.queryByText('Record Observation')).not.toBeInTheDocument();
    const directions = screen.getByText('Instructions').closest('section');
    expect(directions).toHaveTextContent('Define a route through your space and use the same route for each hour.');
    expect(directions).toHaveTextContent(/Add your name, date, & day of the week/);
    expect(screen.getByRole('list', { name: 'Postures' }).querySelectorAll('li svg')).toHaveLength(7);
    expect(screen.getByRole('list', { name: 'Activities' })).toHaveTextContent('Conversing');
  });

  it('goes from the instructions to setting up, to the map, and back', () => {
    mount();
    expect(screen.getByText('Record Observation')).toBeInTheDocument();
    expect(screen.getByLabelText('Session')).toHaveTextContent('Observer: Ada');
    expect(screen.getByLabelText('Session')).toHaveTextContent('Location: Stortorget');
    expect(screen.getByLabelText('Session')).toHaveTextContent('Weather: Sunny');

    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    expect(screen.queryByText('Record Observation')).not.toBeInTheDocument();
    // What was filled in is still there.
    expect(screen.getByLabelText('Name')).toHaveValue('Ada');
    expect(screen.getByText(/4 corners/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }));
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });

  it('will not start mapping until the area is outlined and the header filled in', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    // Today's date and the time now are filled in already.
    expect(screen.getByLabelText('Date').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByLabelText('Time').value).toMatch(/^\d{2}:\d{2}$/);

    fireEvent.click(screen.getByRole('button', { name: 'Start mapping' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Outline the area on the map');
    expect(alert).toHaveTextContent('Add your name.');
    expect(alert).toHaveTextContent('Pick the weather.');
    expect(screen.queryByText('Record Observation')).not.toBeInTheDocument();
  });

  it('outlines the area a corner per click, and can take one back', () => {
    configure({ area: AREA.slice(0, 3) });
    expect(screen.getByText(/3 corners/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo corner' }));
    expect(screen.getByText(/2 corners/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start mapping' }));
    expect(screen.getByRole('alert')).toHaveTextContent('at least three corners');
  });

  it('will not record a spot outside the survey area', () => {
    mount();
    act(() => clickMap(lastMap(), { lat: 55.7, lng: 12.99 }));
    fireEvent.click(screen.getByRole('button', { name: 'Standing' }));
    fireEvent.click(screen.getByLabelText('Waiting for transportation'));
    expect(screen.getByText(/outside the survey area/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record' })).toBeDisabled();
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
    expect(card.textContent).toContain('Public sitting');
  });

  it('shows the tally table with all posture rows', () => {
    mount();
    const tallyCard = screen.getByText('Observation Tally').closest('section');
    expect(tallyCard.textContent).toContain('Standing');
    expect(tallyCard.textContent).toContain('Lying down');
    expect(tallyCard.textContent).toContain('Multiple movement');
  });

  it('plots each observation where it was recorded on the map', () => {
    mount();
    act(() => clickMap(lastMap(), { lat: 55.605, lng: 12.99 }));

    fireEvent.click(screen.getByRole('button', { name: 'Standing' }));
    fireEvent.click(screen.getByLabelText('Waiting for transportation'));
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    const recorded = screen.getByRole('button', { name: 'Standing: Waiting for transportation' });
    const marker = lastMap().markers.find((item) => item.getElement() === recorded);
    expect(marker.getLngLat()).toEqual({ lat: 55.605, lng: 12.99 });
    // Drawn as the posture's symbol: standing is a filled circle.
    expect(recorded.querySelector('svg circle')).toHaveAttribute('fill', 'currentColor');

    // And says what it was when clicked.
    fireEvent.click(recorded);
    expect(lastMap().popups[0].node.textContent).toContain('Observation #1');
  });
});
