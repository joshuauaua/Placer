import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import posthog from 'posthog-js';
import { ProjectLocationMap } from '../ProjectLocationMap';
import { THEME } from '../../theme';

const PROJECT = {
  name: 'Riverside Greenway',
  locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
};

describe('ProjectLocationMap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders nothing when there is no API key', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
    const { container } = render(<ProjectLocationMap t={THEME} project={PROJECT} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the project has no drawn shape', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const { container } = render(<ProjectLocationMap t={THEME} project={{ ...PROJECT, locationShapes: [] }} />);
    expect(container).toBeEmptyDOMElement();
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

  it('swaps in the pin placeholder when the image fails to load, instead of an empty frame', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
    const captureSpy = vi.spyOn(posthog, 'capture').mockImplementation(() => {});
    const { container } = render(<ProjectLocationMap t={THEME} project={PROJECT} />);

    fireEvent.error(screen.getByRole('img', { name: /Riverside Greenway/ }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"] svg')).toBeInTheDocument();
    expect(captureSpy).toHaveBeenCalledWith('map_load_failed', { surface: 'project_map', reason: 'image_error' });
  });
});
