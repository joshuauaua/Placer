import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PinToImage, PinBoard } from '../toolkit/PinToImage';
import { PinToImageResults } from '../toolkit/PinToImageResults';
import { THEME } from '../../theme';

vi.mock('../../services/media', async (importOriginal) => ({
  ...(await importOriginal()),
  mediaUrl: (path) => (path ? `https://media.test/${path}` : null),
}));

const CONFIG = { prompt: 'Where would you sit?', imagePath: 'scenes/p/pin.webp', timer: null };
const openRoom = (contributions = [], publish = vi.fn()) => ({
  status: 'open', isHost: false, config: CONFIG, contributions, publish,
  combined: null,
});

describe('PinToImage, answering', () => {
  it('shows the question over the picture, and sends a pin where it is tapped', () => {
    const publish = vi.fn();
    render(<PinToImage t={THEME} room={openRoom([{ state: { pin: { x: 0.9, y: 0.9 } } }], publish)} answering />);

    expect(screen.getByRole('heading', { name: 'Where would you sit?' })).toBeInTheDocument();
    expect(screen.getByText('Tap the picture where your answer is.')).toBeInTheDocument();
    const board = screen.getByRole('button', { name: /tap to pin your dot/ });
    board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    fireEvent.click(board, { clientX: 50, clientY: 25 });

    expect(publish).toHaveBeenLastCalledWith({ pin: { x: 0.25, y: 0.25 } });
    expect(screen.getByText('Pinned. Tap somewhere else to move it.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove my pin' }));
    expect(publish).toHaveBeenLastCalledWith({ pin: null });
  });
});

describe('PinBoard', () => {
  it('draws a dot for each pin, where it is', () => {
    const { container } = render(
      <PinBoard t={THEME} imageUrl="https://media.test/x.webp" pins={[{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.5 }]} />,
    );
    expect(screen.getByRole('img', { name: 'The picture, with 2 pins' })).toBeInTheDocument();
    const dots = container.querySelectorAll('span[aria-hidden="true"]');
    expect(dots).toHaveLength(2);
    expect(dots[0].style.left).toBe('10%');
    expect(dots[0].style.top).toBe('20%');
  });
});

describe('PinToImageResults', () => {
  it('shows everybody\'s pins on the picture, and how many', () => {
    render(<PinToImageResults t={THEME} result={{ status: 'ended', endsAt: '2026-11-05T10:00:00Z', config: CONFIG,
      states: [{ pin: { x: 0.1, y: 0.1 } }, { pin: { x: 0.2, y: 0.2 } }, { pin: null }] }} />);
    const results = within(screen.getByRole('region', { name: 'Results: Where would you sit?' }));
    expect(results.getByText(/^Completed/)).toBeInTheDocument();
    expect(results.getByText('2 pins')).toBeInTheDocument();
    expect(results.getByRole('img', { name: 'Where would you sit?, with 2 pins' })).toBeInTheDocument();
  });
});
