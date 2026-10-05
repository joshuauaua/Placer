/* PLACER — the town and country an address is in.
 *
 * An organisation gives its exact address, picked from Google Places suggestions, and
 * its public page shows only the town and country, worked out from that address
 * rather than asked for a second time. Places hands back an address as a list of
 * parts, each tagged with what it is; this picks the two that matter.
 *
 * "Town" is not one tag the world over. Most places have a `locality`; much of the UK
 * has a `postal_town` instead; and somewhere rural may have neither, only the county
 * or region around it. So it falls back down that list and takes the first it finds.
 */

const TOWN_TYPES = ['locality', 'postal_town', 'administrative_area_level_3',
  'administrative_area_level_2', 'administrative_area_level_1'];

function partOfType(components, type) {
  return components.find((part) => part?.types?.includes(type))?.long_name ?? '';
}

/**
 * "Malmö, Sweden" for a Places result's `address_components`, or just one of the two
 * when only one is there, or '' when neither is.
 */
export function townAndCountry(components) {
  if (!Array.isArray(components)) return '';

  const town = TOWN_TYPES.map((type) => partOfType(components, type)).find(Boolean) ?? '';
  const country = partOfType(components, 'country');

  // A city-state's town and country can share a name ("Singapore, Singapore").
  return [town, country !== town ? country : '']
    .filter(Boolean)
    .join(', ');
}
