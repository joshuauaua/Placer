import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StreetScreen } from '../StreetScreen';
import { THEME } from '../../theme';

vi.mock('../ImaginationCanvas', () => ({
  default: (props) => (
    <div data-testid="imagination-canvas" data-background={props.backgroundImage}>
      Canvas Mock
    </div>
  ),
}));

describe('StreetScreen', () => {
  it('renders "Back to map" and calls onBack when clicked', () => {
    const onBack = vi.fn();
    render(<StreetScreen t={THEME} onBack={onBack} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Back to map'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders "Next: Describe" and calls onNext when clicked', () => {
    const onNext = vi.fn();
    render(<StreetScreen t={THEME} onBack={vi.fn()} onNext={onNext} />);

    fireEvent.click(screen.getByText('Next: Describe'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders the StepBar showing step 1 ("Place assets") as active', () => {
    render(<StreetScreen t={THEME} onBack={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Place assets')).toHaveStyle({ fontWeight: 800 });
    expect(screen.getByText('Describe')).toHaveStyle({ fontWeight: 600 });
    expect(screen.getByText('Post')).toHaveStyle({ fontWeight: 600 });
  });

  it('renders the "Save draft" button', () => {
    render(<StreetScreen t={THEME} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText('Save draft')).toBeInTheDocument();
  });

  it('renders ImaginationCanvas with the captured screenshot as background', async () => {
    const capturedView = { screenshot: 'data:image/png;base64,mockScreenshot' };
    render(<StreetScreen t={THEME} onBack={vi.fn()} onNext={vi.fn()} capturedView={capturedView} />);

    expect(await screen.findByTestId('imagination-canvas')).toHaveAttribute(
      'data-background',
      'data:image/png;base64,mockScreenshot'
    );
  });

  it('shows the "Loading canvas…" fallback while the lazy import is pending, then renders the canvas', async () => {
    let resolveImport;
    vi.resetModules();
    vi.doMock('../ImaginationCanvas', () => new Promise((resolve) => { resolveImport = resolve; }));

    const { StreetScreen: FreshStreetScreen } = await import('../StreetScreen');
    render(<FreshStreetScreen t={THEME} onBack={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Loading canvas…')).toBeInTheDocument();

    await vi.waitFor(() => expect(resolveImport).toBeInstanceOf(Function));
    resolveImport({
      default: (props) => (
        <div data-testid="imagination-canvas" data-background={props.backgroundImage}>
          Canvas Mock
        </div>
      ),
    });

    expect(await screen.findByTestId('imagination-canvas')).toBeInTheDocument();

    vi.doUnmock('../ImaginationCanvas');
  });
});
