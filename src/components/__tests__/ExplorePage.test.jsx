import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import ExplorePage, { shapeCentre } from '../ExplorePage';
import { isSupabaseConfigured, readMapProjects } from '../../services/projects';
import { readMapOrganisations } from '../../services/organisations';
import { resetGoogleMapsLoaderForTests } from '../../lib/googleMaps';
import { resetGeocodeCacheForTests } from '../../lib/geocode';

vi.mock('../../services/projects', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readMapProjects: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/organisations', () => ({
  readMapOrganisations: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/follows', () => ({
  isFollowing: vi.fn(() => Promise.resolve(false)),
  follow: vi.fn(() => Promise.resolve()),
  unfollow: vi.fn(() => Promise.resolve()),
}));

const PROJECT = {
  id: 'proj-1',
  name: 'Riverside Greenway',
  description: 'Planting along the canal. Then a second sentence nobody needs here.',
  locations: ['Malmö'],
  image: 'https://media.example/projects/proj-1/image.webp',
  locationShapes: [{ path: [{ lat: 55.6, lng: 12.98 }, { lat: 55.62, lng: 12.98 }, { lat: 55.61, lng: 13.01 }] }],
};

const ORGANISATION = {
  id: 'org-1',
  name: 'STPLN',
  description: 'A makerspace by the sea.',
  location: 'Malmö',
  cover: null,
};

let mapListeners = {};
let mapInstance;
let geocodeResult = { lat: 55.6054, lng: 12.9854 };

function mockGoogleMaps() {
  mapListeners = {};
  const overlay = () => vi.fn(function (options) {
    const listeners = {};
    return {
      ...options,
      setMap: vi.fn(),
      setIcon: vi.fn(),
      setZIndex: vi.fn(),
      addListener: vi.fn((event, handler) => { listeners[event] = handler; }),
      fire: (event) => listeners[event]?.(),
    };
  });
  return {
    maps: {
      Map: vi.fn(function () {
        mapInstance = {
          panTo: vi.fn(),
          setZoom: vi.fn(),
          addListener: vi.fn((event, handler) => {
            mapListeners[event] = handler;
            return { remove: vi.fn() };
          }),
        };
        return mapInstance;
      }),
      Marker: overlay(),
      Polygon: overlay(),
      Geocoder: vi.fn(function () {
        return {
          geocode: vi.fn((request, callback) => {
            const point = geocodeResult;
            callback(point ? [{ geometry: { location: { lat: () => point.lat, lng: () => point.lng } } }] : [],
              point ? 'OK' : 'ZERO_RESULTS');
          }),
        };
      }),
      SymbolPath: { CIRCLE: 'circle' },
      event: { clearInstanceListeners: vi.fn() },
    },
  };
}

function renderPage(props = {}) {
  window.google = mockGoogleMaps();
  return render(<ExplorePage apiKey="key" onSignIn={vi.fn()} onOpenProject={vi.fn()}
    onOpenOrganisation={vi.fn()} {...props} />);
}

const markers = () => window.google.maps.Marker.mock.results.map(({ value }) => value);
const markerFor = (title) => markers().filter((marker) => marker.title === title).at(-1);

