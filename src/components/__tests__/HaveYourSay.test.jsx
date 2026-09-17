import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { THEME } from '../../theme';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

const { HaveYourSay, LANDING_SURVEY_CONTENT } = await import('../HaveYourSay');
const { resolveSurveyContent } = await import('../survey/content');

const content = resolveSurveyContent(LANDING_SURVEY_CONTENT);

const LABEL = 'Follow the Project';

const trigger = () => screen.getByRole('button', { name: LABEL });
const dialog = () => screen.queryByRole('dialog', { name: LABEL });

// The survey is code-split: the dialog is there on the click, its contents a
// tick later, so both are waited on before a test looks at them.
async function open() {
  fireEvent.click(trigger());
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: content.hero.title })).toBeInTheDocument()
  );
}

describe('HaveYourSay', () => {
  it('shows only the trigger until it is clicked', () => {
    render(<HaveYourSay t={THEME} />);

    expect(trigger()).toBeInTheDocument();
    expect(dialog()).not.toBeInTheDocument();
  });

  it('takes its shape and place from the stylesheet, so it can be responsive', () => {
    render(<HaveYourSay t={THEME} />);

    // Placement, size and the phone-sized bar are all in index.css: an inline
    // style would win over the media query that swaps the two.
    expect(trigger()).toHaveClass('placer-feedback-trigger');
    expect(trigger().style.position).toBe('');
    expect(trigger().style.width).toBe('');
  });

  it('turns a ring, not the label, and grows on hover', () => {
    render(<HaveYourSay t={THEME} />);

    // The moving part is the ring: a turning disc would look no different from a
    // still one, and the label has to stay upright to be read.
    const ring = trigger().querySelector('.placer-feedback-ring');
    expect(ring).toBeInTheDocument();
    expect(ring).toHaveAttribute('aria-hidden', 'true');

    // The label is a sibling of the ring, so nothing turns it.
    expect(trigger()).toHaveTextContent(LABEL);
    expect(ring).not.toHaveTextContent(LABEL);

    // The hover scale is a stylesheet rule; the class is what wires it up.
    expect(trigger()).toHaveClass('placer-feedback-trigger');
  });

  it('carries its label as text, in the colours the component sets', () => {
    render(<HaveYourSay t={THEME} />);

    // The name comes from the visible text, not an aria-label standing in for it.
    expect(trigger()).toHaveTextContent(LABEL);
    expect(trigger()).not.toHaveAttribute('aria-label');
    expect(trigger()).toHaveStyle({
      // Off-palette on purpose: the one brand colour on a black-and-white page.
      backgroundColor: '#00FFF9',
      color: '#000000',
    });
  });

  it('opens the survey in a modal dialog', async () => {
    render(<HaveYourSay t={THEME} />);
    await open();

    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 1, name: content.hero.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: content.hero.startLabel })).toBeInTheDocument();
  });

  it('closes on the close button, and returns focus to the trigger', async () => {
    render(<HaveYourSay t={THEME} />);
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Close the survey' }));

    expect(dialog()).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes on Escape', async () => {
    render(<HaveYourSay t={THEME} />);
    await open();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(dialog()).not.toBeInTheDocument();
  });

  it('keeps a part-finished survey when the scrim is clicked', async () => {
    render(<HaveYourSay t={THEME} />);
    await open();

    fireEvent.click(dialog().parentElement);

    expect(dialog()).toBeInTheDocument();
  });

  it('locks the page behind the dialog and releases it again', async () => {
    render(<HaveYourSay t={THEME} />);
    await open();

    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('fills the dialog rather than the viewport', async () => {
    render(<HaveYourSay t={THEME} />);
    await open();

    // The route renders the survey at 100vh. Inside the panel it has to take
    // the panel's height instead, or it overflows the dialog it sits in.
    // The close button is the panel's first child; the survey is the last.
    expect(dialog().lastElementChild).toHaveStyle({ height: '100%' });
  });
});
