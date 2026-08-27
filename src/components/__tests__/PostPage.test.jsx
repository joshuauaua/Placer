import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PostPage } from '../PostPage';
import { THEME } from '../../theme';
import { saveImagination } from '../../services/api';

vi.mock('../../services/api', () => ({
  saveImagination: vi.fn(),
}));

const DRAFT = { title: 'Pocket park', cat: 'green', blurb: 'Swap the asphalt for trees.' };
const CAPTURED = {
  position: { lat: 51.507351, lng: -0.127758 },
  pov: { heading: 90, pitch: 0, zoom: 1 },
  fov: 90,
  source: 'streetview',
  screenshot: 'data:image/jpeg;base64,mockScreenshot',
};

const setup = (props = {}) => {
  const onPosted = vi.fn();
  const onBack = vi.fn();
  render(
    <PostPage
      t={THEME}
      draft={DRAFT}
      preview="data:image/jpeg;base64,mockPreview"
      capturedView={CAPTURED}
      canvasAssets={[{ id: 'a1' }, { id: 'a2' }]}
      lines={[{ id: 'l1' }]}
      onPosted={onPosted}
      onBack={onBack}
      {...props}
    />
  );
  return { onPosted, onBack };
};

describe('PostPage', () => {
  beforeEach(() => {
    vi.mocked(saveImagination).mockReset();
    vi.mocked(saveImagination).mockResolvedValue({ id: 'img-1' });
  });

  it('renders the StepBar with step 3 ("Post") active', () => {
    setup();
    expect(screen.getByText('Post')).toHaveStyle({ fontWeight: 800 });
    expect(screen.getByText('Place assets')).toHaveStyle({ fontWeight: 600 });
    expect(screen.getByText('Describe')).toHaveStyle({ fontWeight: 600 });
  });

  it('shows the draft for review', () => {
    setup();

    expect(screen.getByText('Pocket park')).toBeInTheDocument();
    expect(screen.getByText('Swap the asphalt for trees.')).toBeInTheDocument();
    expect(screen.getByText('Green space')).toBeInTheDocument();
  });

  it('shows the asset and line counts', () => {
    setup();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/assets placed/)).toBeInTheDocument();
    expect(screen.getByText(/lines/)).toBeInTheDocument();
  });

  it('formats the captured coordinates as the location', () => {
    setup();
    expect(screen.getByText('51.5074, -0.1278')).toBeInTheDocument();
  });

  it('falls back to "Not recorded" when the capture has no position', () => {
    setup({ capturedView: { ...CAPTURED, position: null } });
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });

  it('prefers the composite preview over the bare screenshot', () => {
    setup();
    expect(screen.getByAltText('Your imagination')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockPreview'
    );
  });

  it('falls back to the bare screenshot when the composite export failed', () => {
    setup({ preview: null });
    expect(screen.getByAltText('Your imagination')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockScreenshot'
    );
  });

  it('saves the imagination and then calls onPosted', async () => {
    const { onPosted } = setup();

    fireEvent.click(screen.getByText('Post to community'));

    await waitFor(() => expect(onPosted).toHaveBeenCalledTimes(1));
    expect(saveImagination).toHaveBeenCalledWith({
      title: 'Pocket park',
      cat: 'green',
      blurb: 'Swap the asphalt for trees.',
      loc: '51.5074, -0.1278',
      author: 'You There',
      source: 'streetview',
      position: CAPTURED.position,
      pov: CAPTURED.pov,
      fov: 90,
      canvasAssets: [{ id: 'a1' }, { id: 'a2' }],
      lines: [{ id: 'l1' }],
      preview: 'data:image/jpeg;base64,mockPreview',
    });
  });

  it('shows a saving state while the write is in flight', async () => {
    vi.mocked(saveImagination).mockImplementation(() => new Promise(() => {}));
    setup();

    fireEvent.click(screen.getByText('Post to community'));

    expect(await screen.findByText('Posting…')).toBeDisabled();
  });

  it('surfaces an error and does not advance when the save fails', async () => {
    vi.mocked(saveImagination).mockRejectedValue(new Error('nope'));
    const { onPosted } = setup();

    fireEvent.click(screen.getByText('Post to community'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not save your imagination/);
    expect(onPosted).not.toHaveBeenCalled();
  });

  it('explains a full localStorage quota specifically', async () => {
    const quotaError = new Error('quota');
    quotaError.name = 'QuotaExceededError';
    vi.mocked(saveImagination).mockRejectedValue(quotaError);
    setup();

    fireEvent.click(screen.getByText('Post to community'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Out of local storage space/);
  });

  it('calls onBack from "Back to describe"', () => {
    const { onBack } = setup();

    fireEvent.click(screen.getByText('Back to describe'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
