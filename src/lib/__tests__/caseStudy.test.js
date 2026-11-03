import { describe, it, expect } from 'vite-plus/test';
import {
  CASE_STUDY_SOURCE, EMPTY_CASE_STUDY, caseStudyResponse, codeHashMatches, codeMatches, isValidUrl,
  validateCaseStudy,
} from '../caseStudy';

const COMPLETE = {
  ...EMPTY_CASE_STUDY,
  title: 'Folkets Park, redesigned',
  subtitle: 'Neighbours planned the new playground.',
  place: 'Malmö, Sweden',
  startDate: '2026-03',
  endDate: '2026-09',
  need: 'Nowhere to play in the shade.',
  approach: 'Three walks and a workshop.',
  audience: 'Families nearby.',
  funded: 'no',
  organisationName: 'STPLN',
  contactName: 'Ada',
  contactEmail: 'ada@example.org',
  consent: true,
};

// The real code is not written out here: the repository is public. These use another
// code, OPEN-SESAME, and its SHA-256, to check the comparison itself.
const TEST_HASH = '8ee19e5d0ae0d1d1f2a9e2b1f0fe4c1e2dd3e7d8a1c6a63d3c0a2e1ad3cf6b44';

describe('the case study code', () => {
  it('opens on the code, whatever its case or spacing', async () => {
    const hash = await sha256Hex('OPEN-SESAME');
    expect(await codeHashMatches('OPEN-SESAME', hash)).toBe(true);
    expect(await codeHashMatches('  open-sesame ', hash)).toBe(true);
  });

  it('stays shut on anything else', async () => {
    const hash = await sha256Hex('OPEN-SESAME');
    expect(await codeHashMatches('', hash)).toBe(false);
    expect(await codeHashMatches('OPEN', hash)).toBe(false);
    expect(await codeHashMatches('OPEN-SESAME', TEST_HASH)).toBe(false);
  });

  it('does not open the real form on a guess', async () => {
    expect(await codeMatches('OPEN-SESAME')).toBe(false);
    expect(await codeMatches('PLACER')).toBe(false);
  });
});

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('validateCaseStudy', () => {
  it('takes a complete case study', () => {
    expect(validateCaseStudy(COMPLETE, { hero: 'data:image/webp;base64,x' })).toBeNull();
  });

  it('asks for every required part of an empty one, the header picture included', () => {
    const problems = validateCaseStudy(EMPTY_CASE_STUDY);
    expect(Object.keys(problems)).toEqual(expect.arrayContaining([
      'title', 'subtitle', 'place', 'hero', 'startDate', 'need', 'approach', 'audience', 'funded',
      'organisationName', 'contactName', 'contactEmail', 'consent',
    ]));
  });

  it('asks who funded it only when it was funded', () => {
    expect(validateCaseStudy({ ...COMPLETE, funded: 'yes' }, { hero: 'x' })).toEqual({ funder: 'Say who funded it.' });
    expect(validateCaseStudy({ ...COMPLETE, funded: 'yes', funder: 'Swedish Institute' }, { hero: 'x' })).toBeNull();
  });

  it('will not end before it starts, unless it is still going on', () => {
    expect(validateCaseStudy({ ...COMPLETE, endDate: '2025-01' }, { hero: 'x' })).toHaveProperty('endDate');
    expect(validateCaseStudy({ ...COMPLETE, endDate: '2025-01', ongoing: true }, { hero: 'x' })).toBeNull();
  });

  it('checks the rows that were filled in, and skips the empty ones', () => {
    const problems = validateCaseStudy({
      ...COMPLETE,
      members: [{ name: '', role: '', email: '' }, { name: '', role: 'Designer', email: 'not-an-email' }],
      links: [{ label: 'Report', url: 'example.org' }],
    }, { hero: 'x' });
    expect(problems).toEqual({
      'members.1.name': 'Name the team member.',
      'members.1.email': 'That email does not look right.',
      'links.0.url': 'Enter a full web address, starting https://',
    });
  });
});

describe('caseStudyResponse', () => {
  it('saves it under its own source, with the contact email and the pictures', () => {
    const response = caseStudyResponse({
      ...COMPLETE,
      title: '  Folkets Park, redesigned ',
      organisationAccount: true,
      members: [{ name: 'Bo', role: '', email: '' }, { name: '', role: '', email: '' }],
    }, { hero: 'data:hero', images: ['data:one'] });

    expect(response).toMatchObject({
      source: CASE_STUDY_SOURCE,
      email: 'ada@example.org',
      title: 'Folkets Park, redesigned',
      dates: { start: '2026-03', end: '2026-09', ongoing: false },
      funding: { funded: 'no', funder: '', amount: '' },
      organisation: { name: 'STPLN', wantsAccount: true },
      members: [{ name: 'Bo', role: '', email: '' }],
      hero: 'data:hero',
      images: ['data:one'],
    });
  });

  it('keeps no end date for one that is still going on', () => {
    expect(caseStudyResponse({ ...COMPLETE, ongoing: true }).dates).toEqual({ start: '2026-03', end: null, ongoing: true });
  });
});

describe('isValidUrl', () => {
  it('takes web addresses only', () => {
    expect(isValidUrl('https://plcr.org/report')).toBe(true);
    expect(isValidUrl('plcr.org')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });
});
