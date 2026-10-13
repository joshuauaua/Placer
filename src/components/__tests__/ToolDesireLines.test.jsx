import { describe, it, expect } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesireLines } from '../toolkit/DesireLines';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';

/** The tool is handed the register entry it belongs to, exactly as the page does. */
function mount(Tool, id) {
  return render(<Tool t={THEME} tool={findTool(id)} />);
}

describe('Desire Lines', () => {
  it('starts with an empty plaza', () => {
    mount(DesireLines, 'desire-lines');

    expect(screen.getByText('0 journeys drawn')).toBeInTheDocument();
    expect(screen.getByText(/needs 3 separate journeys/i)).toBeInTheDocument();
  });

  it('draws a walk from one marker to another', () => {
    mount(DesireLines, 'desire-lines');

    fireEvent.click(screen.getByRole('button', { name: 'Walk from Metro entrance' }));
    expect(screen.getByText(/From Metro entrance — now pick where you are going/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Walk from Tram stop' }));

    expect(screen.getByText('1 journey drawn')).toBeInTheDocument();
    // Corner to corner is a diagonal, and the paving does not go that way.
    expect(screen.getByText('100')).toBeInTheDocument(); // per cent leaving the paving
  });

  it('takes a second tap on the same marker as a change of mind', () => {
    mount(DesireLines, 'desire-lines');

    fireEvent.click(screen.getByRole('button', { name: 'Walk from Metro entrance' }));
    fireEvent.click(screen.getByRole('button', { name: /Walking from Metro entrance/ }));

    expect(screen.getByText('0 journeys drawn')).toBeInTheDocument();
  });

  it('brings in ten neighbours, and suggests paving where they agree', () => {
    mount(DesireLines, 'desire-lines');

    fireEvent.click(screen.getByRole('button', { name: /add ten neighbours/i }));

    expect(screen.getByText('10 journeys drawn')).toBeInTheDocument();
    expect(screen.getByText('Unpaved ground worth paving')).toBeInTheDocument();
  });

  it('hides the suggestions when asked', () => {
    mount(DesireLines, 'desire-lines');
    fireEvent.click(screen.getByRole('button', { name: /add ten neighbours/i }));

    fireEvent.click(screen.getByRole('button', { name: /show where to pave/i }));

    expect(screen.getByText('Suggestions are hidden.')).toBeInTheDocument();
  });

  it('clears the plaza', () => {
    mount(DesireLines, 'desire-lines');
    fireEvent.click(screen.getByRole('button', { name: /add ten neighbours/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText('0 journeys drawn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });
});
