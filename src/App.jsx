/* PLACER — Reimagine Your City */

import { useState, lazy, Suspense } from 'react';
import posthog from 'posthog-js';
import { Switch, Route, useLocation } from 'wouter';
import { THEME } from './theme';
import { Logo, Btn, Avatar } from './components/UI';
import { Icon } from './components/Icon';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieBanner } from './components/CookieBanner';
import { LandingPage } from './components/LandingPage';

const StreetScreen = lazy(() => import('./components/StreetScreen'));
const SurveyPage = lazy(() => import('./components/SurveyPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const MapContainer = lazy(() => import('./components/MapContainer'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const ResourcesPage = lazy(() => import('./components/ResourcesPage'));
const PrivacyPage = lazy(() => import('./components/PrivacyPage'));
const GdprPage = lazy(() => import('./components/GdprPage'));
const DescribePage = lazy(() => import('./components/DescribePage'));
const PostPage = lazy(() => import('./components/PostPage'));
const AdminImaginations = lazy(() => import('./components/AdminImaginations'));
const SandboxPage = lazy(() => import('./components/SandboxPage'));

const EMPTY_DRAFT = { title: '', cat: '', blurb: '' };

// The site is a landing page for now, so the nav bar is off unless asked for.
// Read at render time rather than module load, the same way AdminGate reads its
// flag, so tests and a staging environment can switch it on.
const isNavEnabled = () => import.meta.env.VITE_SHOW_NAV === 'true';

// The three steps of making an imagination. They render full-bleed, without the nav
// bar and footer the other views sit inside.
const FLOW_VIEWS = ['street', 'describe', 'post'];

function LoadingFallback() {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#888' }}>Loading…</div>
    </div>
  );
}

function FooterLink({ t, active, onClick, children }) {
  return (
    <span
      onClick={onClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{ color: active ? t.ink : t.inkDim, fontWeight: 600, cursor: 'pointer' }}>
      {children}
    </span>
  );
}

function MainApp({ initialView = 'welcome' }) {
  const t = THEME;
  // 'welcome', 'map', 'street', 'describe', 'post', 'about', 'resources', 'sandbox', 'privacy', 'gdpr'
  const [currentView, setCurrentView] = useState(initialView);
  const [capturedView, setCapturedView] = useState(null);
  // The imagination being built. Held here rather than in StreetScreen so that
  // stepping forward to Describe and back again does not throw the drawing away.
  const [canvasAssets, setCanvasAssets] = useState([]);
  const [lines, setLines] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // Composite of the photo plus everything drawn on it, exported when leaving step 1.
  const [preview, setPreview] = useState(null);
  // Where the map should open. Set when an imagination is posted, so the map comes
  // back centred on the new pin instead of the default location.
  const [mapFocus, setMapFocus] = useState(null);

  const showNav = isNavEnabled();

  // The Sandbox is the one view that lives in the URL, because every experiment has a
  // link worth sharing. So it is read off the location rather than held in state, and
  // `show` keeps the two in step: going to the Sandbox writes the URL, and leaving it
  // writes the URL back.
  //
  // It is deliberately not its own <Route> with an initialView, the way /privacy is.
  // Switch reconciles two sibling Routes as the same component instance, so MainApp is
  // never remounted when the matched Route changes and an initialView prop only ever
  // applies on first mount — which works for a URL that is only an entry point, and
  // silently does nothing for one you can navigate to from inside the app.
  const [location, navigate] = useLocation();
  const inSandbox = location.startsWith('/sandbox');
  const view = inSandbox ? 'sandbox' : currentView;

  const show = (next) => {
    if (next === 'sandbox') {
      navigate('/sandbox');
      return;
    }
    if (inSandbox) navigate('/');
    setCurrentView(next);
  };

  const handleCaptureView = (viewData) => {
    setCapturedView(viewData);
    // A new capture starts a new imagination.
    setCanvasAssets([]);
    setLines([]);
    setDraft(EMPTY_DRAFT);
    setPreview(null);
    show('street');
  };

  const handleBackToMap = () => {
    show('map');
  };

  const handleNextStep = (canvasPreview) => {
    setPreview(canvasPreview);
    show('describe');
  };

  const handleDraftChange = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handlePosted = () => {
    setMapFocus(capturedView?.position ?? null);
    setCapturedView(null);
    setCanvasAssets([]);
    setLines([]);
    setDraft(EMPTY_DRAFT);
    setPreview(null);
    show('map');
  };

  const handleExplore = () => {
    posthog.capture('explore_started');
    show('map');
  };

  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';


  if (FLOW_VIEWS.includes(view)) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        {view === 'street' && (
          <StreetScreen
            t={t}
            onBack={handleBackToMap}
            onNext={handleNextStep}
            capturedView={capturedView}
            apiKey={GOOGLE_MAPS_API_KEY}
            canvasAssets={canvasAssets}
            onCanvasAssetsChange={setCanvasAssets}
            lines={lines}
            onLinesChange={setLines}
          />
        )}
        {view === 'describe' && (
          <DescribePage
            t={t}
            draft={draft}
            onDraftChange={handleDraftChange}
            onBack={() => show('street')}
            onNext={() => show('post')}
            preview={preview}
          />
        )}
        {view === 'post' && (
          <PostPage
            t={t}
            draft={draft}
            preview={preview}
            capturedView={capturedView}
            canvasAssets={canvasAssets}
            lines={lines}
            onBack={() => show('describe')}
            onPosted={handlePosted}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div className="placer-viewport" style={{ width: '100%', display: 'flex', flexDirection: 'column', background: t.page, color: t.ink }}>
      {/* Navigation Bar */}
      {showNav && (
        <div style={{ height: 66, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 20,
          padding: '0 22px', background: t.chrome, borderBottom: `1px solid ${t.line}`, zIndex: 60 }}>
          <div onClick={() => show('welcome')} style={{ cursor: 'pointer' }}>
            <Logo t={t} size={20} />
          </div>
          <div style={{ width: 1, height: 26, background: t.line }} />
          <nav style={{ display: 'flex', gap: 4 }}>
            <span
              onClick={() => show('about')}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
              color: view === 'about' ? t.ink : t.inkDim,
              background: view === 'about' ? t.surfaceAlt : 'transparent',
              cursor: 'pointer' }}>About</span>
            <span
              onClick={() => show('resources')}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
              color: view === 'resources' ? t.ink : t.inkDim,
              background: view === 'resources' ? t.surfaceAlt : 'transparent',
              cursor: 'pointer' }}>Resources</span>
            <span
              onClick={() => show('sandbox')}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
              color: view === 'sandbox' ? t.ink : t.inkDim,
              background: view === 'sandbox' ? t.surfaceAlt : 'transparent',
              cursor: 'pointer' }}>Sandbox</span>
          </nav>
          <div style={{ flex: 1 }} />
          <Btn t={t} variant="accent" icon="sparkle" onClick={handleExplore}>Explore</Btn>
          <Avatar name="You There" size={40} ring={t.line} />
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {view === 'welcome' && <LandingPage t={t} />}

        {view === 'map' && (
          <Suspense fallback={<LoadingFallback />}>
            <MapContainer
              onCaptureView={handleCaptureView}
              apiKey={GOOGLE_MAPS_API_KEY}
              initialCenter={mapFocus}
            />
          </Suspense>
        )}

        {view === 'about' && (
          <Suspense fallback={<LoadingFallback />}>
            <AboutPage t={t} />
          </Suspense>
        )}

        {view === 'resources' && (
          <Suspense fallback={<LoadingFallback />}>
            <ResourcesPage t={t} />
          </Suspense>
        )}

        {view === 'sandbox' && (
          <Suspense fallback={<LoadingFallback />}>
            <SandboxPage t={t} />
          </Suspense>
        )}

        {view === 'privacy' && (
          <Suspense fallback={<LoadingFallback />}>
            <PrivacyPage t={t} onNavigate={show} />
          </Suspense>
        )}

        {view === 'gdpr' && (
          <Suspense fallback={<LoadingFallback />}>
            <GdprPage t={t} onNavigate={show} />
          </Suspense>
        )}
      </div>

      {/* Footer */}
      <div style={{ height: 44, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 18,
        padding: '0 22px', background: t.chrome, borderTop: `1px solid ${t.line}`, fontSize: 13, zIndex: 60 }}>
        <span style={{ color: t.inkFaint }}>2026 PLACER</span>
        <a href="mailto:info@plcr.org" style={{ color: t.inkFaint, textDecoration: 'none' }}>
          info@plcr.org
        </a>
        <div style={{ flex: 1 }} />
        <FooterLink t={t} active={view === 'privacy'} onClick={() => show('privacy')}>
          Privacy Policy
        </FooterLink>
        <FooterLink t={t} active={view === 'gdpr'} onClick={() => show('gdpr')}>
          GDPR
        </FooterLink>
      </div>
    </div>
  );
}

