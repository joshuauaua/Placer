import { describe, it, expect } from 'vite-plus/test';
import { findTool } from '../../tools';
import { emptyVote } from '../../../lib/openVote';

describe("the Poll's setup", () => {
  it('asks the organiser for the Poll question, and keeps it within bounds', () => {
    const { setup } = findTool('open-vote');
    expect(setup.problems(setup.defaults())).toEqual(['Write the question you want people to vote on.']);
    expect(setup.problems({ question: '   ' })).toHaveLength(1);
    expect(setup.problems({ question: 'x'.repeat(201) })).toHaveLength(1);
    expect(setup.problems({ question: 'Should the square be car-free?' })).toEqual([]);
  });

  it('checks the answers the organiser writes for a Poll', () => {
    const { setup } = findTool('open-vote');
    const question = 'Should the square be car-free?';
    const problems = (answers) => setup.problems({ question, answers });

    expect(problems(['Yes', 'No', 'Undecided'])).toEqual([]);
    expect(problems(['Every day', 'Weekends'])).toEqual([]);
    expect(problems(['Yes'])).toEqual(['Give people at least 2 answers to choose from.']);
    expect(problems(['Yes', '  ', 'No'])).toEqual(['Fill in every answer, or remove the empty ones.']);
    expect(problems(['Yes', 'yes '])).toEqual(['Make each answer different from the others.']);
    expect(problems(Array.from({ length: 11 }, (_, i) => `Answer ${i}`))).toHaveLength(1);
    expect(problems(['Yes', 'x'.repeat(81)])).toHaveLength(1);
  });
});

describe("the Poll's room", () => {
  const { room } = findTool('open-vote');

  it('starts a participant with no choice made', () => {
    expect(room.empty()).toEqual(emptyVote());
  });

  it('counts every vote by its choice', () => {
    const combined = room.combine([{ choice: 'yes' }, { choice: 'yes' }, { choice: 'no' }]);

    expect(combined.counts).toEqual({ yes: 2, no: 1, undecided: 0 });
    expect(combined.total).toBe(3);
  });

  it('is an empty tally when nobody has voted', () => {
    expect(room.combine([])).toEqual({
      counts: { yes: 0, no: 0, undecided: 0 },
      shares: { yes: 0, no: 0, undecided: 0 },
      total: 0,
    });
  });

  it('ignores a contribution that is missing or malformed', () => {
    // The state comes back from a database that other browsers wrote to.
    const combined = room.combine([{ choice: 'yes' }, null, { choice: undefined }, { choice: 'maybe' }]);

    expect(combined.counts).toEqual({ yes: 1, no: 0, undecided: 0 });
    expect(combined.total).toBe(1);
  });

  it("counts votes against the answers the room was set up with", () => {
    const config = { question: 'When?', answers: ['Every day', 'Weekends'] };
    const combined = room.combine([{ choice: 'Weekends' }, { choice: 'Weekends' }, { choice: 'yes' }], config);

    expect(combined.counts).toEqual({ 'Every day': 0, Weekends: 2 });
    expect(combined.total).toBe(2);
  });
});
