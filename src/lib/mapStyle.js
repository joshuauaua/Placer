/* PLACER — the map's visual style, shared by every Google Map the app draws (the
 * community map in MapContainer, the location-outline picker in LocationMapPicker).
 *
 * "Orion", from https://snazzymaps.com/style/708944/orion-map-style — a dark teal
 * basemap with administrative borders, transit lines and most icons switched off, so
 * the imagination pins and drawn polygons are what actually draws the eye.
 */
export const MAP_STYLE = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ saturation: 36 }, { color: '#000000' }, { lightness: 40 }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ visibility: 'on' }, { color: '#000000' }, { lightness: 16 }] },
  { featureType: 'all', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#004c53' }, { lightness: '0' }, { gamma: '1' }] },
  { featureType: 'landscape', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#2f91a2' }, { visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#004c53' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ color: '#436e74' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ color: '#daebea' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#daebea' }] },
  { featureType: 'road', elementType: 'labels.text', stylers: [{ color: '#004c53' }, { weight: '0.01' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'all', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#436e74' }, { lightness: 17 }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ color: '#daebea' }] },
];

export default MAP_STYLE;
