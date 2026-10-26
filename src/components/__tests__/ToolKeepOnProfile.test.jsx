import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BudgetBallot } from '../toolkit/BudgetBallot';
import { OpenVote } from '../toolkit/OpenVote';
import { PopQuiz } from '../toolkit/PopQuiz';
import { WordCloud } from '../toolkit/WordCloud';
import { SiteMapping } from '../toolkit/SiteMapping';
import { SavedInquiries } from '../SavedInquiries';
import { findTool } from '../../toolkit/tools';
import { sampleQuiz } from '../../lib/popQuiz';
import { SURVEY_QUESTIONS } from '../../lib/toolkit/siteMapping';
import { THEME } from '../../theme';

/*
 * Every tool used on its own can be kept on the signed-in account's profile, as an
 * inquiry (KeepOnProfile, services/inquiries.js). Desire Lines has its own tests for
 * this (ToolDesireLinesInquiries); these are the rest, and the Idea Visualizer's is
 * PostPage.test.jsx.
 */

const identity = vi.hoisted(() => ({ value: { status: 'signedIn', accountId: 'acc-1' } }));
vi.mock('../useIdentity', () => ({ useIdentity: () => identity.value }));
vi.mock('../../services/inquiries', () => ({ saveInquiry: vi.fn() }));
vi.mock('../../services/media', async (importOriginal) => ({
  ...(await importOriginal()),
  mediaUrl: (path) => (path ? `https://media.example/${path}` : null),
}));

const { saveInquiry } = await import('../../services/inquiries');

const mount = (Tool, id, props = {}) => render(<Tool t={THEME} tool={findTool(id)} {...props} />);
const keep = () => fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));
const saved = () => waitFor(() => expect(saveInquiry).toHaveBeenCalledTimes(1)).then(() => saveInquiry.mock.calls[0][0]);

beforeEach(() => {
  identity.value = { status: 'signedIn', accountId: 'acc-1' };
  vi.mocked(saveInquiry).mockReset();
  vi.mocked(saveInquiry).mockResolvedValue({ id: 'inq-1' });
});

describe('keeping a Poll', () => {
  it('waits for a question, then keeps it with its answers and the vote', async () => {
    mount(OpenVote, 'open-vote');
    expect(screen.getByRole('button', { name: 'Save to my profile' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'More benches?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    keep();

    expect(await saved()).toEqual({
      tool: 'open-vote', title: 'More benches?', note: '',
      config: { question: 'More benches?', answers: ['Yes', 'No', 'Undecided'], choice: 'Yes' },
    });
    expect(await screen.findByRole('link', { name: 'See your saved inquiries' })).toHaveAttribute('href', '/people/acc-1');
  });

  it('offers it again once something has changed since', async () => {
    mount(OpenVote, 'open-vote');
    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'More benches?' } });
    keep();
    expect(await screen.findByRole('button', { name: 'Saved to your profile' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(screen.getByRole('button', { name: 'Save to my profile' })).toBeEnabled();
  });

  it('is not offered in a room', () => {
    mount(OpenVote, 'open-vote', { room: { status: 'open', config: null, combined: null, participantCount: 0 } });

    expect(screen.queryByRole('button', { name: 'Save to my profile' })).not.toBeInTheDocument();
  });

  it('asks somebody signed out to sign in instead', () => {
    identity.value = { status: 'signedOut', accountId: null };
    mount(OpenVote, 'open-vote');

    expect(screen.queryByRole('button', { name: 'Save to my profile' })).not.toBeInTheDocument();
    expect(screen.getByText(/Sign in to keep this on your profile/)).toBeInTheDocument();
  });

  it('says so when it did not save', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(saveInquiry).mockRejectedValue(new Error('network down'));
    mount(OpenVote, 'open-vote');
    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'More benches?' } });
    keep();

    expect(await screen.findByRole('alert')).toHaveTextContent('It did not save');
    consoleError.mockRestore();
  });
});

