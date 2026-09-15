import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { StreetScreen } from '../StreetScreen';
import { THEME } from '../../theme';

// Stands in for the Konva stage the real canvas would attach. Tests that care about
// the composite export set this before rendering; it stays null otherwise, which is
// what a canvas that has not mounted through Suspense looks like.
let fakeStage = null;

vi.mock('../ImaginationCanvas', () => ({
  default: (props) => {
    if (props.stageRef) props.stageRef.current = fakeStage;
    return (
      <div
        data-testid="imagination-canvas"
        data-background={props.backgroundImage}
        data-assets={props.canvasAssets?.length}>
        Canvas Mock
      </div>
    );
  },
}));

describe('StreetScreen', () => {
  beforeEach(() => {
    fakeStage = null;
  });

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

  it('advances with a null preview when no live Konva stage is available', () => {
    // The canvas is mocked here, so nothing ever populates stageRef. Advancing must
    // still work rather than throwing on the missing stage.
    const onNext = vi.fn();
    render(<StreetScreen t={THEME} onBack={vi.fn()} onNext={onNext} />);

    fireEvent.click(screen.getByText('Next: Describe'));
    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('exports the composite as a JPEG at stage resolution when a photo is behind the drawing', async () => {
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,mockComposite');
    fakeStage = { toDataURL };
    const onNext = vi.fn();
    render(
      <StreetScreen
        t={THEME}
        onBack={vi.fn()}
        onNext={onNext}
        capturedView={{ screenshot: 'data:image/jpeg;base64,mockScreenshot' }}
      />
    );
    await screen.findByTestId('imagination-canvas');

    fireEvent.click(screen.getByText('Next: Describe'));

    expect(toDataURL).toHaveBeenCalledWith({ mimeType: 'image/jpeg', quality: 0.75, pixelRatio: 1 });
    expect(onNext).toHaveBeenCalledWith('data:image/jpeg;base64,mockComposite');
  });

  it('exports PNG when there is no photo, since JPEG would flatten alpha to black', async () => {
    const toDataURL = vi.fn(() => 'data:image/png;base64,mockComposite');
    fakeStage = { toDataURL };
    render(<StreetScreen t={THEME} onBack={vi.fn()} onNext={vi.fn()} capturedView={{ screenshot: null }} />);
    await screen.findByTestId('imagination-canvas');

    fireEvent.click(screen.getByText('Next: Describe'));

    expect(toDataURL).toHaveBeenCalledWith({ mimeType: 'image/png', pixelRatio: 1 });
  });

  it('still advances with a null preview when the export throws', async () => {
    // A tainted canvas would throw here. Losing the preview must not trap the user.
    fakeStage = { toDataURL: () => { throw new Error('tainted canvas'); } };
    const onNext = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StreetScreen
        t={THEME}
        onBack={vi.fn()}
        onNext={onNext}
        capturedView={{ screenshot: 'data:image/jpeg;base64,mockScreenshot' }}
      />
    );
    await screen.findByTestId('imagination-canvas');

    fireEvent.click(screen.getByText('Next: Describe'));

    expect(onNext).toHaveBeenCalledWith(null);
    consoleError.mockRestore();
  });

  it('passes the lifted canvas state through to ImaginationCanvas', async () => {
    const onCanvasAssetsChange = vi.fn();
    render(
      <StreetScreen
        t={THEME}
        onBack={vi.fn()}
        onNext={vi.fn()}
        canvasAssets={[{ id: 'a1' }]}
        onCanvasAssetsChange={onCanvasAssetsChange}
      />
    );

    expect(await screen.findByTestId('imagination-canvas')).toHaveAttribute('data-assets', '1');
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
