/* PLOT — Button component */

export const Button = ({ t, children, variant = 'primary', icon, size = 'md', style, full, onClick }) => {
  const sizes = {
    sm: { h: 34, px: 14, fs: 13.5 },
    md: { h: 42, px: 18, fs: 15 },
    lg: { h: 50, px: 24, fs: 16.5 }
  };
  const z = sizes[size];

  const variants = {
    primary: { background: t.primaryBg, color: t.primaryFg, border: '1px solid transparent' },
    accent:  { background: t.accent, color: t.accentInk, border: '1px solid transparent' },
    outline: { background: 'transparent', color: t.ink, border: `1.5px solid ${t.lineStrong}` },
    ghost:   { background: 'transparent', color: t.ink, border: '1px solid transparent' },
  };

  return (
    <button
      onClick={onClick}
      style={{
        height: z.h,
        padding: `0 ${z.px}px`,
        borderRadius: 9,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: full ? '100%' : 'auto',
        fontFamily: "'Archivo', sans-serif",
        fontWeight: 700,
        fontSize: z.fs,
        letterSpacing: '-0.01em',
        ...variants[variant],
        ...style
      }}
    >
      {children}
    </button>
  );
};
