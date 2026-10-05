import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import { ProjectLocationMap } from '../ProjectLocationMap';
import { THEME } from '../../theme';

const PROJECT = {
  name: 'Riverside Greenway',
  locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
};

describe('ProjectLocationMap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing when there is no API key', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    const { container } = render(<ProjectLocationMap t={THEME} project={PROJECT} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the project has neither a drawn shape nor an address point', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const { container } = render(<ProjectLocationMap t={THEME} project={{ ...PROJECT, locationShapes: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('pins the address of a project with no outline', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const project = { ...PROJECT, locationShapes: [], locationPoint: { lat: 55.59, lng: 13.01 } };
    render(<ProjectLocationMap t={THEME} project={project} />);

    const params = new URL(screen.getByRole('img', { name: /Riverside Greenway/ }).src).searchParams;
    expect(params.get('center')).toBe('55.59,13.01');
    expect(params.get('markers')).toContain('55.59,13.01');
    expect(params.get('path')).toBeNull();
  });

  it('draws the outline rather than the pin when a project has both', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    render(<ProjectLocationMap t={THEME} project={{ ...PROJECT, locationPoint: { lat: 55.59, lng: 13.01 } }} />);

    const params = new URL(screen.getByRole('img', { name: /Riverside Greenway/ }).src).searchParams;
    expect(params.get('path')).not.toBeNull();
    expect(params.get('markers')).toBeNull();
  });

  it('ignores a shape with fewer than 3 points', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const project = { ...PROJECT, locationShapes: [{ path: [{ lat: 1, lng: 2 }] }] };
    const { container } = render(<ProjectLocationMap t={THEME} project={project} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a static map image of the drawn outline', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    render(<ProjectLocationMap t={THEME} project={PROJECT} />);

    const img = screen.getByRole('img', { name: /Riverside Greenway/ });
    expect(img).toHaveAttribute('src', expect.stringContaining('https://maps.googleapis.com/maps/api/staticmap?'));
    expect(img.src).toContain('path=');
    expect(img.src).toContain('key=test-key');
  });
});
