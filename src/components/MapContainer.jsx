/* PLACER — Idea Visualizer's first step: the place, and the photo of it to draw on.
 *
 * The map is OpenStreetMap's (lib/map.js), with nothing on it but the pin: this is
 * for finding one place, so other projects' areas and their key are left off. Searching an address or clicking the map pins the spot. The photo then comes one of
 * two ways, and both are pinned there:
 *
 *   Street View, which OpenStreetMap has nothing like, is Google's: the Street View
 *   button opens Google's panorama over the map at the nearest photo to the pin, and
 *   taking the photo while it is open asks the Street View Static API for that view
 *   (lib/streetViewCapture.js). Only a Street View can be taken: the map itself is not
 *   a picture of the place.
 *
 *   Upload a photo, for one taken there yourself. It is re-encoded on this device
 *   (lib/imageEncode.js), which also strips its location and camera metadata.
 */

import { useState, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { Icon } from './Icon';
import { Btn } from './UI';
import { THEME } from '../theme';
import { captureStreetView as captureStreetViewImage, readPanoramaView as readView } from '../lib/streetViewCapture';
import { IMAGE_PRESETS, encodeImage } from '../lib/imageEncode';
import { loadGoogleMaps } from '../lib/googleMaps';
import { addPlainMarker, createMap, onBackgroundClick, toLngLat } from '../lib/map';
import { PlaceSearch } from './PlaceSearch';

// The pin, in the electric blue the landing page uses for what can be acted on.
const PIN_COLOR = '#3A39FF';

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

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error ?? new Error('The picture could not be read.'));
  reader.readAsDataURL(blob);
});

function Guide({ t, children }) {
  return (
    <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 5, maxWidth: 'min(380px, calc(100% - 32px))',
      padding: '16px 18px', borderRadius: 12, background: t.surface, boxShadow: t.shadow,
      fontSize: 14, lineHeight: 1.5, color: t.ink }}>
      {children}
    </div>
  );
}

function GuideTitle({ children }) {
  return <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{children}</div>;
}

function GuideStep({ t, n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: n > 1 ? 10 : 0 }}>
      <span aria-hidden="true" style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: '50%', background: PIN_COLOR,
        color: '#FFFFFF', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1 }}>
        {n}
      </span>
      <div>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: t.inkDim }}>{children}</div>
      </div>
    </div>
  );
}

