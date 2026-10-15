import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SavedInquiries } from '../SavedInquiries';
import { createRoom } from '../../test/roomServices';
import { configureTool, save } from '../../test/configureTool';
import { THEME } from '../../theme';
import { lastMap } from '../../test/maplibreStub';

const identity = vi.hoisted(() => ({ value: { status: 'signedIn', accountId: 'acc-1' } }));
vi.mock('../useIdentity', () => ({ useIdentity: () => identity.value }));
vi.mock('../../services/rooms', () => import('../../test/roomServices'));
vi.mock('../../services/inquiries', () => ({ saveInquiry: vi.fn(), readInquiries: vi.fn(), deleteInquiry: vi.fn() }));

const { readInquiries } = await import('../../services/inquiries');

const inquiry = {
  id: 'i1', tool: 'desire-lines', title: 'Market square', note: 'The shortcut over the grass is worn bare.',
  createdAt: '2026-10-15T09:00:00Z',
  config: {
    note: 'The shortcut over the grass is worn bare.',
    site: {
      name: 'Market square', point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: null,
      elements: [{ id: 'm1', type: 'entrance', label: '', note: 'Step-free', point: [13.4, 52.52] }],
    },
    walks: [{ id: 'w1', points: [[13.4, 52.52], [13.401, 52.52]] }],
  },
};

describe('setting Desire Lines up from a kept inquiry', () => {
  it("offers a signed-in organiser's inquiries, and adds the site with its marks and note", async () => {
    readInquiries.mockResolvedValue([inquiry]);
    createRoom.mockResolvedValue({ id: 'room-1', pin: '123456', facilitatorToken: 'f' });
    const { onConfigured } = configureTool('desire-lines');

    const picker = await screen.findByLabelText('Start from one of your saved inquiries');
    expect(screen.getByRole('button', { name: 'Add its site' })).toBeDisabled();
    fireEvent.change(picker, { target: { value: 'i1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add its site' }));

    expect(screen.getByRole('list', { name: 'Sites' })).toHaveTextContent('Market square');
    expect(screen.getByRole('list', { name: 'Sites' })).toHaveTextContent('1 marked');
    expect(screen.getByLabelText(/why are you interested/i)).toHaveValue('The shortcut over the grass is worn bare.');
    save();

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(createRoom.mock.calls[0][3]).toMatchObject({
      note: 'The shortcut over the grass is worn bare.',
      sites: [{ name: 'Market square', elements: [{ type: 'entrance', note: 'Step-free' }] }],
    });
  });

  it('offers nothing when the organiser has kept none, or is not signed in', async () => {
    readInquiries.mockResolvedValue([]);
    configureTool('desire-lines');
    await act(async () => { await lastMap().ready; });
    expect(screen.queryByLabelText('Start from one of your saved inquiries')).not.toBeInTheDocument();
  });

  it('lets the organiser write the note about the site themselves', async () => {
    readInquiries.mockResolvedValue([]);
    configureTool('desire-lines');

    fireEvent.change(screen.getByLabelText(/why are you interested/i), { target: { value: 'Because.' } });

    expect(screen.getByLabelText(/why are you interested/i)).toHaveValue('Because.');
  });
});

describe('the inquiries on a profile', () => {
  const service = (list) => ({
    readInquiries: vi.fn().mockResolvedValue(list),
    deleteInquiry: vi.fn().mockResolvedValue(undefined),
  });

  it('lists them with their note, tool and what was drawn', async () => {
    render(<SavedInquiries t={THEME} service={service([inquiry])} />);

    const list = await screen.findByRole('list', { name: 'Saved inquiries' });
    expect(list).toHaveTextContent('Market square');
    expect(list).toHaveTextContent('The shortcut over the grass is worn bare.');
    expect(list).toHaveTextContent('Desire Lines');
    expect(list).toHaveTextContent('1 walk · 1 mark');
  });

  it('says what to do when there are none', async () => {
    render(<SavedInquiries t={THEME} service={service([])} />);
    expect(await screen.findByText(/nothing kept yet/i)).toBeInTheDocument();
  });

  it('deletes one', async () => {
    const svc = service([inquiry]);
    render(<SavedInquiries t={THEME} service={svc} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Market square' }));

    await waitFor(() => expect(svc.deleteInquiry).toHaveBeenCalledWith('i1'));
    expect(await screen.findByText(/nothing kept yet/i)).toBeInTheDocument();
  });

  it('says so when they cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SavedInquiries t={THEME} service={{ readInquiries: vi.fn().mockRejectedValue(new Error('x')) }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i);
  });
});
