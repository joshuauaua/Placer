import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NavSearch } from '../NavSearch';
import { search } from '../../services/search';
import { THEME } from '../../theme';

vi.mock('../../services/search', () => ({
  MIN_QUERY_LENGTH: 2,
  search: vi.fn(),
}));

const RESULTS = [
  { kind: 'tool', id: 'desire-lines', name: 'Desire Lines', detail: 'Understand · PLACER', image: null, icon: 'path' },
  { kind: 'person', id: 'user-1', name: 'Mara Quinn', detail: 'Malmö', image: null },
  { kind: 'organisation', id: 'org-1', name: 'Malmö Stad', detail: 'Malmö', image: null },
  { kind: 'project', id: 'proj-1', name: 'Malmö Greenway', detail: 'Malmö Stad', image: null },
  { kind: 'caseStudy', id: 'case-studies/folkets-park', name: 'Folkets Park', detail: 'A park, reimagined.', image: null },
];

// jsdom applies no stylesheet, so the box and its phone magnifier are both in the
// page here; index.css shows only one of them at a time.
const box = () => screen.getByRole('button', { name: /Search tools, projects, people and case studies/ });

const setup = () => {
  const onSelect = vi.fn();
  render(<NavSearch t={THEME} onSelect={onSelect} />);
  fireEvent.click(box());
  const modal = screen.getByRole('dialog', { name: 'Search' });
  return { onSelect, modal, input: within(modal).getByRole('combobox') };
};

describe('NavSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(search).mockResolvedValue(RESULTS);
  });

  it('shows only a button in the bar, with no field or list until it is pressed', () => {
    render(<NavSearch t={THEME} onSelect={vi.fn()} />);

    expect(box()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a modal, portalled to the page, ready to type into', () => {
    const { modal, input } = setup();

    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal.parentElement.parentElement).toBe(document.body);
    expect(input).toHaveFocus();
  });

  it('opens the same modal from the phone magnifier', () => {
    render(<NavSearch t={THEME} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
  });

  it('suggests tools, projects, people, organisations and case studies as you type, grouped by kind', async () => {
    const { modal, input } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });

    expect(await within(modal).findByRole('option', { name: /Mara Quinn/ })).toBeInTheDocument();
    expect(within(modal).getAllByRole('group').map((group) => group.getAttribute('aria-label')))
      .toEqual(['Tools', 'Projects', 'People', 'Organisations', 'Case studies']);
    expect(within(modal).getByRole('option', { name: /Desire Lines/ })).toBeInTheDocument();
    expect(within(modal).getByRole('option', { name: /Folkets Park/ })).toBeInTheDocument();
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

  it('opens a suggestion when it is clicked, and closes the modal', async () => {
    const { input, onSelect } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /^Malmö Stad/ }));

    expect(onSelect).toHaveBeenCalledWith(RESULTS[2]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(box()).toHaveFocus();
  });

  it('moves down the suggestions as they are listed with the arrow keys, and opens one with Enter', async () => {
    const { input, onSelect } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });
    await screen.findByRole('option', { name: /Mara Quinn/ });
    // Listed Tools, Projects, People: Desire Lines, Malmö Greenway, then Mara Quinn,
    // whatever order the search handed them back in.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(screen.getByRole('option', { name: /Mara Quinn/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(RESULTS[1]);
  });

  it('closes on Escape, handing focus back to the box, and starts empty next time', async () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: 'mal' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(box()).toHaveFocus();

    fireEvent.click(box());
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('closes from its close button, and from a press on the backdrop', () => {
    const { modal } = setup();
    fireEvent.click(within(modal).getByRole('button', { name: 'Close search' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(box());
    const opened = screen.getByRole('dialog', { name: 'Search' });
    fireEvent.mouseDown(opened);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(opened.parentElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
