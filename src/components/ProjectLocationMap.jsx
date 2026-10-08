/* PLACER — the outline a project has drawn on the map, shown as a picture of it.
 *
 * A map that cannot be moved — no dragging, no zoom, no controls — framed on the
 * project's place: this only ever displays what was already saved.
 *
 * A project set up since outlines gave way to addresses has no outline, only the
 * point of its address (supabase/project-setup.sql), and is shown as a pin there.
 */

import { useEffect, useRef } from 'react';
import { addPin, createMap, fitPoints, showAreas } from '../lib/map';
import { CHARACTER } from '../theme';

const SIZE = { width: 1000, height: 240 };

const drawnShapes = (project) =>
  (project?.locationShapes ?? []).filter((shape) => (shape?.path?.length ?? 0) >= 3);

/** The zoom a project's address is shown at: a few streets around it. */
const POINT_ZOOM = 16;

const AREA = { fill: CHARACTER.cityWorker.c300, stroke: CHARACTER.cityWorker.c700 };
const PIN = { fill: CHARACTER.cityWorker.c100, ring: CHARACTER.cityWorker.c700 };

/** Whether ProjectLocationMap has anything to draw for this project. */
export function hasProjectMap(project) {
  return drawnShapes(project).length > 0 || Boolean(project?.locationPoint);
}

/**
 * Renders nothing when the project has neither a drawn shape nor an address point.
 * `size` is the height it is drawn at and `style` overrides how it sits on the page,
 * for the project page's larger hero and the related-project thumbnails.
 */
export function ProjectLocationMap({ t, project, size = SIZE, style }) {
  const containerRef = useRef(null);
  const shapes = drawnShapes(project);
  const point = project?.locationPoint ?? null;
  const drawable = shapes.length > 0 || Boolean(point);
  // Redrawn only when what is drawn changes, not on every render of the page.
  const key = JSON.stringify([shapes.map((shape) => shape.path), point]);

  useEffect(() => {
    if (!drawable || !containerRef.current) return undefined;
    const map = createMap(containerRef.current, {
      center: point ?? shapes[0].path[0],
      zoom: POINT_ZOOM,
      interactive: false,
      controls: false,
    });
    if (shapes.length > 0) {
      showAreas(map, 'project-area', shapes.map((shape) => ({ ...shape, ...AREA })));
      fitPoints(map, shapes.flatMap((shape) => shape.path), { padding: 24 });
    } else {
      addPin(map, point, { ...PIN, title: project?.name });
    }
    return () => map.remove();
    // `key` stands for shapes and point, which are new arrays on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, drawable]);

  if (!drawable) return null;

  return (
    <div ref={containerRef} role="img"
      aria-label={`Map of the area for ${project?.name || 'this project'}`}
      style={{ width: '100%', height: size.height, borderRadius: 16, overflow: 'hidden',
        border: `1px solid ${t.line}`, marginBottom: 28, display: 'block', background: t.surfaceAlt,
        ...style }} />
  );
}

export default ProjectLocationMap;