describe('keeping a Word Cloud', () => {
  it('keeps the prompt and the words added', async () => {
    mount(WordCloud, 'word-cloud');
    fireEvent.change(screen.getByLabelText('The prompt'), { target: { value: 'One word for the square?' } });
    fireEvent.change(screen.getByLabelText('Your word'), { target: { value: 'busy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    keep();

    expect(await saved()).toMatchObject({
      tool: 'word-cloud', title: 'One word for the square?',
      config: { prompt: 'One word for the square?', words: ['busy'] },
    });
  });
});

describe('keeping a Pop Quiz', () => {
  it('keeps the quiz as written, named by its first question', async () => {
    mount(PopQuiz, 'pop-quiz');
    keep();

    const quiz = sampleQuiz();
    expect(await saved()).toEqual({ tool: 'pop-quiz', title: quiz.questions[0].text, note: '', config: quiz });
  });
});

describe('keeping a Co-Budget ballot', () => {
  it('waits for something to be funded, then keeps the budget and the ballot', async () => {
    mount(BudgetBallot, 'budget-ballot');
    expect(screen.getByRole('button', { name: 'Save to my profile' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'One more: Street trees' }));
    keep();

    const inquiry = await saved();
    expect(inquiry).toMatchObject({ tool: 'budget-ballot', title: 'Co-Budget' });
    expect(inquiry.config.budget).toBeGreaterThan(0);
    expect(Object.values(inquiry.config).filter((value) => value === 1)).toHaveLength(1);
    expect(inquiry.note).toMatch(/Street trees/);
  });
});

describe('keeping a Site-Specific Spatial Mapping survey', () => {
  it('keeps the site and the answers, never the contact details', async () => {
    mount(SiteMapping, 'site-spatial-mapping');
    fireEvent.click(screen.getByRole('button', { name: 'Lindenplatz' }));
    for (let i = 0; i < SURVEY_QUESTIONS.length; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getAllByRole('button', { name: /finish & export data/i })[0]);
    fireEvent.change(screen.getByPlaceholderText('you@example.org'), { target: { value: 'mara@example.com' } });
    keep();

    const inquiry = await saved();
    expect(inquiry).toMatchObject({ tool: 'site-spatial-mapping', title: 'Lindenplatz' });
    expect(inquiry.config.site).toMatchObject({ name: 'Lindenplatz', point: { lat: expect.any(Number), lng: expect.any(Number) } });
    expect(Object.values(inquiry.config.answers).every((value) => value === true)).toBe(true);
    expect(JSON.stringify(inquiry)).not.toContain('mara@example.com');
  });
});

describe('the kept inquiries, listed on the profile', () => {
  const list = (inquiries) => render(<SavedInquiries t={THEME} service={{
    readInquiries: vi.fn().mockResolvedValue(inquiries), deleteInquiry: vi.fn(),
  }} />);

  it('sums each one up the way its tool does', async () => {
    list([
      { id: 'a', tool: 'open-vote', title: 'More benches?', note: '', config: { answers: ['Yes', 'No'] } },
      { id: 'b', tool: 'pop-quiz', title: 'Who wrote it?', note: '', config: sampleQuiz() },
      { id: 'c', tool: 'word-cloud', title: 'One word', note: '', config: { words: ['busy'] } },
    ]);

    const shown = await screen.findByRole('list', { name: 'Saved inquiries' });
    expect(shown).toHaveTextContent('Poll');
    expect(shown).toHaveTextContent('2 answers');
    expect(shown).toHaveTextContent(`${sampleQuiz().questions.length} questions`);
    expect(shown).toHaveTextContent('1 word');
  });

  it("shows an Idea Visualizer scene's picture", async () => {
    list([{ id: 'd', tool: 'reimagine-a-space', title: 'Pocket park', note: 'Trees.',
      config: { canvasAssets: [{ type: 'tree' }], preview: 'previews/acc-1/pic.jpg' } }]);

    const shown = await screen.findByRole('list', { name: 'Saved inquiries' });
    expect(shown).toHaveTextContent('1 thing placed');
    expect(shown.querySelector('img')).toHaveAttribute('src', 'https://media.example/previews/acc-1/pic.jpg');
  });
});
