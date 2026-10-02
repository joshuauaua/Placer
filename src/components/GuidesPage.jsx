/* PLACER — Guides Page
 *
 * How-tos for PLACER itself, laid out like Resources (ResourceIndex). None has an
 * article behind it yet, so the cards do not open.
 */

import { ResourceIndex } from './ResourcesPage';

const GUIDES = [
  {
    id: 1,
    title: 'Getting Started with PLACER',
    excerpt: 'Create an account, find your neighbourhood on the map, and see what people have imagined nearby.',
    image: { bg: '#C6DEF8', icon: 'pin' },
    tags: ['Basics'],
    readTime: '3 min read'
  },
  {
    id: 2,
    title: 'Imagining a Street',
    excerpt: 'Pick a spot on the map, step into the street view, and place benches, trees and planters to show what could be.',
    image: { bg: '#DDD2FA', icon: 'bench' },
    tags: ['Imagine', 'Basics'],
    readTime: '5 min read'
  },
  {
    id: 3,
    title: 'Describing and Posting Your Idea',
    excerpt: 'Give your imagination a title and a story, then post it to the map for others to see and vote on.',
    image: { bg: '#FFD9B8', icon: 'pencil' },
    tags: ['Imagine'],
    readTime: '4 min read'
  },
  {
    id: 4,
    title: 'Setting Up a Project',
    excerpt: 'Gather ideas, research and feedback for one place on a dedicated project page that anyone can follow.',
    image: { bg: '#C6DEF8', icon: 'flag' },
    tags: ['Plan'],
    readTime: '6 min read'
  },
  {
    id: 5,
    title: 'Running a Session with the Toolkit',
    excerpt: 'Use the Toolkit’s tools to run polls, map how a space is used, and collect input in a workshop.',
    image: { bg: '#DDD2FA', icon: 'flask' },
    tags: ['Understand', 'Workshops'],
    readTime: '7 min read'
  },
  {
    id: 6,
    title: 'Working as an Organisation',
    excerpt: 'Create an organisation, invite fellow admins, and run projects in its name.',
    image: { bg: '#FFD9B8', icon: 'building' },
    tags: ['Plan', 'Organisations'],
    readTime: '5 min read'
  },
];

export function GuidesPage({ t }) {
  return (
    <ResourceIndex
      t={t}
      title="Guides"
      intro="Step-by-step help for understanding, imagining and planning shared spaces with PLACER."
      noun="guides"
      posts={GUIDES}
      loadError={null}
    />
  );
}

export default GuidesPage;