const MapContainer = ({ onCaptureView, apiKey = '', initialCenter = null, homeCenter = null }) => {
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
  // The address picked from the search, while the pin is still on it.
  const [address, setAddress] = useState('');
  const uploadRef = useRef(null);
  const [currentPosition, setCurrentPosition] = useState(
    hasCoords(initialCenter)
      ? initialCenter
      : hasCoords(homeCenter) ? homeCenter : {
        lat: 55.6054,  // STPLN, Malmöhusvägen 5, Malmö — latitude
        lng: 12.9854   // STPLN, Malmöhusvägen 5, Malmö — longitude
      }
  );
  // Whether Street View is open over the map.
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
      setAddress('');
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
    setStreetViewOpen(Boolean(panorama.getVisible()));
  }, [googleLoaded]);

  // The spot chosen by clicking or searching: where Street View opens, and what the
  // map is captured around.
  useEffect(() => {
    if (!map || !hasCoords(currentPosition)) return undefined;
    const marker = addPlainMarker(map, currentPosition, { color: PIN_COLOR });
    return () => marker.remove();
  }, [map, currentPosition]);

  const handlePlacePicked = (place) => {
    setCurrentPosition(place.point);
    setAddress(place.label ?? '');
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
      // Walked off from the address, so the pin is no longer on it.
      if (point.lat !== currentPosition.lat || point.lng !== currentPosition.lng) setAddress('');
      setCurrentPosition(point);
      map?.jumpTo({ center: toLngLat(point) });
    }
    panorama?.setVisible(false);
  };

  // Take the open Street View as the photo (src/lib/streetViewCapture.js).
  const handleCaptureView = async () => {
    const streetView = readView(panoramaRef.current, currentPosition);
    if (!streetView) return;

    setIsCapturing(true);
    setStreetViewMessage('');
    let screenshot = null;
    try {
      // At the shape the panorama has on screen, so the photo is the view as framed.
      const box = panoramaElRef.current?.getBoundingClientRect?.();
      const aspect = box?.width > 0 && box?.height > 0 ? box.width / box.height : undefined;
      screenshot = await captureStreetViewImage(apiKey, streetView, { aspect });
    } catch (error) {
      console.error('Error capturing Street View:', error);
      setStreetViewMessage(error?.status === 404
        ? 'There is no Street View photo of this spot. Walk to another, or upload a photo of your own.'
        : 'Could not take the photo. Please try again.');
      return;
    } finally {
      setIsCapturing(false);
    }

    posthog.capture('view_captured', { source: 'streetview', has_screenshot: true });
    onCaptureView({
      position: streetView.position,
      address: address || null,
      pov: { heading: streetView.heading, pitch: streetView.pitch, zoom: streetView.zoom },
      // The field of view the image was taken at, and which surface produced it.
      // Auto-detect needs both to fetch higher-resolution tiles covering the same
      // view — see src/lib/panoGeometry.js.
      fov: streetView.fov,
      source: 'streetview',
      timestamp: new Date().toISOString(),
      screenshot,
    });
  };

  // A photo of the place taken by the person themselves, pinned where the map's pin is.
  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    // So picking the same file again still reports a change.
    event.target.value = '';
    if (!file) return;
    setIsCapturing(true);
    setStreetViewMessage('');
    let screenshot;
    try {
      const { blob } = await encodeImage(file, IMAGE_PRESETS.scene);
      screenshot = await blobToDataUrl(blob);
    } catch (error) {
      console.error('Could not use the uploaded photo:', error);
      setStreetViewMessage(error?.message ?? 'That photo could not be used. Try a JPEG, PNG or WebP.');
      return;
    } finally {
      setIsCapturing(false);
    }

    posthog.capture('view_captured', { source: 'upload', has_screenshot: true });
    onCaptureView({
      position: currentPosition,
      address: address || null,
      pov: null,
      fov: null,
      source: 'upload',
      timestamp: new Date().toISOString(),
      screenshot,
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

          {streetViewMessage && (
            <div role="status" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              bottom: 'calc(80px + var(--placer-consent-inset, 0px))', zIndex: 5, maxWidth: 'calc(100% - 32px)',
              padding: '10px 14px', borderRadius: 12, background: t.surface, boxShadow: t.shadow,
              fontSize: 14, color: t.ink }}>
              {streetViewMessage}
            </div>
          )}

          {/* The guide: what to do on the map, then what to do in Street View. */}
          <Guide t={t}>
            {streetViewOpen ? (
              <>
                <GuideTitle t={t}>Frame the view</GuideTitle>
                <p style={{ margin: 0 }}>
                  Drag to look around, scroll to zoom, and click the arrows on the road to move.
                  When the view shows the spot you want to change, press <strong>Take this photo</strong>.
                </p>
              </>
            ) : (
              <>
                <GuideTitle t={t}>Start with a photo of the place</GuideTitle>
                <GuideStep t={t} n={1} title="Find the place">
                  Type an address in the search bar below, or click anywhere on the map. The blue pin marks the spot.
                </GuideStep>
                <GuideStep t={t} n={2} title="Get a photo of it, one of two ways">
                  <span style={{ display: 'block', marginTop: 4 }}>
                    <strong style={{ color: t.ink }}>Street View:</strong> press <em>Street View</em> to stand at the pin,
                    turn to the view you want, and take the photo.
                    {!apiKey && ' (Not set up in this copy of PLACER: it needs a Google Maps key.)'}
                  </span>
                  <span style={{ display: 'block', marginTop: 4 }}>
                    <strong style={{ color: t.ink }}>Your own photo:</strong> press <em>Upload a photo</em> and pick one
                    you took there. It is pinned where the blue pin is.
                  </span>
                </GuideStep>
                <p style={{ margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${t.line}`, color: t.inkDim, fontSize: 13 }}>
                  Next, you place trees, benches and more on your photo.
                </p>
              </>
            )}
          </Guide>

          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleUpload} data-testid="upload-photo" style={{ display: 'none' }} />

          {/* Floating controls, bottom-centred over the map: search and the two ways to a
              photo; with Street View open, taking it. */}
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
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: streetViewOpen ? 'auto' : 'min(760px, calc(100% - 32px))',
          }}>
            {streetViewOpen ? (
              <Btn
                t={t}
                variant="accent"
                icon={isCapturing ? 'loader' : 'camera'}
                onClick={handleCaptureView}
                disabled={isCapturing}
                iconStyle={isCapturing ? { animation: 'placer-spin 0.8s linear infinite' } : undefined}
                style={{ height: 48, padding: '0 22px', boxShadow: t.shadow }}
              >
                {isCapturing ? 'Taking the photo…' : 'Take this photo'}
              </Btn>
            ) : (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flex: '1 1 300px',
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

                {/* Street View, always offered as one of the two ways, but it only works
                    with Google's key. */}
                <Btn t={t} variant="accent" icon="walk" onClick={openStreetView}
                  disabled={!apiKey || !googleLoaded || isCapturing}
                  title={apiKey ? undefined : 'Street View needs a Google Maps key'}
                  style={{ flex: '0 0 auto', height: 44, boxShadow: t.shadow }}>
                  Street View
                </Btn>

                <span aria-hidden="true" style={{ flex: '0 0 auto', padding: '4px 10px', borderRadius: 999,
                  background: t.surface, boxShadow: t.shadow, fontSize: 13, fontWeight: 700, color: t.inkDim }}>
                  or
                </span>

                <Btn t={t} variant="outline" icon={isCapturing ? 'loader' : 'image'}
                  onClick={() => uploadRef.current?.click()} disabled={isCapturing}
                  iconStyle={isCapturing ? { animation: 'placer-spin 0.8s linear infinite' } : undefined}
                  style={{ flex: '0 0 auto', height: 44, boxShadow: t.shadow, background: t.surface }}>
                  {isCapturing ? 'Preparing the photo…' : 'Upload a photo'}
                </Btn>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default MapContainer;
