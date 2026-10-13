import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { WordCloud } from '../toolkit/WordCloud';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('Word Cloud', () => {
  const add = (word) => {
    fireEvent.change(screen.getByLabelText('Your word'), { target: { value: word } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  };

  it('shows the placeholder prompt and an empty cloud', () => {
    mount(WordCloud, 'word-cloud');

    expect(screen.getByPlaceholderText('One word for this place?')).toBeInTheDocument();
    expect(screen.getByText(/add a word to see it here/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Word cloud' })).not.toBeInTheDocument();
  });

  it('adds a word to the cloud, cleaned, and clears the field', () => {
    mount(WordCloud, 'word-cloud');

    add('  Green! ');

    const cloud = within(screen.getByRole('list', { name: 'Word cloud' }));
    expect(cloud.getByText('green')).toBeInTheDocument();
    expect(screen.getByLabelText('Your word')).toHaveValue('');
    expect(screen.getByText('1 of 5 words.')).toBeInTheDocument();
  });

  it('does not add the same word twice', () => {
    mount(WordCloud, 'word-cloud');

    add('green');
    add('GREEN');

    expect(within(screen.getByRole('list', { name: 'Your words' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('stops taking words at the limit, until one is removed', () => {
    mount(WordCloud, 'word-cloud');

    for (const word of ['green', 'quiet', 'busy', 'windy', 'loud']) add(word);
    expect(screen.getByLabelText('Your word')).toBeDisabled();
    expect(screen.getByLabelText('Your word')).toHaveAttribute('maxLength', '20');

    fireEvent.click(screen.getByRole('button', { name: 'Remove quiet' }));

    expect(screen.getByLabelText('Your word')).toBeEnabled();
    expect(within(screen.getByRole('list', { name: 'Word cloud' })).queryByText('quiet')).not.toBeInTheDocument();
  });

  it('lets someone type their own prompt, purely for display', () => {
    mount(WordCloud, 'word-cloud');

    fireEvent.change(screen.getByLabelText('The prompt'), { target: { value: 'What is missing here?' } });

    expect(screen.getByLabelText('The prompt')).toHaveValue('What is missing here?');
  });

  it('lists each answer with how many times it was given, under the cloud', () => {
    mount(WordCloud, 'word-cloud');

    add('green');
    add('quiet');

    const answers = within(screen.getByRole('list', { name: /answers and how many times/i }));
    expect(answers.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['green1', 'quiet1']);
  });

  it('shows the prompt as it was written, in the corner of the cloud card', () => {
    mount(WordCloud, 'word-cloud');

    fireEvent.change(screen.getByLabelText('The prompt'), { target: { value: 'What is missing here?' } });

    const card = within(screen.getByRole('heading', { name: 'Your cloud' }).closest('section'));
    expect(card.getByText('What is missing here?')).toBeInTheDocument();
  });

  describe('with a timer', () => {
    afterEach(() => vi.useRealTimers());

    it('has none to begin with, and offers 10 to 200 seconds in tens', () => {
      mount(WordCloud, 'word-cloud');

      expect(screen.getByLabelText('Timer')).toHaveValue('');
      expect(within(screen.getByLabelText('Timer')).getAllByRole('option').map((option) => option.value))
        .toEqual(['', ...Array.from({ length: 20 }, (_, index) => String((index + 1) * 10))]);
      expect(screen.queryByRole('button', { name: /start the/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('pauses and carries on from where it was', () => {
      vi.useFakeTimers();
      mount(WordCloud, 'word-cloud');

      fireEvent.change(screen.getByLabelText('Timer'), { target: { value: '20' } });
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Start the 20 second timer' }));
      act(() => { vi.advanceTimersByTime(5000); });
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

      expect(screen.getByRole('timer')).toHaveTextContent('0:15 · paused');
      act(() => { vi.advanceTimersByTime(60000); });
      expect(screen.getByRole('timer')).toHaveTextContent('0:15 · paused');
      expect(screen.getByLabelText('Your word')).toBeEnabled();

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByRole('timer')).toHaveTextContent('0:15');
      act(() => { vi.advanceTimersByTime(5000); });
      expect(screen.getByRole('timer')).toHaveTextContent('0:10');
    });

    it('stops on request, which finishes the exercise and locks the cloud', () => {
      vi.useFakeTimers();
      mount(WordCloud, 'word-cloud');

      fireEvent.change(screen.getByLabelText('Timer'), { target: { value: '20' } });
      fireEvent.click(screen.getByRole('button', { name: 'Start the 20 second timer' }));
      add('green');
      act(() => { vi.advanceTimersByTime(5000); });
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

      expect(screen.getByRole('timer')).toHaveTextContent('Finished');
      expect(screen.getByLabelText('Your word')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Remove green' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
      expect(within(screen.getByRole('list', { name: 'Word cloud' })).getByText('green')).toBeInTheDocument();
    });

    it('counts down once started, then stops taking words', () => {
      vi.useFakeTimers();
      mount(WordCloud, 'word-cloud');

      fireEvent.change(screen.getByLabelText('Timer'), { target: { value: '20' } });
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Start the 20 second timer' }));
      expect(screen.getByRole('timer')).toHaveTextContent('0:20');

      add('green');
      act(() => { vi.advanceTimersByTime(8000); });
      expect(screen.getByRole('timer')).toHaveTextContent('0:12');
      expect(screen.getByLabelText('Your word')).toBeEnabled();

      act(() => { vi.advanceTimersByTime(13000); });
      expect(screen.getByRole('timer')).toHaveTextContent('Finished');
      expect(screen.getByLabelText('Your word')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Remove green' })).toBeDisabled();
      expect(within(screen.getByRole('list', { name: 'Word cloud' })).getByText('green')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Reset the timer' }));
      expect(screen.getByLabelText('Your word')).toBeEnabled();
    });
  });
});
