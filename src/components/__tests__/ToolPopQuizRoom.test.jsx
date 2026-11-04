import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { rememberHostedRoom } from '../../toolkit/rooms';
import { createRoom, readRoom, readContributions, saveContribution } from '../../test/roomServices';
import { hours, renderAt, useRoomServices } from '../../test/toolkitRoom';
import { configureTool, next, save } from '../../test/configureTool';

vi.mock('../../services/rooms', () => import('../../test/roomServices'));

useRoomServices();

describe('Pop Quiz in a room', () => {
  const QUIZ = {
    seconds: 20,
    questions: [
      { kind: 'choice', text: 'Which way is north?', choices: ['Up', 'Down', 'Left', 'Right'], correct: 0 },
      { kind: 'blank', text: 'The square is called ___.', answer: 'Möllan' },
    ],
  };
  const quizRoom = () => ({ tool: 'pop-quiz', status: 'open', expiresAt: hours(2), config: QUIZ });
  const from = (state, displayName = null) => ({ displayName, state, updatedAt: 'a' });
  const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
  const sent = (state) => waitFor(
    () => expect(saveContribution).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-1', state })),
    { timeout: 2000 }
  );
  const join = async (nickname = 'Mara') => {
    fireEvent.change(await screen.findByLabelText('Nickname'), { target: { value: nickname } });
    click('Join the quiz');
  };

  describe('for somebody who joined', () => {
    it('asks for a nickname first, then waits in the lobby', async () => {
      readRoom.mockResolvedValue(quizRoom());

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      await join('  Mara  ');

      expect(screen.getByRole('status')).toHaveTextContent('Welcome, Mara.');
      expect(screen.getByText(/starts when the facilitator is ready/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start the quiz' })).not.toBeInTheDocument();
      await sent({ nickname: 'Mara', answers: {} });
    });

    it('answers the question the facilitator has put up, timed from when it went up', async () => {
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([from({ host: { q: 0, at: Date.now() - 5000, shown: false } })]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      await join();
      expect(screen.getByRole('heading', { name: 'Question 1 of 2' })).toBeInTheDocument();
      click(/Up/);

      expect(screen.getByRole('status')).toHaveTextContent('Answer locked in.');
      expect(screen.getByRole('button', { name: /Down/ })).toBeDisabled();
      await sent({ nickname: 'Mara', answers: { 0: { value: 0, ms: expect.any(Number) } } });
      const { ms } = saveContribution.mock.calls.at(-1)[0].state.answers[0];
      expect(ms).toBeGreaterThanOrEqual(5000);
      expect(ms).toBeLessThan(8000);
    });

    it('can skip a question', async () => {
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([from({ host: { q: 0, at: Date.now(), shown: false } })]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      await join();
      click('Skip this question');

      expect(screen.getByRole('status')).toHaveTextContent('Skipped.');
      await sent({ nickname: 'Mara', answers: { 0: { skipped: true } } });
    });

    it('sees the answer and the scoreboard once the facilitator shows them', async () => {
      localStorage.setItem('placemaking_room_answers', JSON.stringify({
        'room-1': { nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } },
      }));
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 0, at: Date.now() - 12000, shown: true } }),
        from({ nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } }),
        from({ nickname: 'Sam', answers: { 0: { value: 0, ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');

      expect((await screen.findByText('Right!')).closest('p')).toHaveTextContent('Right! +750 points.');
      const board = within(screen.getByRole('list', { name: 'Scoreboard' })).getAllByRole('listitem');
      expect(board.map((row) => row.textContent)).toEqual(['1Sam1 right950', '2Mara (you)1 right750']);
      expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();
    });

    it('is told their score and place when the quiz is over', async () => {
      localStorage.setItem('placemaking_room_answers', JSON.stringify({
        'room-1': { nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } },
      }));
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 2, at: Date.now(), shown: false } }),
        from({ nickname: 'Mara', answers: { 0: { value: 0, ms: 10000 } } }),
        from({ nickname: 'Sam', answers: { 0: { value: 0, ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');

      expect(await screen.findByText('750 points')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 right, and number 2 of 2.')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Final scores' })).toBeInTheDocument();
    });
  });

  describe('for the facilitator', () => {
    const host = () => rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });

    it('shows who has joined, and starts the quiz for the room', async () => {
      host();
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([from({ nickname: 'Mara', answers: {} }), from({ nickname: 'Sam', answers: {} })]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');

      const players = within(await screen.findByRole('list', { name: 'Players' }));
      expect(players.getAllByRole('listitem')).toHaveLength(2);
      expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();
      click('Start the quiz');

      expect(screen.getByRole('heading', { name: 'Question 1 of 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Up/ })).toBeDisabled();
      expect(screen.getByText('0 of 2 answered')).toBeInTheDocument();
      await sent({ host: { q: 0, at: expect.any(Number), shown: false } });
    });

    it('shows the answer, then moves the room on to the next question', async () => {
      host();
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 0, at: Date.now() - 3000, shown: false } }),
        from({ nickname: 'Mara', answers: { 0: { value: 0, ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      expect(await screen.findByText('1 of 1 answered')).toBeInTheDocument();
      click('Show the answer');

      expect(screen.getByRole('button', { name: /Up/ })).toHaveTextContent('the right answer');
      expect(within(screen.getByRole('list', { name: 'Scoreboard' })).getByText('950')).toBeInTheDocument();
      await sent({ host: { q: 0, at: expect.any(Number), shown: true } });

      click('Next question');
      expect(screen.getByRole('heading', { name: 'Question 2 of 2' })).toBeInTheDocument();
      await sent({ host: { q: 1, at: expect.any(Number), shown: false } });
    });

    it('ends on the final scores after the last question', async () => {
      host();
      readRoom.mockResolvedValue(quizRoom());
      readContributions.mockResolvedValue([
        from({ host: { q: 1, at: Date.now() - 3000, shown: true } }),
        from({ nickname: 'Mara', answers: { 1: { value: 'mollan', ms: 2000 } } }),
      ]);

      renderAt('/toolkit/pop-quiz', 'room=room-1');
      expect(await screen.findByText('Möllan')).toBeInTheDocument();
      click('Show the final scores');

      const board = within(screen.getByRole('list', { name: 'Final scores' })).getAllByRole('listitem');
      expect(board.map((row) => row.textContent)).toEqual(['1Mara1 right950']);
      await sent({ host: { q: 2, at: expect.any(Number), shown: false } });
    });
  });
});

describe('setting it up for a project', () => {
  beforeEach(() => {
    createRoom.mockResolvedValue({ id: 'room-1', pin: '123456', facilitatorToken: 'facilitator-1' });
  });

  it('asks for the Pop Quiz questions, then the time for each, then how long it stays open', async () => {
    const { onConfigured } = configureTool('pop-quiz');

    expect(screen.getByRole('heading', { name: 'Questions' })).toBeInTheDocument();
    next();
    expect(await screen.findByRole('alert')).toHaveTextContent('Write question 1.');

    fireEvent.change(screen.getByLabelText('Question 1'), { target: { value: 'Which way is north?' } });
    ['Up', 'Down', 'Left', 'Right'].forEach((choice, index) => {
      fireEvent.change(screen.getByLabelText(`Choice ${'ABCD'[index]} for question 1`), { target: { value: choice } });
    });
    fireEvent.click(screen.getByLabelText('B is the right answer to question 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Add a question' }));
    fireEvent.change(screen.getByLabelText('Kind of question 2'), { target: { value: 'blank' } });
    fireEvent.change(screen.getByLabelText('Question 2'), { target: { value: 'The square is called ___.' } });
    fireEvent.change(screen.getByLabelText('Answer to question 2'), { target: { value: 'Möllan' } });
    next();

    expect(screen.getByRole('heading', { name: 'Time' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Time per question'), { target: { value: '30' } });
    next();
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom).toHaveBeenCalledWith('pop-quiz', 'proj-1', expect.any(String), {
      seconds: 30,
      questions: [
        { kind: 'choice', text: 'Which way is north?', choices: ['Up', 'Down', 'Left', 'Right'], correct: 1 },
        { kind: 'blank', text: 'The square is called ___.', answer: 'Möllan' },
      ],
    }, null);
  });
});
