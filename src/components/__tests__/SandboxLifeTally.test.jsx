import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PublicLifeTally } from '../sandbox/PublicLifeTally';
import { findExperiment } from '../../sandbox/experiments';
import { THEME } from '../../theme';

function mount() {
  return render(<PublicLifeTally t={THEME} experiment={findExperiment('life-tally')} />);
}

/** The section of a Panel, found by its title. */
function panel(title) {
  const heading = screen.getByRole('heading', { level: 2, name: new RegExp(title, 'i') });
  return within(heading.closest('section'));
}

describe('Public Life Tally', () => {
  it('lays out the three cards and starts with nothing recorded', () => {
    mount();

    const recording = panel('Record a person');
    expect(recording.getByRole('button', { name: 'Record person' })).toBeDisabled();
    expect(recording.getByRole('button', { name: 'Undo last' })).toBeDisabled();
    expect(recording.getByRole('status')).toHaveTextContent(/nothing recorded yet/i);

    const tallyCard = panel('Tally');
    expect(tallyCard.getByText('People recorded')).toBeInTheDocument();
    expect(tallyCard.getByRole('button', { name: /clear tally/i })).toBeDisabled();

    const map = panel('The square');
    expect(map.getByRole('group', { name: /grid, 8 spots across and 5 down/i })).toBeInTheDocument();
  });

  it('holds record until a posture and then an activity are chosen', () => {
    mount();
    const recording = panel('Record a person');

    fireEvent.click(recording.getByRole('button', { name: 'Standing' }));
    expect(recording.getByRole('button', { name: 'Talking' })).toBeInTheDocument();
    expect(recording.getByRole('button', { name: 'Record person' })).toBeDisabled();

    fireEvent.click(recording.getByRole('button', { name: 'Talking' }));
    expect(recording.getByRole('button', { name: 'Record person' })).toBeEnabled();
  });

  it('recording one person fills the tally and resets the sheet for the next', () => {
    mount();
    const recording = panel('Record a person');

    fireEvent.click(recording.getByRole('button', { name: 'Standing' }));
    fireEvent.click(recording.getByRole('button', { name: 'On a phone' }));
    fireEvent.click(recording.getByRole('button', { name: 'Record person' }));

    // The observation is confirmed, and the sheet is empty again.
    expect(recording.getByRole('status')).toHaveTextContent(/1 person recorded/);
    expect(recording.getByRole('status')).toHaveTextContent(/Last: Standing, On a phone/);
    expect(recording.getByRole('button', { name: 'Record person' })).toBeDisabled();
    expect(recording.queryByRole('button', { name: 'On a phone' })).not.toBeInTheDocument();

    const tallyCard = panel('Tally');
    expect(tallyCard.getByText('1 person · 0 placed')).toBeInTheDocument();
    const row = tallyCard.getByText('Standing').closest('tr');
    expect(row.textContent).toContain('On a phone 1');
  });

  it('counts one person doing several things once in the posture and once each in the activities', () => {
    mount();
    const recording = panel('Record a person');

    fireEvent.click(recording.getByRole('button', { name: 'Standing' }));
    fireEvent.click(recording.getByRole('button', { name: 'Talking' }));
    fireEvent.click(recording.getByRole('button', { name: 'On a phone' }));
    fireEvent.click(recording.getByRole('button', { name: 'Record person' }));

    const tallyCard = panel('Tally');
    const row = tallyCard.getByText('Standing').closest('tr');
    expect(row.textContent).toContain('Talking 1');
    expect(row.textContent).toContain('On a phone 1');
    expect(tallyCard.getByText('1 person · 0 placed')).toBeInTheDocument();
  });

  it('switching posture clears the activities from the one you were coding', () => {
    mount();
    const recording = panel('Record a person');

    fireEvent.click(recording.getByRole('button', { name: 'Standing' }));
    fireEvent.click(recording.getByRole('button', { name: 'Talking' }));
    expect(recording.getByRole('button', { name: 'Record person' })).toBeEnabled();

    fireEvent.click(recording.getByRole('button', { name: 'Sitting' }));

    expect(recording.getByRole('button', { name: 'Record person' })).toBeDisabled();
  });

  it('undo takes the last person back out again', () => {
    mount();
    const recording = panel('Record a person');

    fireEvent.click(recording.getByRole('button', { name: 'Standing' }));
    fireEvent.click(recording.getByRole('button', { name: 'Talking' }));
    fireEvent.click(recording.getByRole('button', { name: 'Record person' }));
    fireEvent.click(recording.getByRole('button', { name: 'Undo last' }));

    expect(recording.getByRole('status')).toHaveTextContent(/nothing recorded yet/i);
    expect(recording.getByRole('button', { name: 'Undo last' })).toBeDisabled();
    expect(panel('Tally').getAllByText('0').length).toBeGreaterThan(0);
  });

  it('marks a spot from the keyboard and pins the next person there', () => {
    mount();
    const map = panel('The square');
    const grid = map.getByRole('group', { name: /grid, 8 spots across and 5 down/i });

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'Enter' });

    expect(map.getByRole('status')).toHaveTextContent(/marked for the next person/);

    const recording = panel('Record a person');
    fireEvent.click(recording.getByRole('button', { name: 'Moving' }));
    fireEvent.click(recording.getByRole('button', { name: 'Walking through' }));
    fireEvent.click(recording.getByRole('button', { name: 'Record person' }));

    expect(panel('Tally').getByText('1 person · 1 placed')).toBeInTheDocument();
  });

  it('a person recorded without a spot still lands in the tally, just not on the map', () => {
    mount();
    const recording = panel('Record a person');

    fireEvent.click(recording.getByRole('button', { name: 'Sitting' }));
    fireEvent.click(recording.getByRole('button', { name: 'Reading' }));
    fireEvent.click(recording.getByRole('button', { name: 'Record person' }));

    const tallyCard = panel('Tally');
    expect(tallyCard.getByText('1 person · 0 placed')).toBeInTheDocument();
    expect(panel('The square').getByText('1 not placed')).toBeInTheDocument();
  });

  it('clears the whole session in one go', () => {
    mount();
    const recording = panel('Record a person');

    fireEvent.click(recording.getByRole('button', { name: 'Standing' }));
    fireEvent.click(recording.getByRole('button', { name: 'Talking' }));
    fireEvent.click(recording.getByRole('button', { name: 'Record person' }));
    fireEvent.click(recording.getByRole('button', { name: 'Standing' }));
    fireEvent.click(recording.getByRole('button', { name: 'Talking' }));
    fireEvent.click(recording.getByRole('button', { name: 'Record person' }));

    fireEvent.click(panel('Tally').getByRole('button', { name: /clear tally/i }));

    expect(recording.getByRole('status')).toHaveTextContent(/nothing recorded yet/i);
    expect(recording.getByRole('button', { name: 'Undo last' })).toBeDisabled();
    expect(panel('Tally').getByRole('button', { name: /clear tally/i })).toBeDisabled();
  });
});