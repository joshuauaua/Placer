import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DesireLines } from '../toolkit/DesireLines';
import { DesireLinesOnPage } from '../toolkit/DesireLinesOnPage';
import { findTool } from '../../toolkit/tools';
import { THEME } from '../../theme';
import { saveInquiry } from '../../services/inquiries';
import { lastMap } from '../../test/maplibreStub';

const identity = vi.hoisted(() => ({ value: { status: 'local', accountId: null } }));
vi.mock('../useIdentity', () => ({ useIdentity: () => identity.value }));
vi.mock('../../services/inquiries', () => ({ saveInquiry: vi.fn(), readInquiries: vi.fn().mockResolvedValue([]) }));

const tool = findTool('desire-lines');
const site = { id: 's1', name: 'Market square', point: { lat: 52.52, lng: 13.4 }, zoom: 17, bounds: null };
const config = { prompt: 'Which way do you walk?', sites: [site, { ...site, id: 's2', name: 'River park' }] };

/** A walk of `steps` moves across the map, a few pixels apiece, as a finger drags. */
function drag(map, steps = 12) {
  fireEvent.pointerDown(map, { clientX: 0, clientY: 0, pointerId: 1 });
  for (let i = 1; i <= steps; i += 1) fireEvent.pointerMove(map, { clientX: i * 10, clientY: i * 4, pointerId: 1 });
  fireEvent.pointerUp(map, { clientX: steps * 10, clientY: steps * 4, pointerId: 1 });
}

const sourceLines = (map, id) => map.getSource(id).data.features.length;
const tap = (map, x, y) => {
  fireEvent.pointerDown(map, { clientX: x, clientY: y, pointerId: 1 });
  fireEvent.pointerUp(map, { clientX: x, clientY: y, pointerId: 1 });
};

