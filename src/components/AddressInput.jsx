/* PLACER — an address field with Google Places suggestions.
 *
 * Any address or place, suggested as it is typed — the same service as Settings'
 * location, but not only towns. Choosing a suggestion reports the address, where it
 * is, and the town and country worked out from it (lib/address.js) through `onPick`.
 * Typing by hand afterwards reports only the text, through `onChange`, and the caller
 * drops the point, since the text no longer says where it was. Without a Maps key it
 * is a plain text field.
 *
 * Used by an organisation's setup and a project's.
 */

import { useEffect, useRef } from 'react';
import { googleMapsApiKey, isGoogleMapsConfigured, loadGoogleMaps } from '../lib/googleMaps';
import { townAndCountry } from '../lib/address';

export function AddressInput({ id, value, onChange, onPick, placeholder, style }) {
  const inputRef = useRef(null);
  // The listener is set up once, so it reads today's onPick through here.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return undefined;
    let cancelled = false;
    let listener = null;

    loadGoogleMaps(googleMapsApiKey())
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['address_components', 'geometry', 'formatted_address', 'name'],
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const location = place?.geometry?.location;
          if (!location) return;
          onPickRef.current({
            address: place.formatted_address || place.name || '',
            point: { lat: location.lat(), lng: location.lng() },
            townAndCountry: townAndCountry(place.address_components),
          });
        });
      })
      .catch((err) => console.error('Could not load address suggestions:', err));

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, []);

  return (
    <input id={id} ref={inputRef} type="text" value={value} maxLength={200}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      // Enter picks a suggestion in the Places list; it must not submit the form.
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
      placeholder={placeholder} style={style} />
  );
}

export default AddressInput;
