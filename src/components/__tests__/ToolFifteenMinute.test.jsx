import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { FifteenMinute } from '../toolkit/FifteenMinute';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('15-Minute Reach', () => {
  const grid = () => screen.getByRole('group', { name: /neighbourhood grid/i });

  it('serves nobody to begin with', () => {
    mount(FifteenMinute, 'fifteen-minute');

    expect(screen.getByRole('status')).toHaveTextContent('0 of 5 kinds within 15 minutes');
    expect(screen.getByText('0 placed · 100 m cells')).toBeInTheDocument();
  });

  it('places an amenity with the keyboard', () => {
    mount(FifteenMinute, 'fifteen-minute');

    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('1 placed · 100 m cells')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Food shop here');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 5 kinds');
  });

  it('moves the cursor with the arrow keys', () => {
    mount(FifteenMinute, 'fifteen-minute');
    expect(screen.getByRole('status')).toHaveTextContent('column 5, row 4');

    fireEvent.keyDown(grid(), { key: 'ArrowRight' });
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    expect(screen.getByRole('status')).toHaveTextContent('column 6, row 5');
  });

  it('will not place anything on the railway', () => {
    mount(FifteenMinute, 'fifteen-minute');
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    expect(screen.getByRole('status')).toHaveTextContent('the railway');
    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('0 placed · 100 m cells')).toBeInTheDocument();
  });

  it('takes an amenity away again with a second press', () => {
    mount(FifteenMinute, 'fifteen-minute');

    fireEvent.keyDown(grid(), { key: 'Enter' });
    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('0 placed · 100 m cells')).toBeInTheDocument();
  });

  it('replaces what is on a cell when a different kind is selected', () => {
    mount(FifteenMinute, 'fifteen-minute');
    fireEvent.keyDown(grid(), { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'School' }));
    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('1 placed · 100 m cells')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('School here');
  });

  it('strands the far side of the railway on the council draft', () => {
    mount(FifteenMinute, 'fifteen-minute');

    fireEvent.click(screen.getByRole('button', { name: /the council's draft/i }));

    expect(screen.getByText('5 placed · 100 m cells')).toBeInTheDocument();
    // Served by all five, and reaching nothing at all, are both non-zero.
    const served = Number(screen.getByText('Served by all five').nextSibling.textContent.replace('%', ''));
    const stranded = Number(screen.getByText('Can reach nothing').nextSibling.textContent.replace('%', ''));
    expect(served).toBeGreaterThan(0);
    expect(served).toBeLessThan(70);
    expect(stranded).toBeGreaterThan(0);
  });
});
