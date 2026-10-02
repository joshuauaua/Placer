import { describe, it, expect, afterEach } from 'vite-plus/test';
import {
  addComment,
  clearPendingImagination,
  eraseAllData,
  exportAllData,
  readComments,
  readMyVote,
  readPendingImagination,
  saveImagination,
  savePendingImagination,
  voteImagination,
} from '../api';
import { saveProfile } from '../profile';
import { participantToken, rememberHostedRoom } from '../../toolkit/rooms';
import { follow } from '../follows';

// api.js and profile.js each declare this literal, so that mocking one in a test
// cannot break the other. These tests are what stops the two from drifting apart:
// a display name is personal data, and a profile key missing from api.js's registry
// would be silently left out of the GDPR export and survive the erasure request.
const PROFILE_KEY = 'placemaking_profile';

describe('the GDPR data rights cover the profile', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('includes the profile in a data export', async () => {
    saveProfile({ name: 'Mara Quinn' });

    const { data } = await exportAllData();

    expect(data[PROFILE_KEY]).toMatchObject({ name: 'Mara Quinn' });
  });

  it('erases the profile along with everything else', async () => {
    saveProfile({ name: 'Mara Quinn' });
    expect(localStorage.getItem(PROFILE_KEY)).not.toBeNull();

    await eraseAllData();

    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });
});

// toolkit/rooms.js declares its two keys the same way and for the same reason. A
// room token is not personal data on its own, but it is an identifier held in the
// visitor's browser, and the GDPR page now says both are covered by the controls
// on it — so these are what keep that sentence true.
const ROOM_PARTICIPANT_KEY = 'placemaking_room_participant';
const ROOMS_HOSTED_KEY = 'placemaking_rooms_hosted';

describe('the GDPR data rights cover toolkit room tokens', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('includes both room keys in a data export', async () => {
    participantToken();
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });

    const { data } = await exportAllData();

    expect(data[ROOM_PARTICIPANT_KEY]).toEqual(expect.any(String));
    expect(data[ROOMS_HOSTED_KEY]).toMatchObject({
      'room-1': { pin: '839201', token: 'facilitator-1' },
    });
  });

  it('erases both room keys along with everything else', async () => {
    participantToken();
    rememberHostedRoom('room-1', { pin: '839201', token: 'facilitator-1' });
    expect(localStorage.getItem(ROOM_PARTICIPANT_KEY)).not.toBeNull();
    expect(localStorage.getItem(ROOMS_HOSTED_KEY)).not.toBeNull();

    await eraseAllData();

    expect(localStorage.getItem(ROOM_PARTICIPANT_KEY)).toBeNull();
    expect(localStorage.getItem(ROOMS_HOSTED_KEY)).toBeNull();
  });
});

// services/follows.js declares this literal the same way and for the same reason.
// Who and what a browser follows before there are accounts is personal enough to
// belong in the same export and erasure the profile gets.
const FOLLOWS_KEY = 'placemaking_follows';

describe('the GDPR data rights cover what this browser follows', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('includes follows in a data export', async () => {
    await follow('imagination', 'img-1', 'Pocket park on Lot 7');

    const { data } = await exportAllData();

    expect(data[FOLLOWS_KEY]).toMatchObject([{ type: 'imagination', targetId: 'img-1' }]);
  });

  it('erases follows along with everything else', async () => {
    await follow('imagination', 'img-1', 'Pocket park on Lot 7');
    expect(localStorage.getItem(FOLLOWS_KEY)).not.toBeNull();

    await eraseAllData();

    expect(localStorage.getItem(FOLLOWS_KEY)).toBeNull();
  });
});

const UPVOTES_KEY = 'placemaking_upvotes';

