import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BudgetBallot } from '../sandbox/BudgetBallot';
import { DesireLines } from '../sandbox/DesireLines';
import { FifteenMinute } from '../sandbox/FifteenMinute';
import { OpenVote } from '../sandbox/OpenVote';
import { StreetMixer } from '../sandbox/StreetMixer';
import { findExperiment } from '../../sandbox/experiments';
import { THEME } from '../../theme';

/** Each tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} experiment={findExperiment(id)} />);
}

describe('Street Section Mixer', () => {
  it('opens on today street', () => {
    mount(StreetMixer, 'street-mixer');

    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    // Two 2.5 m footways at 1,200 an hour, plus 10 m of traffic lane at 250.
    expect(screen.getByText('8.5k')).toBeInTheDocument();
    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
  });

  it('trades width between neighbours when a segment is widened', () => {
    mount(StreetMixer, 'street-mixer');

    // The footway grows by a quarter metre and the parking beside it gives that up,
    // which is 300 more people an hour and the same 20-metre street.
    fireEvent.click(screen.getAllByRole('button', { name: 'Widen Sidewalk' })[0]);

    expect(screen.getByText('8.8k')).toBeInTheDocument();
    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
    expect(screen.getByText('2.75 m')).toBeInTheDocument();
  });

  it('resizes from the keyboard on a divider', () => {
    mount(StreetMixer, 'street-mixer');
    const dividers = screen.getAllByRole('separator');

    expect(dividers[0]).toHaveAttribute('aria-label', 'Divider between Sidewalk and Parking');
    fireEvent.keyDown(dividers[0], { key: 'ArrowRight' });

    expect(screen.getByText('8.8k')).toBeInTheDocument();
  });

  it('moves further with shift held, and stops at the neighbour minimum', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.keyDown(screen.getAllByRole('separator')[0], { key: 'ArrowRight', shiftKey: true });

    // A metre was asked for, but the parking bay beside it bottoms out at 2 m, so the
    // footway gets the half metre that was actually going spare: 3 m, and 9,100 people.
    expect(screen.getAllByRole('separator')[0]).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('9.1k')).toBeInTheDocument();
  });

  it('stops caring about the preset once the street is edited', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.click(screen.getAllByRole('button', { name: 'Widen Sidewalk' })[0]);

    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to another street entirely', () => {
    mount(StreetMixer, 'street-mixer');

    // Scoped, because "Play street" is a preset and also a kind of segment.
    const presets = within(screen.getByRole('group', { name: 'Presets' }));
    fireEvent.click(presets.getByRole('button', { name: 'Play street' }));

    expect(screen.getByText('11.0k')).toBeInTheDocument();
    // Two 1.5 m planting strips and the café awnings: 32% of the street in shade.
    expect(screen.getByText('32')).toBeInTheDocument();
  });

  it('adds something to the street, squeezing what is already there', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.click(screen.getByRole('button', { name: 'Bus lane' }));

    const list = within(screen.getByRole('list'));
    expect(list.getByText('Bus lane')).toBeInTheDocument();
    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
    // A bus lane moves far more people than the space it was given was moving.
    expect(screen.getByText('14.2k')).toBeInTheDocument();
    // And the squeeze is shared, rather than taken out of the footways.
    expect(list.queryByText('1.5 m')).not.toBeInTheDocument();
  });

  it('removes something, and leaves the gap visible rather than hiding it', () => {
    mount(StreetMixer, 'street-mixer');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove Parking' })[0]);

    expect(screen.getByText('17.5 m of 20 m — 2.5 m spare')).toBeInTheDocument();
    expect(screen.getByText('Still unallocated')).toBeInTheDocument();
  });

  it('offers to fill the street again, and does', () => {
    mount(StreetMixer, 'street-mixer');
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove Parking' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Fill the street' }));

    expect(screen.getByText('20 m of 20 m')).toBeInTheDocument();
    expect(screen.queryByText('Still unallocated')).not.toBeInTheDocument();
  });
});

describe('Desire Lines', () => {
  it('starts with an empty plaza', () => {
    mount(DesireLines, 'desire-lines');

    expect(screen.getByText('0 journeys drawn')).toBeInTheDocument();
    expect(screen.getByText(/needs 3 separate journeys/i)).toBeInTheDocument();
  });

  it('draws a walk from one marker to another', () => {
    mount(DesireLines, 'desire-lines');

    fireEvent.click(screen.getByRole('button', { name: 'Walk from Metro entrance' }));
    expect(screen.getByText(/From Metro entrance — now pick where you are going/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Walk from Tram stop' }));

    expect(screen.getByText('1 journey drawn')).toBeInTheDocument();
    // Corner to corner is a diagonal, and the paving does not go that way.
    expect(screen.getByText('100')).toBeInTheDocument(); // per cent leaving the paving
  });

  it('takes a second tap on the same marker as a change of mind', () => {
    mount(DesireLines, 'desire-lines');

    fireEvent.click(screen.getByRole('button', { name: 'Walk from Metro entrance' }));
    fireEvent.click(screen.getByRole('button', { name: /Walking from Metro entrance/ }));

    expect(screen.getByText('0 journeys drawn')).toBeInTheDocument();
  });

  it('brings in ten neighbours, and suggests paving where they agree', () => {
    mount(DesireLines, 'desire-lines');

    fireEvent.click(screen.getByRole('button', { name: /add ten neighbours/i }));

    expect(screen.getByText('10 journeys drawn')).toBeInTheDocument();
    expect(screen.getByText('Unpaved ground worth paving')).toBeInTheDocument();
  });

  it('hides the suggestions when asked', () => {
    mount(DesireLines, 'desire-lines');
    fireEvent.click(screen.getByRole('button', { name: /add ten neighbours/i }));

    fireEvent.click(screen.getByRole('button', { name: /show where to pave/i }));

    expect(screen.getByText('Suggestions are hidden.')).toBeInTheDocument();
  });

  it('clears the plaza', () => {
    mount(DesireLines, 'desire-lines');
    fireEvent.click(screen.getByRole('button', { name: /add ten neighbours/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText('0 journeys drawn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });
});

describe('15-Minute Reach', () => {
  const grid = () => screen.getByRole('group', { name: /neighbourhood grid/i });

  it('serves nobody to begin with', () => {
    mount(FifteenMinute, 'fifteen-minute');

    expect(screen.getByRole('status')).toHaveTextContent('0 of 5 kinds within 15 minutes');
    expect(screen.getByText('0 placed · 100 m cells')).toBeInTheDocument();
  });

  it('places an amenity with the keyboard', () => {
    mount(FifteenMinute, 'fifteen-minute');

    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('1 placed · 100 m cells')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Food shop here');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 5 kinds');
  });

  it('moves the cursor with the arrow keys', () => {
    mount(FifteenMinute, 'fifteen-minute');
    expect(screen.getByRole('status')).toHaveTextContent('column 5, row 4');

    fireEvent.keyDown(grid(), { key: 'ArrowRight' });
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    expect(screen.getByRole('status')).toHaveTextContent('column 6, row 5');
  });

  it('will not place anything on the railway', () => {
    mount(FifteenMinute, 'fifteen-minute');
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    expect(screen.getByRole('status')).toHaveTextContent('the railway');
    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('0 placed · 100 m cells')).toBeInTheDocument();
  });

  it('takes an amenity away again with a second press', () => {
    mount(FifteenMinute, 'fifteen-minute');

    fireEvent.keyDown(grid(), { key: 'Enter' });
    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('0 placed · 100 m cells')).toBeInTheDocument();
  });

  it('replaces what is on a cell when a different kind is selected', () => {
    mount(FifteenMinute, 'fifteen-minute');
    fireEvent.keyDown(grid(), { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'School' }));
    fireEvent.keyDown(grid(), { key: 'Enter' });

    expect(screen.getByText('1 placed · 100 m cells')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('School here');
  });

  it('strands the far side of the railway on the council draft', () => {
    mount(FifteenMinute, 'fifteen-minute');

    fireEvent.click(screen.getByRole('button', { name: /the council's draft/i }));

    expect(screen.getByText('5 placed · 100 m cells')).toBeInTheDocument();
    // Served by all five, and reaching nothing at all, are both non-zero.
    const served = Number(screen.getByText('Served by all five').nextSibling.textContent.replace('%', ''));
    const stranded = Number(screen.getByText('Can reach nothing').nextSibling.textContent.replace('%', ''));
    expect(served).toBeGreaterThan(0);
    expect(served).toBeLessThan(70);
    expect(stranded).toBeGreaterThan(0);
  });
});

describe('Budget Ballot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with the whole budget unspent', () => {
    mount(BudgetBallot, 'budget-ballot');

    expect(screen.getByText('€250,000 left')).toBeInTheDocument();
    expect(screen.getByText(/nothing chosen yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy my ballot/i })).toBeDisabled();
  });

  it('spends the money as a slider moves', () => {
    mount(BudgetBallot, 'budget-ballot');

    fireEvent.change(screen.getByLabelText('Street trees'), { target: { value: '10' } });

    expect(screen.getByText('€236,000 left')).toBeInTheDocument();
    expect(screen.getByText('Street trees × 10')).toBeInTheDocument();
    // Once as the total committed, once on the line, once on the ballot.
    expect(screen.getAllByText('€14,000')).toHaveLength(3);
  });

  it('caps a slider at what the budget will pay for, and says so', () => {
    mount(BudgetBallot, 'budget-ballot');

    const footway = screen.getByLabelText('Widened footway');
    // 60 metres at €2,200 is €132,000, which the budget can just about take on its own.
    expect(footway).toHaveAttribute('max', '60');
    fireEvent.change(footway, { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Play equipment'), { target: { value: '4' } });

    // €180,000 gone, so the €18,000 crossings can no longer reach four.
    expect(Number(screen.getByLabelText('Raised crossings').getAttribute('max'))).toBeLessThan(4);
    expect(screen.getAllByText(/the budget stops at/i).length).toBeGreaterThan(0);
  });

  it('loads the council draft, and scores it', () => {
    mount(BudgetBallot, 'budget-ballot');

    fireEvent.click(screen.getByRole('button', { name: /the council's draft/i }));

    expect(screen.getByText('Widened footway × 40')).toBeInTheDocument();
    expect(screen.getByText('€65,800 left')).toBeInTheDocument();
  });

  it('splits the room when parking becomes parklets', () => {
    mount(BudgetBallot, 'budget-ballot');

    fireEvent.change(screen.getByLabelText('Parking bay → parklet'), { target: { value: '8' } });

    // Children gain, shopkeepers lose, and both are on the same panel.
    const children = screen.getByText('Children').parentElement.parentElement;
    const traders = screen.getByText('Shopkeepers').parentElement.parentElement;
    expect(children.textContent).toMatch(/\+\d+/);
    expect(traders.textContent).toMatch(/-\d+/);
  });

  it('copies the ballot as text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    mount(BudgetBallot, 'budget-ballot');
    fireEvent.change(screen.getByLabelText('Street trees'), { target: { value: '6' } });

    fireEvent.click(screen.getByRole('button', { name: /copy my ballot/i }));

    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Street trees: 6 trees'));
  });

  it('shows the text to copy by hand when the browser will not', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    mount(BudgetBallot, 'budget-ballot');
    fireEvent.change(screen.getByLabelText('Benches with backs'), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: /copy my ballot/i }));

    const field = await screen.findByLabelText('Your ballot as text');
    expect(field.value).toContain('Benches with backs: 3 benches');
    expect(field.value).toContain('Spent €2,700 of €250,000');
  });
});

describe('Open Vote', () => {
  it('shows the placeholder question and nothing chosen yet', () => {
    mount(OpenVote, 'open-vote');

    expect(screen.getByPlaceholderText('Yes or No?')).toBeInTheDocument();
    expect(screen.getByText(/pick yes, no, or undecided to see it here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('picks a vote and shows it in the solo result', () => {
    mount(OpenVote, 'open-vote');

    fireEvent.click(screen.getByRole('button', { name: 'Undecided' }));

    expect(screen.getByRole('button', { name: 'Undecided' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 · 100%')).toBeInTheDocument();
  });

  it('lets someone type their own question, purely for display', () => {
    mount(OpenVote, 'open-vote');

    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Fund the parklets?' } });

    expect(screen.getByLabelText('The question')).toHaveValue('Fund the parklets?');
  });
});
