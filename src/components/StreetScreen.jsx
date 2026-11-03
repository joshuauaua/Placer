/* PLACER — Step 2: place assets on the captured view, and draw on it.
 *
 * The stage takes the photo's own shape (stageSize), a Street View capture's or an
 * uploaded photo's alike, so nothing is stretched or cropped to fit a fixed frame. */

import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Btn } from './UI';
import { FlowScreen } from './FlowLayout';
import { ASSET_LIB } from '../data';
import posthog from 'posthog-js';

const ImaginationCanvas = lazy(() => import('./ImaginationCanvas'));

const noop = () => {};

// The stage is this wide in its own units, and as tall as the photo's shape makes it.
export const STAGE_WIDTH = 1000;
// Beyond these a photo is a sliver; past them it is cropped rather than shown tiny.
const MIN_HEIGHT = 400;
const MAX_HEIGHT = 1600;

/** The stage for a photo `width` × `height` pixels: its shape, STAGE_WIDTH wide. */
export function stageSize(width, height) {
  if (!(width > 0) || !(height > 0)) return { width: STAGE_WIDTH, height: 700 };
  const shaped = Math.round((STAGE_WIDTH * height) / width);
  return { width: STAGE_WIDTH, height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, shaped)) };
}

const PHOTO_WAIT_MS = 5000;

// The photo's pixel size, once it has loaded; null until then or without one.
function usePhotoSize(src) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    setSize(null);
    if (!src) return undefined;
    let cancelled = false;
    const image = new Image();
    image.onload = () => { if (!cancelled) setSize({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { if (!cancelled) setSize({ width: 0, height: 0 }); };
    // A photo that neither loads nor fails would leave the step waiting; after this
    // long it goes ahead at the stage's old shape instead.
    const timer = setTimeout(() => { if (!cancelled) setSize((known) => known ?? { width: 0, height: 0 }); }, PHOTO_WAIT_MS);
    image.src = src;
    return () => { cancelled = true; clearTimeout(timer); };
  }, [src]);
  return size;
}

export function StreetScreen({
  t,
  onBack,
  backLabel = 'Back to map',
  onNext,
  capturedView,
  canvasAssets = [],
  onCanvasAssetsChange = noop,
  lines = [],
  onLinesChange = noop,
}) {
  const stageRef = useRef();
  const backgroundImage = capturedView?.screenshot || null;
  const photoSize = usePhotoSize(backgroundImage);
  // Without a photo there is nothing to wait for.
  const stage = backgroundImage ? (photoSize && stageSize(photoSize.width, photoSize.height)) : stageSize(0, 0);

  // Composite the photo and everything drawn on it into one image, so the later
  // steps can show what the user actually made.
  const handleNext = () => {
    let preview = null;
    // The selection's resize handles are on the stage too, and are not part of the idea.
    const handles = stageRef.current?.find?.('Transformer') ?? [];
    handles.forEach((handle) => handle.hide());
    try {
      // JPEG rather than PNG because saveImagination rewrites the whole array into
      // localStorage's ~5 MB budget and a full-size PNG of a 1000x700 stage runs
      // 1-2 MB; at quality 0.75 the same frame is a couple of hundred KB.
      // pixelRatio 1 exports the stage at its own size and no further: the
      // background is a stitched capture of roughly that resolution (see
      // streetViewBackgroundTiles), so going above 1 would only interpolate the
      // photo while spending budget the overlays do not need. Without a photo (a
      // capture that failed) the stage is transparent, and JPEG has no alpha, so it
      // would flatten to solid black; PNG is both correct and small there.
      // The stage may be shown smaller than its own size to fit the screen; this
      // exports it at its own size whatever it is shown at.
      const pixelRatio = stageRef.current?.width?.() > 0 ? (stage?.width ?? STAGE_WIDTH) / stageRef.current.width() : 1;
      preview = stageRef.current?.toDataURL(
        backgroundImage
          ? { mimeType: 'image/jpeg', quality: 0.75, pixelRatio }
          : { mimeType: 'image/png', pixelRatio }
      ) ?? null;
    } catch (error) {
      // Shouldn't happen — captures are inlined as data: URLs precisely to keep the
      // stage untainted (see src/lib/staticMaps.js) — but a tainted canvas must not
      // stop the user advancing. The next step falls back to the bare screenshot.
      console.error('Could not export canvas preview:', error);
    } finally {
      handles.forEach((handle) => handle.show());
    }
    posthog.capture('imagination_description_started', {
      assets_count: canvasAssets.length,
      has_background: !!backgroundImage,
    });
    onNext(preview);
  };

  return (
    <FlowScreen
      t={t}
      step={2}
      onBack={onBack}
      backLabel={backLabel}
      actions={
        <>
          <Btn t={t} variant="ghost" size="sm" style={{ color: t.inkDim }}>Save draft</Btn>
          <Btn t={t} variant="primary" size="sm" icon="arrowRight" onClick={handleNext}>Next: Describe</Btn>
        </>
      }
    >
      {/* ImaginationCanvas with built-in asset library */}
      <Suspense fallback={
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkDim }}>
          Loading canvas…
        </div>
      }>
        {stage ? (
          <ImaginationCanvas
            availableAssets={ASSET_LIB}
            canvasAssets={canvasAssets}
            onCanvasAssetsChange={onCanvasAssetsChange}
            lines={lines}
            onLinesChange={onLinesChange}
            stageRef={stageRef}
            width={stage.width}
            height={stage.height}
            backgroundImage={backgroundImage}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkDim }}>
            Loading the photo…
          </div>
        )}
      </Suspense>
    </FlowScreen>
  );
}

export default StreetScreen;
