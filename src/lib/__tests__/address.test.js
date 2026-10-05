import { describe, it, expect } from 'vite-plus/test';
import { townAndCountry } from '../address';

const part = (long_name, ...types) => ({ long_name, short_name: long_name, types: [...types, 'political'] });

describe('townAndCountry', () => {
  it('takes the locality and the country', () => {
    expect(townAndCountry([
      part('5', 'street_number'),
      part('Malmöhusvägen', 'route'),
      part('Malmö', 'locality'),
      part('Skåne län', 'administrative_area_level_1'),
      part('Sweden', 'country'),
      part('211 18', 'postal_code'),
    ])).toBe('Malmö, Sweden');
  });

  it('falls back to the postal town where there is no locality', () => {
    expect(townAndCountry([
      part('Greater London', 'administrative_area_level_2'),
      part('London', 'postal_town'),
      part('United Kingdom', 'country'),
    ])).toBe('London, United Kingdom');
  });

  it('falls back to the region around a place with no town of its own', () => {
    expect(townAndCountry([
      part('Gotland County', 'administrative_area_level_1'),
      part('Sweden', 'country'),
    ])).toBe('Gotland County, Sweden');
  });

  it('says a city-state once', () => {
    expect(townAndCountry([part('Singapore', 'locality'), part('Singapore', 'country')])).toBe('Singapore');
  });

  it('gives what it has, or nothing', () => {
    expect(townAndCountry([part('Turkey', 'country')])).toBe('Turkey');
    expect(townAndCountry([])).toBe('');
    expect(townAndCountry(undefined)).toBe('');
  });
});
