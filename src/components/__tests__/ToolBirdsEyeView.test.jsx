import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BirdsEyeView } from '../toolkit/BirdsEyeView';
import { BirdsEyeEditor } from '../toolkit/BirdsEyeSetup';
import { BirdsEyeResults } from '../toolkit/BirdsEyeResults';
import { defaultBirdsEyeSetup } from '../../lib/birdsEye';
import { THEME } from '../../theme';

const CONFIG = { prompt: 'How would you lay out the yard?', outline: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }],
  assets: [{ id: 'bench', title: 'Work bench', shape: 'rect', w: 3, d: 1, x: 10, y: 6, r: 0 }], timer: null };

describe('BirdsEyeEditor', () => {
  it('adds a titled piece, sizes the plan in metres, and labels its sides', () => {
    let setup = defaultBirdsEyeSetup();
    const onChange = vi.fn((next) => { setup = next; });
    const { rerender } = render(<BirdsEyeEditor t={THEME} setup={setup} onChange={onChange} />);
    const plan = screen.getByRole('img', { name: 'Plan of the place, to edit' });
    expect(within(plan).getAllByText('20 m')).toHaveLength(2);
    expect(screen.getByText('240 m²')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    rerender(<BirdsEyeEditor t={THEME} setup={setup} onChange={onChange} />);
    expect(setup.assets).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Piece title'), { target: { value: 'Work bench' } });
    rerender(<BirdsEyeEditor t={THEME} setup={setup} onChange={onChange} />);
    expect(setup.assets[0].title).toBe('Work bench');

    const width = screen.getAllByLabelText('Width in metres')[0];
    fireEvent.change(width, { target: { value: '30' } });
    fireEvent.blur(width);
    expect(setup.outline[1]).toEqual({ x: 30, y: 0 });
  });

  it('draws a new outline corner by corner', () => {
    let setup = defaultBirdsEyeSetup();
    render(<BirdsEyeEditor t={THEME} setup={setup} onChange={(next) => { setup = next; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw outline' }));
    expect(screen.getByRole('status')).toHaveTextContent('Click each corner in turn');
    expect(screen.getByRole('button', { name: 'Finish shape' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Draw outline' })).toBeInTheDocument();
  });
});

describe('BirdsEyeView, answering', () => {
  it('shows what to do over the question, and the plan with its pieces', () => {
    const room = { status: 'open', isHost: false, config: CONFIG, contributions: [], publish: vi.fn(), combined: null };
    render(<BirdsEyeView t={THEME} room={room} answering />);
    expect(screen.getByRole('status')).toHaveTextContent('Drag the pieces where you would put them');
    expect(screen.getByRole('heading', { name: 'How would you lay out the yard?' })).toBeInTheDocument();
    expect(screen.getByText('Work bench')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit layout' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled();
  });
});

describe('BirdsEyeResults', () => {
  it('says how many layouts there are, over the plan', () => {
    render(<BirdsEyeResults t={THEME} result={{ status: 'open', config: CONFIG,
      states: [{ layout: { bench: { x: 2, y: 2, r: 0 } } }, { layout: { bench: { x: 15, y: 9, r: 90 } } }] }} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('2 layouts')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'How would you lay out the yard?, with 2 layouts' })).toBeInTheDocument();
  });
});
