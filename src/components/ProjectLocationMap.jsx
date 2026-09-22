/* PLACER — the outline a project has drawn on the map, shown as a plain image.
 *
 * A single <img> against the Maps Static API rather than a live google.maps.Map: this
 * only ever displays what LocationMapPicker already saved, so there is nothing here
 * that needs the JS API's script, drag handles, or edit events.
 */

import { googleMapsApiKey } from '../lib/googleMaps';
import { staticMapUrl } from '../lib/staticMaps';

const SIZE = { width: 1000, height: 240 };

/** Renders nothing when the project has no drawn shape, or there is no API key. */
export function ProjectLocationMap({ t, project }) {
  const apiKey = googleMapsApiKey();
  const shapes = (project?.locationShapes ?? []).filter((shape) => (shape?.path?.length ?? 0) >= 3);
  if (!apiKey || shapes.length === 0) return null;

  const url = staticMapUrl({ apiKey, paths: shapes, pathColor: t.accent, size: SIZE });

  return (
    <img
      src={url}
      alt={`Map of the area for ${project?.name || 'this project'}`}
      style={{ width: '100%', height: 240, objectFit: 'cover', borderRadius: 12,
        border: `1px solid ${t.line}`, marginBottom: 28, display: 'block' }}
    />
  );
}

export default ProjectLocationMap;
