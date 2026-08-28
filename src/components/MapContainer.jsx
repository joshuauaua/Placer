/* PLOT — Map Container with Google Maps */

import { useState, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { toPng } from 'html-to-image';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ImaginationPreview } from './ImaginationPreview';
import { CAT, THEME } from '../theme';
import { fetchImaginations } from '../services/api';
import {
  DEFAULT_SIZE,
  fetchAsDataUrl,
  fovFromPanoramaZoom,
  staticMapUrl,
  streetViewBackgroundTiles,
  streetViewStaticUrl,
} from '../lib/staticMaps';
import { tilingGain } from '../lib/panoGeometry';

// Pin colour for an imagination saved without a recognised category.
const FALLBACK_PIN_COLOR = THEME.accent;

// Below this resolution gain, tiling is not worth its extra requests: the gain
// comes from spending a whole 640px tile on a slice of the view, so it shrinks as
// the panorama zooms in and the wide shot is already spending its own 640px on a
// narrow arc. At two columns this bows out somewhere around fov 30.
const MIN_TILING_GAIN = 1.25;

// Ceiling on the stitched output, independent of the gain. Composing runs one
// inverse projection per output pixel, and past the 1000x700 stage the extra
// pixels cost time for detail nothing displays.
const MAX_TILING_SCALE = 2;

const hasCoords = (position) =>
  Number.isFinite(position?.lat) && Number.isFinite(position?.lng);

/**
 * `initialCenter` opens the map somewhere other than the default — used after
 * posting, so the imagination that was just saved is on screen rather than a
 * continent away.
 */
