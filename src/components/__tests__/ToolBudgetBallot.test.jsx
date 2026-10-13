import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { BudgetBallot } from '../toolkit/BudgetBallot';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('Co-Budget', () => {
  const add = (label, times) => {
    for (let i = 0; i < times; i += 1) fireEvent.click(screen.getByRole('button', { name: `One more: ${label}` }));
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with the whole budget unspent', () => {
    mount(BudgetBallot, 'budget-ballot');

    expect(screen.getByText('€250,000 left')).toBeInTheDocument();
    expect(screen.getByText(/nothing chosen yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy my ballot/i })).toBeDisabled();
  });

  it('spends the money as + and − are pressed', () => {
    mount(BudgetBallot, 'budget-ballot');

    expect(screen.getByRole('button', { name: 'One fewer: Street trees' })).toBeDisabled();
    add('Street trees', 11);
    fireEvent.click(screen.getByRole('button', { name: 'One fewer: Street trees' }));

    expect(screen.getByLabelText('Street trees: how many')).toHaveTextContent('10');
    expect(screen.getByText('€236,000 left')).toBeInTheDocument();
    expect(screen.getByText('Street trees × 10')).toBeInTheDocument();
    // Once as the total committed, once on the line, once on the ballot.
    expect(screen.getAllByText('€14,000')).toHaveLength(3);
  });

  it('stops + at what the budget will pay for, and says so', () => {
    mount(BudgetBallot, 'budget-ballot');

    // 60 metres of footway at €2,200 and four play sets at €12,000: €180,000 gone.
    add('Widened footway', 60);
    add('Play equipment', 4);
    expect(screen.getByRole('button', { name: 'One more: Widened footway' })).toBeDisabled();

    // So the €18,000 crossings stop short of the four that fit.
    add('Raised crossings', 4);
    expect(screen.getByLabelText('Raised crossings: how many')).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'One more: Raised crossings' })).toBeDisabled();
    expect(screen.getAllByText(/the budget stops at/i).length).toBeGreaterThan(0);
  });

  it('loads the council draft, and scores it', () => {
    mount(BudgetBallot, 'budget-ballot');

    fireEvent.click(screen.getByRole('button', { name: /the council's draft/i }));

    expect(screen.getByText('Widened footway × 40')).toBeInTheDocument();
    expect(screen.getByText('€65,800 left')).toBeInTheDocument();
  });

  it('keeps no score of outcomes or who gains', () => {
    mount(BudgetBallot, 'budget-ballot');

    expect(screen.queryByText('What it achieves')).not.toBeInTheDocument();
    expect(screen.queryByText('Who gains')).not.toBeInTheDocument();
  });

  it('copies the ballot as text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    mount(BudgetBallot, 'budget-ballot');
    add('Street trees', 6);

    fireEvent.click(screen.getByRole('button', { name: /copy my ballot/i }));

    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Street trees: 6 trees'));
  });

  it('shows the text to copy by hand when the browser will not', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    mount(BudgetBallot, 'budget-ballot');
    add('Benches with backs', 3);

    fireEvent.click(screen.getByRole('button', { name: /copy my ballot/i }));

    const field = await screen.findByLabelText('Your ballot as text');
    expect(field.value).toContain('Benches with backs: 3 benches');
    expect(field.value).toContain('Spent €2,700 of €250,000');
  });
});
