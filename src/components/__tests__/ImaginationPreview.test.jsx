import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImaginationPreview } from '../ImaginationPreview';
import { THEME } from '../../theme';

const IMAGINATION = {
  id: 'img-1',
  title: 'Pocket park',
  cat: 'green',
  blurb: 'Swap the asphalt for trees, a lawn, and a few benches.',
  loc: '55.6100, 12.9900',
  author: 'You There',
  preview: 'data:image/jpeg;base64,mockPreview',
  canvasAssets: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
  lines: [{ id: 'l1' }],
};

const setup = (imagination = IMAGINATION) => {
  const onClose = vi.fn();
  render(<ImaginationPreview t={THEME} imagination={imagination} onClose={onClose} />);
  return { onClose };
};

describe('ImaginationPreview', () => {
  it('shows the title, description, category, and location', () => {
    setup();

    expect(screen.getByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByText(/Swap the asphalt for trees/)).toBeInTheDocument();
    expect(screen.getByText('Green space')).toBeInTheDocument();
    expect(screen.getByText('55.6100, 12.9900')).toBeInTheDocument();
  });

  it('shows the saved composite preview image', () => {
    setup();

    expect(screen.getByAltText('Preview of Pocket park')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockPreview'
    );
  });

  it('shows the asset and line counts and the author', () => {
    setup();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/You There/)).toBeInTheDocument();
  });

  it('is exposed as a dialog named after the imagination', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Imagination: Pocket park' })).toBeInTheDocument();
  });

  it('calls onClose from the close button', () => {
    const { onClose } = setup();

    fireEvent.click(screen.getByLabelText('Close preview'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders without an image when the record has no preview', () => {
    setup({ ...IMAGINATION, preview: null });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Pocket park')).toBeInTheDocument();
  });

  it('falls back to a placeholder title when the record has none', () => {
    setup({ ...IMAGINATION, title: '' });
    expect(screen.getByText('Untitled imagination')).toBeInTheDocument();
  });

  it('survives a sparse record with no assets, lines, category, or location', () => {
    setup({ id: 'img-2', title: 'Bare', preview: null });

    expect(screen.getByText('Bare')).toBeInTheDocument();
    // Both counts render as zero rather than crashing on the missing arrays.
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('renders user text as text, never as markup', () => {
    setup({ ...IMAGINATION, title: '<img src=x onerror="alert(1)">', preview: null });

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
  });
});