describe('ExplorePage', () => {
  afterEach(() => {
    cleanup();
    delete window.google;
    resetGoogleMapsLoaderForTests();
    resetGeocodeCacheForTests();
    geocodeResult = { lat: 55.6054, lng: 12.9854 };
    mapInstance = undefined;
    vi.clearAllMocks();
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(readMapProjects).mockResolvedValue([]);
    vi.mocked(readMapOrganisations).mockResolvedValue([]);
  });

  it('frames the map beside the filter and preview cards, with search across the top', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Show on the map' })).toBeInTheDocument();
    expect(screen.getByText('Find the places that interest you')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Selected place' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search Explore' })).toBeInTheDocument();
  });

  it('offers Projects, Case studies and Organisations, with case studies not yet available', () => {
    renderPage();
    expect(screen.getByRole('checkbox', { name: /projects/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /organisations/i })).toBeChecked();
    const caseStudies = screen.getByRole('checkbox', { name: /case studies/i });
    expect(caseStudies).toBeDisabled();
    expect(caseStudies).not.toBeChecked();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('draws each project as its outline with a pin in the middle', async () => {
    vi.mocked(readMapProjects).mockResolvedValue([PROJECT]);
    renderPage();

    await waitFor(() => expect(markerFor('Riverside Greenway')).toBeDefined());
    expect(window.google.maps.Polygon).toHaveBeenCalledWith(expect.objectContaining({
      paths: PROJECT.locationShapes[0].path,
    }));
    expect(markerFor('Riverside Greenway').position).toEqual(shapeCentre(PROJECT.locationShapes));
  });

  it('pins an organisation where its location text geocodes to', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([ORGANISATION]);
    geocodeResult = { lat: 55.6, lng: 13 };
    renderPage();

    await waitFor(() => expect(markerFor('STPLN')).toBeDefined());
    expect(markerFor('STPLN').position).toEqual({ lat: 55.6, lng: 13 });
  });

  it('pins an organisation at the point of the address it chose, without geocoding', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([{ ...ORGANISATION,
      address: 'Malmöhusvägen 5, Malmö', locationPoint: { lat: 55.6054, lng: 12.9854 } }]);
    renderPage();

    await waitFor(() => expect(markerFor('STPLN')).toBeDefined());
    expect(markerFor('STPLN').position).toEqual({ lat: 55.6054, lng: 12.9854 });
    expect(window.google.maps.Geocoder).not.toHaveBeenCalled();
  });

  it('geocodes the address rather than the town when there is no point', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([{ ...ORGANISATION,
      address: 'Stapelbäddsgatan 3, Malmö', locationPoint: null }]);
    geocodeResult = { lat: 55.61, lng: 12.97 };
    renderPage();

    await waitFor(() => expect(markerFor('STPLN')).toBeDefined());
    const [geocoder] = window.google.maps.Geocoder.mock.results.map(({ value }) => value);
    expect(geocoder.geocode).toHaveBeenCalledWith({ address: 'Stapelbäddsgatan 3, Malmö' }, expect.any(Function));
    expect(markerFor('STPLN').position).toEqual({ lat: 55.61, lng: 12.97 });
  });

  it('leaves an organisation off the map when its location cannot be found', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([ORGANISATION]);
    geocodeResult = null;
    renderPage();

    await waitFor(() => expect(window.google.maps.Geocoder).toHaveBeenCalled());
    expect(markerFor('STPLN')).toBeUndefined();
  });

  it('takes a layer off the map when its filter is unticked', async () => {
    vi.mocked(readMapProjects).mockResolvedValue([PROJECT]);
    renderPage();
    await waitFor(() => expect(markerFor('Riverside Greenway')).toBeDefined());
    const drawn = markerFor('Riverside Greenway');

    fireEvent.click(screen.getByRole('checkbox', { name: /projects/i }));

    expect(drawn.setMap).toHaveBeenCalledWith(null);
  });

  it('makes the map once, and leaves Google\'s own listeners on it', async () => {
    renderPage();
    await waitFor(() => expect(mapInstance).toBeDefined());
    // Setting the map re-renders the page; that must not tear the map down.
    await act(async () => {});
    expect(window.google.maps.Map).toHaveBeenCalledTimes(1);
    expect(window.google.maps.event.clearInstanceListeners).not.toHaveBeenCalled();
  });

  it('reads nothing when Supabase is not configured', () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    renderPage();
    expect(readMapProjects).not.toHaveBeenCalled();
    expect(readMapOrganisations).not.toHaveBeenCalled();
  });

  describe('the preview card', () => {
    const pickProject = async (props) => {
      vi.mocked(readMapProjects).mockResolvedValue([PROJECT]);
      renderPage(props);
      await waitFor(() => expect(markerFor('Riverside Greenway')).toBeDefined());
      act(() => markerFor('Riverside Greenway').fire('click'));
      return screen.getByRole('region', { name: 'Selected place' });
    };

    it('asks for a pick until there is one', () => {
      renderPage();
      expect(screen.getByRole('region', { name: 'Selected place' }))
        .toHaveTextContent(/pick something on the map/i);
    });

    it('shows the image, type, location, title and first sentence of what was picked', async () => {
      const card = await pickProject();
      expect(card.querySelector('img')).toHaveAttribute('src', PROJECT.image);
      expect(card).toHaveTextContent('Project');
      expect(card).toHaveTextContent('Malmö');
      expect(within(card).getByRole('heading', { name: 'Riverside Greenway' })).toBeInTheDocument();
      expect(card).toHaveTextContent('Planting along the canal.');
      expect(card).not.toHaveTextContent('second sentence');
    });

    it('pans to what was picked', async () => {
      await pickProject();
      expect(mapInstance.panTo).toHaveBeenCalledWith(shapeCentre(PROJECT.locationShapes));
    });

    it('links through to the project page, staying in the app on a plain click', async () => {
      const onOpenProject = vi.fn();
      const card = await pickProject({ onOpenProject });
      const link = within(card).getByRole('link', { name: /view project/i });
      expect(link).toHaveAttribute('href', '/projects/proj-1');

      fireEvent.click(link);

      expect(onOpenProject).toHaveBeenCalledWith('proj-1');
    });

    it('saves by following, for someone signed in', async () => {
      const card = await pickProject({ accountId: 'user-1' });
      expect(await within(card).findByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('sends someone signed out to sign in when they save', async () => {
      const onSignIn = vi.fn();
      const card = await pickProject({ onSignIn });
      fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
      expect(onSignIn).toHaveBeenCalled();
    });

    it('closes when the map itself is clicked', async () => {
      const card = await pickProject();
      act(() => mapListeners.click());
      expect(card).toHaveTextContent(/pick something on the map/i);
    });
  });

  describe('search', () => {
    it('lists matching projects and organisations, then the words as a place to go', async () => {
      vi.mocked(readMapProjects).mockResolvedValue([PROJECT]);
      vi.mocked(readMapOrganisations).mockResolvedValue([ORGANISATION]);
      renderPage();
      await waitFor(() => expect(markerFor('STPLN')).toBeDefined());

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'malmö' } });

      const options = screen.getAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual([
        expect.stringContaining('Riverside Greenway'),
        expect.stringContaining('STPLN'),
        expect.stringContaining('Go to “malmö”'),
      ]);
    });

    it('previews a result and zooms to it when it is chosen', async () => {
      vi.mocked(readMapProjects).mockResolvedValue([PROJECT]);
      renderPage();
      await waitFor(() => expect(markerFor('Riverside Greenway')).toBeDefined());

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'river' } });
      fireEvent.mouseDown(screen.getByRole('option', { name: /riverside greenway/i }));

      expect(within(screen.getByRole('region', { name: 'Selected place' }))
        .getByRole('heading', { name: 'Riverside Greenway' })).toBeInTheDocument();
      expect(mapInstance.setZoom).toHaveBeenCalled();
    });

    it('goes to a typed place on Enter when nothing matches it', async () => {
      geocodeResult = { lat: 59.33, lng: 18.07 };
      renderPage();
      await waitFor(() => expect(mapInstance).toBeDefined());

      const box = screen.getByRole('combobox');
      fireEvent.change(box, { target: { value: 'Stockholm' } });
      fireEvent.keyDown(box, { key: 'Enter' });

      await waitFor(() => expect(mapInstance.panTo).toHaveBeenCalledWith({ lat: 59.33, lng: 18.07 }));
    });
  });
});
