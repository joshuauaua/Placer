/* PLACER — what any address the app does not know shows, inside the usual nav bar
 * and footer.
 *
 * One large card in purple with overlapping circles in its
 * deeper steps, the same as the dashboard's Getting Started cards (LayeredCircles),
 * saying the page is not there and offering the way back: the dashboard for somebody
 * signed in, the home page for anybody else, and Explore for either.
 */

import { Btn } from './UI';
import { LayeredCircles } from './LayeredCircles';
import { PALETTE } from '../theme';

const HUE = PALETTE.purple;

export function NotFoundPage({ t, signedIn, onNavigate }) {
  return (
    <div className="placer-not-found" style={{ background: t.page }}>
      <section aria-labelledby="not-found-heading"
        style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate', maxWidth: 1200,
          margin: '0 auto', minHeight: 'min(560px, 70vh)', borderRadius: 16, background: HUE.c50,
          color: t.ink }}>
        <LayeredCircles hue={HUE} scale={1.6} />
        <div className="placer-not-found-body" style={{ position: 'relative', maxWidth: 560 }}>
          <p className="placer-caption" style={{ textTransform: 'uppercase', letterSpacing: '0.08em',
            fontWeight: 700, marginBottom: 12 }}>
            Error 404
          </p>
          <h1 id="not-found-heading" className="placer-disp" style={{ fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            This page does not exist
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, marginTop: 16, maxWidth: 440 }}>
            The link may be old, or the address mistyped. Nothing has been lost; it is just
            not here.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
            {signedIn
              ? <Btn t={t} variant="primary" onClick={() => onNavigate('dashboard')}>Go to your dashboard</Btn>
              : <Btn t={t} variant="primary" onClick={() => onNavigate('welcome')}>Go to the home page</Btn>}
            <Btn t={t} variant="outline" icon="pin" onClick={() => onNavigate('map')}>Explore the map</Btn>
          </div>
        </div>
      </section>
    </div>
  );
}

export default NotFoundPage;
