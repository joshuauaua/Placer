/* PLACER — shared UI primitives */

import { useState } from 'react';
import { Icon } from './Icon';
import { copyText } from '../lib/clipboard';
import { CAT, CHARACTER_LIST } from '../theme';

/**
 * The loading state: the favicon's bench mark — white bench on the #111111
 * square, at the kit's 22% app-icon radius — turning in place. The text stays
 * in the tree, visually hidden, so screen readers still hear what is happening.
 */
export function LoadingMark({ size = 56, label = 'Loading…' }) {
  return (
    <div role="status" className="placer-loading-mark">
      <img src="/apple-touch-icon.png" alt="" width={size} height={size}
        style={{ borderRadius: size * 0.22 }} />
      <span className="placer-visually-hidden">{label}</span>
    </div>
  );
}

/**
 * The wordmark: Helvetica Bold, uppercase, +8% tracking, in ink or white only.
 * `size` is the cap height; the font size is that over Helvetica's cap ratio.
 * Left unset it follows the kit — 20px caps on desktop, 16px on mobile (see
 * .placer-wordmark in index.css).
 */
export function Logo({ t, size }) {
  return (
    <span className="placer-wordmark"
      style={{ color: t.ink, ...(size ? { fontSize: Math.round(size / 0.717) } : null) }}>
      PLACER
    </span>
  );
}

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

// `icon` picks one of AVATAR_ICONS over the initials this used to always show, and
// `photo` (an uploaded picture's URL) wins over both. Same circle every way, so
// switching between them is a same-size swap.
//
// The brand kit's avatar: a character's 100 fill, a 2px ring in its 700 and ink
// initials. Nobody has a character on their profile yet, so the name picks one of
// the three, the same way every time. `ring` still adds an outer ring when asked.
export function Avatar({ name = '', size = 40, ring, icon, photo }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const character = CHARACTER_LIST[(name.charCodeAt(0) + name.length || 0) % CHARACTER_LIST.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: character.c100, color: '#111111',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
      fontFamily: 'var(--placer-font)', fontWeight: 700, fontSize: Math.max(12, Math.round(size * 0.4)),
      // A photo would paint over the inset character ring, so it keeps only the outer one.
      boxShadow: photo
        ? (ring ? `0 0 0 2px ${ring}` : 'none')
        : `inset 0 0 0 2px ${character.c700}${ring ? `, 0 0 0 2px ${ring}` : ''}` }}>
      {photo
        // Decorative: the name is always beside it, or in the button's label.
        ? <img src={photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%',
          objectFit: 'cover', display: 'block' }} />
        : icon ? <Icon name={icon} size={size * 0.52} stroke={2} /> : initials}
    </div>
  );
}

// 48px by default, 40px where a desktop layout needs a compact one; 12px corners,
// 24px either side, a 14–16px Medium label.
export const BTN_SIZES = {
  sm: { h: 40, px: 16, fs: 14 },
  md: { h: 48, px: 24, fs: 14 },
  lg: { h: 48, px: 24, fs: 16 },
};

