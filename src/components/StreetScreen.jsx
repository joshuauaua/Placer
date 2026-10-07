/* PLACER — Step 1: place assets on the captured view */

import { useRef, lazy, Suspense } from 'react';
import { Btn } from './UI';
import { FlowScreen } from './FlowLayout';
import { ASSET_LIB } from '../data';
import posthog from 'posthog-js';

const ImaginationCanvas = lazy(() => import('./ImaginationCanvas'));

const noop = () => {};

export function StreetScreen({
  t,
  onBack,
  backLabel = 'Back to map',
  onNext,
  capturedView,
  canvasAssets = [],
  onCanvasAssetsChange = noop,
}) {
  const stageRef = useRef();
  const backgroundImage = capturedView?.screenshot || null;

  // Composite the photo and everything drawn on it into one image, so the later
  // steps can show what the user actually made.
  const handleNext = () => {
    let preview = null;
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
      preview = stageRef.current?.toDataURL(
        backgroundImage
          ? { mimeType: 'image/jpeg', quality: 0.75, pixelRatio: 1 }
          : { mimeType: 'image/png', pixelRatio: 1 }
      ) ?? null;
    } catch (error) {
      // Shouldn't happen — captures are inlined as data: URLs precisely to keep the
      // stage untainted (see src/lib/staticMaps.js) — but a tainted canvas must not
      // stop the user advancing. The next step falls back to the bare screenshot.
      console.error('Could not export canvas preview:', error);
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
      step={1}
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
        <ImaginationCanvas
          availableAssets={ASSET_LIB}
          canvasAssets={canvasAssets}
          onCanvasAssetsChange={onCanvasAssetsChange}
          stageRef={stageRef}
          width={1000}
          height={700}
          backgroundImage={backgroundImage}
        />
      </Suspense>
    </FlowScreen>
  );
}

export default StreetScreen;
