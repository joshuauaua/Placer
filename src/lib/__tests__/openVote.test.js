import { describe, it, expect } from 'vite-plus/test';
import { DEFAULT_QUESTION, OPTIONS, emptyVote, tally } from '../openVote';

describe('the options', () => {
  it('offers exactly Yes, No and Undecided', () => {
    expect(OPTIONS.map((option) => option.key)).toEqual(['yes', 'no', 'undecided']);
  });

  it('has a placeholder question to show before anybody has typed one', () => {
    expect(DEFAULT_QUESTION).toBe('Yes or No?');
  });
});

describe('emptyVote', () => {
  it('starts with no choice made', () => {
    expect(emptyVote()).toEqual({ choice: null });
  });
});

describe('tally', () => {
  it('counts nothing when nobody has voted', () => {
    expect(tally([])).toEqual({
      counts: { yes: 0, no: 0, undecided: 0 },
      shares: { yes: 0, no: 0, undecided: 0 },
      total: 0,
    });
  });

  it('counts every vote by its choice', () => {
    const result = tally([{ choice: 'yes' }, { choice: 'yes' }, { choice: 'no' }, { choice: 'undecided' }]);

    expect(result.counts).toEqual({ yes: 2, no: 1, undecided: 1 });
    expect(result.total).toBe(4);
  });

  it('reports each option as a share of the total', () => {
    const result = tally([{ choice: 'yes' }, { choice: 'yes' }, { choice: 'no' }, { choice: 'undecided' }]);

    expect(result.shares.yes).toBe(0.5);
    expect(result.shares.no).toBe(0.25);
    expect(result.shares.undecided).toBe(0.25);
  });

  it('ignores a contribution that is missing or malformed', () => {
    // The state comes back from a database other browsers wrote to.
    const result = tally([{ choice: 'yes' }, null, { choice: undefined }, { choice: 'maybe' }]);

    expect(result).toEqual({
      counts: { yes: 1, no: 0, undecided: 0 },
      shares: { yes: 1, no: 0, undecided: 0 },
      total: 1,
    });
  });
});
