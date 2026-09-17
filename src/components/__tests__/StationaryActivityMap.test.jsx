import { describe, it, expect, fireEvent, afterEach } from 'vite-plus/test';
import { render, screen, cleanup } from '@testing-library/react';
import { StationaryActivityMap } from '../sandbox/StationaryActivityMap';
import { findExperiment } from '../../sandbox/experiments';
import { THEME } from '../../theme';

function mount() {
  return render(<StationaryActivityMap t={THEME} experiment={findExperiment('stationary-activity-mapping')} />);
}

function getRecordingCard() {
  const el = screen.getByText('Record Observation');
  return el.closest('section') ?? el.parentElement?.closest('section') ?? el.parentElement;
}

describe('Stationary Activity Mapping', () => {
  afterEach(() => cleanup());

  it('lays out the map, recording card, and tally', () => {
    mount();

    expect(screen.getByRole('group', { name: /map, 8 spots across and 5 down/i })).toBeInTheDocument();
    expect(screen.getByText('Record Observation')).toBeInTheDocument();
    expect(screen.getByText('Observation Tally')).toBeInTheDocument();
  });

  it('shows activity options after selecting a posture', () => {
    mount();
    const card = getRecordingCard();
    const buttons = Array.from(card.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    const standingBtn = buttons.find(
      (b) => b.textContent?.includes('Standing')
    );
    fireEvent.click(standingBtn);
    expect(screen.getByText('Waiting for Transport')).toBeInTheDocument();
  });

  it('enables Record once a posture and an activity are chosen', () => {
    mount();
    const card = getRecordingCard();
    const buttons = Array.from(card.querySelectorAll('button'));
    fireEvent.click(buttons.find((b) => b.textContent?.trim() === 'Standing'));
    fireEvent.click(buttons.find((b) => b.textContent?.trim() === 'Waiting for Transport'));

    expect(screen.getByRole('button', { name: 'Record' })).not.toBeDisabled();
  });

  it('recording one person updates the tally and resets the card', () => {
    mount();
    const card = getRecordingCard();
    const buttons = Array.from(card.querySelectorAll('button'));
    fireEvent.click(buttons.find((b) => b.textContent?.trim() === 'Standing'));
    fireEvent.click(buttons.find((b) => b.textContent?.trim() === 'Waiting for Transport'));
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    expect(screen.getByText(/recorded/)).toBeInTheDocument();
  });

  it('shows the tally table with posture rows', () => {
    mount();
    const tallyCard = screen.getByText('Observation Tally').closest('section');
    expect(tallyCard.textContent).toContain('Standing');
    expect(tallyCard.textContent).toContain('Lying Down');
  });
});
