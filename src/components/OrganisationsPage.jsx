/* PLACER — Organisations: every organisation on the platform, yours first.
 *
 * Reached from the side nav. The ones this account is an admin of come first, each
 * labelled as yours, and open on their dashboard; every other organisation follows
 * and opens on its public page. The list of yours is read once in App.jsx (a new
 * project can be run in the name of any of them) and handed in; everything else is
 * read here.
 *
 * The header is the one Projects and the Toolkit have (PageHeader), with the same
 * toolbar (GalleryToolbar): whose organisations to show, an order (Recent, A-Z,
 * Location), favourites, and grid or list. The order applies within yours and within
 * the rest, so yours stay first whichever is chosen.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { FavouriteButton, GalleryToolbar, useFavourites, useGalleryView } from './GalleryToolbar';
import { isSupabaseConfigured, readAllOrganisations } from '../services/organisations';

const SHOW = [
  { id: null, name: 'All organisations' },
  { id: 'yours', name: 'Yours' },
  { id: 'others', name: 'Everyone else’s' },
];

const SORTS = [
  { id: 'recent', name: 'Recent', direction: 'desc' },
  { id: 'az', name: 'A-Z', direction: 'asc' },
  { id: 'location', name: 'Location', direction: 'asc' },
];

const NO_FILTERS = { show: null };

/**
 * The organisations in one of SORTS' orders, as a new array: Recent by when it joined
 * PLACER, A-Z by name, Location by its town and country. One with nothing to sort by
 * goes last whichever way round.
 */
export function sortOrganisations(organisations, { id, direction }) {
  const sign = direction === 'desc' ? -1 : 1;
  const byText = (field) => (a, b) => {
    if (!a[field] || !b[field]) return Number(!a[field]) - Number(!b[field]);
    return sign * String(a[field]).localeCompare(String(b[field]));
  };
  const compare = {
    recent: byText('createdAt'),
    location: byText('location'),
    az: byText('name'),
  }[id] ?? (() => 0);
  return [...organisations].sort(compare);
}

/** Says that this account is an admin of it — shown on its card and its row. */
function YoursLabel({ t }) {
  return (
    <span title="You are an admin of this organisation"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
        background: t.ink, color: t.page, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <Icon name="check" size={12} stroke={2.6} />
      Your organisation
    </span>
  );
}

/* One organisation: its cover edge to edge across the top, the way a ProjectCard
 * shows a project's image, then the building mark beside its name, town and the start
 * of its description. Without a cover it is just that row. */
