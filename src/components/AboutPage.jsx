/* PLACER — About Page
 *
 * The page is the project poster and nothing else. The wordmark, the description
 * and the credit line are all part of the artwork, so the alt text carries the
 * illustration.
 */

import aboutPoster from '../assets/about-placer.jpg';

export function AboutPage({ t }) {
  return (
    // Scrolls from the top rather than centring vertically: the poster is taller
    // than most viewports, and a centred flex child overflows past the top edge
    // where it cannot be scrolled back into view.
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '40px 20px'
    }}>
      <img
        src={aboutPoster}
        alt="PLACER — a tool for participatory placemaking. An isometric line drawing of a street: crowd barriers, a bench, a person carrying a planter beside a dog, potted plants, a bicycle, a bollard and a traffic light, laid over a faint plan grid."
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 800,
          height: 'auto',
          margin: '0 auto',
          borderRadius: 12
        }}
      />
    </div>
  );
}

export default AboutPage;
