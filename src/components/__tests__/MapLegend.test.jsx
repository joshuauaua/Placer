import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapLegend } from '../MapLegend';
import { CHARACTER, THEME } from '../../theme';

const PIN = { fill: CHARACTER.citizen.c100, ring: CHARACTER.citizen.c700 };
const AREA = { fill: CHARACTER.cityWorker.c300, stroke: CHARACTER.cityWorker.c700 };

describe('MapLegend', () => {
  it('explains the three marks drawn on the map', () => {
    render(<MapLegend t={THEME} pin={PIN} area={AREA} />);

    expect(screen.getByRole('region', { name: 'Map legend' })).toBeInTheDocument();
    expect(screen.getByText('An imagination')).toBeInTheDocument();
    expect(screen.getByText('A project area')).toBeInTheDocument();
    expect(screen.getByText('Your search result')).toBeInTheDocument();
  });

  it('folds down to its heading, and opens again', () => {
    render(<MapLegend t={THEME} pin={PIN} area={AREA} />);
    const toggle = screen.getByRole('button', { name: 'Map key' });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('An imagination')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('An imagination')).toBeInTheDocument();
  });
});
