import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import BeforeAfterSlider from '../BeforeAfterSlider';
import { THEME } from '../../theme';

const getHandle = (container) =>
  container.querySelectorAll('div[style*="cursor: col-resize"]')[1];

describe('BeforeAfterSlider', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <BeforeAfterSlider t={THEME} beforeImage="before.jpg" afterImage="after.jpg" />
    );
    expect(container.querySelector('h3')).toHaveTextContent('Before / After Comparison');
  });

  it('updates slider position on mouse drag', () => {
    const { container } = render(
      <BeforeAfterSlider t={THEME} beforeImage="before.jpg" afterImage="after.jpg" />
    );
    const handle = getHandle(container);

    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(window, { clientX: 200 });
    expect(handle.style.left).toBe('25%');

    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { clientX: 600 });
    expect(handle.style.left).toBe('25%');
  });

  it('updates slider position on touch drag', () => {
    const { container } = render(
      <BeforeAfterSlider t={THEME} beforeImage="before.jpg" afterImage="after.jpg" />
    );
    const handle = getHandle(container);

    fireEvent.touchStart(handle);
    fireEvent.touchMove(window, { touches: [{ clientX: 600 }] });
    expect(handle.style.left).toBe('75%');

    fireEvent.touchEnd(window);
    fireEvent.touchMove(window, { touches: [{ clientX: 100 }] });
    expect(handle.style.left).toBe('75%');
  });

  it('clamps slider position between 0 and 100', () => {
    const { container } = render(
      <BeforeAfterSlider t={THEME} beforeImage="before.jpg" afterImage="after.jpg" />
    );
    const handle = getHandle(container);

    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(window, { clientX: -200 });
    expect(handle.style.left).toBe('0%');

    fireEvent.mouseMove(window, { clientX: 2000 });
    expect(handle.style.left).toBe('100%');
  });
});
