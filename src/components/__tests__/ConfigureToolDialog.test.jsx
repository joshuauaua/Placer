import { describe, it, expect, vi, afterEach, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigureToolDialog } from '../ConfigureToolDialog';
import {
  markProjectToolConfigured, readProjectToolConfig, removeProjectImageFile, saveProjectToolConfig, uploadSceneImage,
} from '../../services/projects';
import { createRoom } from '../../services/rooms';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

vi.mock('../../services/projects', () => ({
  readProjectToolConfig: vi.fn(() => Promise.resolve(null)),
  saveProjectToolConfig: vi.fn(() => Promise.resolve()),
  markProjectToolConfigured: vi.fn(() => Promise.resolve()),
  uploadSceneImage: vi.fn(() => Promise.resolve('scenes/proj-1/scene-1.webp')),
  removeProjectImageFile: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rooms', () => ({
  createRoom: vi.fn(() => Promise.resolve({ id: 'room-1', pin: '123456', facilitatorToken: 'facilitator-1' })),
}));

// Stubbed to the field plus a stand-in for choosing a suggestion, as in ProjectSetupPage's tests.
const PICKED = { address: 'Folkets Park, Amiralsgatan 35, Malmö', point: { lat: 55.59, lng: 13.01 } };
vi.mock('../AddressInput', () => ({
  AddressInput: ({ id, value, onChange, onPick }) => (
    <>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => onPick(PICKED)}>Pick the suggestion</button>
    </>
  ),
}));

const PROJECT = {
  id: 'proj-1', name: 'Riverside Greenway', address: 'Folkets Park, Malmö', locationPoint: { lat: 55.59, lng: 13.01 },
};
const PHOTO = new File(['photo'], 'park.jpg', { type: 'image/jpeg' });

// Rendered past the introduction, onto the tool's form, unless `intro` is asked for.
const setup = (toolId, overrides = {}, { intro = false } = {}) => {
  const props = {
    t: THEME, project: PROJECT, tool: findTool(toolId), onClose: vi.fn(), onConfigured: vi.fn(), ...overrides,
  };
  render(<ConfigureToolDialog {...props} />);
  if (!intro) fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  return props;
};

