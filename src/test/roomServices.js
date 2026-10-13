/*
 * Stand-ins for src/services/rooms, for the tests of a tool running in a room. A test
 * file swaps them in with
 *
 *   vi.mock('../../services/rooms', () => import('../../test/roomServices'));
 *
 * and toolkitRoom.jsx's useRoomServices() puts them back to an empty room before
 * each test.
 */
import { vi } from 'vite-plus/test';

export const createRoom = vi.fn();
export const readRoom = vi.fn();
export const readContributions = vi.fn();
export const saveContribution = vi.fn();
export const closeRoom = vi.fn();
export const deleteRoom = vi.fn();
export const subscribeToRoom = vi.fn();
export const isSupabaseConfigured = vi.fn(() => true);

/** Nobody has contributed yet, saving works, and following the room does nothing. */
export function resetRoomServices() {
  for (const spy of [createRoom, readRoom, readContributions, saveContribution, closeRoom, deleteRoom, subscribeToRoom]) {
    spy.mockReset();
  }
  isSupabaseConfigured.mockReset().mockReturnValue(true);
  readContributions.mockResolvedValue([]);
  subscribeToRoom.mockReturnValue(() => {});
  saveContribution.mockResolvedValue(true);
}
