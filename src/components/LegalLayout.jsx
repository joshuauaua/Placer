/* PLACER — layout primitives shared by the legal page (terms, privacy, GDPR) */

import { Icon } from './Icon';
import { LAST_UPDATED } from '../legal';

export function LegalPage({ t, title, intro, children }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '48px 40px 96px'
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: `1px solid ${t.line}` }}>
          <div className="placer-mono" style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: t.inkDim,
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 16
          }}>
            Last updated {LAST_UPDATED}
          </div>
          <h1 className="placer-disp" style={{
            fontSize: 48,
            fontWeight: 900,
            color: t.ink,
            letterSpacing: '-0.03em',
            marginBottom: 16,
            lineHeight: 1.1
          }}>
            {title}
          </h1>
          <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6 }}>
            {intro}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

// A chapter groups several Sections under one of the three bodies of text this
// page carries (Terms of Service, Privacy Policy, GDPR). It sits above Section
// in the heading hierarchy, so Section renders an h3 rather than an h2.
export function Chapter({ t, title }) {
  return (
    <h2 className="placer-disp" style={{
      fontSize: 32,
      fontWeight: 900,
      color: t.ink,
      letterSpacing: '-0.02em',
      marginTop: 56,
      marginBottom: 24,
      paddingTop: 32,
      borderTop: `1px solid ${t.line}`
    }}>
      {title}
    </h2>
  );
}

export function Section({ t, title, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h3 style={{
        fontSize: 22,
        fontWeight: 800,
        color: t.ink,
        letterSpacing: '-0.01em',
        marginBottom: 12
      }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function P({ t, children, style }) {
  return (
    <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.7, marginBottom: 12, ...style }}>
      {children}
    </p>
  );
}

export function Bullets({ t, items }) {
  return (
    <ul style={{ margin: '0 0 12px', padding: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: 'flex',
          gap: 10,
          fontSize: 16,
          color: t.inkDim,
          lineHeight: 1.7,
          marginBottom: 8
        }}>
          <span style={{ color: t.inkFaint, flex: '0 0 auto', marginTop: 1 }}>—</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ t, icon, title, children }) {
  return (
    <div style={{
      padding: 24,
      background: t.surface,
      borderRadius: 12,
      border: `1px solid ${t.line}`,
      boxShadow: t.shadow,
      marginBottom: 40
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {icon && <Icon name={icon} size={20} stroke={2} style={{ color: t.accent }} />}
        <div style={{ fontSize: 16, fontWeight: 700, color: t.ink }}>{title}</div>
      </div>
      <div style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

export function Table({ t, columns, rows }) {
  return (
    <div style={{
      border: `1px solid ${t.line}`,
      borderRadius: 12,
      overflowX: 'auto',
      marginBottom: 12,
      background: t.surface
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 480 }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col} className="placer-mono" style={{
                textAlign: 'left',
                padding: '12px 16px',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: t.inkDim,
                background: t.surfaceAlt,
                borderBottom: `1px solid ${t.line}`
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '14px 16px',
                  color: j === 0 ? t.ink : t.inkDim,
                  fontWeight: j === 0 ? 600 : 400,
                  lineHeight: 1.6,
                  verticalAlign: 'top',
                  borderTop: i === 0 ? 'none' : `1px solid ${t.line}`
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExternalLink({ t, href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: t.ink, fontWeight: 600, textDecoration: 'underline' }}
    >
      {children}
    </a>
  );
}

export function PageLink({ t, onClick, children }) {
  return (
    <span
      onClick={onClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{ color: t.ink, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
    >
      {children}
    </span>
  );
}
