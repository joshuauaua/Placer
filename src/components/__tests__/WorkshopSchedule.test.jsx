import { describe, it, expect } from 'vite-plus/test';
import { workshopSchedule } from '../WorkshopSchedule';
import { findTool } from '../../toolkit/tools';

const POLL = findTool('open-vote');
const NOW = new Date(2026, 10, 5, 12, 0);
const at = (day, hour) => new Date(2026, 10, day, hour, 0).toISOString();
const SECTION = { key: 'room:r-now', tool: POLL, room: { id: 'r-now', expiresAt: at(5, 14) } };

describe('workshopSchedule', () => {
  it("lists what finished today, what is on now, then what comes next, leaving out other days' and other tools'", () => {
    const items = workshopSchedule({
      now: NOW,
      sections: [SECTION],
      tools: new Set(['open-vote']),
      schedule: [
        { id: 'r-yesterday', tool: 'open-vote', status: 'expired', opensAt: at(4, 10), closesAt: at(4, 12) },
        { id: 'r-later', tool: 'open-vote', status: 'scheduled', opensAt: at(5, 15), closesAt: at(5, 17) },
        { id: 'r-now', tool: 'open-vote', status: 'open', opensAt: at(5, 11), closesAt: at(5, 14) },
        { id: 'r-morning', tool: 'open-vote', status: 'closed', opensAt: at(5, 9), closesAt: at(5, 10) },
        { id: 'r-page', tool: 'dream-it', status: 'open', opensAt: at(5, 9), closesAt: at(5, 14) },
      ],
    });

    expect(items.map(({ key, state, sectionKey }) => [key, state, sectionKey])).toEqual([
      ['room:r-morning', 'done', null],
      ['room:r-now', 'now', 'room:r-now'],
      ['room:r-later', 'next', null],
    ]);
  });

  it('lists only what is on now when the schedule could not be read', () => {
    const items = workshopSchedule({ now: NOW, sections: [SECTION], tools: new Set(['open-vote']), schedule: null });

    expect(items).toEqual([{ key: 'room:r-now', tool: POLL, state: 'now', opensAt: null, closesAt: at(5, 14),
      sectionKey: 'room:r-now' }]);
  });
});
