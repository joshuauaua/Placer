import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { rememberHostedRoom } from '../../toolkit/rooms';
import { createRoom, readRoom, readContributions, saveContribution } from '../../test/roomServices';
import { hours, renderAt, useRoomServices } from '../../test/toolkitRoom';
import { configureTool, next, save } from '../../test/configureTool';

vi.mock('../../services/rooms', () => import('../../test/roomServices'));

useRoomServices();

describe('Word Cloud in a room', () => {
  const wordCloudRoom = () => ({ tool: 'word-cloud', status: 'open', expiresAt: hours(2) });

  it("publishes a participant's words once they add one", async () => {
    readRoom.mockResolvedValue(wordCloudRoom());

    renderAt('/toolkit/word-cloud', 'room=room-1');
    await screen.findByText(/you are in a room/i);

    fireEvent.change(screen.getByLabelText('Your word'), { target: { value: 'Green' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(
      () => {
        expect(saveContribution).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', state: { words: ['green'] } })
        );
      },
      { timeout: 2000 }
    );
  });

  it("gathers everybody's words into the room's cloud", async () => {
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    readRoom.mockResolvedValue(wordCloudRoom());
    readContributions.mockResolvedValue([
      { displayName: 'Mara', state: { words: ['green', 'quiet'] }, updatedAt: 'a' },
      { displayName: 'Sam', state: { words: ['green'] }, updatedAt: 'b' },
    ]);

    renderAt('/toolkit/word-cloud', 'room=room-1');

    expect(await screen.findByText("The room's cloud")).toBeInTheDocument();
    expect(screen.getByText('2 people')).toBeInTheDocument();
    const cloud = within(screen.getByRole('list', { name: 'Word cloud' }));
    expect(cloud.getByText('green').closest('li')).toHaveAttribute('title', '2 people');
    expect(cloud.getByText('quiet').closest('li')).toHaveAttribute('title', '1 person');
    const answers = within(screen.getByRole('list', { name: /answers and how many times/i }));
    expect(answers.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['green2', 'quiet1']);
  });

  it('shows the prompt the room was set up with, and takes only as many words as it allows', async () => {
    readRoom.mockResolvedValue({ ...wordCloudRoom(), config: { prompt: 'One word for the square?', limit: 1 } });

    renderAt('/toolkit/word-cloud', 'room=room-1');

    expect(await screen.findByText('One word for the square?')).toBeInTheDocument();
    expect(screen.queryByLabelText('The prompt')).not.toBeInTheDocument();
    expect(screen.getByText('One word each.')).toBeInTheDocument();
  });

  describe('set up with a timer', () => {
    const timedRoom = () => ({ ...wordCloudRoom(), config: { prompt: 'One word for the square?', limit: 3, timer: 60 } });
    const host = () => rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    const carrying = (timer, words = []) => [{ displayName: 'Mara', state: { words, timer }, updatedAt: 'a' }];
    const sent = (state) => waitFor(
      () => expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-1', state })),
      { timeout: 2000 }
    );

    it('lets the facilitator start it, and tells the room', async () => {
      host();
      readRoom.mockResolvedValue(timedRoom());

      renderAt('/toolkit/word-cloud', 'room=room-1');
      fireEvent.click(await screen.findByRole('button', { name: 'Start the 60 second timer' }));

      expect(screen.getByRole('timer')).toHaveTextContent(/^(1:00|0:59)$/);
      await sent({ words: [], timer: { endsAt: expect.any(Number) } });
    });

    it('lets the facilitator pause it and carry on, and tells the room each time', async () => {
      host();
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() + 40000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');
      fireEvent.click(await screen.findByRole('button', { name: 'Pause' }));

      expect(screen.getByRole('timer')).toHaveTextContent(/^0:(40|39) · paused$/);
      await sent({ words: [], timer: { pausedLeft: expect.any(Number) } });

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByRole('timer')).toHaveTextContent(/^0:(40|39)$/);
      await sent({ words: [], timer: { endsAt: expect.any(Number) } });
    });

    it('lets the facilitator stop it, which locks the cloud for the room', async () => {
      host();
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() + 40000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');
      fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));

      expect(screen.getByRole('timer')).toHaveTextContent('Finished');
      expect(screen.getByLabelText('Your word')).toBeDisabled();
      expect(screen.queryByRole('button', { name: /start the/i })).not.toBeInTheDocument();
      await sent({ words: [], timer: { endsAt: expect.any(Number) } });
    });

    it('offers none of it to somebody who only joined', async () => {
      readRoom.mockResolvedValue(timedRoom());

      renderAt('/toolkit/word-cloud', 'room=room-1');
      await screen.findByText(/you are in a room/i);

      expect(screen.queryByRole('button', { name: /start the/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Your word')).toBeEnabled();
    });

    it('shows everybody the countdown once it has been started, without the buttons', async () => {
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() + 40000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');

      expect(await screen.findByRole('timer')).toHaveTextContent(/^0:(40|39)$/);
      expect(screen.getByLabelText('Your word')).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    });

    it('shows everybody that it is paused', async () => {
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ pausedLeft: 25000 }));

      renderAt('/toolkit/word-cloud', 'room=room-1');

      expect(await screen.findByRole('timer')).toHaveTextContent('0:25 · paused');
      expect(screen.getByLabelText('Your word')).toBeEnabled();
    });

    it('stops taking words once it is over', async () => {
      readRoom.mockResolvedValue(timedRoom());
      readContributions.mockResolvedValue(carrying({ endsAt: Date.now() - 30000 }, ['green']));

      renderAt('/toolkit/word-cloud', 'room=room-1');

      expect(await screen.findByRole('timer')).toHaveTextContent('Finished');
      expect(screen.getByLabelText('Your word')).toBeDisabled();
      expect(within(screen.getByRole('list', { name: 'Word cloud' })).getByText('green')).toBeInTheDocument();
    });
  });
});

describe('setting it up for a project', () => {
  beforeEach(() => {
    createRoom.mockResolvedValue({ id: 'room-1', pin: '123456', facilitatorToken: 'facilitator-1' });
  });

  it('asks for the Word Cloud prompt, then the words per person, then how long it stays open', async () => {
    const { onConfigured } = configureTool('word-cloud');

    expect(screen.getByRole('heading', { name: 'Prompt' })).toBeInTheDocument();
    next();
    expect(await screen.findByRole('alert')).toHaveTextContent('Write what you want people to answer.');
    fireEvent.change(screen.getByLabelText('The prompt'), { target: { value: 'One word for the square?' } });
    next();

    expect(screen.getByRole('heading', { name: 'Words' })).toBeInTheDocument();
    expect(screen.getByText('One word for the square?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Words per person'), { target: { value: '1' } });
    expect(screen.getByLabelText('Timer')).toHaveValue('');
    expect(within(screen.getByLabelText('Timer')).getAllByRole('option')).toHaveLength(21);
    fireEvent.change(screen.getByLabelText('Timer'), { target: { value: '90' } });
    next();

    expect(screen.getByRole('heading', { name: 'Open for' })).toBeInTheDocument();
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom).toHaveBeenCalledWith('word-cloud', 'proj-1', expect.any(String),
      { prompt: 'One word for the square?', limit: 1, timer: 90 }, null);
  });
});
