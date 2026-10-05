import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrganisationsPage } from '../OrganisationsPage';
import { THEME } from '../../theme';

const WITH_COVER = { id: 'org-1', name: 'Malmö Stad', location: 'Malmö, Sweden', description: 'The city.',
  cover: 'https://media.example/organisations/org-1/cover-1.webp' };
const WITHOUT_COVER = { id: 'org-2', name: 'STPLN', location: '', description: '', cover: null };

const cardFor = (name) => screen.getByRole('button', { name: new RegExp(name) });

describe('OrganisationsPage', () => {
  it('shows each organisation’s cover across the top of its card', () => {
    render(<OrganisationsPage t={THEME} organisations={[WITH_COVER, WITHOUT_COVER]}
      onOpenOrganisationDashboard={vi.fn()} />);

    // Decorative: the name beside it already says whose it is.
    const cover = cardFor('Malmö Stad').querySelector('img');
    expect(cover).toHaveAttribute('src', WITH_COVER.cover);
    expect(cover).toHaveAttribute('alt', '');
    expect(cardFor('Malmö Stad')).toHaveTextContent('Malmö, Sweden');

    // No cover, no empty frame: just the name row.
    expect(cardFor('STPLN').querySelector('img')).toBeNull();
  });

  it('opens an organisation’s dashboard from its card', () => {
    const onOpen = vi.fn();
    render(<OrganisationsPage t={THEME} organisations={[WITH_COVER]} onOpenOrganisationDashboard={onOpen} />);

    fireEvent.click(cardFor('Malmö Stad'));

    expect(onOpen).toHaveBeenCalledWith('org-1');
  });
});
