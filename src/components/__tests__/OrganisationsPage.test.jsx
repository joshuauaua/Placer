import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { OrganisationsPage, sortOrganisations } from '../OrganisationsPage';
import { readAllOrganisations } from '../../services/organisations';
import { THEME } from '../../theme';

vi.mock('../../services/organisations', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readAllOrganisations: vi.fn(),
}));

const MINE = { id: 'org-1', name: 'Malmö Stad', location: 'Malmö, Sweden', description: 'The city.',
  cover: 'https://media.example/organisations/org-1/cover-1.webp', createdAt: '2026-09-01' };
const ALSO_MINE = { id: 'org-3', name: 'Ateljé Rum', location: '', description: '', cover: null, createdAt: '2026-09-10' };
const STPLN = { id: 'org-2', name: 'STPLN', location: 'Malmö, Sweden', description: '', cover: null, createdAt: '2026-09-20' };
const ARKITEKTUR = { id: 'org-4', name: 'Arkitekturgalleriet', location: 'Copenhagen, Denmark', description: '',
  cover: null, createdAt: '2026-09-05' };

// The cards, in the order they are shown. The favourite hearts beside them are
// buttons too, named with an aria-label; the cards are named by what they say.
const cards = () => screen.getAllByRole('button')
  .filter((button) => !button.hasAttribute('aria-label')
    && [MINE, ALSO_MINE, STPLN, ARKITEKTUR].some((org) => button.textContent.includes(org.name)));
const cardFor = (name) => cards().find((card) => card.textContent.includes(name));
const names = () => cards().map((card) => card.textContent);

function setup(props = {}) {
  const handlers = { onOpenOrganisationDashboard: vi.fn(), onOpenOrganisation: vi.fn(), onNewOrganisation: vi.fn() };
  render(<OrganisationsPage t={THEME} organisations={[MINE]} {...handlers} {...props} />);
  return handlers;
}

beforeEach(() => {
  readAllOrganisations.mockResolvedValue([ARKITEKTUR, MINE, STPLN]);
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('OrganisationsPage', () => {
  it('has the same header as the other gallery pages, with a way to create one', async () => {
    const { onNewOrganisation } = setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Organisations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show: All organisations/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create an organisation' }));
    expect(onNewOrganisation).toHaveBeenCalled();
    await screen.findByText('STPLN');
  });

  it('shows yours first, labelled as yours, then every other organisation', async () => {
    setup();
    await screen.findByText('STPLN');

    expect(names()[0]).toContain('Malmö Stad');
    expect(names().slice(1).map((text) => text.replace(/Malmö.*|Copenhagen.*/, ''))).toEqual(['Arkitekturgalleriet', 'STPLN']);
    expect(within(cardFor('Malmö Stad')).getByText('Your organisation')).toBeInTheDocument();
    expect(within(cardFor('STPLN')).queryByText('Your organisation')).not.toBeInTheDocument();
  });

  it('keeps yours first whatever the order', async () => {
    setup({ organisations: [MINE, ALSO_MINE] });
    await screen.findByText('STPLN');

    // A-Z by default: Ateljé before Malmö, both before everyone else.
    expect(names().slice(0, 2).map((text) => text.split('Your organisation').join(''))).toEqual(
      [expect.stringContaining('Ateljé Rum'), expect.stringContaining('Malmö Stad')]);
    expect(screen.getAllByText('Your organisation')).toHaveLength(2);
  });

  it('opens yours on its dashboard and anybody else’s on its public page', async () => {
    const { onOpenOrganisationDashboard, onOpenOrganisation } = setup();
    await screen.findByText('STPLN');

    fireEvent.click(cardFor('Malmö Stad'));
    fireEvent.click(cardFor('STPLN'));

    expect(onOpenOrganisationDashboard).toHaveBeenCalledWith('org-1');
    expect(onOpenOrganisation).toHaveBeenCalledWith('org-2');
  });

  it('filters to yours, or to everyone else’s', async () => {
    setup();
    await screen.findByText('STPLN');

    fireEvent.click(screen.getByRole('button', { name: /Show: All organisations/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Yours' }));
    expect(screen.queryByText('STPLN')).not.toBeInTheDocument();
    expect(screen.getByText('Malmö Stad')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show: Yours/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Everyone else’s' }));
    expect(screen.getByText('STPLN')).toBeInTheDocument();
    expect(screen.queryByText('Malmö Stad')).not.toBeInTheDocument();
  });

  it('shows each organisation’s cover across the top of its card', async () => {
    setup();
    await screen.findByText('STPLN');

    const cover = cardFor('Malmö Stad').querySelector('img');
    expect(cover).toHaveAttribute('src', MINE.cover);
    expect(cover).toHaveAttribute('alt', '');
    expect(cardFor('STPLN').querySelector('img')).toBeNull();
  });

  it('still shows yours when everyone else’s cannot be read', async () => {
    readAllOrganisations.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the other organisations');
    expect(screen.getByText('Malmö Stad')).toBeInTheDocument();
  });

  it('says so when there are no organisations at all', async () => {
    readAllOrganisations.mockResolvedValue([]);
    setup({ organisations: [] });

    expect(await screen.findByText(/No organisations yet/)).toBeInTheDocument();
  });

  it('does not list one of yours twice when it is also in the full list', async () => {
    setup();
    await waitFor(() => expect(screen.getAllByText('Malmö Stad')).toHaveLength(1));
  });
});

describe('sortOrganisations', () => {
  const list = [STPLN, { ...ARKITEKTUR, location: '' }, MINE];

  it('sorts by name', () => {
    expect(sortOrganisations(list, { id: 'az', direction: 'asc' }).map((o) => o.id)).toEqual(['org-4', 'org-1', 'org-2']);
  });

  it('sorts newest first', () => {
    expect(sortOrganisations(list, { id: 'recent', direction: 'desc' }).map((o) => o.id)).toEqual(['org-2', 'org-4', 'org-1']);
  });

  it('sorts by location, with none last', () => {
    expect(sortOrganisations(list, { id: 'location', direction: 'asc' }).map((o) => o.id).at(-1)).toBe('org-4');
  });
});