const MapContainer = ({ onCaptureView, apiKey = '', initialCenter = null }) => {
  const t = THEME;
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const mapInitializedRef = useRef(false);
  // The StreetViewPanorama bound to the map div. Held in a ref, not state — the
  // capture handler reads getVisible()/getPosition()/getPov() live at click time,
  // so there is nothing to re-render on as the user pans.
  const panoramaRef = useRef(null);
  const [map, setMap] = useState(null);
  const [googleLoaded, setGoogleLoaded] = useState(() => !!window.google);
  const [searchValue, setSearchValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(
    hasCoords(initialCenter)
      ? initialCenter
      : {
        lat: 55.6054,  // STPLN, Malmöhusvägen 5, Malmö — latitude
        lng: 12.9854   // STPLN, Malmöhusvägen 5, Malmö — longitude
      }
  );
  // Imaginations already saved, drawn as pins so people can see where others have
  // been. Loaded once per mount, which is enough: returning from the post step
  // remounts this component, so a just-posted imagination appears without plumbing.
  const [imaginations, setImaginations] = useState([]);
  const markersRef = useRef([]);
  // The imagination whose preview card is open, if any.
  const [selected, setSelected] = useState(null);
  // Tracks the latest position without making the init effect below re-run on every change —
  // currentPosition should only seed the map's initial center, not trigger re-initialization.
  const currentPositionRef = useRef(currentPosition);
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

  // Load Google Maps script
  useEffect(() => {
    if (window.google) {
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;

    script.onload = () => {
      setGoogleLoaded(true);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps script');
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize Google Maps
  useEffect(() => {
    if (!googleLoaded) {
      return;
    }

    if (!mapRef.current) {
      return;
    }

    if (mapInitializedRef.current) {
      return;
    }

    try {
      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: currentPositionRef.current,
        zoom: hasCoords(initialCenter) ? 17 : 15,
        mapTypeControl: true,
        streetViewControl: true,
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -20 }] }
        ]
      });


      panoramaRef.current = googleMap.getStreetView
        ? googleMap.getStreetView()
        : null;

      // Add click listener to update current position
      googleMap.addListener('click', (e) => {
        // A click on open water rather than a pin: put the preview away.
        setSelected(null);
        if (e.latLng) {
          setCurrentPosition({
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
          });
        }
      });

      setMap(googleMap);
      mapInitializedRef.current = true;

      return () => {
        if (googleMap) {
          window.google.maps.event.clearInstanceListeners(googleMap);
        }
      };
    } catch (error) {
      console.error('Error initializing maps:', error);
    }
  }, [googleLoaded]);

  // Load the saved imaginations to pin on the map.
  useEffect(() => {
    let cancelled = false;

    fetchImaginations()
      .then((saved) => {
        if (!cancelled) setImaginations(saved);
      })
      .catch((error) => {
        // A pin layer that fails to load must not take the map down with it.
        console.error('Could not load saved imaginations:', error);
      });

    return () => { cancelled = true; };
  }, []);

  // Drop one pin per saved imagination, coloured by category so the map reads the
  // same way the category tags do. Imaginations saved without coordinates are
  // skipped — there is nowhere to put them.
  useEffect(() => {
    if (!map || !window.google) return;

    const withCoords = imaginations.filter((imagination) => hasCoords(imagination.position));

    markersRef.current = withCoords.map((imagination) => {
      const marker = new window.google.maps.Marker({
        position: imagination.position,
        map,
        title: imagination.title || 'Imagination',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: CAT[imagination.cat]?.color || FALLBACK_PIN_COLOR,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5,
        },
        // Above the plain marker the address search drops.
        zIndex: 10,
      });

      marker.addListener('click', () => {
        posthog.capture('imagination_viewed', {
          imagination_id: imagination.id,
          category: imagination.cat,
          assets_count: imagination.canvasAssets?.length ?? 0,
          lines_count: imagination.lines?.length ?? 0,
        });
        setSelected(imagination);
        // Bring the pin into view so it is obvious which one the card describes.
        map.panTo(imagination.position);
      });

      return marker;
    });

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      // The card describes a marker that no longer exists.
      setSelected(null);
    };
  }, [map, imaginations]);

  // Escape closes the preview, matching the canvas's own Escape behaviour.
  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!googleLoaded || !map || !searchInputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'formatted_address', 'name']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        return;
      }

      const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };

      setCurrentPosition(location);
      map.setCenter(location);
      map.setZoom(17);

      // Add marker at searched location
      new window.google.maps.Marker({
        position: location,
        map: map,
        title: place.formatted_address || place.name
      });

      setSearchValue(place.formatted_address || place.name || '');
    });

    return () => {
      window.google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [googleLoaded, map]);

  // Snapshot the live panorama, or null when the user is looking at the map
  // rather than a Street View panorama.
  const readPanoramaView = () => {
    const panorama = panoramaRef.current;
    if (!panorama?.getVisible?.()) {
      return null;
    }

    const position = panorama.getPosition?.();
    const pov = panorama.getPov?.() || {};
    const zoom = panorama.getZoom?.();

    return {
      // getPosition() is null until the panorama settles on a photo; the map's
      // last known position is the best stand-in until it does.
      position: position
        ? { lat: position.lat(), lng: position.lng() }
        : currentPosition,
      heading: Number(pov.heading),
      pitch: Number(pov.pitch) || 0,
      zoom,
      fov: fovFromPanoramaZoom(zoom),
    };
  };

  // Fetch the view as a grid of narrow tiles and stitch them into one frame
  // sharper than the 640px cap allows on its own. Returns null when tiling is not
  // worth its extra requests, or when composing the tiles failed, leaving the
  // caller on the single wide request.
  //
  // Fetch failures are not caught here on purpose. A 404 means the spot has no
  // coverage and the caller's map fallback is the answer; anything else — a
  // rejected key, a network fault — would meet the single wide request in exactly
  // the same way, so retrying it just spends another request to learn the same
  // thing.
  const captureTiledStreetView = async (view) => {
    const wide = { width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height, fov: view.fov };
    const sources = streetViewBackgroundTiles({
      apiKey,
      location: view.position,
      heading: view.heading,
      pitch: view.pitch,
      fov: view.fov,
      wideSize: DEFAULT_SIZE,
    });
    const tiles = sources.map(({ tile }) => tile);
    const gain = tilingGain(tiles, wide);
    if (gain < MIN_TILING_GAIN) return null;

    const images = await Promise.all(sources.map(({ url }) => fetchAsDataUrl(url)));

    try {
      const { stitchPanoTiles } = await import('../lib/panoStitch');
      return await stitchPanoTiles({
        images,
        tiles,
        wide,
        scale: Math.min(gain, MAX_TILING_SCALE),
      });
    } catch (error) {
      // Composing is all that can still fail with the images already in hand, and
      // a wide capture does not depend on it — so that one is worth a try.
      console.warn('Could not stitch the tiled capture — falling back to one wide image', error);
      return null;
    }
  };

  // Ask Google's servers for the panorama image. Falls back to a top-down map
  // tile when the spot has no Street View coverage (signalled by a 404, which
  // return_error_code=true in streetViewStaticUrl makes Google send instead of a
  // gray placeholder image).
  const captureStreetView = async (view) => {
    try {
      const stitched = await captureTiledStreetView(view);
      if (stitched) return stitched;

      return await fetchAsDataUrl(streetViewStaticUrl({
        apiKey,
        location: view.position,
        heading: view.heading,
        pitch: view.pitch,
        fov: view.fov,
      }));
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      console.warn('No Street View imagery here — falling back to map view');
      return await fetchAsDataUrl(
        staticMapUrl({ apiKey, center: view.position, zoom: 18 })
      );
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
      : { heading: 0, pitch: 0, zoom: map ? map.getZoom() : 1 };

    let screenshot = null;

    try {
      if (streetView) {
        screenshot = await captureStreetView(streetView);
      } else {
        // Small delay to ensure map is fully rendered
        await new Promise(resolve => setTimeout(resolve, 300));

        // Capture screenshot of the map
        screenshot = await toPng(mapRef.current, {
          cacheBust: true,
        });
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

          {selected && (
            <ImaginationPreview t={t} imagination={selected} onClose={() => setSelected(null)} />
          )}

          {/* Floating controls — bottom-centered over the map: search + capture */}
          <div style={{
            position: 'absolute',
            // Clears the cookie banner while it is up, so search and capture stay reachable.
            bottom: 'calc(24px + var(--plot-consent-inset, 0px))',
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
              borderRadius: 10,
              border: `1.5px solid ${t.line}`,
              background: t.surface,
              boxShadow: t.shadow
            }}>
              <Icon name="search" size={19} stroke={2} style={{ color: t.inkDim }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search for an address..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontFamily: "'Archivo', sans-serif",
                  fontSize: 15,
                  fontWeight: 500,
                  color: t.ink,
                  '::placeholder': { color: t.inkDim }
                }}
              />
            </div>

            {/* Capture Button — icon only */}
            <Btn
              t={t}
              variant="accent"
              icon={isCapturing ? 'loader' : 'camera'}
              onClick={handleCaptureView}
              disabled={isCapturing}
              ariaLabel={isCapturing ? 'Capturing view' : 'Capture view'}
              iconStyle={isCapturing ? { animation: 'plot-spin 0.8s linear infinite' } : undefined}
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

      {!apiKey && (
        <div style={{ background: '#FEF3C7', borderLeft: `4px solid #F59E0B`, color: '#92400E',
          padding: 16, margin: 12 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>Google Maps API Key Required</p>
          <p style={{ fontSize: 14 }}>Add your API key to .env to enable map functionality.</p>
        </div>
      )}
    </div>
  );
};

export default MapContainer;