const save = (name = /Save and go live/) => fireEvent.click(screen.getByRole('button', { name }));
const addPhoto = () => fireEvent.change(screen.getByLabelText(/Add a base image|Choose another/),
  { target: { files: [PHOTO] } });

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:scene');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ConfigureToolDialog, its introduction', () => {
  it('opens on what the tool is and what configuring it involves, before any form', () => {
    setup('open-vote', {}, { intro: true });

    expect(screen.getByRole('dialog', { name: 'Configure Poll' })).toBeInTheDocument();
    expect(screen.getByText(findTool('open-vote').blurb)).toBeInTheDocument();
    expect(screen.getByText(/choose how long it stays open/)).toBeInTheDocument();
    expect(screen.queryByLabelText('The question')).not.toBeInTheDocument();
  });

  it('shows the form on Get started', () => {
    setup('open-vote', {}, { intro: true });

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

    expect(screen.getByLabelText('The question')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('closes from the introduction on Cancel', () => {
    const props = setup('desire-lines', {}, { intro: true });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClose).toHaveBeenCalled();
  });
});

describe('ConfigureToolDialog, Idea Visualizer', () => {
  it('starts a new scene at the project\'s own place, and needs a base image to go live', async () => {
    setup('reimagine-a-space');

    expect(await screen.findByLabelText('Location *')).toHaveValue('Folkets Park, Malmö');
    expect(screen.getByRole('button', { name: /Save and go live/ })).toBeDisabled();
    addPhoto();
    await waitFor(() => expect(screen.getByRole('button', { name: /Save and go live/ })).toBeEnabled());
  });

  it('uploads the base image and saves the scene on the tool', async () => {
    const { onConfigured } = setup('reimagine-a-space');
    await screen.findByLabelText('Location *');
    addPhoto();
    await waitFor(() => expect(screen.getByRole('button', { name: /Save and go live/ })).toBeEnabled());
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(uploadSceneImage).toHaveBeenCalledWith('proj-1', PHOTO);
    expect(saveProjectToolConfig).toHaveBeenCalledWith('proj-1', 'reimagine-a-space', {
      address: 'Folkets Park, Malmö', point: { lat: 55.59, lng: 13.01 }, imagePath: 'scenes/proj-1/scene-1.webp',
    });
  });

  describe('already configured', () => {
    const SAVED = {
      address: 'Folkets Park, Malmö', point: { lat: 55.59, lng: 13.01 },
      imagePath: 'scenes/proj-1/scene-0.webp', image: 'https://media.test/scenes/proj-1/scene-0.webp',
    };

    beforeEach(() => {
      readProjectToolConfig.mockResolvedValueOnce(SAVED);
    });

    it('starts filled in, and keeps its image when only the location changes', async () => {
      const { onConfigured } = setup('reimagine-a-space');

      expect(await screen.findByRole('img', { name: 'The base image' })).toHaveAttribute('src', SAVED.image);
      fireEvent.click(screen.getByRole('button', { name: 'Pick the suggestion' }));
      save();

      await waitFor(() => expect(onConfigured).toHaveBeenCalled());
      expect(saveProjectToolConfig).toHaveBeenCalledWith('proj-1', 'reimagine-a-space', {
        address: PICKED.address, point: PICKED.point, imagePath: SAVED.imagePath,
      });
      expect(uploadSceneImage).not.toHaveBeenCalled();
      expect(removeProjectImageFile).not.toHaveBeenCalled();
    });

    it('deletes the base image it replaces', async () => {
      const { onConfigured } = setup('reimagine-a-space');
      await screen.findByRole('img', { name: 'The base image' });

      addPhoto();
      await waitFor(() => expect(screen.getByRole('img', { name: 'The base image' })).toHaveAttribute('src', 'blob:scene'));
      save();

      await waitFor(() => expect(onConfigured).toHaveBeenCalled());
      expect(removeProjectImageFile).toHaveBeenCalledWith(SAVED.imagePath);
    });

    it('will not save with the base image removed', async () => {
      setup('reimagine-a-space');
      await screen.findByRole('img', { name: 'The base image' });

      fireEvent.click(screen.getByRole('button', { name: /Remove/ }));

      await waitFor(() => expect(screen.getByRole('button', { name: /Save and go live/ })).toBeDisabled());
    });
  });
});

describe('ConfigureToolDialog, a tool that runs in a room', () => {
  const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

  it('will not move past a stage with something missing, and says what', async () => {
    setup('open-vote');

    next();

    expect(await screen.findByRole('alert')).toHaveTextContent('Write the question you want people to vote on.');
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('asks for the question, then the answers, then how long it stays open', async () => {
    const { onConfigured } = setup('open-vote');

    expect(screen.getByRole('heading', { name: 'Question' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Car-free on Sundays?' } });
    next();

    expect(screen.getByRole('heading', { name: 'Answers' })).toBeInTheDocument();
    expect(screen.getByText('Car-free on Sundays?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Answer 3'), { target: { value: 'Only in summer' } });
    next();

    expect(screen.getByRole('heading', { name: 'Open for' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Open for'), { target: { value: '90d' } });
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom).toHaveBeenCalledWith('open-vote', 'proj-1', '90d',
      { question: 'Car-free on Sundays?', answers: ['Yes', 'No', 'Only in summer'] }, null);
  });

  describe('starting on a date', () => {
    const DATED = { ...PROJECT, startDate: '2026-11-01', endDate: '2026-12-31' };
    const toLastStep = () => {
      fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Car-free on Sundays?' } });
      next();
      next();
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 10, 12));
    });
    afterEach(() => vi.useRealTimers());

    it('schedules it for a day within the project\'s dates', async () => {
      const { onConfigured } = setup('open-vote', { project: DATED });
      toLastStep();

      fireEvent.click(screen.getByLabelText('On a date'));
      const day = screen.getByLabelText('Start date');
      expect(day).toHaveAttribute('min', '2026-11-01');
      expect(day).toHaveAttribute('max', '2026-12-31');
      fireEvent.change(day, { target: { value: '2026-11-15' } });
      save();

      await waitFor(() => expect(onConfigured).toHaveBeenCalled());
      expect(createRoom).toHaveBeenCalledWith('open-vote', 'proj-1', '30d', expect.any(Object), '2026-11-15');
    });

    it('will not schedule it outside the project\'s dates', async () => {
      setup('open-vote', { project: DATED });
      toLastStep();

      fireEvent.click(screen.getByLabelText('On a date'));
      fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-01-05' } });
      save();

      expect(await screen.findByRole('alert')).toHaveTextContent('within the project\u2019s dates');
      expect(createRoom).not.toHaveBeenCalled();
    });

    it('only starts now for a project without dates', () => {
      setup('open-vote');
      toLastStep();

      expect(screen.getByLabelText('On a date')).toBeDisabled();
      expect(screen.getByText(/Give the project start and end dates/)).toBeInTheDocument();
    });
  });

  it('adds and removes answers without leaving the stage', () => {
    setup('open-vote');
    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Car-free on Sundays?' } });
    next();

    fireEvent.click(screen.getByRole('button', { name: 'Add an answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove answer 1' }));

    expect(screen.getByRole('heading', { name: 'Answers' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Answer \d$/)).toHaveLength(3);
  });

  it('goes Back without losing what was written', () => {
    setup('open-vote');

    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Car-free on Sundays?' } });
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('The question')).toHaveValue('Car-free on Sundays?');
  });

  it('asks a Co-Budget for its budget, then its posts, then how long it stays open', async () => {
    const { onConfigured } = setup('budget-ballot');

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Total budget, in euros'), { target: { value: '40000' } });
    next();

    expect(screen.getByRole('heading', { name: 'Posts' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Post 1 cost per item, in euros'), { target: { value: '50000' } });
    next();
    expect(screen.getByRole('alert')).toHaveTextContent('costs more per item than the whole budget');

    fireEvent.change(screen.getByLabelText('Post 1 cost per item, in euros'), { target: { value: '2000' } });
    next();
    expect(screen.getByRole('heading', { name: 'Open for' })).toBeInTheDocument();
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom).toHaveBeenCalledWith('budget-ballot', 'proj-1', '30d',
      expect.objectContaining({ budget: 40000 }), null);
    expect(createRoom.mock.calls[0][3].posts[0]).toEqual(
      { key: 'trees', label: 'Street trees', icon: 'tree', unitCost: 2000 });
  });
});

describe('ConfigureToolDialog, a tool with nothing to set up', () => {
  it('puts it live', async () => {
    const { onConfigured } = setup('desire-lines');

    save('Go live');

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(markProjectToolConfigured).toHaveBeenCalledWith('proj-1', 'desire-lines');
  });

  it('says why when it cannot, and stays open', async () => {
    markProjectToolConfigured.mockRejectedValueOnce(new Error('Could not put that tool live: denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onConfigured } = setup('desire-lines');

    save('Go live');

    expect(await screen.findByRole('alert')).toHaveTextContent('denied');
    expect(onConfigured).not.toHaveBeenCalled();
  });

  it('closes on Cancel', () => {
    const { onClose } = setup('desire-lines');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
