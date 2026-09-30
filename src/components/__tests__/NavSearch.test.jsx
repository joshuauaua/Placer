import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavSearch } from '../NavSearch';
import { search } from '../../services/search';
import { THEME } from '../../theme';

vi.mock('../../services/search', () => ({
  MIN_QUERY_LENGTH: 2,
  search: vi.fn(),
}));

const RESULTS = [
  { kind: 'person', id: 'user-1', name: 'Mara Quinn', detail: 'Malmö', image: null },
  { kind: 'organisation', id: 'org-1', name: 'Malmö Stad', detail: 'Malmö', image: null },
  { kind: 'project', id: 'proj-1', name: 'Malmö Greenway', detail: 'Malmö Stad', image: null },
];

const setup = () => {
  const onSelect = vi.fn();
  render(<NavSearch t={THEME} onSelect={onSelect} />);
  return { onSelect, input: screen.getByRole('combobox', { name: /Search people, organisations and projects/ }) };
};

describe('NavSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(search).mockResolvedValue(RESULTS);
  });

  it('suggests people, organisations and projects as you type, grouped by kind', async () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });

    expect(await screen.findByRole('option', { name: /Mara Quinn/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Organisations' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Projects' })).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith('mal');
  });

  it('waits for typing to pause, and sends only the last query', async () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'ma' } });
    fireEvent.change(input, { target: { value: 'mal' } });
    fireEvent.change(input, { target: { value: 'malm' } });

    await screen.findByRole('option', { name: /Mara Quinn/ });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('malm');
  });

  it('does not search on a single letter', async () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'm' } });

    await new Promise((resolve) => { setTimeout(resolve, 300); });
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens a suggestion when it is clicked, and clears the box', async () => {
    const { input, onSelect } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /^Malmö Stad/ }));

    expect(onSelect).toHaveBeenCalledWith(RESULTS[1]);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('moves through the suggestions with the arrow keys and opens one with Enter', async () => {
    const { input, onSelect } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });
    await screen.findByRole('option', { name: /Mara Quinn/ });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(screen.getByRole('option', { name: /Malmö Greenway/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(RESULTS[2]);
  });

  it('closes on Escape', async () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('says when nothing matches', async () => {
    vi.mocked(search).mockResolvedValue([]);
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'zzz' } });

    expect(await screen.findByText('Nothing matches “zzz”.')).toBeInTheDocument();
  });

  it('says when the search fails', async () => {
    vi.mocked(search).mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not search'));
  });
});
