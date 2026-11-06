import { describe, it, expect, afterEach, vi } from 'vite-plus/test';
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react';
import { PeopleMovingCount } from '../toolkit/PeopleMovingCount';
import { CountSiteCanvas, TimerStep } from '../toolkit/PeopleMovingSetup';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';
import { clickMap, lastMap } from '../../test/maplibreStub';

vi.mock('../../lib/geocode', () => ({
  searchPlaces: vi.fn(() => Promise.resolve([])),
}));

const tool = () => findTool('people-moving-count');
const AREA = [{ lat: 55.6, lng: 12.98 }, { lat: 55.6, lng: 12.99 }, { lat: 55.61, lng: 12.99 }];
const LINE = [{ lat: 55.6, lng: 12.98 }, { lat: 55.601, lng: 12.981 }];
const SETUP = { area: AREA, line: LINE, location: 'Södergatan', minutes: 10 };

function open(props = {}) {
  return render(<PeopleMovingCount t={THEME} tool={tool()} {...props} />);
}

// The area with the polygon tool (on to start with), then the line with the line tool.
function drawSite() {
  AREA.forEach((corner) => act(() => clickMap(lastMap(), corner)));
  fireEvent.click(screen.getByRole('button', { name: 'Draw the line' }));
  LINE.forEach((point) => act(() => clickMap(lastMap(), point)));
}

// Past the instructions and the session, onto the counting screen.
function startCounting({ setup = null } = {}) {
  open({ setup });
  fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  if (!setup) {
    drawSite();
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

  it('is in the register, by the Gehl Institute, a count site per slide drawn on the canvas', () => {
    expect(tool()).toMatchObject({ createdBy: 'Gehl Institute', category: 'understand', slides: true });
    expect(tool().setup.Canvas).toBe(CountSiteCanvas);
    expect(tool().setup.title.key).toBe('location');
    expect(tool().setup.steps.map((step) => step.title)).toEqual(['Instructions', 'Count site', 'Timer']);
  });

  it('will not start counting without the area, a line and the header', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start counting' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Outline the area on the map');
    expect(screen.getByRole('alert')).toHaveTextContent('Draw the count line');
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

  it('runs the timer for as long as the slide sets, or shows none', () => {
    vi.useFakeTimers();
    startCounting({ setup: { ...SETUP, minutes: 5 } });
    expect(screen.getByText('of 5:00')).toBeInTheDocument();
    cleanup();
    startCounting({ setup: { ...SETUP, minutes: null } });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Total crossed')).toBeInTheDocument();
  });

  it("shows a project's site fixed: the area and the line over it, not to be drawn on or moved", async () => {
    startCounting({ setup: SETUP });
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Draw the area' })).not.toBeInTheDocument();
    const map = lastMap();
    expect(map.options.interactive).toBe(false);
    expect(map.sources.get('count-area').data.features).toHaveLength(1);
    expect(map.sources.get('count-line').data.features[0].geometry)
      .toEqual({ type: 'LineString', coordinates: [[12.98, 55.6], [12.981, 55.601]] });
  });

  it('keeps the location of a project fixed in the session form', () => {
    open({ setup: SETUP });
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(screen.getByLabelText('Location')).toHaveValue('Södergatan');
    expect(screen.getByLabelText('Location')).toHaveAttribute('readonly');
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
});

describe('People Moving Count, configured on the canvas', () => {
  afterEach(() => cleanup());

  function canvas(setup = { area: [], line: [], location: '', minutes: 10 }) {
    const onChange = vi.fn();
    render(<CountSiteCanvas t={THEME} tool={tool()} setup={setup} onChange={onChange} />);
    return onChange;
  }

  it('starts on the polygon tool, with the line tool waiting for the area', () => {
    const onChange = canvas();
    expect(screen.getByRole('button', { name: 'Stop drawing the area' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Draw the line' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Step 1');
    act(() => clickMap(lastMap(), AREA[0]));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ area: [AREA[0]], line: [] }));
  });

  it('draws the line on top of the area once the area is outlined', () => {
    const onChange = canvas({ area: AREA, line: [], location: '', minutes: 10 });
    expect(screen.getByRole('status')).toHaveTextContent('Step 2');
    fireEvent.click(screen.getByRole('button', { name: 'Draw the line' }));
    act(() => clickMap(lastMap(), LINE[0]));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ area: AREA, line: [LINE[0]] }));
  });

  it('has one undo on the map: the line’s last point first, then the area’s corners', () => {
    const onChange = canvas({ area: AREA, line: LINE, location: '', minutes: 10 });
    expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo the last line point' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ area: AREA, line: [LINE[0]] }));
    cleanup();
    const again = canvas({ area: AREA, line: [], location: '', minutes: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo the last corner' }));
    expect(again).toHaveBeenLastCalledWith(expect.objectContaining({ area: AREA.slice(0, 2), line: [] }));
  });

  it('has nothing to undo on an empty map', () => {
    canvas();
    expect(screen.getByRole('button', { name: 'Undo the last corner' })).toBeDisabled();
  });

  it('sets the timer in the panel: a length, or none', () => {
    const onChange = vi.fn();
    render(<TimerStep t={THEME} setup={SETUP} onChange={onChange} compact />);
    fireEvent.change(screen.getByLabelText('Timer'), { target: { value: '15' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...SETUP, minutes: 15 });
    fireEvent.change(screen.getByLabelText('Timer'), { target: { value: 'none' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...SETUP, minutes: null });
  });
});
