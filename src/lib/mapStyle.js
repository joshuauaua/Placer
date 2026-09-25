/* PLACER — the map's visual style, shared by every Google Map the app draws (the
 * community map in MapContainer, the location-outline picker in LocationMapPicker).
 *
 * The brand kit's light map: black and white only, so the glass panels over it read
 * as ink on a pale ground and the character-coloured pins and areas are the only
 * colour on screen. Land is white, roads grey-200, water and parks grey-100, labels
 * grey-500, with administrative borders, transit and most icons switched off.
 */
export const MAP_STYLE = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#6E6E6E' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 3 }] },
  { featureType: 'all', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#E6E6E6' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#F5F5F5' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#E6E6E6' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'all', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6D6D6' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export default MAP_STYLE;
