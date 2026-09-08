/* PLACER — shared UI primitives */

import { Icon } from './Icon';
import { CAT } from '../theme';

export function Logo({ t, size = 22 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: size * 1.25, height: size * 1.25, background: t.accent, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.accentInk }}>
        <Icon name="pin" size={size * 0.82} stroke={2.2} />
      </div>
      <span className="placer-disp" style={{ fontSize: size * 1.15, fontWeight: 800, letterSpacing: '-0.02em', color: t.ink }}>PLACER</span>
    </div>
  );
}

const AV_COLORS = ['#3E9D4E', '#E08A2B', '#D4407E', '#7A52E0', '#2F7BD6', '#D6452F', '#16766B'];

export function Avatar({ name = '', size = 34, ring }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const color = AV_COLORS[(name.charCodeAt(0) + name.length) % AV_COLORS.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
      fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: size * 0.4,
      boxShadow: ring ? `0 0 0 2px ${ring}` : 'none' }}>{initials}</div>
  );
}

export function Btn({ t, children, variant = 'primary', icon, size = 'md', style, full, onClick, disabled, ariaLabel, title, iconStyle }) {
  const sizes = { sm: { h: 34, px: 14, fs: 13.5 }, md: { h: 42, px: 18, fs: 15 }, lg: { h: 50, px: 24, fs: 16.5 } };
  const z = sizes[size];
  const variants = {
    primary: { background: t.primaryBg, color: t.primaryFg, border: '1px solid transparent' },
    accent:  { background: t.accent, color: t.accentInk, border: '1px solid transparent' },
    outline: { background: 'transparent', color: t.ink, border: `1.5px solid ${t.lineStrong}` },
    ghost:   { background: 'transparent', color: t.ink, border: '1px solid transparent' },
  };
  return (
    <button disabled={disabled} onClick={onClick} aria-label={ariaLabel} title={title ?? ariaLabel}
      style={{ height: z.h, padding: `0 ${z.px}px`, borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: full ? '100%' : 'auto',
      fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: z.fs, letterSpacing: '-0.01em',
      opacity: disabled ? 0.5 : 1,
      ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={z.fs + 3} stroke={2.1} style={iconStyle} />}
      {children}
    </button>
  );
}

export function CatTag({ cat, t, size = 'md', solid }) {
  const c = CAT[cat];
  if (!c) return null;
  const z = size === 'sm' ? { fs: 11, py: 3, px: 8, ic: 12 } : { fs: 12.5, py: 5, px: 11, ic: 14 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: `${z.py}px ${z.px}px`,
      borderRadius: 999, fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: z.fs, letterSpacing: '-0.01em',
      background: solid ? c.color : (t.mapMode === 'dark' ? 'rgba(255,255,255,.08)' : c.color + '1A'),
      color: solid ? '#fff' : c.color }}>
      <Icon name={c.icon} size={z.ic} stroke={2.2} />
      {c.label}
    </span>
  );
}

export function Chip({ t, children, active, color, icon, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px',
      borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
      fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.01em',
      border: active ? `1.5px solid ${color || t.ink}` : `1.5px solid ${t.line}`,
      background: active ? (color ? color + '18' : t.surfaceAlt) : 'transparent',
      color: active ? (color || t.ink) : t.inkDim }}>
      {icon && (color
        ? <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
        : <Icon name={icon} size={15} stroke={2} />)}
      {children}
    </button>
  );
}

export function Vote({ t, count, voted, size = 'md', rank }) {
  const z = size === 'lg' ? { w: 64, fs: 22, ic: 22, rfs: 12 } : size === 'sm' ? { w: 40, fs: 14, ic: 16, rfs: 9 } : { w: 52, fs: 18, ic: 19, rfs: 11 };
  return (
    <div style={{ width: z.w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: size === 'lg' ? '10px 0' : '6px 0', borderRadius: 10, flex: '0 0 auto',
      border: `1.5px solid ${voted ? t.accent : t.line}`,
      background: voted ? (t.mapMode === 'dark' ? 'rgba(215,251,54,.1)' : t.accent + '22') : 'transparent' }}>
      <Icon name="arrowUp" size={z.ic} stroke={2.4} style={{ color: voted ? (t.mapMode === 'dark' ? t.accent : t.ink) : t.ink }} />
      <span className="placer-disp" style={{ fontSize: z.fs, fontWeight: 800, color: t.ink, lineHeight: 1 }}>{count}</span>
      {rank && <span className="placer-mono" style={{ fontSize: z.rfs, color: t.inkDim, marginTop: 2 }}>{rank}</span>}
    </div>
  );
}

export function SearchBar({ t, value, placeholder, width = '100%' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, width, padding: '0 14px',
      borderRadius: 10, border: `1.5px solid ${t.line}`, background: t.surface, color: t.ink }}>
      <Icon name="search" size={19} stroke={2} style={{ color: t.inkDim }} />
      <span style={{ flex: 1, fontFamily: "'Archivo', sans-serif", fontSize: 15, fontWeight: value ? 600 : 400,
        color: value ? t.ink : t.inkDim, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {value || placeholder}
      </span>
    </div>
  );
}
