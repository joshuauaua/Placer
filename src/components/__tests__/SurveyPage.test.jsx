import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SurveyPage } from '../SurveyPage';
import { THEME } from '../../theme';

function getOptionButtons() {
  return screen
    .getAllByRole('button')
    .filter((btn) => !['Previous', 'Next Question', 'Submit Survey'].includes(btn.textContent));
}

function answerCurrentQuestion(optionIndex = 0) {
  fireEvent.click(getOptionButtons()[optionIndex]);
}

describe('SurveyPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the first question text on mount', () => {
    render(<SurveyPage t={THEME} />);
    expect(
      screen.getByText('How often do you visit public spaces in your neighborhood?')
    ).toBeInTheDocument();
  });

  it('displays a progress indicator showing "1 / 12"', () => {
    render(<SurveyPage t={THEME} />);
    expect(screen.getByText('1 / 12')).toBeInTheDocument();
  });

  it('highlights the selected answer', () => {
    render(<SurveyPage t={THEME} />);
    const option = getOptionButtons()[0];
    fireEvent.click(option);
    expect(option).toHaveStyle({ borderColor: THEME.accent });
  });

  it('disables "Next Question" until an option is selected', () => {
    render(<SurveyPage t={THEME} />);
    expect(screen.getByText('Next Question')).toBeDisabled();
    answerCurrentQuestion();
    expect(screen.getByText('Next Question')).not.toBeDisabled();
  });

  it('advances to question 2 and updates progress to "2 / 12" on "Next Question"', () => {
    render(<SurveyPage t={THEME} />);
    answerCurrentQuestion();
    fireEvent.click(screen.getByText('Next Question'));
    expect(screen.getByText('2 / 12')).toBeInTheDocument();
    expect(
      screen.getByText('What type of public space improvement would benefit your community most?')
    ).toBeInTheDocument();
  });

  it('disables "Previous" on question 1', () => {
    render(<SurveyPage t={THEME} />);
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('navigates back to the prior question with the answer preserved', () => {
    render(<SurveyPage t={THEME} />);
    const firstOption = getOptionButtons()[1];
    fireEvent.click(firstOption);
    fireEvent.click(screen.getByText('Next Question'));
    fireEvent.click(screen.getByText('Previous'));

    expect(screen.getByText('1 / 12')).toBeInTheDocument();
    expect(screen.getByText('Next Question')).not.toBeDisabled();
    expect(getOptionButtons()[1]).toHaveStyle({ borderColor: THEME.accent });
  });

  it('replaces the prior answer when a different option is selected on the same question', () => {
    render(<SurveyPage t={THEME} />);
    const options = getOptionButtons();
    fireEvent.click(options[0]);
    fireEvent.click(options[1]);

    expect(options[1]).toHaveStyle({ borderColor: THEME.accent });
    expect(options[0]).toHaveStyle({ borderColor: THEME.line });
  });

  it('replaces "Next Question" with "Submit Survey" on the last question', () => {
    render(<SurveyPage t={THEME} />);
    for (let i = 0; i < 11; i++) {
      answerCurrentQuestion();
      fireEvent.click(screen.getByText('Next Question'));
    }
    expect(screen.getByText('12 / 12')).toBeInTheDocument();
    expect(screen.queryByText('Next Question')).not.toBeInTheDocument();
    expect(screen.getByText('Submit Survey')).toBeInTheDocument();
  });

  it('disables "Submit Survey" until all 12 questions are answered', () => {
    render(<SurveyPage t={THEME} />);
    for (let i = 0; i < 11; i++) {
      answerCurrentQuestion();
      fireEvent.click(screen.getByText('Next Question'));
    }
    expect(screen.getByText('Submit Survey')).toBeDisabled();
    answerCurrentQuestion();
    expect(screen.getByText('Submit Survey')).not.toBeDisabled();
  });

  it('renders the "Thank You!" confirmation after submission', () => {
    render(<SurveyPage t={THEME} />);
    for (let i = 0; i < 11; i++) {
      answerCurrentQuestion();
      fireEvent.click(screen.getByText('Next Question'));
    }
    answerCurrentQuestion();
    fireEvent.click(screen.getByText('Submit Survey'));
    expect(screen.getByText('Thank You!')).toBeInTheDocument();
  });

  it('sets window.location.href to "/" when "Return to Home" is clicked', () => {
    delete window.location;
    window.location = { href: '' };

    render(<SurveyPage t={THEME} />);
    for (let i = 0; i < 11; i++) {
      answerCurrentQuestion();
      fireEvent.click(screen.getByText('Next Question'));
    }
    answerCurrentQuestion();
    fireEvent.click(screen.getByText('Submit Survey'));
    fireEvent.click(screen.getByText('Return to Home'));

    expect(window.location.href).toBe('/');
  });
});
