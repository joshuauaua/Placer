/* PLACER — saving a QR code as a file, for a room somebody wants to print.
 *
 * react-qr-code draws an <svg>, so the file is that svg as it is on screen. SVG
 * rather than PNG on purpose: a code going on an A3 poster has to scale up without
 * blurring, and a scanner that cannot resolve the modules is a poll nobody joins.
 */

/** Save the first <svg> inside `container` as `filename`. False if there was none. */
export function downloadQrSvg(container, filename = 'placer-room-qr.svg') {
  const svg = container?.querySelector?.('svg');
  if (!svg) return false;

  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = new XMLSerializer().serializeToString(copy);

  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick rather than at once: some browsers start the download
  // asynchronously and would find the URL already gone.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
