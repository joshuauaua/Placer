import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PlaceSearch } from '../PlaceSearch';
import { searchPlaces } from '../../lib/geocode';

vi.mock('../../lib/geocode', () => ({
  searchPlaces: vi.fn(() => Promise.resolve([
    { label: 'Folkets Park, Malmö', name: 'Folkets Park', point: { lat: 55.59, lng: 13.01 }, townAndCountry: 'Malmö, Sweden' },
  ])),
}));

function Field({ initial = '', onPick = () => {} }) {
  const [value, setValue] = useState(initial);
  return <PlaceSearch id="place" value={value} onChange={setValue} onPick={onPick} />;
}

/** Past the pause the field waits for before it asks. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 400)));

describe('PlaceSearch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('suggests nothing for an address it opens already filled in', async () => {
    render(<Field initial="Folkets Park, Amiralsgatan 35, Malmö" />);

    await settle();
    expect(searchPlaces).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('suggests places once something is typed', async () => {
    render(<Field initial="Folkets Park, Amiralsgatan 35, Malmö" />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Folkets' } });
    await settle();
    expect(searchPlaces).toHaveBeenCalledWith('Folkets', expect.anything());
    expect(screen.getByRole('option', { name: 'Folkets Park, Malmö' })).toBeInTheDocument();
  });

  it('puts the list away for good once one is picked', async () => {
    const onPick = vi.fn();
    render(<Field onPick={onPick} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Folkets' } });
    await settle();
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Folkets Park, Malmö' }));
    await settle();

    expect(onPick).toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('Folkets Park, Malmö');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(searchPlaces).toHaveBeenCalledTimes(1);
  });
});
