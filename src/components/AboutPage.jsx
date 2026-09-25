/* PLACER — About Page
 *
 * Top to bottom: a User Labs photo beside the pitch (PhotoSplit, as on User
 * Labs), three things PLACER lets you do (understand, imagine, plan), two photo-and-text rows on how it is
 * being built, and the team and partners behind it. The geometry lives in index.css
 * (.placer-about-*), since the rows rearrange on a phone and a media query cannot
 * override an inline style.
 */

import malmoPhoto from '../assets/about-malmo.jpg';
import teamPhoto from '../assets/about-team.jpg';
import logoAks from '../assets/logo-aks.png';
import logoStpln from '../assets/logo-stpln.png';
import logoSwedishInstitute from '../assets/logo-swedish-institute.png';
import placemakingTrendsPhoto from '../assets/placemaking-trends-cover.webp';
import streetBench from '../assets/street-bench.png';
import streetBicycle from '../assets/street-bicycle.png';
import streetPlanter from '../assets/street-planter-trough.png';
import userLabsPhoto from '../assets/user-labs.webp';
import { PhotoSplit, PhotoSplitHeading } from './PhotoSplit';

const PILLARS = [
  {
    image: streetBench,
    title: 'Understand',
    body: 'Find the right approach to gather meaningful feedback, from interactive polls and surveys to digital adaptations of methodologies by leading design studios.',
  },
  {
    image: streetPlanter,
    title: 'Imagine',
    body: 'Every built space around us was once an idea. Intuitive spatial visualization tools allow anyone to quickly transform ideas into clear visual concepts.',
  },
  {
    image: streetBicycle,
    title: 'Plan',
    body: 'Bring everything together on a dedicated project page. Research, community ideas, and interactive outputs are displayed in one transparent space—creating a living repository for your placemaking journey.',
  },
];

const FEATURES = [
  {
    image: placemakingTrendsPhoto,
    alt: 'A deck of cards clipped to a plywood board beside a street map dotted with pins, from a workshop.',
    kicker: 'User Labs',
    title: 'Built with the people who will use it',
    body: [
      'PLACER is tested on the streets of Malmö, Ankara, and beyond. In our User Labs, residents, designers, and local leaders test early versions of the toolkit, telling us what works and what doesn’t.',
      'What we learn in each session directly shapes what we build next.',
    ],
  },
  {
    image: malmoPhoto,
    alt: 'A small group talking on a sunny street in Malmö, beside red-brick buildings and a large tree.',
    kicker: 'Research',
    title: 'Grounded in how cities work today',
    body: [
      'Alongside the toolkit, we are surveying city officials and urban planners globally to understand how they engage citizens in public space development today—and where the greatest opportunities for improvement lie.',
      'The findings feed into our Placemaking Trends 2026/2027 Report, available May 2027.',
    ],
  },
];

const PARTNERS = [
  { src: logoStpln, alt: 'STPLN', href: 'https://stpln.se/' },
  { src: logoAks, alt: 'Ankara Aks', href: 'https://ankaraaks.com/' },
  { src: logoSwedishInstitute, alt: 'Funded by Swedish Institute', href: null },
];

function Kicker({ t, children }) {
  return (
    <div className="placer-mono" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: t.inkDim, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function SectionTitle({ t, children }) {
  return (
    <h2 className="placer-disp" style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 700,
      letterSpacing: '-0.03em', lineHeight: 1.1, color: t.ink }}>
      {children}
    </h2>
  );
}

export function AboutPage({ t }) {
  return (
    <div className="placer-about" style={{ width: '100%', background: t.page }}>
      <PhotoSplit
        t={t}
        src={userLabsPhoto}
        alt="People at a User Labs session pinning notes to a map and sketching on wooden boards outdoors."
      >
        <PhotoSplitHeading
          t={t}
          title="About PLACER"
          subtitle="A toolkit for shaping shared spaces together."
        />
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
          Shared spaces belong to everyone who uses them, but the people who know
          them best are rarely the ones asked how they should change. PLACER gives
          residents, designers and local authorities one place to imagine, discuss and
          decide on the spaces they share.
        </p>
      </PhotoSplit>

      <section className="placer-about-section" style={{ borderTop: `1px solid ${t.line}` }}>
        <div className="placer-about-pillars" style={{ marginTop: 0 }}>
          {PILLARS.map(({ image, title, body }) => (
            <div key={title}>
              <div className="placer-about-pillar-art" style={{ background: t.surface, border: `1px solid ${t.line}` }}>
                <img src={image} alt="" />
              </div>
              <h3 className="placer-disp" style={{ marginTop: 20, fontSize: 21, fontWeight: 700,
                letterSpacing: '-0.02em', color: t.ink }}>
                {title}
              </h3>
              <p style={{ marginTop: 8, fontSize: 16, lineHeight: 1.6, color: t.inkDim }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {FEATURES.map(({ image, alt, kicker, title, body }, index) => (
        <section
          key={title}
          className={`placer-about-section placer-about-feature${index % 2 ? ' placer-about-feature-reverse' : ''}`}
          style={{ borderTop: `1px solid ${t.line}` }}
        >
          <div className="placer-about-feature-media">
            <img src={image} alt={alt} />
          </div>
          <div>
            <Kicker t={t}>{kicker}</Kicker>
            <SectionTitle t={t}>{title}</SectionTitle>
            {body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} style={{ marginTop: 16, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}

      <section className="placer-about-section" style={{ borderTop: `1px solid ${t.line}` }}>
        <img
          className="placer-about-team-photo"
          src={teamPhoto}
          alt="A Polaroid-style photo of the people behind PLACER gathered around a table at a restaurant, smiling towards the camera."
        />
        <Kicker t={t}>Who is behind it</Kicker>
        <SectionTitle t={t}>
          Made with <span role="img" aria-label="love">♥</span> in Malmö and Ankara
        </SectionTitle>
        <p style={{ marginTop: 16, maxWidth: 680, fontSize: 17, lineHeight: 1.65, color: t.inkDim }}>
          PLACER is developed by STPLN in Malmö and Ankara Aks in Ankara as part of
          Participatory Urban Design Toolkit for Democratic and Inclusive City-building,
          funded by the Swedish Institute.
        </p>
        <div className="placer-about-logos">
          {PARTNERS.map(({ src, alt, href }) => {
            const logo = <img src={src} alt={alt} />;
            return href ? (
              <a key={alt} href={href} target="_blank" rel="noopener noreferrer">{logo}</a>
            ) : (
              <span key={alt}>{logo}</span>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default AboutPage;
