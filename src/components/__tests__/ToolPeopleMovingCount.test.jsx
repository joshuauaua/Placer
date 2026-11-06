import { describe, it, expect, afterEach, vi } from 'vite-plus/test';
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react';
import { PeopleMovingCount } from '../toolkit/PeopleMovingCount';
import { CountLineStep } from '../toolkit/PeopleMovingSetup';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';
import { clickMap, lastMap, maps } from '../../test/maplibreStub';

vi.mock('../../lib/geocode', () => ({
  searchPlaces: vi.fn(() => Promise.resolve([])),
}));

const tool = () => findTool('people-moving-count');
const LINE = [{ lat: 55.6, lng: 12.98 }, { lat: 55.601, lng: 12.981 }];
const SETUP = { line: LINE, location: 'Södergatan' };

function open(props = {}) {
  return render(<PeopleMovingCount t={THEME} tool={tool()} {...props} />);
}

// Past the instructions and the session, onto the counting screen.
function startCounting({ setup = null } = {}) {
  open({ setup });
  fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  if (!setup) {
    fireEvent.click(screen.getByRole('button', { name: 'Draw the line' }));
    LINE.forEach((point) => act(() => clickMap(lastMap(), point)));
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Södergatan' } });
  }
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Weather'), { target: { value: 'Sunny' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start counting' }));
}

const tap = (name) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}.*Add one$`) }));

describe('People Moving Count', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('is in the register, by the Gehl Institute, set up with a line', () => {
    expect(tool()).toMatchObject({ createdBy: 'Gehl Institute', category: 'understand' });
    expect(tool().setup.steps.map((step) => step.title)).toEqual(['Instructions', 'Count line']);
  });

  it('will not start counting without a line and the header', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start counting' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Draw the count line on the map');
    expect(screen.getByRole('alert')).toHaveTextContent('Add your name.');
  });

  it('tallies pedestrians and people on bicycles apart, under one total', () => {
    startCounting();
    tap('Walking');
    tap('Walking');
    tap('Carried');
    tap('People on bicycles');
    expect(screen.getByLabelText('Total crossed')).toHaveTextContent('4');
    const tally = screen.getByLabelText('Total crossed').closest('section');
    expect(within(tally).getByLabelText('Pedestrians')).toHaveTextContent('3');
    expect(within(tally).getByLabelText('People on bicycles')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'One fewer: Walking' }));
    expect(screen.getByLabelText('Total crossed')).toHaveTextContent('3');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last' }));
    expect(screen.getByLabelText('Total crossed')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'One fewer: People on bicycles' })).toBeDisabled();
  });

  it('starts the timer on the first tap and stops it at ten minutes', () => {
    vi.useFakeTimers();
    startCounting();
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
    tap('Running / jogging');
    act(() => vi.advanceTimersByTime(65_000));
    expect(screen.getByRole('timer')).toHaveTextContent('1:05');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole('timer')).toHaveTextContent('1:05');

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    act(() => vi.advanceTimersByTime(20 * 60_000));
    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
    expect(screen.getByText('Time is up.')).toBeInTheDocument();
  });

  it("shows a project's line fixed: not to be drawn on or moved", async () => {
    startCounting({ setup: SETUP });
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Draw the line' })).not.toBeInTheDocument();
    const map = lastMap();
    expect(map.options.interactive).toBe(false);
    expect(map.sources.get('count-line').data.features[0].geometry)
      .toEqual({ type: 'LineString', coordinates: [[12.98, 55.6], [12.981, 55.601]] });
  });

  it('keeps the location of a project fixed in the session form', () => {
    open({ setup: SETUP });
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(screen.getByLabelText('Location')).toHaveValue('Södergatan');
    expect(screen.getByLabelText('Location')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Draw the line' })).not.toBeInTheDocument();
  });

  it('adds it all up on the results, to copy', () => {
    startCounting();
    tap('Rolling');
    tap('People on bicycles');
    fireEvent.click(screen.getByRole('button', { name: 'See results' }));
    expect(screen.getByText('Count Tally')).toBeInTheDocument();
    expect(screen.getByLabelText('Session')).toHaveTextContent('Observer: Ada');
    expect(screen.getByRole('row', { name: /Pedestrians/ })).toHaveTextContent('1');
  });

  it('opens straight on the count when answering in the Preview', () => {
    open({ setup: SETUP, answering: true });
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See results' })).not.toBeInTheDocument();
  });

  it('draws only the line on the configuration canvas', () => {
    open({ setup: SETUP, slide: true });
    expect(screen.getByText('Södergatan')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Count line map' })).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it("draws a project's line in the Configure panel, a point a click", () => {
    const onChange = vi.fn();
    render(<CountLineStep t={THEME} tool={tool()} setup={{ line: [], location: '' }} onChange={onChange} compact />);
    const before = maps.length;
    act(() => clickMap(lastMap(), LINE[0]));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Draw the line' }));
    act(() => clickMap(lastMap(), LINE[0]));
    expect(onChange).toHaveBeenCalledWith({ line: [LINE[0]], location: '' });
    expect(maps.length).toBe(before);
  });
});
