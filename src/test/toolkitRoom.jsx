/*
 * What the tests of a tool running in a room share: the Toolkit page opened on a room,
 * and room deadlines. The file also has to mock src/services/rooms with
 * roomServices.js — see there.
 */
import { beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { THEME } from '../theme';
import ToolkitPage from '../components/ToolkitPage';
import { resetRoomServices } from './roomServices';

/**
 * An ISO deadline this many hours from now. Future deadlines get half a minute of
 * slack, because the countdown floors to whole minutes and the milliseconds spent
 * rendering would otherwise turn "2h" into "1h 59m".
 */
export const hours = (n) => new Date(Date.now() + n * 3600000 + (n > 0 ? 30000 : 0)).toISOString();

/** The page at `path`, past the tool's cover page — these are about the tool. */
export function renderAt(path, searchPath = '', props = {}) {
  const location = memoryLocation({ path, searchPath, record: true });
  render(
    <Router hook={location.hook}>
      <ToolkitPage t={THEME} {...props} />
    </Router>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
  return location;
}

/** Each test starts from an empty room, and forgets the rooms this browser hosted. */
export function useRoomServices() {
  beforeEach(resetRoomServices);
  afterEach(() => localStorage.clear());
}
