/* PLACER — Toolkit: setting up Idea Visualizer for a project.
 *
 * The scene everybody taking part draws on, as the first stage of the registry entry's
 * `setup.steps` (SetupSteps walks through it, then when the room starts and how long
 * it stays open): the address, picked from the suggestions; a map of the area around
 * it; and, in the same card, its Street View, turned and zoomed to the view wanted
 * and taken as a photo. The photo is uploaded straight away (uploadSceneImage) and the
 * setup keeps its path, with where and how it was taken.
 *
 * The photo only ever comes from Street View: without Google's key there is none to
 * take it from, and the step says so rather than accept any other picture. This only
 * edits the setup.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Btn } from '../UI';
import { AddressInput } from '../AddressInput';
import { addPlainMarker, createMap, onBackgroundClick, toLngLat } from '../../lib/map';
import { googleMapsApiKey, loadGoogleMaps } from '../../lib/googleMaps';
import { captureStreetView, readPanoramaView } from '../../lib/streetViewCapture';
import { mediaUrl } from '../../services/media';
import { uploadSceneImage } from '../../services/projects';
import { PALETTE } from '../../theme';

// Close enough to see the streets around the address.
const AREA_ZOOM = 17;
// How close to the chosen spot a Street View photo has to be to count as of it.
const STREET_VIEW_RADIUS = 100;

const fieldStyle = (t) => ({
  width: '100%', height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
  background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15, boxSizing: 'border-box',
});

async function dataUrlToFile(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], 'street-view.jpg', { type: blob.type || 'image/jpeg' });
}

/** The address, its map, and the Street View photo taken from it. */
export function SceneStep({ t, project = null, setup, onChange }) {
  const id = useId();
  const apiKey = googleMapsApiKey();
  const mapEl = useRef(null);
  const panoramaEl = useRef(null);
  const mapRef = useRef(null);
  const panoramaRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(() => Boolean(window.google?.maps));
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'taking' | 'uploading'
  const [message, setMessage] = useState('');
  // The photo just taken, shown from memory until the uploaded copy is the one to show.
  const [taken, setTaken] = useState(null);

  const point = setup.point ?? null;
  const photo = taken ?? mediaUrl(setup.imagePath);

  // The map of the area, once there is an address to show the area of.
  useEffect(() => {
    if (!point || !mapEl.current || mapRef.current) return undefined;
    let map;
    try {
      map = createMap(mapEl.current, { center: point, zoom: AREA_ZOOM });
    } catch (err) {
      console.error('Could not load the map:', err);
      return undefined;
    }
    // A spot clicked on the map is where Street View opens.
    onBackgroundClick(map, (spot) => onChange((current) => ({ ...current, point: spot })));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Made once there is a point; later points move its marker rather than remake it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(point)]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return undefined;
    const marker = addPlainMarker(map, point, { color: PALETTE.orange.c700 });
    return () => marker.remove();
  }, [point]);

  // Google's script, which only Street View needs.
  useEffect(() => {
    if (!apiKey) return undefined;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => { if (!cancelled) setGoogleReady(true); })
      .catch((err) => console.error('Failed to load Google Street View', err));
    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    if (!googleReady || !panoramaEl.current || panoramaRef.current) return;
    const panorama = new window.google.maps.StreetViewPanorama(panoramaEl.current, {
      visible: false, addressControl: false, fullscreenControl: false, motionTracking: false,
      motionTrackingControl: false, enableCloseButton: false,
    });
    panorama.addListener('visible_changed', () => setStreetViewOpen(Boolean(panorama.getVisible())));
    panoramaRef.current = panorama;
  }, [googleReady, Boolean(point)]);

  const openStreetView = () => {
    const panorama = panoramaRef.current;
    if (!panorama || !window.google?.maps?.StreetViewService || !point) return;
    setMessage('');
    new window.google.maps.StreetViewService().getPanorama({
      location: point,
      radius: STREET_VIEW_RADIUS,
      preference: window.google.maps.StreetViewPreference?.NEAREST,
      sources: window.google.maps.StreetViewSource?.OUTDOOR ? [window.google.maps.StreetViewSource.OUTDOOR] : undefined,
    }, (data, found) => {
      if (found !== 'OK' || !data?.location?.pano) {
        setMessage('No Street View near this spot. Click a spot on a street on the map and try again.');
        return;
      }
      panorama.setPano(data.location.pano);
      panorama.setPov(setup.view ? { heading: setup.view.heading, pitch: setup.view.pitch } : { heading: 0, pitch: 0 });
      panorama.setZoom(setup.view?.zoom ?? 1);
      panorama.setVisible(true);
    });
  };

  const upload = async (file, view) => {
    setStatus('uploading');
    try {
      const imagePath = await uploadSceneImage(project.id, file);
      onChange((current) => ({ ...current, imagePath, view }));
      setMessage('');
    } catch (err) {
      console.error('Could not upload the photo:', err);
      setTaken(null);
      setMessage(err?.message ?? 'Could not upload the photo.');
    } finally {
      setStatus('idle');
    }
  };

  const takePhoto = async () => {
    const view = readPanoramaView(panoramaRef.current, point);
    if (!view) return;
    setStatus('taking');
    setMessage('');
    let dataUrl;
    try {
      dataUrl = await captureStreetView(apiKey, view);
    } catch (err) {
      console.error('Could not take the photo:', err);
      setMessage(err?.status === 404
        ? 'There is no Street View photo of this spot. Try another spot on a street.'
        : 'Could not take the photo. Please try again.');
      setStatus('idle');
      return;
    }
    setTaken(dataUrl);
    panoramaRef.current?.setVisible(false);
    await upload(await dataUrlToFile(dataUrl), {
      position: view.position, heading: view.heading, pitch: view.pitch, zoom: view.zoom, fov: view.fov,
    });
  };

  const busy = status !== 'idle';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`${id}-address`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Address *</label>
        <span style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.5 }}>
          Pick it from the suggestions, so everybody&rsquo;s ideas are pinned there.
        </span>
        <AddressInput id={`${id}-address`} value={setup.address ?? ''} placeholder="e.g. Folkets Park, Malmö"
          style={fieldStyle(t)}
          onChange={(address) => onChange((current) => ({ ...current, address, point: null }))}
          onPick={(picked) => {
            onChange((current) => ({ ...current, address: picked.address, point: picked.point }));
            mapRef.current?.jumpTo({ center: toLngLat(picked.point), zoom: AREA_ZOOM });
          }} />
      </div>

      {point && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Select a view *</div>
          <span style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.5 }}>
            {apiKey
              ? 'The map shows the area around the address. Click the spot to stand on, open Street View, turn and zoom to the view everybody should imagine in, and take its photo.'
              : 'The photo is taken in Street View, which needs a Google Maps key (VITE_GOOGLE_MAPS_API_KEY). This copy of PLACER does not have one, so the view cannot be taken here.'}
          </span>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '10 / 7', borderRadius: 12, overflow: 'hidden',
            border: `1.5px solid ${t.line}`, background: t.surfaceAlt }}>
            <div ref={mapEl} role="application" aria-label="Map of the area around the address. Click to choose where to stand."
              style={{ position: 'absolute', inset: 0 }} />
            <div ref={panoramaEl} data-testid="setup-street-view"
              style={{ position: 'absolute', inset: 0, zIndex: 2, visibility: streetViewOpen ? 'visible' : 'hidden' }} />
          </div>
          {apiKey && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {streetViewOpen ? (
                <>
                  <Btn t={t} type="button" variant="primary" size="sm" icon={busy ? 'loader' : 'camera'} disabled={busy}
                    onClick={takePhoto}>
                    {status === 'taking' ? 'Taking the photo…' : 'Take the photo'}
                  </Btn>
                  <Btn t={t} type="button" variant="outline" size="sm" icon="close" disabled={busy}
                    onClick={() => panoramaRef.current?.setVisible(false)}>
                    Back to the map
                  </Btn>
                </>
              ) : (
                <Btn t={t} type="button" variant="outline" size="sm" icon="walk" disabled={!googleReady || busy}
                  onClick={openStreetView}>
                  {photo ? 'Take another photo in Street View' : 'Open Street View'}
                </Btn>
              )}
            </div>
          )}
          {message && <p role="alert" style={{ fontSize: 13, color: '#B3261E', margin: 0 }}>{message}</p>}
        </div>
      )}

      {photo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>The photo everybody imagines on</div>
          <img src={photo} alt="The view everybody imagines on" style={{ display: 'block', width: '100%',
            aspectRatio: '10 / 7', objectFit: 'cover', borderRadius: 12, border: `1px solid ${t.line}` }} />
          <span role="status" style={{ fontSize: 13, color: t.inkDim }}>
            {status === 'uploading' ? 'Saving the photo…' : 'Saved. Continue when it is the view you want.'}
          </span>
        </div>
      )}
    </div>
  );
}

export default SceneStep;
