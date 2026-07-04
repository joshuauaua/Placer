/* PLOT — About Page */

import { Icon } from './Icon';

export function AboutPage({ t }) {
  const partnerLogos = [
    { name: 'Partner 1', color: '#3E9D4E' },
    { name: 'Partner 2', color: '#E08A2B' },
    { name: 'Partner 3', color: '#D4407E' },
    { name: 'Partner 4', color: '#7A52E0' },
    { name: 'Partner 5', color: '#2F7BD6' },
  ];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.page,
      overflowY: 'auto',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: 800, width: '100%' }}>
        {/* Hero Image */}
        <div style={{
          width: '100%',
          height: 400,
          background: `linear-gradient(135deg, ${t.accent}33 0%, ${t.accent}66 100%)`,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 48,
          border: `1px solid ${t.line}`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            width: 120,
            height: 120,
            background: t.accent,
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }}>
            <Icon name="pin" size={70} stroke={2.4} style={{ color: t.accentInk }} />
          </div>

          {/* Decorative elements */}
          <div style={{
            position: 'absolute',
            top: 60,
            left: 80,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: `${t.accent}40`,
            filter: 'blur(2px)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: 80,
            right: 100,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `${t.accent}40`,
            filter: 'blur(2px)'
          }} />
        </div>

        {/* Text Content */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h1 className="plot-disp" style={{
            fontSize: 56,
            fontWeight: 900,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 24,
            lineHeight: 1.1
          }}>
            About PLOT
          </h1>

          <p style={{
            fontSize: 20,
            color: t.inkDim,
            lineHeight: 1.7,
            marginBottom: 24,
            maxWidth: 680,
            margin: '0 auto 24px'
          }}>
            PLOT is a community-driven platform that empowers citizens to reimagine and reshape their urban environments.
            We believe everyone should have a voice in how public spaces evolve.
          </p>

          <p style={{
            fontSize: 20,
            color: t.inkDim,
            lineHeight: 1.7,
            maxWidth: 680,
            margin: '0 auto'
          }}>
            By combining interactive mapping, visual asset placement, and community feedback, PLOT makes urban planning
            accessible and collaborative. From street trees to public art, benches to bike lanes — visualize improvements
            and bring your ideas to life.
          </p>
        </div>

        {/* Mission Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
          marginBottom: 80
        }}>
          <div style={{
            padding: 32,
            background: t.surface,
            borderRadius: 12,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadow
          }}>
            <Icon name="users" size={36} stroke={2} style={{ color: t.accent, marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
              Community First
            </h3>
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
              Built by and for communities who care about their neighborhoods
            </p>
          </div>

          <div style={{
            padding: 32,
            background: t.surface,
            borderRadius: 12,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadow
          }}>
            <Icon name="eye" size={36} stroke={2} style={{ color: t.accent, marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
              Visual Impact
            </h3>
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
              See changes before they happen with realistic visualizations
            </p>
          </div>

          <div style={{
            padding: 32,
            background: t.surface,
            borderRadius: 12,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadow
          }}>
            <Icon name="zap" size={36} stroke={2} style={{ color: t.accent, marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
              Real Change
            </h3>
            <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6 }}>
              Turn community visions into actionable proposals for local government
            </p>
          </div>
        </div>

        {/* Partner Logos */}
        <div style={{
          padding: 40,
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.line}`,
          textAlign: 'center'
        }}>
          <div className="plot-mono" style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: t.inkDim,
            textTransform: 'uppercase',
            marginBottom: 32,
            fontWeight: 600
          }}>
            Supported By
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 48,
            flexWrap: 'wrap'
          }}>
            {partnerLogos.map((partner, i) => (
              <div key={i} style={{
                width: 100,
                height: 60,
                background: partner.color,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                padding: 12,
                opacity: 0.9,
                transition: 'opacity 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.9}>
                {partner.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
