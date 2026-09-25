/* PLACER — the outline a project has drawn on the map, shown as a plain image.
 *
 * A single <img> against the Maps Static API rather than a live google.maps.Map: this
 * only ever displays what LocationMapPicker already saved, so there is nothing here
 * that needs the JS API's script, drag handles, or edit events.
 */

import { googleMapsApiKey } from '../lib/googleMaps';
import { staticMapUrl } from '../lib/staticMaps';
import { CHARACTER } from '../theme';

const SIZE = { width: 1000, height: 240 };

const drawnShapes = (project) =>
  (project?.locationShapes ?? []).filter((shape) => (shape?.path?.length ?? 0) >= 3);

/** Whether ProjectLocationMap has anything to draw for this project. */
export function hasProjectMap(project) {
  return Boolean(googleMapsApiKey()) && drawnShapes(project).length > 0;
}

/**
 * Renders nothing when the project has no drawn shape, or there is no API key.
 * `size` is the image requested and `style` overrides how it sits on the page,
 * for the project page's larger hero and the related-project thumbnails.
 */
export function ProjectLocationMap({ t, project, size = SIZE, style }) {
  const apiKey = googleMapsApiKey();
  const shapes = drawnShapes(project);
  if (!apiKey || shapes.length === 0) return null;

  const url = staticMapUrl({ apiKey, paths: shapes, pathColor: CHARACTER.cityWorker.c700, size });

  return (
    <img
      src={url}
      alt={`Map of the area for ${project?.name || 'this project'}`}
      style={{ width: '100%', height: size.height, objectFit: 'cover', borderRadius: 16,
        border: `1px solid ${t.line}`, marginBottom: 28, display: 'block', ...style }}
    />
  );
}

export default ProjectLocationMap;
