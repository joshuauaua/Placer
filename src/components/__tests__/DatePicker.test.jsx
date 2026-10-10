import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DatePicker } from '../DatePicker';
import { THEME } from '../../theme';

const setup = (props = {}) => {
  const onChange = vi.fn();
  render(
    <>
      <label htmlFor="when">When</label>
      <DatePicker t={THEME} id="when" value="" onChange={onChange} {...props} />
    </>
  );
  return onChange;
};

const calendar = () => within(screen.getByRole('dialog', { name: 'Choose a date' }));

describe('DatePicker', () => {
  it('opens the same calendar as the range picker, and picks one day', () => {
    const onChange = setup({ min: '2026-11-01', max: '2026-12-31' });

    fireEvent.click(screen.getByLabelText('When'));
    fireEvent.click(calendar().getByRole('button', { name: '20 November 2026' }));

    expect(onChange).toHaveBeenCalledWith('2026-11-20');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows days outside its bounds in their month, but will not pick them', () => {
    setup({ min: '2026-11-10', max: '2026-11-20' });

    fireEvent.click(screen.getByLabelText('When'));

    expect(calendar().getByRole('button', { name: '9 November 2026' })).toBeDisabled();
    expect(calendar().getByRole('button', { name: '10 November 2026' })).toBeEnabled();
    expect(calendar().getByRole('button', { name: '21 November 2026' })).toBeDisabled();
    expect(calendar().queryByRole('button', { name: '1 December 2026' })).not.toBeInTheDocument();
  });

  it('shows the picked day on its button, and can clear it', () => {
    const onChange = setup({ value: '2026-11-20', min: '2026-11-01', max: '2026-12-31' });

    expect(screen.getByLabelText('When')).toHaveTextContent('2026');
    fireEvent.click(screen.getByLabelText('When'));
    expect(calendar().getByRole('button', { name: '20 November 2026' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(calendar().getByRole('button', { name: 'Clear' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('closes on Escape without picking', () => {
    const onChange = setup();

    fireEvent.click(screen.getByLabelText('When'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
