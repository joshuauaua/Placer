import { describe, it, expect, afterEach } from 'vite-plus/test';
import { exportAllData, eraseAllData } from '../api';
import { saveProfile } from '../profile';

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
