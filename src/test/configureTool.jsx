/*
 * ConfigureToolDialog, as the tests of a tool's setup for a project open it. Opening a
 * room goes through src/services/rooms, which the test file mocks.
 */
import { vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigureToolDialog } from '../components/ConfigureToolDialog';
import { findTool } from '../toolkit/tools';
import { THEME } from '../theme';

export const PROJECT = {
  id: 'proj-1', name: 'Riverside Greenway', address: 'Folkets Park, Malmö', locationPoint: { lat: 55.59, lng: 13.01 },
};

/** The dialog for the tool with this id, past its introduction onto the form unless `intro` is asked for. */
export function configureTool(toolId, overrides = {}, { intro = false } = {}) {
  const props = {
    t: THEME, project: PROJECT, tool: findTool(toolId), onClose: vi.fn(), onConfigured: vi.fn(), ...overrides,
  };
  render(<ConfigureToolDialog {...props} />);
  if (!intro) fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  return props;
}

export const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
export const save = (name = /Save and go live/) => fireEvent.click(screen.getByRole('button', { name }));
