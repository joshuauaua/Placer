import { describe, it, expect, vi, afterEach, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import ExplorePage, { shapeCentre } from '../ExplorePage';
import { isSupabaseConfigured, readMapProjects } from '../../services/projects';
import { readMapOrganisations } from '../../services/organisations';
import { resetGeocodeCacheForTests } from '../../lib/geocode';
import { clickMap, lastMap, maps } from '../../test/maplibreStub';
import { photonFeature, stubPhoton } from '../../test/photon';

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

// What the geocoder answers for any place asked about; null for nothing found.
const answerWith = (point) => stubPhoton(point ? [photonFeature({ name: 'Somewhere', ...point })] : []);

function renderPage(props = {}) {
  return render(<ExplorePage onSignIn={vi.fn()} onOpenProject={vi.fn()}
    onOpenOrganisation={vi.fn()} {...props} />);
}

const markerFor = (title) => lastMap()?.markers.find((marker) => marker.getElement().title === title);
const positionOf = (marker) => ({ lat: marker.getLngLat().lat, lng: marker.getLngLat().lng });

describe('ExplorePage', () => {
  let geocoder;
  beforeEach(() => {
    geocoder = answerWith({ lat: 55.6054, lng: 12.9854 });
  });

  afterEach(() => {
    cleanup();
    resetGeocodeCacheForTests();
    vi.unstubAllGlobals();
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
    await waitFor(() => expect(lastMap().getSource('explore-areas')).toBeDefined());
    const ring = lastMap().getSource('explore-areas').data.features[0].geometry.coordinates[0];
    expect(ring.slice(0, 3)).toEqual(PROJECT.locationShapes[0].path.map(({ lat, lng }) => [lng, lat]));
    expect(positionOf(markerFor('Riverside Greenway'))).toEqual(shapeCentre(PROJECT.locationShapes));
  });

  it('pins an organisation where its location text geocodes to', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([ORGANISATION]);
    answerWith({ lat: 55.6, lng: 13 });
    renderPage();

    await waitFor(() => expect(markerFor('STPLN')).toBeDefined());
    expect(positionOf(markerFor('STPLN'))).toEqual({ lat: 55.6, lng: 13 });
  });

  it('pins an organisation at the point of the address it chose, without geocoding', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([{ ...ORGANISATION,
      address: 'Malmöhusvägen 5, Malmö', locationPoint: { lat: 55.6054, lng: 12.9854 } }]);
    renderPage();

    await waitFor(() => expect(markerFor('STPLN')).toBeDefined());
    expect(positionOf(markerFor('STPLN'))).toEqual({ lat: 55.6054, lng: 12.9854 });
    expect(geocoder).not.toHaveBeenCalled();
  });

  it('geocodes the address rather than the town when there is no point', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([{ ...ORGANISATION,
      address: 'Stapelbäddsgatan 3, Malmö', locationPoint: null }]);
    const asked = answerWith({ lat: 55.61, lng: 12.97 });
    renderPage();

    await waitFor(() => expect(markerFor('STPLN')).toBeDefined());
    expect(new URL(asked.mock.calls[0][0]).searchParams.get('q')).toBe('Stapelbäddsgatan 3, Malmö');
    expect(positionOf(markerFor('STPLN'))).toEqual({ lat: 55.61, lng: 12.97 });
  });

  it('leaves an organisation off the map when its location cannot be found', async () => {
    vi.mocked(readMapOrganisations).mockResolvedValue([ORGANISATION]);
    const asked = answerWith(null);
    renderPage();

    await waitFor(() => expect(asked).toHaveBeenCalled());
    await act(async () => {});
    expect(markerFor('STPLN')).toBeUndefined();
  });

  it('takes a layer off the map when its filter is unticked', async () => {
    vi.mocked(readMapProjects).mockResolvedValue([PROJECT]);
    renderPage();
    await waitFor(() => expect(markerFor('Riverside Greenway')).toBeDefined());
    const drawn = markerFor('Riverside Greenway').getElement();

    fireEvent.click(screen.getByRole('checkbox', { name: /projects/i }));

    expect(markerFor('Riverside Greenway')).toBeUndefined();
    expect(drawn).not.toBeInTheDocument();
  });

  it('makes the map once, and keeps it while the page re-renders', async () => {
    renderPage();
    await waitFor(() => expect(lastMap()).toBeDefined());
    // Setting the map re-renders the page; that must not tear the map down.
    await act(async () => {});
    expect(maps).toHaveLength(1);
    expect(lastMap().removed).toBe(false);
  });

  it('opens over the place chosen in Settings', () => {
    renderPage({ homeCenter: { lat: 59.33, lng: 18.07 } });
    expect(lastMap().center).toEqual({ lat: 59.33, lng: 18.07 });
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
      fireEvent.click(markerFor('Riverside Greenway').getElement());
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
      expect(lastMap().center).toEqual(shapeCentre(PROJECT.locationShapes));
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
      act(() => clickMap(lastMap(), { lat: 55, lng: 13 }));
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
      expect(lastMap().zoom).toBe(15);
      expect(lastMap().center).toEqual(shapeCentre(PROJECT.locationShapes));
    });

    it('goes to a typed place on Enter when nothing matches it', async () => {
      answerWith({ lat: 59.33, lng: 18.07 });
      renderPage();
      await waitFor(() => expect(lastMap()).toBeDefined());

      const box = screen.getByRole('combobox');
      fireEvent.change(box, { target: { value: 'Stockholm' } });
      fireEvent.keyDown(box, { key: 'Enter' });

      await waitFor(() => expect(lastMap().center).toEqual({ lat: 59.33, lng: 18.07 }));
    });
  });
});
