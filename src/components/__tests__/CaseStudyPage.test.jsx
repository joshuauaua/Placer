import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaseStudyPage } from '../CaseStudyPage';
import { saveSurveyResponse } from '../../services/api';
import { pictureToDataUrl } from '../../lib/pictureEncode';
import { UNLOCK_KEY } from '../../lib/caseStudy';

// The real code is not written out here, as the repository is public: the form opens
// on this stand-in instead, with everything else in lib/caseStudy.js as it is.
vi.mock('../../lib/caseStudy', async (importOriginal) => ({
  ...(await importOriginal()),
  codeMatches: vi.fn((code) => Promise.resolve(code.trim().toUpperCase() === 'TEST-CODE')),
}));

vi.mock('../../services/api', () => ({ saveSurveyResponse: vi.fn() }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
// Canvas work, which jsdom cannot do: a picture comes back as its own name.
vi.mock('../../lib/pictureEncode', () => ({
  pictureToDataUrl: vi.fn((file) => Promise.resolve(`data:image/webp;base64,${file.name}`)),
}));

const photo = (name) => new File(['pixels'], name, { type: 'image/jpeg' });

async function unlock() {
  fireEvent.change(screen.getByLabelText('Code'), { target: { value: ' test-code ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open the form' }));
  return screen.findByRole('button', { name: 'Send the case study' });
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });

async function fillIn() {
  type('Title', 'Folkets Park, redesigned');
  type('Short description', 'Neighbours planned the new playground.');
  type('Where', 'Malmö, Sweden');
  type('Started', '2026-03');
  fireEvent.change(screen.getByLabelText(/^Header picture/, { selector: 'input' }),
    { target: { files: [photo('park.jpg')] } });
  await screen.findByAltText('Header picture: park.jpg');
  type('What need did it address\\?', 'Nowhere to play in the shade.');
  type('What did you do\\?', 'Three walks and a workshop.');
  type('Who was it for\\?', 'Families nearby.');
  fireEvent.click(screen.getByRole('radio', { name: 'No' }));
  type('Organisation that led it', 'STPLN');
  type('Your name', 'Ada');
  type('Your email', 'ada@example.org');
  fireEvent.click(screen.getByRole('checkbox', { name: /PLACER may publish them/ }));
}

describe('Add a case study', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(saveSurveyResponse).mockReset();
    vi.mocked(saveSurveyResponse).mockResolvedValue({});
  });

  it('asks for the code before showing the form', () => {
    render(<CaseStudyPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Add a case study' })).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send the case study' })).not.toBeInTheDocument();
  });

  it('says so when the code is wrong, and stays shut', async () => {
    render(<CaseStudyPage />);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'guess' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open the form' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right.');
    expect(screen.queryByRole('button', { name: 'Send the case study' })).not.toBeInTheDocument();
  });

  it('opens on the right code, and stays open for the visit', async () => {
    const { unmount } = render(<CaseStudyPage />);
    await unlock();
    expect(sessionStorage.getItem(UNLOCK_KEY)).toBe('yes');

    unmount();
    render(<CaseStudyPage />);
    expect(screen.getByRole('button', { name: 'Send the case study' })).toBeInTheDocument();
  });

  it('points out what is missing rather than sending', async () => {
    render(<CaseStudyPage />);
    await unlock();

    fireEvent.click(screen.getByRole('button', { name: 'Send the case study' }));

    expect(screen.getByText('Give the case study a title.')).toBeInTheDocument();
    expect(screen.getByText('Add a header picture.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/things need fixing/);
    expect(saveSurveyResponse).not.toHaveBeenCalled();
  });

  it('asks who funded it, and how much, once it was funded', async () => {
    render(<CaseStudyPage />);
    await unlock();
    expect(screen.queryByLabelText(/^By whom/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));

    expect(screen.getByLabelText(/^By whom/)).toBeRequired();
    expect(screen.getByLabelText(/^How much/)).not.toBeRequired();
  });

  it('adds team members and organisations as rows, and takes them away again', async () => {
    render(<CaseStudyPage />);
    await unlock();

    fireEvent.click(screen.getByRole('button', { name: 'Add a team member' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a team member' }));
    expect(screen.getAllByRole('group', { name: /^team member/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Add an organisation' }));
    expect(screen.getAllByRole('group', { name: /^organisation/ })).toHaveLength(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove 1' })[0]);
    expect(screen.getAllByRole('group', { name: /^organisation|^team member/ })).toHaveLength(2);
  });

  it('says accounts are needed to link organisations and people, and that they will be invited', async () => {
    render(<CaseStudyPage />);
    await unlock();
    expect(screen.getByText(/they need a PLACER account/)).toBeInTheDocument();
  });

  it('sends a complete case study with its pictures, then thanks them', async () => {
    render(<CaseStudyPage />);
    await unlock();
    await fillIn();
    fireEvent.change(screen.getByLabelText(/^Other pictures/, { selector: 'input' }),
      { target: { files: [photo('walk.jpg'), photo('workshop.jpg')] } });
    await screen.findByAltText('workshop.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Send the case study' }));

    await waitFor(() => expect(saveSurveyResponse).toHaveBeenCalledTimes(1));
    expect(pictureToDataUrl).toHaveBeenCalledWith(expect.objectContaining({ name: 'park.jpg' }), { maxSide: 1600 });
    expect(saveSurveyResponse.mock.calls[0][0]).toMatchObject({
      source: 'case_study_submission',
      email: 'ada@example.org',
      title: 'Folkets Park, redesigned',
      place: 'Malmö, Sweden',
      funding: { funded: 'no' },
      organisation: { name: 'STPLN', wantsAccount: false },
      hero: 'data:image/webp;base64,park.jpg',
      images: ['data:image/webp;base64,walk.jpg', 'data:image/webp;base64,workshop.jpg'],
      consent: true,
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Thank you.' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ada@example.org');
  });

  it('says so, and keeps what was typed, when it does not go through', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(saveSurveyResponse).mockRejectedValueOnce(new Error('offline'));
    render(<CaseStudyPage />);
    await unlock();
    await fillIn();

    fireEvent.click(screen.getByRole('button', { name: 'Send the case study' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('It did not go through.');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Folkets Park, redesigned');
  });
});
