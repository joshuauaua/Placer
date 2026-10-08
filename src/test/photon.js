/* Place search answered without the network, for tests of anything with a PlaceSearch.
 *
 * stubPhoton(features) has fetch answer every Photon request with `features`, built
 * with photonFeature, and returns the fetch mock so a test can check what was asked.
 * Undone by vi.unstubAllGlobals().
 */

import { vi } from 'vite-plus/test';

/** One Photon result: a GeoJSON point with the properties Photon gives a place. */
export function photonFeature({ lat, lng, ...properties }) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties };
}

export function stubPhoton(features) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ features }) }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