export function Btn({ t, children, variant = 'primary', icon, size = 'md', style, full, onClick, onBlur,
  disabled, type, ariaLabel, ariaPressed, title, iconStyle, tone }) {
  const z = BTN_SIZES[size];
  // Primary is ink with white text; secondary (outline) is white with an ink
  // hairline. `accent` is primary now that the brand has no accent colour, and
  // `quiet` is secondary on a grey-300 line, for buttons beside a diagram. Hovers
  // are in index.css (.placer-btn-*), since an inline style cannot have one.
  const variants = {
    primary: { background: t.primaryBg, color: t.primaryFg, border: '1px solid transparent' },
    accent:  { background: t.primaryBg, color: t.primaryFg, border: '1px solid transparent' },
    outline: { background: '#FFFFFF', color: t.ink, border: `1px solid ${t.ink}` },
    quiet:   { background: '#FFFFFF', color: t.ink, border: `1px solid ${t.lineStrong}` },
    ghost:   { background: 'transparent', color: t.ink, border: '1px solid transparent' },
    // A character button: `tone` is { color, tint, hover } — the 700, 100 and 300 of
    // one character. The 100 fill with a 700 hairline and ink text, 300 on hover.
    character: tone ? { background: tone.tint, color: t.ink, border: `1px solid ${tone.color}`,
      '--placer-btn-hover': tone.hover } : {},
  };
  const hover = variant === 'primary' || variant === 'accent' ? 'primary'
    : variant === 'ghost' ? 'ghost' : variant === 'character' ? 'character' : 'secondary';
  const disabledLook = disabled ? { background: '#E6E6E6', color: '#6E6E6E', border: '1px solid transparent' } : null;
  return (
    <button disabled={disabled} onClick={onClick} onBlur={onBlur} type={type}
      aria-label={ariaLabel} aria-pressed={ariaPressed} title={title ?? ariaLabel}
      className={`placer-btn placer-btn-${hover}`}
      style={{ height: z.h, padding: `0 ${z.px}px`, borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: full ? '100%' : 'auto',
      fontFamily: 'var(--placer-font)', fontWeight: 500, fontSize: z.fs, letterSpacing: '0.01em',
      ...variants[variant], ...style, ...disabledLook }}>
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
    borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink,
    fontFamily: 'var(--placer-font)', fontSize: 14,
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
  // A chip, in neutrals: categories have no colour of their own in the brand kit.
  const z = size === 'sm' ? { h: 24, fs: 12, px: 8, ic: 12 } : { h: 32, fs: 14, px: 12, ic: 14 };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: z.h, padding: `0 ${z.px}px`,
      borderRadius: 12, fontFamily: 'var(--placer-font)', fontWeight: 500, fontSize: z.fs, letterSpacing: '0.01em',
      background: solid ? t.ink : '#F5F5F5',
      color: solid ? '#FFFFFF' : t.ink }}>
      <Icon name={c.icon} size={z.ic} stroke={2.2} />
      {c.label}
    </span>
  );
}

export function Chip({ t, children, active, color, icon, dot, onClick, ariaPressed, title }) {
  return (
    <button onClick={onClick} aria-pressed={ariaPressed} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px',
      borderRadius: 12, cursor: 'pointer', whiteSpace: 'nowrap',
      fontFamily: 'var(--placer-font)', fontWeight: 500, fontSize: 14, letterSpacing: '0.01em',
      border: active ? `1px solid ${color || t.ink}` : `1px solid ${t.lineStrong}`,
      background: active ? '#F5F5F5' : '#FFFFFF',
      color: t.ink }}>
      {/* `dot` asks for the colour as a swatch instead of the icon — what the category
          picker wants, where the colour is the thing being chosen. */}
      {icon && (dot && color
        ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        : <Icon name={icon} size={15} stroke={2} />)}
      {children}
    </button>
  );
}

export function Vote({ t, count, voted, size = 'md', rank }) {
  const z = size === 'lg' ? { w: 64, fs: 22, ic: 22, rfs: 12 } : size === 'sm' ? { w: 40, fs: 14, ic: 16, rfs: 9 } : { w: 52, fs: 18, ic: 19, rfs: 11 };
  return (
    <div style={{ width: z.w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: size === 'lg' ? '10px 0' : '6px 0', borderRadius: 12, flex: '0 0 auto',
      border: `1px solid ${voted ? t.ink : t.line}`,
      background: voted ? '#F5F5F5' : 'transparent' }}>
      <Icon name="arrowUp" size={z.ic} stroke={2.4} style={{ color: t.ink }} />
      <span className="placer-disp" style={{ fontSize: z.fs, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{count}</span>
      {rank && <span className="placer-mono" style={{ fontSize: z.rfs, color: t.inkDim, marginTop: 2 }}>{rank}</span>}
    </div>
  );
}

export function SearchBar({ t, value, placeholder, width = '100%' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, width, padding: '0 16px',
      borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink }}>
      <Icon name="search" size={19} stroke={2} style={{ color: t.inkDim }} />
      <span style={{ flex: 1, fontFamily: 'var(--placer-font)', fontSize: 15, fontWeight: value ? 600 : 400,
        color: value ? t.ink : t.inkDim, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {value || placeholder}
      </span>
    </div>
  );
}
