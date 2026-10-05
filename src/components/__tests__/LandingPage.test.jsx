import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LandingPage } from '../LandingPage';
import { THEME } from '../../theme';

const TITLES = [
  'Be the first to use PLACER',
  'Help shape what we build',
  'Tell us about placemaking in your city',
];

function activeTitle(container) {
  return container.querySelector('.placer-landing-option[data-active="true"] h2').textContent;
}

describe('LandingPage carousel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('has three cards, each with a photo, a title and a button, the first showing', () => {
    const { container } = render(<LandingPage t={THEME} />);

    const cards = container.querySelectorAll('.placer-landing-option');
    expect(cards).toHaveLength(3);
    cards.forEach((card, i) => {
      expect(card.querySelector('img.placer-landing-option-photo')).not.toBeNull();
      expect(card).toHaveTextContent(TITLES[i]);
    });
    expect(activeTitle(container)).toBe(TITLES[0]);

    // Only the showing card reaches assistive tech.
    expect(screen.getByRole('button', { name: 'Join the Waitlist' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Apply to User Labs' })).not.toBeInTheDocument();
    expect(cards[1]).toHaveAttribute('inert');
  });

  it('jumps to a card from its dot', () => {
    const { container } = render(<LandingPage t={THEME} />);

    fireEvent.click(screen.getByRole('button', { name: `Show card 3: ${TITLES[2]}` }));

    expect(activeTitle(container)).toBe(TITLES[2]);
    expect(screen.getByRole('link', { name: 'Take the Placemaking Trends survey' }))
      .toHaveAttribute('href', '/placemaking-trends-survey');
    expect(screen.getByRole('button', { name: `Show card 3: ${TITLES[2]}` }))
      .toHaveAttribute('aria-current', 'true');
  });

  it('rotates through the cards on its own, and back to the first', () => {
    vi.useFakeTimers();
    const { container } = render(<LandingPage t={THEME} />);

    act(() => { vi.advanceTimersByTime(6000); });
    expect(activeTitle(container)).toBe(TITLES[1]);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(activeTitle(container)).toBe(TITLES[2]);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(activeTitle(container)).toBe(TITLES[0]);
  });

  it('holds still while the pointer is over it', () => {
    vi.useFakeTimers();
    const { container } = render(<LandingPage t={THEME} />);

    fireEvent.mouseEnter(container.querySelector('.placer-landing-actions'));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(activeTitle(container)).toBe(TITLES[0]);
  });
});
