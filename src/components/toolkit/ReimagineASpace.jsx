/* PLACER — Toolkit: Idea Visualizer.
 *
 * Four steps, a screen each: choose a spot on the map (MapContainer), place benches,
 * trees and the rest into its Street View (StreetScreen), describe the idea
 * (DescribePage) and save it to the profile (PostPage). It is one of
 * FULL_SCREEN_TOOLS (lib/routes.js), so once its cover's Get started is pressed it has
 * the whole window, at /toolkit/reimagine-a-space?start.
 *
 * The idea is held here, across the steps, so going back a step does not throw the
 * drawing away. Signing up to save it leaves the page for a confirmation email, so it
 * is parked in this browser first (services/api.js), the link brings the new account
 * back to this tool's address, and it is picked up here.
 *
 * Opened for a project (?project=) whose organisers set the tool up with a Street View
 * photo (IdeaVisualizerSetup), it skips the map: everyone draws on that photo, pinned
 * at that address, and the idea saved is tagged with the project. One whose photo
 * cannot be loaded gets the map, so taking part is never blocked.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import posthog from 'posthog-js';
import { PageLoader } from '../UI';
import { FlowScreen } from '../FlowLayout';
import { useIdentity } from '../useIdentity';
import { projectIdFrom } from '../../toolkit/rooms';
import { readReimagineScene } from '../../services/projects';
import { clearPendingImagination, readPendingImagination, savePendingImagination } from '../../services/api';

// Loaded when the tool is started: the Toolkit's register imports this file, and every
// page that reads the register would otherwise carry the map and the canvas.
const MapContainer = lazy(() => import('../MapContainer'));
const StreetScreen = lazy(() => import('../StreetScreen'));
const DescribePage = lazy(() => import('../DescribePage'));
const PostPage = lazy(() => import('../PostPage'));

const EMPTY_DRAFT = { title: '', cat: '', blurb: '' };

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function ReimagineASpace({ t, tool }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const projectId = projectIdFrom(search);
  const { profile, status, accountId } = useIdentity();

  // Null while working out where to start, then 'map', 'street', 'describe' or 'post'.
  const [step, setStep] = useState(null);
  const [capturedView, setCapturedView] = useState(null);
  const [canvasAssets, setCanvasAssets] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // Composite of the photo plus everything drawn on it, exported when leaving the canvas.
  const [preview, setPreview] = useState(null);
  // Where the map should open. Set when an idea is saved, so the map comes back centred
  // on where it was made instead of the default location.
  const [mapFocus, setMapFocus] = useState(null);

  // A new capture starts a new idea.
  const capture = (viewData) => {
    setCapturedView(viewData);
    setCanvasAssets([]);
    setDraft(EMPTY_DRAFT);
    setPreview(null);
    setStep('street');
  };

  // Where to start: an idea parked on the way to confirming a new account, once there
  // is an account to save it under; else the project's scene; else the map. Waits out
  // the session being read, since that decides whether a parked idea can come back.
  useEffect(() => {
    if (step !== null || status === 'loading') return undefined;
    let cancelled = false;

    (async () => {
      const pending = status === 'signedIn' ? await readPendingImagination() : null;
      if (cancelled) return;
      if (pending) {
        setCapturedView(pending.capturedView ?? null);
        setCanvasAssets(pending.canvasAssets ?? []);
        setDraft(pending.draft ?? EMPTY_DRAFT);
        setPreview(pending.preview ?? null);
        clearPendingImagination();
        setStep('post');
        return;
      }

      posthog.capture('imagination_started', { project: Boolean(projectId) });
      let scene = null;
      if (projectId) {
        try {
          scene = await readReimagineScene(projectId);
        } catch (err) {
          console.error("Could not load the project's scene, so starting from the map:", err);
        }
      }
      if (cancelled) return;
      if (!scene) {
        setStep('map');
        return;
      }
      capture({
        position: scene.position,
        pov: null,
        fov: null,
        source: 'project',
        timestamp: new Date().toISOString(),
        screenshot: scene.screenshot,
      });
    })();

    return () => { cancelled = true; };
  }, [step, status, projectId]);

  // Out of the tool: back to the project it was opened for, or to the Toolkit.
  const leave = () => navigate(projectId ? `/projects/${encodeURIComponent(projectId)}` : '/toolkit');
  const leaveLabel = projectId ? 'Back to project' : 'Back to Toolkit';
  // A project's scene was never picked from the map, so back from it is the project.
  const fromProjectScene = capturedView?.source === 'project' && Boolean(projectId);

  const handlePosted = () => {
    // Saved, so there is nothing left to come back to.
    clearPendingImagination();
    setMapFocus(capturedView?.position ?? null);
    setCapturedView(null);
    setCanvasAssets([]);
    setDraft(EMPTY_DRAFT);
    setPreview(null);
    setStep('map');
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: t.page, color: t.ink }}>
      <Suspense fallback={<PageLoader />}>
        {step === null && <PageLoader />}

        {step === 'map' && (
          <FlowScreen t={t} step={1} onBack={leave} backLabel={leaveLabel}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MapContainer
                onCaptureView={capture}
                apiKey={GOOGLE_MAPS_API_KEY}
                initialCenter={mapFocus}
                homeCenter={profile?.locationPoint ?? null}
                onOpenProject={(id) => navigate(`/projects/${id}`)}
              />
            </div>
          </FlowScreen>
        )}

        {step === 'street' && (
          <StreetScreen
            t={t}
            onBack={fromProjectScene ? leave : () => setStep('map')}
            backLabel={fromProjectScene ? 'Back to project' : undefined}
            onNext={(canvasPreview) => { setPreview(canvasPreview); setStep('describe'); }}
            capturedView={capturedView}
            canvasAssets={canvasAssets}
            onCanvasAssetsChange={setCanvasAssets}
          />
        )}

        {step === 'describe' && (
          <DescribePage
            t={t}
            draft={draft}
            onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onBack={() => setStep('street')}
            onNext={() => setStep('post')}
            preview={preview}
            needsAccount={status === 'signedOut'}
          />
        )}

        {step === 'post' && (
          <PostPage
            t={t}
            draft={draft}
            preview={preview}
            capturedView={capturedView}
            canvasAssets={canvasAssets}
            onBack={() => setStep('describe')}
            onPosted={handlePosted}
            accountId={accountId}
            // Saving is the one thing an account is required for. Where there is no
            // Supabase project there are no accounts either, so the status is 'local'
            // and this stays false.
            needsAccount={status === 'signedOut'}
            checkingAccount={status === 'loading'}
            onStashDraft={() => savePendingImagination({ capturedView, canvasAssets, draft, preview })}
            // This address, ?start and all, so the confirmation link comes back here.
            returnTo={`/toolkit/${tool.id}?${search}`}
            projectId={projectId}
          />
        )}
      </Suspense>
    </div>
  );
}

export default ReimagineASpace;
