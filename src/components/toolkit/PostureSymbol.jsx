/* PLACER — the field sheet's symbol for each posture, in Stationary Activity Mapping.
 *
 *   Standing             a black circle
 *   Public sitting       a square
 *   Private sitting      a triangle
 *   Commercial sitting   an open circle
 *   Informal sitting     a square with an X
 *   Lying down           a thick horizontal line
 *   Multiple movement    an X
 *
 * One list of shapes, drawn two ways: as a React <svg> for the page (legend, buttons,
 * tally), and as a DOM element for the map's markers, which MapLibre places itself.
 * Black on whatever is behind it; the map gives each a white tile to sit on.
 */

const STROKE = { fill: 'none', stroke: 'currentColor' };

// Each shape is [tag, attributes], on a 24 × 24 box. Attributes are React's names;
// symbolElement turns them into the SVG ones.
export const POSTURE_SHAPES = {
  standing: [['circle', { cx: 12, cy: 12, r: 7, fill: 'currentColor' }]],
  sittingPublic: [['rect', { x: 5, y: 5, width: 14, height: 14, fill: 'currentColor' }]],
  sittingPrivate: [['path', { d: 'M12 4 L20.5 19 L3.5 19 Z', fill: 'currentColor' }]],
  sittingCommercial: [['circle', { cx: 12, cy: 12, r: 6.5, ...STROKE, strokeWidth: 2.5 }]],
  sittingInformally: [
    ['rect', { x: 5, y: 5, width: 14, height: 14, ...STROKE, strokeWidth: 2 }],
    ['path', { d: 'M5 5 L19 19 M19 5 L5 19', ...STROKE, strokeWidth: 2 }],
  ],
  lying: [['path', { d: 'M3 12 H21', ...STROKE, strokeWidth: 4.5 }]],
  multiple: [['path', { d: 'M6 6 L18 18 M18 6 L6 18', ...STROKE, strokeWidth: 3, strokeLinecap: 'round' }]],
};

/** A posture's symbol, `size` pixels square, in the surrounding text colour. */
export function PostureSymbol({ posture, size = 16, style }) {
  const shapes = POSTURE_SHAPES[posture];
  if (!shapes) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      style={{ display: 'inline-block', flex: '0 0 auto', verticalAlign: 'middle', ...style }}>
      {shapes.map(([Tag, attributes], index) => <Tag key={index} {...attributes} />)}
    </svg>
  );
}

const SVG = 'http://www.w3.org/2000/svg';
const svgName = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The same symbol as a DOM <svg>, for a map marker. */
export function symbolElement(posture, size = 16) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attributes] of POSTURE_SHAPES[posture] ?? []) {
    const shape = document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attributes)) shape.setAttribute(svgName(name), String(value));
    svg.append(shape);
  }
  return svg;
}
