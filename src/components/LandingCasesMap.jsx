/* PLACER — the map over the landing page's case studies
 *
 * The same OpenStreetMap ground as Explore (lib/map.js), with a pin for each
 * case study that has a `position`. Picking a pin brings its card into view in
 * the row below. Loaded lazily by LandingPage, so MapLibre is only fetched once
 * the page gets this far.
 */

import { useEffect, useRef } from 'react';
import { CHARACTER } from '../theme';
import { addPin, createMap, fitPoints, toLngLat } from '../lib/map';

// STPLN, Malmöhusvägen 5, Malmö — where Explore opens too.
const HOME = { lat: 55.6054, lng: 12.9854 };
const HOME_ZOOM = 12;

// Case studies are orange on Explore, so here too.
const PIN = { fill: CHARACTER.citizen.c100, ring: CHARACTER.citizen.c700 };

const hasCoords = (position) =>
  Number.isFinite(position?.lat) && Number.isFinite(position?.lng);

export default function LandingCasesMap({ studies, onPick }) {
  const container = useRef(null);
  // Held so a new onPick each render need not remake the map.
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!container.current) return undefined;
    let map;
    try {
      // The map sits in a page that scrolls, so the wheel scrolls the page
      // unless Ctrl or Cmd is held, and one finger does the same on a phone.
      map = createMap(container.current, { center: HOME, zoom: HOME_ZOOM, cooperativeGestures: true });
    } catch (error) {
      console.error('Could not draw the case studies map:', error);
      return undefined;
    }

    const placed = studies
      .map((study, index) => ({ study, index }))
      .filter(({ study }) => hasCoords(study.position));
    placed.forEach(({ study, index }) => {
      addPin(map, study.position, { ...PIN, title: study.title, onClick: () => pick.current?.(index) });
    });
    if (placed.length > 1) fitPoints(map, placed.map(({ study }) => study.position), { padding: 64, maxZoom: 13 });
    else if (placed.length === 1) map.jumpTo({ center: toLngLat(placed[0].study.position) });

    return () => map.remove();
  }, [studies]);

  return <div ref={container} className="placer-landing-cases-map" data-testid="landing-cases-map" />;
}
