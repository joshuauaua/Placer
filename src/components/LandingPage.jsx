/* PLACER — landing page
 *
 * The holding page for the project: what it is, who is building it, and who
 * funds it. Shown as the home view only, with the nav bar hidden (see App.jsx).
 */

import logoAks from '../assets/logo-aks.png';
import logoStpln from '../assets/logo-stpln.png';
import logoSwedishInstitute from '../assets/logo-swedish-institute.png';

// Trimmed to their artwork and stored at 160px tall, so a height here is enough
// to size them and the widths stay in proportion.
const PARTNER_HEIGHT = 32;
const FUNDER_HEIGHT = 52;

export function LandingPage({ t }) {
  return (
    // margin:auto on the child rather than justify-content, so content taller
    // than the viewport scrolls from the top instead of being clipped there.
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', background: t.page }}>
      <div style={{ margin: 'auto', maxWidth: 620, padding: '64px 24px', textAlign: 'center' }}>
        <h1 className="placer-disp" style={{
          fontSize: 64,
          fontWeight: 900,
          color: t.ink,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          marginBottom: 14
        }}>
          PLACER
        </h1>

        <p style={{ fontSize: 19, color: t.inkDim, marginBottom: 40 }}>
          a tool for participatory placemaking
        </p>

        <p style={{ fontSize: 17, color: t.ink, lineHeight: 1.7, marginBottom: 64 }}>
          PLACER is built to strengthen participatory placemaking and democratic urban
          development through digital innovation and international cooperation. The
          initiative will develop an interactive digital placemaking tool and resource
          platform that enables citizens, cultural practitioners, and municipal
          stakeholders to collaborate in shaping more inclusive public spaces.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
          flexWrap: 'wrap',
          marginBottom: 72
        }}>
          <img src={logoAks} alt="Aks Creative Hub" style={{ height: PARTNER_HEIGHT, width: 'auto' }} />
          <img src={logoStpln} alt="STPLN" style={{ height: PARTNER_HEIGHT, width: 'auto' }} />
        </div>

        {/* The lockup reads "Funded by Swedish Institute" as part of the artwork. */}
        <img
          src={logoSwedishInstitute}
          alt="Funded by Swedish Institute"
          style={{ height: FUNDER_HEIGHT, width: 'auto' }}
        />
      </div>
    </div>
  );
}

export default LandingPage;
