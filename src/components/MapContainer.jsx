/* PLOT — Map Container with Google Maps */

import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Icon } from './Icon';
import { Btn } from './UI';
import { THEME } from '../theme';

const MapContainer = ({ onCaptureView, apiKey = '' }) => {
  const t = THEME;
  const mapRef = useRef(null);
  const streetViewRef = useRef(null);
  const searchInputRef = useRef(null);
  const [map, setMap] = useState(null);
  const [panorama, setPanorama] = useState(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isStreetViewActive, setIsStreetViewActive] = useState(false);
  const [currentPosition, setCurrentPosition] = useState({
    lat: 59.3293,  // Stockholm latitude
    lng: 18.0686   // Stockholm longitude
  });
  const [currentPov, setCurrentPov] = useState({
    heading: 0,
    pitch: 0,
    zoom: 1
  });

  // Load Google Maps script
  useEffect(() => {
    if (window.google) {
      console.log('Google Maps already loaded');
      setGoogleLoaded(true);
      return;
    }

    console.log('Loading Google Maps script...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;

    script.onload = () => {
      console.log('Google Maps script loaded successfully!');
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
      console.log('Waiting for Google Maps to load...');
      return;
    }

    if (!mapRef.current) {
      console.log('Waiting for DOM refs...');
      return;
    }

    console.log('Initializing Google Maps...');

    try {
      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: currentPosition,
        zoom: 15,
        mapTypeControl: true,
        streetViewControl: true,
        streetViewControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM
        },
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -20 }] }
        ]
      });

      console.log('Map created');

      setMap(googleMap);

      // Listen for when street view is opened (pegman dragged)
      const streetView = googleMap.getStreetView();

      streetView.addListener('visible_changed', () => {
        const isVisible = streetView.getVisible();
        console.log('Street View visible:', isVisible);
        setIsStreetViewActive(isVisible);
      });

      console.log('Map initialized successfully!');

      return () => {
        if (googleMap) {
          window.google.maps.event.clearInstanceListeners(googleMap);
        }
      };
    } catch (error) {
      console.error('Error initializing maps:', error);
    }
  }, [googleLoaded]);

  // Initialize custom Street View panorama when street view becomes active
  useEffect(() => {
    if (!isStreetViewActive || !map || !streetViewRef.current) return;

    console.log('Initializing custom Street View panorama...');

    // Get the default street view from the map
    const defaultStreetView = map.getStreetView();
    const position = defaultStreetView.getPosition();
    const pov = defaultStreetView.getPov();

    // Create our custom panorama
    const customPanorama = new window.google.maps.StreetViewPanorama(
      streetViewRef.current,
      {
        position: position,
        pov: pov,
        zoom: 1,
        addressControl: false,
        fullscreenControl: false,
        linksControl: true,
        panControl: true,
        enableCloseButton: false
      }
    );

    setPanorama(customPanorama);

    // Listen for POV changes
    customPanorama.addListener('pov_changed', () => {
      const newPov = customPanorama.getPov();
      setCurrentPov({
        heading: newPov.heading || 0,
        pitch: newPov.pitch || 0,
        zoom: newPov.zoom || 1
      });
    });

    // Listen for position changes
    customPanorama.addListener('position_changed', () => {
      const pos = customPanorama.getPosition();
      if (pos) {
        setCurrentPosition({
          lat: pos.lat(),
          lng: pos.lng()
        });
      }
    });

    console.log('Custom panorama initialized');

    return () => {
      if (customPanorama) {
        window.google.maps.event.clearInstanceListeners(customPanorama);
      }
    };
  }, [isStreetViewActive, map]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!googleLoaded || !map || !searchInputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'formatted_address', 'name']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        console.log('No geometry found for place');
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

  const handleBackToMap = () => {
    if (panorama) {
      panorama.setVisible(false);
      setIsStreetViewActive(false);
    }
  };

  const handleCaptureView = async () => {
    console.log('Capture button clicked!');

    if (!panorama || !isStreetViewActive) {
      alert('Please enter Street View first by dragging the yellow pegman onto the map.');
      return;
    }

    setIsCapturing(true);

    try {
      // Get the current street view state
      const position = panorama.getPosition();
      const pov = panorama.getPov();

      if (!position) {
        throw new Error('No Street View position available');
      }

      // Generate a static Street View image URL
      const width = 1000;
      const height = 700;

      // Build the Street View Static API URL
      const streetViewStaticUrl = `https://maps.googleapis.com/maps/api/streetview?` +
        `size=${width}x${height}` +
        `&location=${position.lat()},${position.lng()}` +
        `&heading=${pov.heading || 0}` +
        `&pitch=${pov.pitch || 0}` +
        `&fov=90` +
        `&key=${apiKey}`;

      console.log('Generating static Street View image...');

      // Fetch the static Street View image and convert to data URL
      const response = await fetch(streetViewStaticUrl);
      const blob = await response.blob();

      // Convert blob to data URL
      const reader = new FileReader();
      const screenshotDataUrl = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      console.log('Street View screenshot captured successfully');

      const captureData = {
        position: {
          lat: position.lat(),
          lng: position.lng()
        },
        pov: {
          heading: pov.heading || 0,
          pitch: pov.pitch || 0,
          zoom: pov.zoom || 1
        },
        timestamp: new Date().toISOString(),
        screenshot: screenshotDataUrl
      };

      console.log('Capturing view data:', captureData);
      onCaptureView(captureData);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      alert('Error capturing Street View. Please make sure Street View is available at this location.');

      // Fallback: send data without screenshot
      const captureData = {
        position: currentPosition,
        pov: currentPov,
        timestamp: new Date().toISOString(),
        screenshot: null
      };

      onCaptureView(captureData);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: t.page }}>
      {/* Top Bar */}
      <div style={{ background: t.chrome, borderBottom: `1px solid ${t.line}`, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Back Button (only shown in Street View) */}
        {isStreetViewActive && (
          <button
            onClick={handleBackToMap}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: `1.5px solid ${t.line}`,
              background: t.surface,
              color: t.ink,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            <Icon name="arrowLeft" size={18} stroke={2} />
            Back to Map
          </button>
        )}

        {/* Search Bar (only shown in map view) */}
        {!isStreetViewActive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: '0 0 400px',
            height: 44,
            padding: '0 16px',
            borderRadius: 10,
            border: `1.5px solid ${t.line}`,
            background: t.surface
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
        )}

        {/* Position Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Icon name="pin" size={18} stroke={2} style={{ color: t.accent }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
              {currentPosition.lat.toFixed(4)}, {currentPosition.lng.toFixed(4)}
            </div>
            {isStreetViewActive && (
              <div style={{ fontSize: 12, color: t.inkDim }}>
                Heading: {currentPov.heading.toFixed(0)}° | Pitch: {currentPov.pitch.toFixed(0)}°
              </div>
            )}
          </div>
        </div>

        {/* Capture Button (only shown in Street View) */}
        {isStreetViewActive && (
          <Btn t={t} variant="accent" icon={isCapturing ? "loader" : "sparkle"} onClick={handleCaptureView} disabled={isCapturing}>
            {isCapturing ? 'Capturing...' : 'Capture View'}
          </Btn>
        )}
      </div>

      {/* Main View Area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Map View */}
        {!isStreetViewActive && (
          <div style={{
            width: '100%',
            height: '100%',
            background: t.surface
          }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

            {/* Instructions Overlay */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '16px 24px',
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              maxWidth: '90%',
              zIndex: 10
            }}>
              <Icon name="info" size={20} stroke={2} />
              <span>Drag the yellow pegman <span style={{ color: '#FFD700' }}>👤</span> onto the street to enter Street View</span>
            </div>
          </div>
        )}

        {/* Street View - Only render when active */}
        {isStreetViewActive && (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#000'
          }}>
            <div ref={streetViewRef} style={{ width: '100%', height: '100%' }} />

            {/* Street View Instructions */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '12px 20px',
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 10
            }}>
              <Icon name="rotate" size={18} stroke={2} />
              <span>Rotate the view to frame your shot, then click Capture</span>
            </div>
          </div>
        )}
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