function AdminGate({ children, t }) {
  const adminEnabled = import.meta.env.VITE_ADMIN_ENABLED === 'true';

  if (!adminEnabled) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: t.page, color: t.ink }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <Icon name="shield" size={48} stroke={2} style={{ color: t.inkDim, margin: '0 auto 16px' }} />
          <h1 className="placer-disp" style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Access Restricted</h1>
          <p style={{ fontSize: 15, color: t.inkDim }}>
            The admin dashboard is not available in this environment.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export { AdminGate };

function App() {
  const t = THEME;

  return (
    <>
      <ErrorBoundary>
        <Switch>
          <Route path="/survey"><Suspense fallback={<LoadingFallback />}><SurveyPage t={t} /></Suspense></Route>
          <Route path="/admin/imaginations"><Suspense fallback={<LoadingFallback />}><AdminGate t={t}><AdminImaginations t={t} /></AdminGate></Suspense></Route>
          <Route path="/admin"><Suspense fallback={<LoadingFallback />}><AdminGate t={t}><AdminDashboard t={t} /></AdminGate></Suspense></Route>
          <Route path="/privacy"><MainApp initialView="privacy" /></Route>
          <Route path="/gdpr"><MainApp initialView="gdpr" /></Route>
          {/* Everything else, /sandbox and /sandbox/<experiment> included — MainApp
              reads those off the location itself. */}
          <Route><MainApp /></Route>
        </Switch>
      </ErrorBoundary>
      {/* Outside the boundary so a crashed route still leaves the consent
          choice reachable. */}
      <CookieBanner t={t} />
    </>
  );
}

export default App;
