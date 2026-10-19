import { describe, it, expect } from 'vite-plus/test';
import { arrangeSections, layoutFor, projectIntro, projectSections } from '../projectSections';
import { findTool } from '../../toolkit/tools';

const PROJECT = { summary: 'A park on the old rail line.', description: 'Ask who uses it.', gallery: [] };
const poll = (id, question) => ({ id, tool: 'open-vote', config: { question } });

describe('projectIntro', () => {
  it('puts the description first and the goals after it', () => {
    expect(projectIntro(PROJECT)).toEqual({ intro: 'A park on the old rail line.', goals: 'Ask who uses it.' });
  });

  it('shows the goals in its place for a project with no description', () => {
    expect(projectIntro({ summary: '', description: 'Ask who uses it.' })).toEqual({ intro: 'Ask who uses it.', goals: '' });
  });
});

describe('projectSections', () => {
  it('lists the project\'s own sections, then a section per live tool', () => {
    const sections = projectSections({
      project: { ...PROJECT, gallery: [{ path: 'gallery/p/1.webp', url: 'u' }] },
      tools: [findTool('open-vote')],
      openRooms: [poll('room-1', 'Car-free?')],
    });
    expect(sections.map(({ key }) => key)).toEqual(['about', 'goals', 'photos', 'room:room-1']);
    expect(sections.map(({ defaultTitle }) => defaultTitle))
      .toEqual(['About the project', 'Goals', 'Photos', 'We want your opinion']);
  });

  it('leaves out what is not there: no goals, no photos, a tool with no open room', () => {
    const sections = projectSections({ project: { description: 'Only goals.' }, tools: [findTool('open-vote')] });
    expect(sections.map(({ key }) => key)).toEqual(['about']);
  });

  it('gives each of several rooms of one tool a section, told apart by its label', () => {
    const sections = projectSections({
      project: {}, tools: [findTool('open-vote')],
      openRooms: [poll('room-1', 'Car-free?'), poll('room-2', 'More benches?')],
    });
    expect(sections.map(({ key, defaultTitle }) => [key, defaultTitle])).toEqual([
      ['room:room-1', 'We want your opinion: Car-free?'],
      ['room:room-2', 'We want your opinion: More benches?'],
    ]);
  });
});

describe('arrangeSections', () => {
  const sections = projectSections({
    project: PROJECT, tools: [findTool('open-vote')], openRooms: [poll('room-1', 'Car-free?')],
  });

  it('keeps the default order and titles with no layout', () => {
    expect(arrangeSections(sections, []).map(({ key, title }) => [key, title])).toEqual([
      ['about', 'About the project'], ['goals', 'Goals'], ['room:room-1', 'We want your opinion'],
    ]);
  });

  it('puts the sections in the layout\'s order, under its titles', () => {
    const arranged = arrangeSections(sections, [
      { key: 'room:room-1', title: 'Should the square be car-free?' }, { key: 'about' }, { key: 'goals', title: '  ' },
    ]);
    expect(arranged.map(({ key, title }) => [key, title])).toEqual([
      ['room:room-1', 'Should the square be car-free?'], ['about', 'About the project'], ['goals', 'Goals'],
    ]);
  });

  it('puts sections the layout does not name after the rest, and passes over ones that have gone', () => {
    const arranged = arrangeSections(sections, [{ key: 'room:closed', title: 'Old poll' }, { key: 'goals' }]);
    expect(arranged.map(({ key }) => key)).toEqual(['goals', 'about', 'room:room-1']);
  });

  it('shrugs off a layout that is not a list of entries', () => {
    expect(arrangeSections(sections, null).map(({ key }) => key)).toEqual(['about', 'goals', 'room:room-1']);
    expect(arrangeSections(sections, [null, 7, { key: 3 }]).map(({ key }) => key))
      .toEqual(['about', 'goals', 'room:room-1']);
  });
});

describe('layoutFor', () => {
  it('saves every section in order, with a title only where it is not the default', () => {
    const arranged = arrangeSections(
      projectSections({ project: PROJECT, tools: [findTool('open-vote')], openRooms: [poll('room-1', 'Car-free?')] }),
      [{ key: 'room:room-1', title: ' Car-free? ' }, { key: 'goals', title: 'Goals' }],
    );
    expect(layoutFor(arranged)).toEqual([{ key: 'room:room-1', title: 'Car-free?' }, { key: 'goals' }, { key: 'about' }]);
  });
});
