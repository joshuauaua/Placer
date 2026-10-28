import { describe, it, expect } from 'vite-plus/test';
import { inquiryAsActivity, mergeActivity } from '../activityFeed';

const INQUIRY = { id: 'q1', tool: 'desire-lines', title: 'Shortcut by the station', note: '', config: {},
  createdAt: '2026-10-01T10:00:00Z' };

describe('inquiryAsActivity', () => {
  it('reads as something you did, already read, linking to your profile', () => {
    const row = inquiryAsActivity(INQUIRY, 'user-1');
    expect(row).toMatchObject({
      id: 'inquiry-q1', title: 'You saved Shortcut by the station', icon: 'path',
      linkType: 'profile', linkId: 'user-1', createdAt: INQUIRY.createdAt, readAt: INQUIRY.createdAt,
    });
    expect(row.body).toContain('Desire Lines');
  });

  it('links nowhere without an account, and copes with a tool that no longer exists', () => {
    const row = inquiryAsActivity({ ...INQUIRY, tool: 'retired-tool' });
    expect(row).toMatchObject({ linkType: null, icon: 'flask', body: 'retired-tool' });
  });
});

describe('mergeActivity', () => {
  const note = (id, createdAt) => ({ id, title: id, createdAt, readAt: null });

  it('puts everything newest first, and keeps only the first few when asked', () => {
    const merged = mergeActivity([note('a', '2026-10-20T10:00:00Z'), note('b', '2026-09-01T10:00:00Z')],
      [INQUIRY], 'user-1');
    expect(merged.map((row) => row.id)).toEqual(['a', 'inquiry-q1', 'b']);
    expect(mergeActivity([note('a', '2026-10-20T10:00:00Z')], [INQUIRY], 'user-1', 1).map((row) => row.id))
      .toEqual(['a']);
  });
});
