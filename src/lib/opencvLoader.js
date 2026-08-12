// Loads OpenCV.js from the self-hosted static asset emitted by the
// opencv-asset Vite plugin (see vite.config.js) instead of importing the
// package through the bundler, which would inflate its 13 MB UMD build by a
// further ~2 MB and pin it to a chunk hash that churns on every app rebuild.

let opencvPromise = null;
let opencvOverride = null;

function injectScript(src) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return existing;
  const script = document.createElement('script');
  script.src = src;
  document.head.appendChild(script);
  return script;
}

// Cached across calls so the ~4 MB module is fetched and instantiated once.
export function loadOpenCv() {
  if (opencvOverride) return Promise.resolve(opencvOverride);
  if (!opencvPromise) {
    const src = `${import.meta.env.BASE_URL}${__OPENCV_ASSET_PATH__}`;
    const script = injectScript(src);
    opencvPromise = new Promise((resolve, reject) => {
      script.addEventListener('load', () => {
        // The package is an Emscripten MODULARIZE build: globalThis.cv is a
        // thenable that resolves to the cv namespace once the runtime is
        // ready. Awaiting it is required — the older cv.onRuntimeInitialized
        // callback is not set on this build and waiting for it hangs forever.
        Promise.resolve(globalThis.cv)
          .then((cv) => resolve(cv?.default ?? cv))
          .catch(reject);
      });
      script.addEventListener('error', reject);
    }).catch((err) => {
      // Clear the memo and drop the failed tag so a user who was offline (or
      // hit a transient CDN failure) can retry Auto-detect — reusing the
      // failed tag by src match would never re-fetch.
      opencvPromise = null;
      script.remove();
      throw err;
    });
  }
  return opencvPromise;
}

// Overrides the memo — used by tests and by Node scripts, which import
// '@techstark/opencv-js' themselves (no DOM to inject a <script> into) and
// hand the resolved namespace to detectLines via setOpenCv.
export function setOpenCv(cv) {
  opencvOverride = cv;
}

// Exposed for tests, which need to reset the module-level cache between cases.
export function _resetOpenCvCache() {
  opencvPromise = null;
  opencvOverride = null;
}
