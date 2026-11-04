import { describe, it, expect } from 'vite-plus/test';
import { render, screen, waitFor } from '@testing-library/react';
import { ProjectLocationMap, hasProjectMap } from '../ProjectLocationMap';
import { THEME } from '../../theme';
import { lastMap, maps } from '../../test/maplibreStub';

const PROJECT = {
  name: 'Riverside Greenway',
  locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.61, lng: 12.98 }, { lat: 55.61, lng: 12.99 }] }],
};

describe('ProjectLocationMap', () => {
  it('needs no API key: a project with an outline always has a map', () => {
    expect(hasProjectMap(PROJECT)).toBe(true);
  });

  it('renders nothing when the project has neither a drawn shape nor an address point', () => {
    const { container } = render(<ProjectLocationMap t={THEME} project={{ ...PROJECT, locationShapes: [] }} />);
    expect(container).toBeEmptyDOMElement();
    expect(maps).toHaveLength(0);
  });

  it('pins the address of a project with no outline', () => {
    const project = { ...PROJECT, locationShapes: [], locationPoint: { lat: 55.59, lng: 13.01 } };
    render(<ProjectLocationMap t={THEME} project={project} />);

    const map = lastMap();
    expect(map.center).toEqual({ lat: 55.59, lng: 13.01 });
    expect(map.markers).toHaveLength(1);
    expect(map.markers[0].getLngLat()).toEqual({ lat: 55.59, lng: 13.01 });
  });

  it('draws the outline rather than the pin when a project has both', async () => {
    render(<ProjectLocationMap t={THEME} project={{ ...PROJECT, locationPoint: { lat: 55.59, lng: 13.01 } }} />);

    const map = lastMap();
    await waitFor(() => expect(map.getSource('project-area')).toBeDefined());
    expect(map.markers).toHaveLength(0);
    // Framed on the outline's points.
    expect(map.bounds.points).toEqual(expect.arrayContaining([{ lat: 55.61, lng: 12.99 }]));
  });

  it('ignores a shape with fewer than 3 points', () => {
    const project = { ...PROJECT, locationShapes: [{ path: [{ lat: 1, lng: 2 }] }] };
    const { container } = render(<ProjectLocationMap t={THEME} project={project} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a map that cannot be moved, named for the project', async () => {
    render(<ProjectLocationMap t={THEME} project={PROJECT} />);

    expect(screen.getByRole('img', { name: /Riverside Greenway/ })).toBeInTheDocument();
    expect(lastMap().options.interactive).toBe(false);
    await waitFor(() => {
      const ring = lastMap().getSource('project-area').data.features[0].geometry.coordinates[0];
      // Closed: it ends where it starts, as GeoJSON asks.
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(ring[0]).toEqual([12.98, 55.6]);
    });
  });
});
