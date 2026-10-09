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

const setup = (toolId, overrides = {}) => {
  const props = {
    t: THEME, project: PROJECT, tool: findTool(toolId), onClose: vi.fn(), onConfigured: vi.fn(), ...overrides,
  };
  render(<ConfigureToolDialog {...props} />);
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

describe('ConfigureToolDialog, Reimagine a Space', () => {
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
  it('lists what is missing rather than opening a room that is not set up', async () => {
    setup('open-vote');

    save();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('opens the project\'s room with its setup, for as long as chosen', async () => {
    const { onConfigured } = setup('open-vote');

    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Car-free on Sundays?' } });
    fireEvent.change(screen.getByLabelText('Open for'), { target: { value: '90d' } });
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom).toHaveBeenCalledWith('open-vote', 'proj-1', '90d',
      expect.objectContaining({ question: 'Car-free on Sundays?' }));
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
