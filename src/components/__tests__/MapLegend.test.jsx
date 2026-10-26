import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapLegend } from '../MapLegend';
import { PALETTE, THEME } from '../../theme';

const AREA = { fill: PALETTE.blue.c300, stroke: PALETTE.blue.c700 };

describe('MapLegend', () => {
  it('explains the two marks drawn on the map', () => {
    render(<MapLegend t={THEME} area={AREA} />);

    expect(screen.getByRole('region', { name: 'Map legend' })).toBeInTheDocument();
    expect(screen.getByText('A project area')).toBeInTheDocument();
    expect(screen.getByText('Your search result')).toBeInTheDocument();
    expect(screen.queryByText('An imagination')).not.toBeInTheDocument();
  });

  it('folds down to its heading, and opens again', () => {
    render(<MapLegend t={THEME} area={AREA} />);
    const toggle = screen.getByRole('button', { name: 'Map key' });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('A project area')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('A project area')).toBeInTheDocument();
  });
});
