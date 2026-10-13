import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { PopQuiz } from '../toolkit/PopQuiz';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('Pop Quiz', () => {
  const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
  const start = (nickname = 'Mara') => {
    click('Play this quiz');
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: nickname } });
    click('Start the quiz');
  };

  afterEach(() => vi.useRealTimers());

  it('opens on a sample quiz to edit, with room for twenty questions', () => {
    mount(PopQuiz, 'pop-quiz');

    expect(screen.getByLabelText('Question 1')).toHaveValue('Who wrote “The Death and Life of Great American Cities”?');
    expect(screen.getByText('3 of 20 questions')).toBeInTheDocument();
    expect(screen.getByLabelText('Kind of question 2')).toHaveValue('blank');
    expect(screen.getByLabelText('Time per question')).toHaveValue('20');
  });

  it('adds questions up to twenty, and removes them down to one', () => {
    mount(PopQuiz, 'pop-quiz');

    for (let i = 0; i < 17; i += 1) click('Add a question');
    expect(screen.getByText('20 of 20 questions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a question' })).not.toBeInTheDocument();

    for (let i = 20; i > 1; i -= 1) click(`Remove question ${i}`);
    expect(screen.getByRole('button', { name: 'Remove question 1' })).toBeDisabled();
  });

  it('will not play a quiz with something missing, and says what', () => {
    mount(PopQuiz, 'pop-quiz');

    click('Add a question');
    fireEvent.change(screen.getByLabelText('Kind of question 4'), { target: { value: 'blank' } });
    click('Play this quiz');

    expect(screen.getByRole('alert')).toHaveTextContent('Write question 4.');
    expect(screen.getByRole('alert')).toHaveTextContent('Write the answer to question 4.');
    expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();
  });

  it('asks for a nickname before the first question', () => {
    mount(PopQuiz, 'pop-quiz');

    click('Play this quiz');

    expect(screen.getByRole('button', { name: 'Start the quiz' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Mara' } });
    click('Start the quiz');
    expect(screen.getByRole('heading', { name: 'Question 1 of 3' })).toBeInTheDocument();
  });

  it('scores a right answer more the sooner it comes', () => {
    vi.useFakeTimers();
    mount(PopQuiz, 'pop-quiz');
    start();

    expect(screen.getByRole('timer')).toHaveTextContent('20');
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole('timer')).toHaveTextContent('10');
    click(/Jane Jacobs/);

    expect(screen.getByRole('status')).toHaveTextContent('Right! +750 points.');
    expect(screen.getByText('750 points so far')).toBeInTheDocument();
  });

  it('gives nothing for a wrong answer, and shows the right one', () => {
    mount(PopQuiz, 'pop-quiz');
    start();

    click(/Le Corbusier/);

    expect(screen.getByRole('status')).toHaveTextContent('Not this time. The answer was A, Jane Jacobs.');
    expect(screen.getByRole('button', { name: /Jane Jacobs/ })).toHaveTextContent('the right answer');
  });

  it('checks a filled-in blank without minding how it was typed', () => {
    mount(PopQuiz, 'pop-quiz');
    start();
    click('Skip this question');
    expect(screen.getByRole('status')).toHaveTextContent('Skipped. The answer was A, Jane Jacobs.');
    click('Next question');

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ' 15. ' } });
    click('Answer');

    expect(screen.getByRole('status')).toHaveTextContent(/Right! \+\d+ points\./);
  });

  it('closes a question when its time runs out', () => {
    vi.useFakeTimers();
    mount(PopQuiz, 'pop-quiz');
    start();

    act(() => { vi.advanceTimersByTime(21000); });

    expect(screen.getByRole('status')).toHaveTextContent('Time ran out. The answer was A, Jane Jacobs.');
    expect(screen.getByRole('button', { name: /Le Corbusier/ })).toBeDisabled();
  });

  it('adds the quiz up at the end, and can be played again', () => {
    mount(PopQuiz, 'pop-quiz');
    start();

    click(/Jane Jacobs/);
    click('Next question');
    click('Skip this question');
    click('Next question');
    click(/A painted cycle lane/);
    click('See your score');

    expect(screen.getByText('Mara, you got 1 of 3 right.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^\d+ points$/);

    click('Play again');
    expect(screen.getByRole('heading', { name: 'Question 1 of 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jane Jacobs/ })).toBeEnabled();
  });
});
