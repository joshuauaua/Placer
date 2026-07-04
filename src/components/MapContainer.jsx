/* PLOT — Map Container with Google Maps */

import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Icon } from './Icon';
import { Btn } from './UI';
import { THEME } from '../theme';

const MapContainer = ({ onCaptureView, apiKey = '' }) => {
  const t = THEME;
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const [map, setMap] = useState(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
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
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: -20 }] }
        ]
      });

      console.log('Map created');

      // Add click listener to update current position
      googleMap.addListener('click', (e) => {
        if (e.latLng) {
          setCurrentPosition({
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
          });
        }
      });

      setMap(googleMap);

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

  const handleCaptureView = async () => {
    console.log('Capture button clicked!');

    if (!mapRef.current) {
      console.error('Map ref not found');
      return;
    }

    setIsCapturing(true);

    try {
      // Small delay to ensure map is fully rendered
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture screenshot of the map
      console.log('Capturing screenshot...');
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 1
      });

      // Convert canvas to blob
      const screenshotDataUrl = canvas.toDataURL('image/png');

      console.log('Screenshot captured successfully');

      const captureData = {
        position: currentPosition,
        pov: currentPov,
        timestamp: new Date().toISOString(),
        screenshot: screenshotDataUrl
      };

      console.log('Capturing view data:', captureData);
      onCaptureView(captureData);
    } catch (error) {
      console.error('Error capturing screenshot:', error);

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

        {/* Search Bar */}
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

        {/* Position Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Icon name="pin" size={18} stroke={2} style={{ color: t.accent }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
              {currentPosition.lat.toFixed(4)}, {currentPosition.lng.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Capture Button */}
        <Btn t={t} variant="accent" icon={isCapturing ? "loader" : "sparkle"} onClick={handleCaptureView} disabled={isCapturing}>
          {isCapturing ? 'Capturing...' : 'Capture View'}
        </Btn>
      </div>

      {/* Map View */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ width: '100%', height: '100%', position: 'relative', background: t.surface }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
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
