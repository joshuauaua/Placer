/* PLACER — the map an Idea Visualizer idea starts on.
 *
 * The map is OpenStreetMap's (lib/map.js), with the areas projects have outlined.
 * Clicking it chooses a spot. Street View, which
 * OpenStreetMap has nothing like, is Google's: the Street View button opens Google's
 * panorama over the map at the nearest photo to that spot, and capturing while it is
 * open takes the background from the Street View Static API (lib/staticMaps.js).
 * Capturing with the map showing takes the map itself.
 */

import { useState, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { Btn } from './UI';
import { MapLegend } from './MapLegend';
import { PALETTE, THEME } from '../theme';
import { isSupabaseConfigured, readProjectLocations } from '../services/projects';
import { captureStreetView as captureStreetViewImage, readPanoramaView as readView } from '../lib/streetViewCapture';
import { loadGoogleMaps } from '../lib/googleMaps';
import { addPlainMarker, createMap, onBackgroundClick, showAreas, toLngLat } from '../lib/map';
import { PlaceSearch } from './PlaceSearch';

// A project's drawn area: a map area is a theme colour's 300, outlined in its 700.
// Projects are set up by the city, so blue — the same LocationMapPicker and
// ProjectLocationMap draw it in while it is being set up and shown off.
const PROJECT_AREA = { fill: PALETTE.blue.c300, stroke: PALETTE.blue.c700 };

const hasCoords = (position) =>
  Number.isFinite(position?.lat) && Number.isFinite(position?.lng);

/**
 * `initialCenter` opens the map somewhere other than the default — used after
 * saving, so the spot the idea was made at is on screen rather than a continent
 * away. Without one, `homeCenter` — the place chosen as the account's location in
 * Settings — opens it over that town instead, zoomed out to show it.
 */
// Close enough for one spot; far enough out to see a whole town.
const PIN_ZOOM = 17;
const HOME_ZOOM = 13;
const DEFAULT_ZOOM = 15;
// How close to the chosen spot a Street View photo has to be to count as of it.
const STREET_VIEW_RADIUS = 100;
// The zoom the map is captured at when a spot turns out to have no Street View.
const FALLBACK_ZOOM = 18;

const MapContainer = ({ onCaptureView, apiKey = '', initialCenter = null, homeCenter = null, onOpenProject }) => {
  const t = THEME;
  const mapRef = useRef(null);
  const panoramaElRef = useRef(null);
  // The StreetViewPanorama over the map. Held in a ref, not state — the capture
  // handler reads getVisible()/getPosition()/getPov() live at click time, so there is
  // nothing to re-render on as the user pans.
  const panoramaRef = useRef(null);
  const [map, setMap] = useState(null);
  // Google's script, which only Street View needs: the map is there without it.
  const [googleLoaded, setGoogleLoaded] = useState(() => !!window.google?.maps);
  // Why Street View could not open at the chosen spot, shown until the next try.
  const [streetViewMessage, setStreetViewMessage] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(
    hasCoords(initialCenter)
      ? initialCenter
      : hasCoords(homeCenter) ? homeCenter : {
        lat: 55.6054,  // STPLN, Malmöhusvägen 5, Malmö — latitude
        lng: 12.9854   // STPLN, Malmöhusvägen 5, Malmö — longitude
      }
  );
  // Every project's drawn location outline, so a project's area shows up here too —
  // not just on its own public page. Loaded once per mount.
  const [projectLocations, setProjectLocations] = useState([]);
  // Whether Street View is open over the map, where the legend's areas
  // are not drawn and it would only be in the way.
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  // Tracks the latest position without making the init effect below re-run on every change —
  // currentPosition should only seed the map's initial center, not trigger re-initialization.
  const currentPositionRef = useRef(currentPosition);
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

  // Load Google's script for Street View, sharing one tag with anything else that needs
  // it — see src/lib/googleMaps.js. Without a key there is no Street View to offer.
  useEffect(() => {
    if (!apiKey) return undefined;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) setGoogleLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to load Google Street View', error);
      });

    return () => { cancelled = true; };
  }, [apiKey]);

  // The map, made once. A click on it — not on an area — chooses the spot.
  useEffect(() => {
    if (!mapRef.current) return undefined;

    let osmMap;
    try {
      osmMap = createMap(mapRef.current, {
        center: currentPositionRef.current,
        zoom: hasCoords(initialCenter) ? PIN_ZOOM : hasCoords(homeCenter) ? HOME_ZOOM : DEFAULT_ZOOM,
      });
    } catch (error) {
      console.error('Error initializing maps:', error);
      return undefined;
    }

    onBackgroundClick(osmMap, (point) => {
      setStreetViewMessage('');
      setCurrentPosition(point);
    });

    setMap(osmMap);
    return () => osmMap.remove();
    // initialCenter and homeCenter only seed where the map opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The panorama, once Google is there: hidden over the map until Street View is asked for.
  useEffect(() => {
    if (!googleLoaded || !panoramaElRef.current || panoramaRef.current) return;
    const panorama = new window.google.maps.StreetViewPanorama(panoramaElRef.current, {
      visible: false,
      addressControl: false,
      fullscreenControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      enableCloseButton: false,
    });
    panorama.addListener('visible_changed', () => {
      setStreetViewOpen(Boolean(panorama.getVisible()));
    });
    panoramaRef.current = panorama;
  }, [googleLoaded]);

  // Load every project's drawn location outline. There is no local fallback to fall
  // into with no Supabase project configured — projects need an account by definition
  // (see services/projects.js's header) — so this is skipped rather than left to throw
  // and be swallowed.
  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;

    readProjectLocations()
      .then((rows) => {
        if (!cancelled) setProjectLocations(rows);
      })
      .catch((error) => {
        // A layer that fails to load must not take the map down with it.
        console.error('Could not load project locations:', error);
      });

    return () => { cancelled = true; };
  }, []);

  // Draw every shape a project has outlined — the same trace ProjectLocationMap shows
  // on its public page, now on the map everyone shares. Clicking one goes to that
  // project's public page, the same destination "View the public page" on its
  // dashboard does.
  useEffect(() => {
    if (!map) return undefined;

    const areas = projectLocations.flatMap((project) =>
      (project.locationShapes ?? []).map((shape) => ({
        path: shape?.path ?? [],
        fill: PROJECT_AREA.fill,
        stroke: PROJECT_AREA.stroke,
        projectId: project.id,
      })));

    return showAreas(map, 'project-areas', areas, {
      onClick: (area) => onOpenProject?.(area.projectId),
    });
  }, [map, projectLocations, onOpenProject]);

  // The spot chosen by clicking or searching: where Street View opens, and what the
  // map is captured around.
  useEffect(() => {
    if (!map || !hasCoords(currentPosition)) return undefined;
    const marker = addPlainMarker(map, currentPosition, { color: PALETTE.orange.c700 });
    return () => marker.remove();
  }, [map, currentPosition]);

  const handlePlacePicked = (place) => {
    setCurrentPosition(place.point);
    setStreetViewMessage('');
    map?.jumpTo({ center: toLngLat(place.point), zoom: PIN_ZOOM });
  };

  // Open Street View at the nearest photo to the chosen spot, or say there is none.
  const openStreetView = () => {
    const panorama = panoramaRef.current;
    if (!panorama || !window.google?.maps?.StreetViewService) return;
    setStreetViewMessage('');
    new window.google.maps.StreetViewService().getPanorama({
      location: currentPosition,
      radius: STREET_VIEW_RADIUS,
      preference: window.google.maps.StreetViewPreference?.NEAREST,
      sources: window.google.maps.StreetViewSource?.OUTDOOR
        ? [window.google.maps.StreetViewSource.OUTDOOR] : undefined,
    }, (data, status) => {
      if (status !== 'OK' || !data?.location?.pano) {
        setStreetViewMessage('No Street View near this spot. Choose a spot on a street and try again.');
        return;
      }
      panorama.setPano(data.location.pano);
      panorama.setPov({ heading: 0, pitch: 0 });
      panorama.setZoom(1);
      panorama.setVisible(true);
    });
  };

  // Back to the map, where Street View had walked to.
  const closeStreetView = () => {
    const panorama = panoramaRef.current;
    const position = panorama?.getPosition?.();
    if (position) {
      const point = { lat: position.lat(), lng: position.lng() };
      setCurrentPosition(point);
      map?.jumpTo({ center: toLngLat(point) });
    }
    panorama?.setVisible(false);
  };

  // The map as it is drawn, as a PNG. `at` moves it there first, and waits for it to
  // finish drawing.
  const captureMap = async (at = null) => {
    if (!map) return null;
    if (at) {
      map.jumpTo({ center: toLngLat(at), zoom: FALLBACK_ZOOM });
      // Waits for it to settle, but not forever: a tile that never arrives is a gap in
      // the picture, not a capture that never happens.
      await new Promise((resolve) => {
        map.once('idle', resolve);
        map.triggerRepaint();
        setTimeout(resolve, 4000);
      });
    }
    return map.getCanvas().toDataURL('image/png');
  };

  // Snapshot the live panorama, or null when the user is looking at the map
  // rather than a Street View panorama.
  const readPanoramaView = () => readView(panoramaRef.current, currentPosition);

  // Ask Google's servers for the panorama image (src/lib/streetViewCapture.js). Falls
  // back to the map at that spot when it has no Street View coverage.
  const captureStreetView = async (view) => {
    try {
      return await captureStreetViewImage(apiKey, view);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.warn('No Street View imagery here — falling back to map view');
      return captureMap(view.position);
    }
  };

  const handleCaptureView = async () => {

    if (!mapRef.current) {
      console.error('Map ref not found');
      return;
    }

    setIsCapturing(true);

    const streetView = readPanoramaView();

    // Street View and the map need different POV data: the panorama reports a
    // real heading/pitch/zoom, while the map only has a zoom level.
    const position = streetView ? streetView.position : currentPosition;
    const pov = streetView
      ? { heading: streetView.heading, pitch: streetView.pitch, zoom: streetView.zoom }
      : { heading: 0, pitch: 0, zoom: map ? Math.round(map.getZoom()) : 1 };

    let screenshot = null;

    try {
      if (streetView) {
        screenshot = await captureStreetView(streetView);
      } else {
        screenshot = await captureMap();
      }
    } catch (error) {
      // Fallback: send data without screenshot
      console.error('Error capturing screenshot:', error);
    } finally {
      setIsCapturing(false);
    }

    const captureSource = streetView ? 'streetview' : 'map';
    posthog.capture('view_captured', {
      source: captureSource,
      has_screenshot: !!screenshot,
    });

    onCaptureView({
      position,
      pov,
      // The field of view the image was taken at, and which surface produced it.
      // Auto-detect needs both to fetch higher-resolution tiles covering the same
      // view — see src/lib/panoGeometry.js.
      fov: streetView ? streetView.fov : null,
      source: captureSource,
      timestamp: new Date().toISOString(),
      screenshot
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: t.page }}>
      {/* Map View */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ width: '100%', height: '100%', position: 'relative', background: t.surface }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {/* Street View, over the map while it is open. */}
          <div ref={panoramaElRef} data-testid="street-view" style={{ position: 'absolute', inset: 0,
            zIndex: 2, visibility: streetViewOpen ? 'visible' : 'hidden' }} />
          {streetViewOpen && (
            <Btn t={t} variant="outline" icon="close" onClick={closeStreetView}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 6, boxShadow: t.shadow }}>
              Back to the map
            </Btn>
          )}

          {!streetViewOpen && <MapLegend t={t} area={PROJECT_AREA} />}

          {streetViewMessage && !streetViewOpen && (
            <div role="status" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              bottom: 'calc(80px + var(--placer-consent-inset, 0px))', zIndex: 5, maxWidth: 'calc(100% - 32px)',
              padding: '10px 14px', borderRadius: 12, background: t.surface, boxShadow: t.shadow,
              fontSize: 14, color: t.ink }}>
              {streetViewMessage}
            </div>
          )}

          {/* Floating controls — bottom-centered over the map: search + capture */}
          <div style={{
            position: 'absolute',
            // Clears the cookie banner while it is up, so search and capture stay reachable.
            bottom: 'calc(24px + var(--placer-consent-inset, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: 'calc(100% - 32px)'
          }}>
            {/* Search Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: '1 1 400px',
              minWidth: 0,
              height: 44,
              padding: '0 16px',
              borderRadius: 12,
              border: `1.5px solid ${t.line}`,
              background: t.surface,
              boxShadow: t.shadow
            }}>
              <Icon name="search" size={19} stroke={2} style={{ color: t.inkDim }} />
              <PlaceSearch value={searchValue} onChange={setSearchValue} onPick={handlePlacePicked}
                near={currentPosition} placement="above" ariaLabel="Search for an address"
                placeholder="Search for an address..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontFamily: 'var(--placer-font)',
                  fontSize: 15,
                  fontWeight: 500,
                  color: t.ink,
                }}
              />
            </div>

            {/* Street View — only with Google's key, which it needs */}
            {apiKey && !streetViewOpen && (
              <Btn
                t={t}
                variant="outline"
                icon="walk"
                onClick={openStreetView}
                disabled={!googleLoaded}
                ariaLabel="Open Street View at the chosen spot"
                style={{ flex: '0 0 auto', width: 44, height: 44, padding: 0, boxShadow: t.shadow }}
              />
            )}

            {/* Capture Button — icon only */}
            <Btn
              t={t}
              variant="accent"
              icon={isCapturing ? 'loader' : 'camera'}
              onClick={handleCaptureView}
              disabled={isCapturing}
              ariaLabel={isCapturing ? 'Capturing view' : 'Capture view'}
              iconStyle={isCapturing ? { animation: 'placer-spin 0.8s linear infinite' } : undefined}
              style={{
                flex: '0 0 auto',
                width: 44,
                height: 44,
                padding: 0,
                boxShadow: t.shadow
              }}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default MapContainer;
