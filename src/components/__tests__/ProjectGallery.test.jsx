import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectGallery } from '../ProjectGallery';
import { THEME } from '../../theme';

const photo = (n) => ({ path: `gallery/proj-1/photo-${n}.webp`, url: `https://media.test/gallery/proj-1/photo-${n}.webp` });
const PHOTOS = [photo(1), photo(2), photo(3)];

const shown = () => screen.getByRole('link', { name: /full size/ });

describe('ProjectGallery', () => {
  it('shows one photo at a time, the first to begin with, opening full size', () => {
    render(<ProjectGallery t={THEME} photos={PHOTOS} />);

    expect(shown()).toHaveAccessibleName('Photo 1 of 3, full size');
    expect(shown()).toHaveAttribute('href', photo(1).url);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('goes on and back with its buttons, round from either end', () => {
    render(<ProjectGallery t={THEME} photos={PHOTOS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(shown()).toHaveAttribute('href', photo(2).url);
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(shown()).toHaveAttribute('href', photo(3).url);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(shown()).toHaveAttribute('href', photo(1).url);
  });

  it('jumps to a photo from its thumbnail, and marks it', () => {
    render(<ProjectGallery t={THEME} photos={PHOTOS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show photo 3' }));
    expect(shown()).toHaveAttribute('href', photo(3).url);
    expect(screen.getByRole('button', { name: 'Show photo 3' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Show photo 1' })).not.toHaveAttribute('aria-current');
  });

  it('moves with the arrow keys', () => {
    render(<ProjectGallery t={THEME} photos={PHOTOS} />);
    const gallery = screen.getByRole('group', { name: 'Photo gallery' });

    fireEvent.keyDown(gallery, { key: 'ArrowRight' });
    expect(shown()).toHaveAttribute('href', photo(2).url);
    fireEvent.keyDown(gallery, { key: 'ArrowLeft' });
    expect(shown()).toHaveAttribute('href', photo(1).url);
  });

  it('moves with a swipe, but not a tap', () => {
    render(<ProjectGallery t={THEME} photos={PHOTOS} />);
    const stage = shown().parentElement;
    const swipe = (from, to) => {
      fireEvent.touchStart(stage, { touches: [{ clientX: from, clientY: 100 }] });
      fireEvent.touchEnd(stage, { changedTouches: [{ clientX: to, clientY: 100 }] });
    };

    swipe(300, 100);
    expect(shown()).toHaveAttribute('href', photo(2).url);
    swipe(100, 110);
    expect(shown()).toHaveAttribute('href', photo(2).url);
    swipe(100, 300);
    expect(shown()).toHaveAttribute('href', photo(1).url);
  });

  it('is just the photo when there is one', () => {
    render(<ProjectGallery t={THEME} photos={[photo(1)]} />);

    expect(shown()).toHaveAccessibleName('Photo 1 of 1, full size');
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'All photos' })).not.toBeInTheDocument();
  });
});
