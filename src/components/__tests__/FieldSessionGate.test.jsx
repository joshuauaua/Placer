import { describe, it, expect, afterEach, vi } from 'vite-plus/test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FieldSessionGate } from '../toolkit/FieldSessionGate';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';
import { asksForFieldSession, emptyFieldSession } from '../../lib/toolkit/fieldSession';

const tool = () => findTool('people-moving-count');
const signedIn = { status: 'signedIn', accountId: 'acc-1', name: 'Ada Lovelace' };

function gate({ identity = signedIn, member = true, onReady = vi.fn() } = {}) {
  const isRoomMember = vi.fn(() => (member instanceof Error ? Promise.reject(member) : Promise.resolve(member)));
  render(<FieldSessionGate t={THEME} tool={tool()} roomId="room-1" identity={identity}
    onReady={onReady} isRoomMember={isRoomMember} />);
  return { onReady, isRoomMember };
}

describe('FieldSessionGate', () => {
  afterEach(() => cleanup());

  it('is asked for by the Gehl field tools that run in rooms, and no others', () => {
    expect(asksForFieldSession(findTool('people-moving-count'))).toBe(true);
    expect(asksForFieldSession(findTool('stationary-activity-mapping'))).toBe(true);
    expect(asksForFieldSession(findTool('site-spatial-mapping'))).toBe(true);
    expect(asksForFieldSession(findTool('word-cloud'))).toBe(false);
  });

  it('asks somebody signed out to sign in, here, before anything else', () => {
    const { isRoomMember } = gate({ identity: { status: 'signedOut', accountId: null, name: null } });
    expect(screen.getByRole('heading', { name: 'Sign in to take part' })).toBeInTheDocument();
    expect(screen.getByText(/added as a collaborator/)).toBeInTheDocument();
    expect(isRoomMember).not.toHaveBeenCalled();
  });

  it('turns away an account that is not on the project', async () => {
    const { onReady } = gate({ member: false });
    expect(await screen.findByRole('heading', { name: 'You are not on this project' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Ask the organiser to add Ada Lovelace as a collaborator');
    expect(screen.queryByLabelText('Weather')).not.toBeInTheDocument();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('says so when the check fails, rather than letting anybody in', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    gate({ member: new Error('Could not check whether you are on this project: offline') });
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.queryByLabelText('Weather')).not.toBeInTheDocument();
  });

  it("asks a collaborator for the session: their account's name, locked, today's date and the time now", async () => {
    const { onReady, isRoomMember } = gate();
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    expect(isRoomMember).toHaveBeenCalledWith('room-1');

    const today = emptyFieldSession();
    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Name')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Date')).toHaveValue(today.date);
    expect(screen.getByLabelText('Time')).toHaveValue(today.time);

    // The weather has to be picked.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pick the weather.');
    expect(onReady).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Weather'), { target: { value: 'Overcast' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '08:15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onReady).toHaveBeenCalledWith({ name: 'Ada Lovelace', date: today.date, time: '08:15', weather: 'Overcast' });
  });

  it('checks nothing where there are no accounts at all (local development)', async () => {
    const { isRoomMember } = gate({ identity: { status: 'local', accountId: null, name: 'Local' } });
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    expect(isRoomMember).not.toHaveBeenCalled();
  });
});