function OrganisationCard({ t, organisation, yours, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(organisation.id)} style={{ flex: 1, textAlign: 'left',
      padding: 20, background: t.surface, border: `1px solid ${yours ? t.ink : t.line}`, borderRadius: 12,
      boxShadow: t.shadow, cursor: 'pointer', fontFamily: 'var(--placer-font)', overflow: 'hidden' }}>
      {/* The negative margins undo the card's padding. */}
      {organisation.cover && (
        <img src={organisation.cover} alt="" style={{ display: 'block', width: 'calc(100% + 40px)',
          margin: '-20px -20px 16px', aspectRatio: '16 / 9', objectFit: 'cover' }} />
      )}
      {yours && <span style={{ display: 'block', marginBottom: 12 }}><YoursLabel t={t} /></span>}
      <span style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: t.surfaceAlt, flex: '0 0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink }}>
          <Icon name="building" size={22} stroke={2} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: t.ink, marginBottom: 4 }}>
            {organisation.name}
          </span>
          {organisation.location && (
            <span style={{ display: 'block', fontSize: 13.5, color: t.inkDim, marginBottom: 6 }}>
              {organisation.location}
            </span>
          )}
          {organisation.description && (
            <span style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {organisation.description}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** One organisation as a row, for the list view. */
function OrganisationRow({ t, organisation, yours, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(organisation.id)} className="placer-toolkit-row"
      style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0, textAlign: 'left',
        cursor: 'pointer', padding: '16px 20px', border: 'none', background: 'transparent', color: t.ink,
        fontFamily: 'var(--placer-font)' }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, flex: '0 0 auto', overflow: 'hidden',
        background: t.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {organisation.cover
          ? <img src={organisation.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icon name="building" size={20} stroke={2} />}
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{organisation.name}</span>
          {yours && <YoursLabel t={t} />}
        </span>
        {organisation.location && (
          <span style={{ fontSize: 14, color: t.inkDim }}>{organisation.location}</span>
        )}
      </span>
      <Icon name="arrowRight" size={18} stroke={2.2} style={{ color: t.inkDim }} />
    </button>
  );
}

export function OrganisationsPage({ t, organisations = [], onNewOrganisation, onOpenOrganisationDashboard,
  onOpenOrganisation }) {
  const [everyone, setEveryone] = useState([]);
  const [status, setStatus] = useState(isSupabaseConfigured() ? 'loading' : 'ready');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ id: SORTS[1].id, direction: SORTS[1].direction });
  const [favourites, toggleFavourite] = useFavourites('placer_organisations_favourites');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [view, changeView] = useGalleryView('placer_organisations_view');
  const clearFilters = () => { setFilters(NO_FILTERS); setFavouritesOnly(false); };

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;
    readAllOrganisations()
      .then((found) => {
        if (cancelled) return;
        setEveryone(found);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Could not load organisations:', err);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  // Yours come from App and may be newer than the read above (one just created), so
  // they are added to it rather than looked up in it.
  const yourIds = new Set(organisations.map((organisation) => organisation.id));
  const others = everyone.filter((organisation) => !yourIds.has(organisation.id));

  const keep = (organisation) => !favouritesOnly || favourites.includes(organisation.id);
  const matching = [
    ...(filters.show === 'others' ? [] : sortOrganisations(organisations.filter(keep), sort)),
    ...(filters.show === 'yours' ? [] : sortOrganisations(others.filter(keep), sort)),
  ];
  const total = organisations.length + others.length;

  const open = (id) => (yourIds.has(id) ? onOpenOrganisationDashboard : onOpenOrganisation)?.(id);
  const showName = SHOW.find((option) => option.id === filters.show).name;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '0 32px 48px' }} className="placer-scroll">
      <PageHeader t={t} title="Organisations" inset={32} maxWidth="none"
        actions={onNewOrganisation ? (
          <Btn t={t} variant="primary" icon="plus" onClick={onNewOrganisation}>
            Create an organisation
          </Btn>
        ) : null}
        toolbar={(
          <GalleryToolbar t={t} sorts={SORTS} sort={sort} onSort={setSort}
            favouritesOnly={favouritesOnly} onFavouritesOnly={setFavouritesOnly}
            view={view} onView={changeView}
            menu={{
              label: 'Show',
              current: showName,
              sections: [
                SHOW.map((option) => ({ key: option.id ?? 'all', label: option.name,
                  selected: filters.show === option.id,
                  onSelect: () => setFilters({ ...filters, show: option.id }) })),
              ],
            }} />
        )} />
      <div>
        {status === 'loading' && (
          <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 500, marginBottom: 20 }}>
            Loading organisations…
          </div>
        )}

        {/* Yours are still shown when everyone else's could not be read. */}
        {status === 'error' && (
          <div role="alert" style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: '#F5F5F5',
            borderLeft: '4px solid #B3261E', fontSize: 14, fontWeight: 500, color: t.ink }}>
            Could not load the other organisations on PLACER. See the console for details.
          </div>
        )}

        {status !== 'loading' && total === 0 && (
          <p style={{ fontSize: 14, color: t.inkFaint }}>
            No organisations yet. An organisation runs projects in its own name and has a public
            page of its own.
          </p>
        )}

        {status !== 'loading' && total > 0 && matching.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: t.inkDim }}>
            <p style={{ fontSize: 16, marginBottom: 16 }}>
              {favouritesOnly && favourites.length === 0
                ? 'No favourites yet. Tap the heart on an organisation to keep it here.'
                : filters.show === 'yours' && organisations.length === 0
                  ? 'You are not an admin of any organisation.'
                  : 'No organisations match those filters.'}
            </p>
            <Btn t={t} variant="outline" onClick={clearFilters}>Clear filters</Btn>
          </div>
        )}

        {matching.length > 0 && view === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20 }}>
            {matching.map((organisation) => (
              <div key={organisation.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <OrganisationCard t={t} organisation={organisation} yours={yourIds.has(organisation.id)}
                  onOpen={open} />
                <FavouriteButton t={t} name={organisation.name} favourite={favourites.includes(organisation.id)}
                  onToggle={() => toggleFavourite(organisation.id)}
                  style={{ position: 'absolute', top: 10, right: 10, background: t.surface,
                    boxShadow: t.shadow }} />
              </div>
            ))}
          </div>
        )}

        {matching.length > 0 && view === 'list' && (
          <div style={{ borderTop: `1px solid ${t.line}` }}>
            {matching.map((organisation) => (
              <div key={organisation.id} style={{ display: 'flex', alignItems: 'center',
                borderBottom: `1px solid ${t.line}` }}>
                <OrganisationRow t={t} organisation={organisation} yours={yourIds.has(organisation.id)}
                  onOpen={open} />
                <FavouriteButton t={t} name={organisation.name} favourite={favourites.includes(organisation.id)}
                  onToggle={() => toggleFavourite(organisation.id)} style={{ margin: '0 12px' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganisationsPage;
