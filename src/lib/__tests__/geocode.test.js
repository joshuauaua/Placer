import { describe, it, expect, afterEach, vi } from 'vite-plus/test';
import { geocodePlace, resetGeocodeCacheForTests, searchPlaces, townAndCountry } from '../geocode';
import { photonFeature, stubPhoton } from '../../test/photon';

const STPLN = photonFeature({ type: 'house', housenumber: '5', street: 'Malmöhusvägen', postcode: '211 18',
  city: 'Malmö', country: 'Sweden', lat: 55.6054, lng: 12.9854 });
const MALMO = photonFeature({ type: 'city', name: 'Malmö', state: 'Skåne', country: 'Sweden', lat: 55.6, lng: 13 });

describe('townAndCountry', () => {
  it('takes the city a place is in, and its country', () => {
    expect(townAndCountry(STPLN.properties)).toBe('Malmö, Sweden');
  });

  it('takes a city\'s own name as its town', () => {
    expect(townAndCountry(MALMO.properties)).toBe('Malmö, Sweden');
  });

  it('falls back to the county or region around a place with no town of its own', () => {
    expect(townAndCountry({ type: 'house', county: 'Gotland', country: 'Sweden' })).toBe('Gotland, Sweden');
  });

  it('says a city-state once', () => {
    expect(townAndCountry({ type: 'city', name: 'Singapore', country: 'Singapore' })).toBe('Singapore');
  });

  it('is empty when there is nothing to go on', () => {
    expect(townAndCountry({})).toBe('');
  });
});

describe('searchPlaces', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes each result the way an address is written, with its point', async () => {
    stubPhoton([STPLN]);
    const [result] = await searchPlaces('Malmöhusvägen 5');
    expect(result).toEqual({
      label: 'Malmöhusvägen 5, 211 18 Malmö, Sweden',
      name: '',
      point: { lat: 55.6054, lng: 12.9854 },
      townAndCountry: 'Malmö, Sweden',
      type: 'house',
    });
  });

  it('keeps to towns, cities and regions when asked to', async () => {
    stubPhoton([STPLN, MALMO]);
    const results = await searchPlaces('Malmö', { regions: true });
    expect(results.map((result) => result.label)).toEqual(['Malmö, Skåne, Sweden']);
  });

  it('prefers places near a point, when given one', async () => {
    const fetchMock = stubPhoton([]);
    await searchPlaces('park', { near: { lat: 55.6, lng: 13 } });
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get('lat')).toBe('55.6');
    expect(params.get('lon')).toBe('13');
  });

  it('asks nothing for an empty query', async () => {
    const fetchMock = stubPhoton([]);
    expect(await searchPlaces('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when the geocoder answers with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(searchPlaces('Malmö')).rejects.toThrow('503');
  });
});

describe('geocodePlace', () => {
  afterEach(() => {
    resetGeocodeCacheForTests();
    vi.unstubAllGlobals();
  });

  it('gives the point of the best match', async () => {
    stubPhoton([MALMO]);
    expect(await geocodePlace('Malmö')).toEqual({ lat: 55.6, lng: 13 });
  });

  it('asks about each place once, however it is written', async () => {
    const fetchMock = stubPhoton([MALMO]);
    await geocodePlace('Malmö');
    await geocodePlace('  malmö ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is null for a place nobody knows, and remembers that too', async () => {
    const fetchMock = stubPhoton([]);
    expect(await geocodePlace('Nowhere at all')).toBeNull();
    expect(await geocodePlace('Nowhere at all')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is null when the geocoder cannot be reached, and asks again next time', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchMock);
    expect(await geocodePlace('Malmö')).toBeNull();
    await geocodePlace('Malmö');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
