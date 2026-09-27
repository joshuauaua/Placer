/* PLACER — the outline a project has drawn on the map, shown as a plain image.
 *
 * A single <img> against the Maps Static API rather than a live google.maps.Map: this
 * only ever displays what LocationMapPicker already saved, so there is nothing here
 * that needs the JS API's script, drag handles, or edit events.
 */

import { useState } from 'react';
import posthog from 'posthog-js';
import { Icon } from './Icon';
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

/** Stands in for the map when there is none to show, so the page keeps its shape. */
export function ImagePlaceholder({ t, frame }) {
  return (
    <div aria-hidden="true" style={{ ...frame, borderRadius: 16, background: CHARACTER.cityWorker.c50,
      border: `1px solid ${t.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 72, height: 72, borderRadius: '50%', background: CHARACTER.cityWorker.c100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
        <Icon name="pin" size={32} stroke={1.5} />
      </span>
    </div>
  );
}

/**
 * Renders nothing when the project has no drawn shape, or there is no API key.
 * `size` is the image requested and `style` overrides how it sits on the page,
 * for the project page's larger hero and the related-project thumbnails.
 */
export function ProjectLocationMap({ t, project, size = SIZE, style }) {
  // Google sometimes does not answer at all (the request ends with no status), and a
  // broken <img> is an empty framed box. The placeholder at least keeps the page's shape.
  const [failed, setFailed] = useState(false);
  const apiKey = googleMapsApiKey();
  const shapes = drawnShapes(project);
  if (!apiKey || shapes.length === 0) return null;

  const frame = { width: '100%', height: size.height, ...style };
  if (failed) return <ImagePlaceholder t={t} frame={frame} />;

  const url = staticMapUrl({ apiKey, paths: shapes, pathColor: CHARACTER.cityWorker.c700, size });

  return (
    <img
      src={url}
      alt={`Map of the area for ${project?.name || 'this project'}`}
      onError={() => {
        posthog.capture('map_load_failed', { surface: 'project_map', reason: 'image_error' });
        setFailed(true);
      }}
      // The placeholder's tint while the image is in flight, rather than a blank box.
      style={{ width: '100%', height: size.height, objectFit: 'cover', borderRadius: 16,
        border: `1px solid ${t.line}`, marginBottom: 28, display: 'block',
        background: CHARACTER.cityWorker.c50, ...style }}
    />
  );
}

export default ProjectLocationMap;
