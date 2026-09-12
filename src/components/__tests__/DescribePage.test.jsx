import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { DescribePage } from '../DescribePage';
import { THEME } from '../../theme';

const EMPTY = { title: '', cat: '', blurb: '' };
const FILLED = { title: 'Pocket park', cat: 'green', blurb: 'Swap the asphalt for trees.' };

const setup = (props = {}) => {
  const onDraftChange = vi.fn();
  const onNext = vi.fn();
  const onBack = vi.fn();
  render(
    <DescribePage
      t={THEME}
      draft={EMPTY}
      onDraftChange={onDraftChange}
      onNext={onNext}
      onBack={onBack}
      {...props}
    />
  );
  return { onDraftChange, onNext, onBack };
};

describe('DescribePage', () => {
  it('renders the StepBar with step 2 ("Describe") active', () => {
    setup();
    expect(screen.getByText('Describe')).toHaveStyle({ fontWeight: 800 });
    expect(screen.getByText('Place assets')).toHaveStyle({ fontWeight: 600 });
    expect(screen.getByText('Post')).toHaveStyle({ fontWeight: 600 });
  });

  it('disables "Next: Post" until title, category, and description are all set', () => {
    setup();
    expect(screen.getByText('Next: Post')).toBeDisabled();
  });

  it('enables "Next: Post" once the draft is complete', () => {
    const { onNext } = setup({ draft: FILLED });

    expect(screen.getByText('Next: Post')).not.toBeDisabled();
    fireEvent.click(screen.getByText('Next: Post'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('treats whitespace-only text as empty', () => {
    setup({ draft: { title: '   ', cat: 'green', blurb: '   ' } });
    expect(screen.getByText('Next: Post')).toBeDisabled();
  });

  it('reports a title change as a patch', () => {
    const { onDraftChange } = setup();

    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Pocket park' } });
    expect(onDraftChange).toHaveBeenCalledWith({ title: 'Pocket park' });
  });

  it('reports a description change as a patch', () => {
    const { onDraftChange } = setup();

    fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'More trees.' } });
    expect(onDraftChange).toHaveBeenCalledWith({ blurb: 'More trees.' });
  });

  it('reports the chosen category as a patch', () => {
    const { onDraftChange } = setup();

    fireEvent.click(screen.getByText('Green space'));
    expect(onDraftChange).toHaveBeenCalledWith({ cat: 'green' });
  });

  it('calls onBack from "Back to canvas"', () => {
    const { onBack } = setup();

    fireEvent.click(screen.getByText('Back to canvas'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows the composite preview when one was captured', () => {
    setup({ preview: 'data:image/jpeg;base64,mockPreview' });

    expect(screen.getByAltText('Your imagination')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,mockPreview'
    );
  });

  it('omits the preview image when the export produced nothing', () => {
    setup({ preview: null });
    expect(screen.queryByAltText('Your imagination')).not.toBeInTheDocument();
  });
});

describe('DescribePage, when posting will need an account', () => {
  it('warns a step early rather than at the last moment', () => {
    setup({ draft: FILLED, needsAccount: true });

    expect(screen.getByText(/You will need an account to post this/)).toBeInTheDocument();
  });

  it('still lets anybody describe what they made', () => {
    setup({ draft: FILLED, needsAccount: true });

    // Not a gate. Drawing and describing stay open; only posting is gated.
    expect(screen.getByRole('button', { name: /Next: Post/ })).toBeEnabled();
  });

  it('says nothing where there are no accounts to need', () => {
    setup({ draft: FILLED });

    expect(screen.queryByText(/You will need an account/)).not.toBeInTheDocument();
  });
});
