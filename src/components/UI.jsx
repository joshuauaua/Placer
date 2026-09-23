/* PLACER — shared UI primitives */

import { useState } from 'react';
import { Icon } from './Icon';
import { copyText } from '../lib/clipboard';
import { CAT } from '../theme';

/**
 * Wordmark only — no bench badge. The favicon (see index.html) still carries the
 * bench drawing on its own; this is just the type everywhere PLACER's name is set
 * in the nav bar, the footer and JoinPage.
 */
export function Logo({ t, size = 22 }) {
  return (
    <span className="placer-disp" style={{ fontSize: size * 1.15, fontWeight: 800, letterSpacing: '-0.02em', color: t.ink }}>PLACER</span>
  );
}

const AV_COLORS = ['#3E9D4E', '#E08A2B', '#D4407E', '#7A52E0', '#2F7BD6', '#D6452F', '#16766B'];

/**
 * The predefined avatar library: a fixed set of icon names, already in Icon.jsx,
 * that a profile may pick instead of the initials Avatar falls back to. Kept as one
 * list so the picker in SettingsPage and the `avatar` column's check constraint in
 * supabase/auth.sql cannot drift apart — the SQL comment next to that constraint
 * says to keep this list in step with it.
 */
export const AVATAR_ICONS = [
  { key: 'user', label: 'Person' },
  { key: 'tree', label: 'Tree' },
  { key: 'bench', label: 'Bench' },
  { key: 'art', label: 'Art' },
  { key: 'play', label: 'Play' },
  { key: 'light', label: 'Lighting' },
  { key: 'cart', label: 'Market' },
  { key: 'sparkle', label: 'Sparkle' },
  { key: 'pin', label: 'Pin' },
  { key: 'walk', label: 'Walking' },
  { key: 'bike', label: 'Cycling' },
  { key: 'planter', label: 'Planter' },
];

export const AVATAR_ICON_KEYS = AVATAR_ICONS.map((option) => option.key);

// `icon` picks one of AVATAR_ICONS over the initials this used to always show. Same
// coloured circle either way, so switching between the two is a same-size swap.
export function Avatar({ name = '', size = 34, ring, icon }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const color = AV_COLORS[(name.charCodeAt(0) + name.length) % AV_COLORS.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
      fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: size * 0.4,
      boxShadow: ring ? `0 0 0 2px ${ring}` : 'none' }}>
      {icon ? <Icon name={icon} size={size * 0.52} stroke={2} /> : initials}
    </div>
  );
}

export const BTN_SIZES = {
  sm: { h: 34, px: 14, fs: 13.5 },
  md: { h: 42, px: 18, fs: 15 },
  lg: { h: 50, px: 24, fs: 16.5 },
};

export function Btn({ t, children, variant = 'primary', icon, size = 'md', style, full, onClick, onBlur,
  disabled, type, ariaLabel, ariaPressed, title, iconStyle }) {
  const z = BTN_SIZES[size];
  const variants = {
    primary: { background: t.primaryBg, color: t.primaryFg, border: '1px solid transparent' },
    accent:  { background: t.accent, color: t.accentInk, border: '1px solid transparent' },
    outline: { background: 'transparent', color: t.ink, border: `1.5px solid ${t.lineStrong}` },
    // The quieter outline the sandbox tools use: a button that has to sit beside a
    // diagram without competing with it.
    quiet:   { background: 'transparent', color: t.inkDim, border: `1.5px solid ${t.line}` },
    ghost:   { background: 'transparent', color: t.ink, border: '1px solid transparent' },
  };
  return (
    <button disabled={disabled} onClick={onClick} onBlur={onBlur} type={type}
      aria-label={ariaLabel} aria-pressed={ariaPressed} title={title ?? ariaLabel}
      style={{ height: z.h, padding: `0 ${z.px}px`, borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: full ? '100%' : 'auto',
      fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: z.fs, letterSpacing: '-0.01em',
      opacity: disabled ? 0.5 : 1,
      ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={z.fs + 3} stroke={2.1} style={iconStyle} />}
      {children}
    </button>
  );
}

/**
 * Copy something to the clipboard, and show it if the browser will not.
 *
 * The three-state `copied` is the whole point of this component: null before anybody
 * has pressed it, true once the text is on the clipboard, and false when the browser
 * refused — in which case the honest thing is to reveal the text and let somebody
 * copy it by hand. It resets itself whenever `value` changes, so a button cannot go
 * on claiming it copied something that has since been edited.
 *
 * `actions` sits beside the button, for anything belonging to the same row, matching
 * the slot of the same name on SandboxLayout.
 */
export function CopyButton({ t, value, label = 'Copy link', copiedLabel = 'Link copied', icon = 'link',
  variant = 'quiet', size = 'sm', fieldLabel, fieldWidth = '100%', multiline, actions, disabled, style }) {
  const [result, setResult] = useState({ value: null, copied: null });
  const copied = result.value === value ? result.copied : null;
  const field = {
    borderRadius: 8, border: `1.5px solid ${t.line}`, background: t.chrome, color: t.inkDim,
    fontFamily: "'Space Mono', monospace", fontSize: multiline ? 11.5 : 12,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn t={t} variant={variant} size={size} disabled={disabled}
          icon={copied ? 'check' : icon}
          onClick={async () => setResult({ value, copied: await copyText(value) })}>
          {copied ? copiedLabel : label}
        </Btn>
        {actions}
      </div>

      {copied === false && (multiline ? (
        <textarea readOnly value={value} aria-label={fieldLabel} rows={8}
          style={{ ...field, width: '100%', padding: 10, resize: 'vertical' }} />
      ) : (
        <input readOnly value={value} aria-label={fieldLabel}
          onFocus={(event) => event.target.select()}
          style={{ ...field, width: fieldWidth, maxWidth: '100%', height: BTN_SIZES[size].h, padding: '0 10px' }} />
      ))}
    </div>
  );
}

export function CatTag({ cat, t, size = 'md', solid }) {
  const c = CAT[cat];
  if (!c) return null;
  const z = size === 'sm' ? { fs: 11, py: 3, px: 8, ic: 12 } : { fs: 12.5, py: 5, px: 11, ic: 14 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: `${z.py}px ${z.px}px`,
      borderRadius: 999, fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: z.fs, letterSpacing: '-0.01em',
      background: solid ? c.color : (t.mapMode === 'dark' ? 'rgba(255,255,255,.08)' : c.color + '1A'),
      color: solid ? '#fff' : c.color }}>
      <Icon name={c.icon} size={z.ic} stroke={2.2} />
      {c.label}
    </span>
  );
}

export function Chip({ t, children, active, color, icon, dot, onClick, ariaPressed, title }) {
  return (
    <button onClick={onClick} aria-pressed={ariaPressed} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px',
      borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
      fontFamily: 'var(--placer-font)', fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.01em',
      border: active ? `1.5px solid ${color || t.ink}` : `1.5px solid ${t.line}`,
      background: active ? (color ? color + '18' : t.surfaceAlt) : 'transparent',
      color: active ? (color || t.ink) : t.inkDim }}>
      {/* `dot` asks for the colour as a swatch instead of the icon — what the category
          picker wants, where the colour is the thing being chosen. */}
      {icon && (dot && color
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
      <span style={{ flex: 1, fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: value ? 600 : 400,
        color: value ? t.ink : t.inkDim, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {value || placeholder}
      </span>
    </div>
  );
}
