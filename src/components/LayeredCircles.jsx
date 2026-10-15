/* PLACER — overlapping circles in the deeper steps of one brand colour (100, 300, 700),
 * stacked into the lower right corner of whatever holds them. Laid on that colour's 50
 * step, they are the dashboard's Getting Started cards and the 404 page.
 *
 * The holder needs position: relative, overflow: hidden and isolation: isolate, and
 * its own content position: relative, so the circles stay behind it. `scale` sizes
 * them to the holder: 1 suits a card about 200px tall.
 */

const LAYERS = [
  { step: 'c100', size: 340, right: -110, bottom: -150 },
  { step: 'c300', size: 210, right: -40, bottom: -90 },
  { step: 'c700', size: 96, right: 24, bottom: -30 },
];

export function LayeredCircles({ hue, scale = 1 }) {
  return LAYERS.map(({ step, size, right, bottom }) => (
    <span key={step} aria-hidden="true" style={{ position: 'absolute', width: size * scale, height: size * scale,
      right: right * scale, bottom: bottom * scale, borderRadius: '50%', background: hue[step],
      pointerEvents: 'none' }} />
  ));
}

export default LayeredCircles;
