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
          a toolkit for participatory placemaking
        </p>

        <p style={{ fontSize: 17, color: t.ink, lineHeight: 1.7, marginBottom: 20 }}>
          PLACER is an interactive platform that empowers citizens, design
          practitioners, and municipal stakeholders to co-create more inclusive,
          democratic public spaces.
        </p>

        <p style={{ fontSize: 17, color: t.ink, lineHeight: 1.7, marginBottom: 56 }}>
          By bridging community vision with urban design, PLACER provides tools and
          shared resources to make citymaking collaborative, accessible, and
          transparent.
        </p>

        {/* The partner and funder logos below stand as the visual half of this
          * section, so the heading introduces both the prose and the artwork. */}
        <h2 className="placer-mono" style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: t.inkFaint,
          borderTop: `1px solid ${t.line}`,
          paddingTop: 28,
          marginBottom: 16
        }}>
          About the Initiative
        </h2>

        <p style={{ fontSize: 15.5, color: t.inkDim, lineHeight: 1.7, marginBottom: 48 }}>
          PLACER is developed through an international collaboration between STPLN and
          Aks Ankara, funded by the Swedish Institute as part of the Participatory
          Urban Design Toolkit for Inclusive and Democratic Citymaking project.
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