describe('Desire Lines on its own', () => {
  async function chooseSite() {
    render(<DesireLines t={THEME} tool={tool} />);
    // The map has loaded and been moved to the place.
    await act(async () => { await lastMap().ready; });
    // The map as it opens is not a site anybody chose; moved to a place, it is.
    act(() => lastMap().fire('moveend'));
    expect(screen.getByRole('button', { name: 'Use this site' })).toBeDisabled();
    act(() => {
      lastMap().jumpTo({ center: [13.01, 55.59], zoom: 17 });
      lastMap().fire('moveend');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this site' }));
    await act(async () => { await lastMap().ready; });
  }

  it('starts by choosing a site, with nothing to draw on yet', () => {
    render(<DesireLines t={THEME} tool={tool} />);

    expect(screen.getByText('Choose your site')).toBeInTheDocument();
    expect(screen.getByLabelText(/search for the place/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'How to draw' })).not.toBeInTheDocument();
  });

  it('asks for the name, the place, why it is of interest, and then the frame', () => {
    render(<DesireLines t={THEME} tool={tool} />);

    const name = screen.getByLabelText('Site name');
    const search = screen.getByLabelText(/search for the place/i);
    const about = screen.getByLabelText(/why are you interested/i);
    const before = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(before(name, search)).toBeTruthy();
    expect(before(search, about)).toBeTruthy();
    expect(before(about, screen.getByText('Frame the site *'))).toBeTruthy();
  });

  it('names the site as typed', async () => {
    render(<DesireLines t={THEME} tool={tool} />);
    await act(async () => { await lastMap().ready; });
    fireEvent.change(screen.getByLabelText('Site name'), { target: { value: 'Folkets Park' } });
    act(() => {
      lastMap().jumpTo({ center: [13.01, 55.59], zoom: 17 });
      lastMap().fire('moveend');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this site' }));

    expect(await screen.findByText('Folkets Park')).toBeInTheDocument();
  });

  it('draws a walk freehand on the chosen site', async () => {
    await chooseSite();
    expect(screen.getByText('0 walks drawn')).toBeInTheDocument();

    drag(screen.getByRole('application'));

    expect(screen.getByText('1 walk drawn')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your walks' })).toBeInTheDocument();
    expect(sourceLines(lastMap(), 'aligned')).toBe(1);
  });

  it('turns off dragging the map while drawing, and back on to move it', async () => {
    await chooseSite();

    expect(lastMap().dragPan.on).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Move the map' }));
    expect(lastMap().dragPan.on).toBe(true);
    drag(screen.getByRole('application'));
    expect(screen.getByText('0 walks drawn')).toBeInTheDocument();
  });

  it('draws point by point, and finishes the walk', async () => {
    await chooseSite();
    fireEvent.click(screen.getByRole('button', { name: 'Point by point' }));
    const map = screen.getByRole('application');

    tap(map, 0, 0);
    expect(screen.getByRole('button', { name: 'Finish walk' })).toBeDisabled();
    tap(map, 200, 100);
    tap(map, 400, 100);
    expect(sourceLines(lastMap(), 'draft')).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish walk' }));

    expect(screen.getByText('1 walk drawn')).toBeInTheDocument();
    expect(sourceLines(lastMap(), 'draft')).toBe(0);
  });

  it('draws each walk in a colour of its own', async () => {
    await chooseSite();
    drag(screen.getByRole('application'));
    drag(screen.getByRole('application'));
    drag(screen.getByRole('application'));

    const colors = lastMap().getSource('aligned').data.features.map((feature) => feature.properties.color);
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
    // The walk being drawn next is already in the colour it will get.
    fireEvent.click(screen.getByRole('button', { name: 'Point by point' }));
    fireEvent.pointerDown(screen.getByRole('application'), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole('application'), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerDown(screen.getByRole('application'), { clientX: 90, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole('application'), { clientX: 90, clientY: 0, pointerId: 1 });
    const draft = lastMap().getSource('draft').data.features[0].properties.color;
    expect(colors).not.toContain(draft);
  });

  it('undoes the last walk, then the last mark, one at a time', async () => {
    await chooseSite();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    drag(screen.getByRole('application'));
    fireEvent.click(screen.getByRole('button', { name: 'Entrance' }));
    fireEvent.pointerDown(screen.getByRole('application'), { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole('application'), { clientX: 20, clientY: 20, pointerId: 1 });
    expect(screen.getByRole('list', { name: 'Your marks' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('list', { name: 'Your marks' })).not.toBeInTheDocument();
    expect(screen.getByText('1 walk drawn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('0 walks drawn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('does not keep a slip of the finger as a walk', async () => {
    await chooseSite();

    fireEvent.pointerDown(screen.getByRole('application'), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(screen.getByRole('application'), { clientX: 3, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole('application'), { clientX: 3, clientY: 0, pointerId: 1 });

    expect(screen.getByText('0 walks drawn')).toBeInTheDocument();
  });

  it('removes a walk, and clears them', async () => {
    await chooseSite();
    drag(screen.getByRole('application'));
    drag(screen.getByRole('application'));
    expect(screen.getByText('2 walks drawn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove walk 1' }));
    expect(screen.getByText('1 walk drawn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('0 walks drawn')).toBeInTheDocument();
  });

  it('goes back to choosing a site', async () => {
    await chooseSite();

    fireEvent.click(screen.getByRole('button', { name: 'Choose another site' }));

    expect(screen.getByText('Choose your site')).toBeInTheDocument();
  });

  it('offers no way to see other people, since nobody else is drawing', async () => {
    await chooseSite();
    expect(screen.queryByRole('button', { name: /other people/i })).not.toBeInTheDocument();
  });
});

describe('Desire Lines in a project room', () => {
  const other = (id, offset) => ({
    id,
    points: [[13.4, 52.52 + offset], [13.404, 52.52 + offset]],
  });
  const openRoom = (combined, publish = vi.fn()) => ({
    status: 'open', config, combined, publish, participantCount: 2, isHost: false,
  });
  const mount = (room) => render(<DesireLines t={THEME} tool={tool} room={room} />);

  it("draws on the organiser's sites, and sends the walks to the room", async () => {
    const room = openRoom({ people: 0, sites: {} });
    mount(room);
    await act(async () => { await lastMap().ready; });

    expect(screen.getByRole('button', { name: 'Market square' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'River park' })).toBeInTheDocument();
    expect(room.publish).not.toHaveBeenCalled();

    drag(screen.getByRole('application'));

    await waitFor(() => expect(room.publish).toHaveBeenCalled());
    const sent = room.publish.mock.calls.at(-1)[0];
    expect(sent.sites.s1).toHaveLength(1);
    expect(sent.sites.s1[0].points.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps each site's walks apart", async () => {
    mount(openRoom({ people: 0, sites: {} }));
    await act(async () => { await lastMap().ready; });
    drag(screen.getByRole('application'));
    expect(screen.getByText('1 walk drawn')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'River park' }));

    expect(screen.getByText('0 walks drawn')).toBeInTheDocument();
  });

  it("keeps the others' walks hidden until asked, then shows how they compare", async () => {
    // Along the way the drag goes: east, rising gently from the site's centre.
    const combined = { people: 3, sites: { s1: [other('a', 0), other('b', 0.0001)] } };
    mount(openRoom(combined));
    await act(async () => { await lastMap().ready; });
    drag(screen.getByRole('application'));

    expect(sourceLines(lastMap(), 'others')).toBe(0);
    expect(screen.getByText(/draw first, then show what other people drew/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show other people/i }));

    expect(sourceLines(lastMap(), 'others')).toBe(2);
    expect(screen.getByText(/2 walks by other people/)).toBeInTheDocument();
    expect(screen.getByText('Walked the same way')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide other people/i }));
    expect(sourceLines(lastMap(), 'others')).toBe(0);
  });

  it("does not count one's own walks among the others'", async () => {
    const room = openRoom({ people: 0, sites: {} });
    const view = mount(room);
    await act(async () => { await lastMap().ready; });
    drag(screen.getByRole('application'));
    await waitFor(() => expect(room.publish).toHaveBeenCalled());
    const mine = room.publish.mock.calls.at(-1)[0];

    // The room hears this browser's walk and hands it back among everybody's.
    view.rerender(<DesireLines t={THEME} tool={tool} room={{ ...room, combined: { people: 1, sites: mine.sites } }} />);
    fireEvent.click(screen.getByRole('button', { name: /show other people/i }));

    expect(screen.getByText(/nobody else has drawn on market square yet/i)).toBeInTheDocument();
  });

  it('says so when the room was opened with no site', () => {
    mount({ status: 'open', config: { sites: [] }, combined: null, publish: vi.fn() });
    expect(screen.getByText(/without a site to draw on/i)).toBeInTheDocument();
  });
});

describe('Desire Lines on a project page', () => {
  // What a browser remembers of a room is kept in memory here, fresh for each test (some
  // test environments have no storage at all).
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  beforeEach(() => {
    const store = new Map();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)),
    } });
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original);
    else delete window.localStorage;
  });

  const room = { id: 'room-1', tool: 'desire-lines', expiresAt: null, config };
  const service = () => ({
    readContributions: vi.fn().mockResolvedValue([]),
    subscribeToRoom: vi.fn(() => () => {}),
    saveContribution: vi.fn().mockResolvedValue(true),
  });
  const mount = (svc) => render(<DesireLinesOnPage t={THEME} tool={tool} room={room} service={svc} />);

  it('shows the question and sends the walks once drawn', async () => {
    const svc = service();
    mount(svc);
    await act(async () => { await lastMap().ready; });
    expect(screen.getByText('Which way do you walk?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send my walks' })).toBeDisabled();

    drag(screen.getByRole('application'));
    fireEvent.click(screen.getByRole('button', { name: 'Send my walks' }));

    await waitFor(() => expect(svc.saveContribution).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room-1', state: { sites: { s1: [expect.objectContaining({ id: expect.any(String) })] }, elements: {} } }),
    ));
    expect(await screen.findByText(/^Sent\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update my walks' })).toBeDisabled();
  });

  it('remembers what was sent in this browser', async () => {
    mount(service());
    await act(async () => { await lastMap().ready; });
    drag(screen.getByRole('application'));
    fireEvent.click(screen.getByRole('button', { name: 'Send my walks' }));
    await screen.findByText(/^Sent\./);

    document.body.innerHTML = '';
    mount(service());

    expect(await screen.findByText('1 walk drawn')).toBeInTheDocument();
  });

  it("lets a visitor look at the others' walks", async () => {
    const svc = service();
    svc.readContributions.mockResolvedValue([
      { displayName: null, updatedAt: 'a', state: { sites: { s1: [{ id: 'z', points: [[13.4, 52.52], [13.404, 52.52]] }] } } },
    ]);
    mount(svc);
    await act(async () => { await lastMap().ready; });
    await waitFor(() => expect(svc.readContributions).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /show other people/i }));

    await waitFor(() => expect(sourceLines(lastMap(), 'others')).toBe(1));
  });

  it('says so when the desire lines have closed', async () => {
    const svc = service();
    svc.saveContribution.mockResolvedValue(false);
    mount(svc);
    await act(async () => { await lastMap().ready; });
    drag(screen.getByRole('application'));

    fireEvent.click(screen.getByRole('button', { name: 'Send my walks' }));

    expect(await screen.findByText(/has closed/i)).toBeInTheDocument();
  });

  it('says so when the walks do not go through', async () => {
    const svc = service();
    svc.saveContribution.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(svc);
    await act(async () => { await lastMap().ready; });
    drag(screen.getByRole('application'));

    fireEvent.click(screen.getByRole('button', { name: 'Send my walks' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not go through/i);
  });
});

describe('marking entrances, obstacles and other things', () => {
  const palette = { types: [{ id: 't1', label: 'Bench' }] };
  const fixed = { ...site, elements: [{ id: 'f1', type: 'entrance', label: '', point: [13.4, 52.52] }] };
  const openRoom = (combined = { people: 0, sites: {}, elements: {} }, config2 = { sites: [fixed], ...palette }) => ({
    status: 'open', config: config2, combined, publish: vi.fn(), participantCount: 1, isHost: false,
  });
  const mount = (room) => render(<DesireLines t={THEME} tool={tool} room={room} />);
  const tap = (map, x = 20, y = 20) => {
    fireEvent.pointerDown(map, { clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(map, { clientX: x, clientY: y, pointerId: 1 });
  };
  const ready = () => act(async () => { await lastMap().ready; });

  it("offers an entrance, an obstacle, something else, and the project's own kinds", async () => {
    mount(openRoom());
    await ready();

    const group = screen.getByRole('group', { name: 'Put on the map' });
    expect([...group.querySelectorAll('button')].map((b) => b.textContent))
      .toEqual(['Entrance', 'Obstacle', 'Something else', 'Bench']);
  });

  it("shows what the organiser marked on the site, with its name", async () => {
    mount(openRoom());
    await ready();

    expect(screen.getByLabelText('Entrance')).toBeInTheDocument();
  });

  it('places an entrance by tapping the map, and takes it back', async () => {
    const room = openRoom();
    mount(room);
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Obstacle' }));
    tap(screen.getByRole('application'));

    expect(screen.getByText('1 marked', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Obstacle')).toHaveLength(1);
    await waitFor(() => expect(room.publish).toHaveBeenCalled());
    expect(room.publish.mock.calls.at(-1)[0].elements.s1[0]).toMatchObject({ type: 'obstacle' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Obstacle' }));
    expect(screen.queryByLabelText('Obstacle')).not.toBeInTheDocument();
  });

  it('has to be told what a blank element is before it is placed', async () => {
    mount(openRoom());
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
    tap(screen.getByRole('application'));
    expect(screen.queryByRole('list', { name: 'Your marks' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Broken bench' } });
    tap(screen.getByRole('application'));

    expect(screen.getByLabelText('Broken bench')).toBeInTheDocument();
    expect(screen.getByLabelText('What is it?')).toHaveValue('');
  });

  it("places one of the project's own kinds under its name", async () => {
    mount(openRoom());
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Bench' }));
    tap(screen.getByRole('application'));

    expect(screen.getByLabelText('Bench')).toBeInTheDocument();
  });

  it("does not place anything while drawing, or on a tap on an existing pin", async () => {
    mount(openRoom());
    await ready();

    fireEvent.pointerDown(screen.getByLabelText('Entrance'), { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(screen.getByLabelText('Entrance'), { clientX: 5, clientY: 5, pointerId: 1 });
    tap(screen.getByRole('application'));

    expect(screen.queryByRole('list', { name: 'Your marks' })).not.toBeInTheDocument();
  });

  it("shows other people's marks only when their walks are asked for", async () => {
    const combined = {
      people: 2, sites: {}, elements: { s1: [{ id: 'o1', type: 'obstacle', label: '', point: [13.4, 52.52] }] },
    };
    mount(openRoom(combined));
    await ready();
    expect(screen.queryByLabelText('Obstacle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show other people/i }));

    expect(screen.getByLabelText('Obstacle')).toBeInTheDocument();
  });

  it("is sent to a project page's room along with the walks", async () => {
    const svc = {
      readContributions: vi.fn().mockResolvedValue([]),
      subscribeToRoom: vi.fn(() => () => {}),
      saveContribution: vi.fn().mockResolvedValue(true),
    };
    render(<DesireLinesOnPage t={THEME} tool={tool} service={svc}
      room={{ id: 'room-1', tool: 'desire-lines', expiresAt: null, config: { sites: [site] } }} />);
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Entrance' }));
    tap(screen.getByRole('application'));
    fireEvent.click(screen.getByRole('button', { name: 'Send my walks' }));

    await waitFor(() => expect(svc.saveContribution).toHaveBeenCalledWith(expect.objectContaining({
      state: { sites: {}, elements: { s1: [expect.objectContaining({ type: 'entrance' })] } },
    })));
  });
});

describe('the pointer and the popups on the map', () => {
  const fixed = {
    ...site, elements: [{ id: 'f1', type: 'other', label: 'Bench', note: 'Has been broken since spring', point: [13.4, 52.52] }],
  };
  const room = { status: 'open', config: { sites: [fixed] }, combined: null, publish: vi.fn(), participantCount: 1 };
  const ready = () => act(async () => { await lastMap().ready; });

  it('is a ring while drawing, and the map\'s own hand to move it', async () => {
    render(<DesireLines t={THEME} tool={tool} room={room} />);
    await ready();

    expect(lastMap().getCanvas().style.cursor).toContain('%3Ccircle');
    fireEvent.click(screen.getByRole('button', { name: 'Move the map' }));
    expect(lastMap().getCanvas().style.cursor).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Point by point' }));
    expect(lastMap().getCanvas().style.cursor).toContain('circle');
  });

  it('opens a popup with the description when an element is hovered, and closes it again', async () => {
    render(<DesireLines t={THEME} tool={tool} room={room} />);
    await ready();
    const pin = screen.getByLabelText('Bench');
    expect(pin).not.toHaveAttribute('title');
    expect(lastMap().popups).toHaveLength(0);

    fireEvent.mouseEnter(pin);
    expect(lastMap().popups).toHaveLength(1);
    expect(screen.getByText('Has been broken since spring')).toBeInTheDocument();

    fireEvent.mouseLeave(pin);
    expect(screen.queryByText('Has been broken since spring')).not.toBeInTheDocument();
  });

  it('keeps the description somebody gives an element they place', async () => {
    render(<DesireLines t={THEME} tool={tool} room={{ ...room, config: { sites: [site] } }} />);
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Obstacle' }));
    fireEvent.change(screen.getByLabelText('Describe it'), { target: { value: 'Steps, no ramp' } });
    const map = screen.getByRole('application');
    fireEvent.pointerDown(map, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(map, { clientX: 20, clientY: 20, pointerId: 1 });

    fireEvent.mouseEnter(screen.getByLabelText('Obstacle'));
    expect(screen.getByText('Steps, no ramp')).toBeInTheDocument();
    expect(screen.getByLabelText('Describe it')).toHaveValue('');
  });
});

describe('Desire Lines on its own, kept on a profile', () => {
  async function chooseSite(note) {
    render(<DesireLines t={THEME} tool={tool} />);
    await act(async () => { await lastMap().ready; });
    if (note) fireEvent.change(screen.getByLabelText(/why are you interested/i), { target: { value: note } });
    act(() => {
      lastMap().jumpTo({ center: [13.01, 55.59], zoom: 17 });
      lastMap().fire('moveend');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this site' }));
    await act(async () => { await lastMap().ready; });
  }

  it('asks why the site is of interest, and keeps the answer beside the map', async () => {
    identity.value = { status: 'local', accountId: null };
    await chooseSite('The shortcut over the grass is worn bare.');

    expect(screen.getByText('About this site')).toBeInTheDocument();
    expect(screen.getByText('The shortcut over the grass is worn bare.')).toBeInTheDocument();
  });

  it('shows no About box when nothing was said', async () => {
    identity.value = { status: 'local', accountId: null };
    await chooseSite('');
    expect(screen.queryByText('About this site')).not.toBeInTheDocument();
  });

  it('offers nothing to keep it on when there are no accounts', async () => {
    identity.value = { status: 'local', accountId: null };
    await chooseSite('');
    expect(screen.queryByRole('button', { name: /save to my profile/i })).not.toBeInTheDocument();
  });

  it('suggests signing in to somebody who is not', async () => {
    identity.value = { status: 'signedOut', accountId: null };
    await chooseSite('');
    expect(screen.getByText(/sign in to keep this on your profile/i)).toBeInTheDocument();
  });

  it('keeps the site, note, marks and walks on the profile of somebody signed in', async () => {
    identity.value = { status: 'signedIn', accountId: 'acc-1' };
    saveInquiry.mockResolvedValue({ id: 'i1' });
    await chooseSite('The shortcut over the grass is worn bare.');
    drag(screen.getByRole('application'));
    fireEvent.click(screen.getByRole('button', { name: 'Entrance' }));
    fireEvent.pointerDown(screen.getByRole('application'), { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(screen.getByRole('application'), { clientX: 20, clientY: 20, pointerId: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));

    expect(await screen.findByRole('button', { name: 'Saved to your profile' })).toBeDisabled();
    expect(saveInquiry).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'desire-lines',
      note: 'The shortcut over the grass is worn bare.',
      config: expect.objectContaining({
        note: 'The shortcut over the grass is worn bare.',
        site: expect.objectContaining({ point: { lat: 55.59, lng: 13.01 }, elements: [expect.objectContaining({ type: 'entrance' })] }),
        walks: [expect.objectContaining({ points: expect.any(Array) })],
      }),
    }));
    expect(screen.getByRole('link', { name: 'See your saved inquiries' })).toHaveAttribute('href', '/people/acc-1');

    // Drawing more is something else to keep.
    fireEvent.click(screen.getByRole('button', { name: 'Draw freehand' }));
    drag(screen.getByRole('application'));
    expect(screen.getByRole('button', { name: 'Save to my profile' })).toBeEnabled();
  });

  it('says so when it does not save', async () => {
    identity.value = { status: 'signedIn', accountId: 'acc-1' };
    saveInquiry.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await chooseSite('');

    fireEvent.click(screen.getByRole('button', { name: 'Save to my profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not save/i);
  });
});
