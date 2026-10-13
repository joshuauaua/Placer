import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpenVote } from '../toolkit/OpenVote';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('Poll', () => {
  it('shows the placeholder question and nothing chosen yet', () => {
    mount(OpenVote, 'open-vote');

    expect(screen.getByPlaceholderText('Yes or No?')).toBeInTheDocument();
    expect(screen.getByText(/pick an answer to see it here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('picks a vote and shows it in the solo result', () => {
    mount(OpenVote, 'open-vote');

    fireEvent.click(screen.getByRole('button', { name: 'Undecided' }));

    expect(screen.getByRole('button', { name: 'Undecided' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 · 100%')).toBeInTheDocument();
  });

  it('starts from Yes, No and Undecided as answers anybody can rewrite', () => {
    mount(OpenVote, 'open-vote');

    fireEvent.change(screen.getByLabelText('Answer 2'), { target: { value: 'Not yet' } });

    expect(screen.getByRole('button', { name: 'Not yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No' })).not.toBeInTheDocument();
  });

  it('adds answers, and removes them down to two', () => {
    mount(OpenVote, 'open-vote');

    fireEvent.click(screen.getByRole('button', { name: 'Add an answer' }));
    fireEvent.change(screen.getByLabelText('Answer 4'), { target: { value: 'Only at weekends' } });
    fireEvent.click(screen.getByRole('button', { name: 'Only at weekends' }));
    expect(screen.getByText('1 · 100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove answer 4' }));
    expect(screen.queryByRole('button', { name: 'Only at weekends' })).not.toBeInTheDocument();
    expect(screen.getByText(/pick an answer to see it here/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove answer 3' }));
    expect(screen.getByRole('button', { name: 'Remove answer 1' })).toBeDisabled();
  });

  it('lets someone type their own question, purely for display', () => {
    mount(OpenVote, 'open-vote');

    fireEvent.change(screen.getByLabelText('The question'), { target: { value: 'Fund the parklets?' } });

    expect(screen.getByLabelText('The question')).toHaveValue('Fund the parklets?');
  });
});
