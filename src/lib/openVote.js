/* PLACER — Open Vote: ask anything, pick Yes, No or Undecided.
 *
 * The simplest room there is: three fixed options and a headcount, nothing to
 * calibrate. The question itself is typed in on screen but never published — only
 * the vote is — so what a room's tally reports is exactly the three-way split
 * people actually cast, whatever they were asked.
 */

export const DEFAULT_QUESTION = 'Yes or No?';

export const OPTIONS = [
  { key: 'yes', label: 'Yes', color: '#3E9D4E' },
  { key: 'no', label: 'No', color: '#D6452F' },
  { key: 'undecided', label: 'Undecided', color: '#8A8A8A' },
];

const OPTION_KEYS = new Set(OPTIONS.map((option) => option.key));

/** The state one participant starts from: no vote cast yet. */
export function emptyVote() {
  return { choice: null };
}

/**
 * Everybody's vote, folded into counts and shares. This is also what a solo vote
 * (outside a room) is shown through, so the numbers mean the same thing either way.
 *
 * A malformed or missing contribution — the state comes back from a database other
 * browsers wrote to — is skipped rather than thrown on.
 */
export function tally(votes) {
  const counts = { yes: 0, no: 0, undecided: 0 };
  for (const vote of votes ?? []) {
    const choice = vote?.choice;
    if (OPTION_KEYS.has(choice)) counts[choice] += 1;
  }

  const total = counts.yes + counts.no + counts.undecided;
  const shares = {
    yes: total === 0 ? 0 : counts.yes / total,
    no: total === 0 ? 0 : counts.no / total,
    undecided: total === 0 ? 0 : counts.undecided / total,
  };

  return { counts, shares, total };
}