describe('voting on an imagination', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('adds an upvote and records the standing vote', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });

    const result = await voteImagination(id, 'up');

    expect(result).toEqual({ upvotes: 1, myVote: 'up' });
    await expect(readMyVote(id)).resolves.toBe('up');
  });

  it('withdraws a vote when the same direction is pressed again', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });
    await voteImagination(id, 'up');

    const result = await voteImagination(id, 'up');

    expect(result).toEqual({ upvotes: 0, myVote: null });
    await expect(readMyVote(id)).resolves.toBeNull();
  });

  it('switches from up to down in one move, a swing of two', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });
    await voteImagination(id, 'up');

    const result = await voteImagination(id, 'down');

    expect(result).toEqual({ upvotes: -1, myVote: 'down' });
  });

  it('is null for an imagination that is not there', async () => {
    await expect(voteImagination('missing', 'up')).resolves.toBeNull();
  });

  it('has no standing vote before one is cast', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });

    await expect(readMyVote(id)).resolves.toBeNull();
  });

  it('is included in a data export, and erased along with everything else', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });
    await voteImagination(id, 'up');

    const { data } = await exportAllData();
    expect(data[UPVOTES_KEY]).toEqual({ [id]: 'up' });

    await eraseAllData();
    expect(localStorage.getItem(UPVOTES_KEY)).toBeNull();
  });
});

describe('commenting on an imagination', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('adds a comment and reads it back', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });

    const saved = await addComment(id, { text: 'Nice idea', author: 'Mara Quinn' });
    const all = await readComments(id);

    expect(saved).toMatchObject({ text: 'Nice idea', author: 'Mara Quinn' });
    expect(all).toEqual([saved]);
  });

  it('credits an unnamed comment to Anonymous', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });

    const saved = await addComment(id, { text: 'Nice idea' });

    expect(saved.author).toBe('Anonymous');
  });

  it('is nothing for an imagination with no comments yet', async () => {
    const { id } = await saveImagination({ title: 'Pocket park' });

    await expect(readComments(id)).resolves.toEqual([]);
  });

  it('is nothing for an imagination that is not there', async () => {
    await expect(readComments('missing')).resolves.toEqual([]);
  });
});

/*
 * The imagination somebody is in the middle of making, parked while they go and sign in.
 * It carries a description they wrote and a photograph of a real street, so it is
 * personal data sitting in the browser like any other — which means the GDPR controls
 * have to reach it, and it must not outlive its purpose.
 */
const PENDING_KEY = 'placemaking_pending_imagination';

const PENDING = {
  capturedView: { position: { lat: 51.5, lng: -0.12 }, screenshot: 'data:image/jpeg;base64,x' },
  canvasAssets: [{ id: 'a1' }],
  draft: { title: 'Pocket park', cat: 'green', blurb: 'Trees instead of asphalt.' },
  preview: 'data:image/jpeg;base64,y',
};

describe('the imagination parked while somebody signs in', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('comes back the way it went in', async () => {
    await savePendingImagination(PENDING);

    const restored = await readPendingImagination();

    expect(restored).toMatchObject(PENDING);
  });

  it('is nothing when none was parked', async () => {
    await expect(readPendingImagination()).resolves.toBeNull();
  });

  it('is nothing once cleared', async () => {
    await savePendingImagination(PENDING);

    await clearPendingImagination();

    await expect(readPendingImagination()).resolves.toBeNull();
  });

  it('is refused when there is no capture to restore', async () => {
    // A Post step with no imagination on it would be worse than starting again.
    localStorage.setItem(PENDING_KEY, JSON.stringify({ draft: PENDING.draft }));

    await expect(readPendingImagination()).resolves.toBeNull();
  });

  it('survives an unparseable record without throwing', async () => {
    localStorage.setItem(PENDING_KEY, 'not json');

    await expect(readPendingImagination()).resolves.toBeNull();
  });

  it('is dropped once it is a day old, rather than sprung on somebody later', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...PENDING, stashedAt: twoDaysAgo }));

    await expect(readPendingImagination()).resolves.toBeNull();
    // And not left behind taking up a share of a few megabytes.
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('is included in a data export', async () => {
    await savePendingImagination(PENDING);

    const { data } = await exportAllData();

    expect(data[PENDING_KEY]).toMatchObject({ draft: { title: 'Pocket park' } });
  });

  it('is erased along with everything else', async () => {
    await savePendingImagination(PENDING);
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();

    await eraseAllData();

    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});
