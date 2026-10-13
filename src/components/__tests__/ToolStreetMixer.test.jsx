import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StreetMixer } from '../toolkit/StreetMixer';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('Street Section Mixer', () => {
  it('opens on today street', () => {
    mount(StreetMixer, 'street-mixer');

    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    // Two 2.5 m footways at 1,200 an hour, plus 10 m of traffic lane at 250.
    expect(screen.getByText('8.5k')).toBeInTheDocument();
    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
  });

  it('trades width between neighbours when a segment is widened', () => {
    mount(StreetMixer, 'street-mixer');

    // The footway grows by a quarter metre and the parking beside it gives that up,
    // which is 300 more people an hour and the same 20-metre street.
    fireEvent.click(screen.getAllByRole('button', { name: 'Widen Sidewalk' })[0]);

    expect(screen.getByText('8.8k')).toBeInTheDocument();
    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
    expect(screen.getByText('2.75 m')).toBeInTheDocument();
  });

  it('resizes from the keyboard on a divider', () => {
    mount(StreetMixer, 'street-mixer');
    const dividers = screen.getAllByRole('separator');

    expect(dividers[0]).toHaveAttribute('aria-label', 'Divider between Sidewalk and Parking');
    fireEvent.keyDown(dividers[0], { key: 'ArrowRight' });

    expect(screen.getByText('8.8k')).toBeInTheDocument();
  });

  it('moves further with shift held, and stops at the neighbour minimum', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.keyDown(screen.getAllByRole('separator')[0], { key: 'ArrowRight', shiftKey: true });

    // A metre was asked for, but the parking bay beside it bottoms out at 2 m, so the
    // footway gets the half metre that was actually going spare: 3 m, and 9,100 people.
    expect(screen.getAllByRole('separator')[0]).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('9.1k')).toBeInTheDocument();
  });

  it('stops caring about the preset once the street is edited', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.click(screen.getAllByRole('button', { name: 'Widen Sidewalk' })[0]);

    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to another street entirely', () => {
    mount(StreetMixer, 'street-mixer');

    // Scoped, because "Play street" is a preset and also a kind of segment.
    const presets = within(screen.getByRole('group', { name: 'Presets' }));
    fireEvent.click(presets.getByRole('button', { name: 'Play street' }));

    expect(screen.getByText('11.0k')).toBeInTheDocument();
    // Two 1.5 m planting strips and the café awnings: 32% of the street in shade.
    expect(screen.getByText('32')).toBeInTheDocument();
  });

  it('adds something to the street, squeezing what is already there', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.click(screen.getByRole('button', { name: 'Bus lane' }));

    const list = within(screen.getByRole('list'));
    expect(list.getByText('Bus lane')).toBeInTheDocument();
    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
    // A bus lane moves far more people than the space it was given was moving.
    expect(screen.getByText('14.2k')).toBeInTheDocument();
    // And the squeeze is shared, rather than taken out of the footways.
    expect(list.queryByText('1.5 m')).not.toBeInTheDocument();
  });

  it('removes something, and leaves the gap visible rather than hiding it', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove Parking' })[0]);

    expect(screen.getByText('17.5 m of 20 m — 2.5 m spare')).toBeInTheDocument();
    expect(screen.getByText('Still unallocated')).toBeInTheDocument();
  });

  it('offers to fill the street again, and does', () => {
    mount(StreetMixer, 'street-mixer');
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove Parking' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Fill the street' }));

    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
    expect(screen.queryByText('Still unallocated')).not.toBeInTheDocument();
  });
});
