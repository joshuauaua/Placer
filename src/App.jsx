/* PLACER — Reimagine Your City */

import { useState, useEffect, lazy, Suspense } from 'react';
import posthog from 'posthog-js';
import { Switch, Route, useLocation } from 'wouter';
import { THEME } from './theme';
import { Logo, Btn } from './components/UI';
import { Icon } from './components/Icon';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieBanner } from './components/CookieBanner';
// Not lazy: the home view, so there is nothing to defer.
import { LandingPage } from './components/LandingPage';
// Not lazy: the nav bar renders it on every view, so there is nothing to defer.
import { UserMenu } from './components/UserMenu';
import { DEFAULT_NAME } from './services/profile';
import { clearPendingImagination, readPendingImagination, savePendingImagination } from './services/api';
import { useIdentity } from './components/useIdentity';

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
const JoinPage = lazy(() => import('./components/JoinPage'));
const ProfilePage = lazy(() => import('./components/ProfilePage'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const AuthCallback = lazy(() => import('./components/AuthCallback'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));

const EMPTY_DRAFT = { title: '', cat: '', blurb: '' };

// The three steps of making an imagination. They render full-bleed, without the nav
// bar and footer the other views sit inside.
const FLOW_VIEWS = ['street', 'describe', 'post'];

// The account views live in the URL, for the same reason the Sandbox does: a
// settings page you cannot bookmark or refresh into is a worse settings page.
//
// Sign in and sign up are in here rather than being routes of their own, and that is
// load-bearing rather than tidy: every one of these paths is matched by the catch-all
// Route below, so moving between them never unmounts MainApp. Somebody who reaches the
// Post step signed out can therefore sign in and come back to the capture, the drawing
// and the draft they left in MainApp's state. A sibling Route would throw all of it away.
const ACCOUNT_PATHS = {
  profile: '/profile',
  settings: '/settings',
  signin: '/signin',
  signup: '/signup',
};
const ACCOUNT_VIEWS = {
  '/profile': 'profile',
  '/settings': 'settings',
  '/signin': 'signin',
  '/signup': 'signup',
};

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

// What /profile and /settings show to someone who has logged out. Not a redirect,
// so the URL still works once they log back in.
function SignedOutNotice({ t, onSignIn }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: t.page, color: t.ink }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <Icon name="user" size={48} stroke={2} style={{ color: t.inkDim, margin: '0 auto 16px' }} />
        <h1 className="placer-disp" style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          You are logged out
        </h1>
        <p style={{ fontSize: 15, color: t.inkDim, marginBottom: 24 }}>
          Log back in to see your profile and settings.
        </p>
        <Btn t={t} variant="primary" onClick={onSignIn}>Sign in</Btn>
      </div>
    </div>
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
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // Composite of the photo plus everything drawn on it, exported when leaving step 1.
  const [preview, setPreview] = useState(null);
  // Where the map should open. Set when an imagination is posted, so the map comes
  // back centred on the new pin instead of the default location.
  const [mapFocus, setMapFocus] = useState(null);

  // Who is signed in, and how that question is being answered — a real Supabase account
  // where a project is configured, the localStorage record from before accounts existed
  // where there is none. useIdentity is the only thing that knows the difference; here
  // `profile` is { name, bio } or null either way. `status` is 'loading' until a session
  // has been read once, which is a state worth waiting out rather than rendering as
  // signed out.
  const { profile, status: identityStatus, accountId, signIn: handleSignIn,
    signOut: signOutOfPlacer, saveProfile: handleSaveProfile } = useIdentity();
  const identityLoading = identityStatus === 'loading';

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
  // The four account views are read off the location the same way, and for the same
  // reason: every one of them is reachable both from a link and from inside the app.
  const [location, navigate] = useLocation();
  const inSandbox = location.startsWith('/sandbox');
  const accountView = ACCOUNT_VIEWS[location];
  const view = accountView ?? (inSandbox ? 'sandbox' : currentView);

  const show = (next) => {
    if (next === 'sandbox') {
      navigate('/sandbox');
      return;
    }
    if (ACCOUNT_PATHS[next]) {
      navigate(ACCOUNT_PATHS[next]);
      return;
    }
    if (inSandbox || accountView) navigate('/');
    setCurrentView(next);
  };

  const handleCaptureView = (viewData) => {
    setCapturedView(viewData);
    // A new capture starts a new imagination.
    setCanvasAssets([]);
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

  // Written down before somebody is sent off to Google or to their email, and picked up
  // again on the way back — both of those reload the page, and everything above is React
  // state. See PostPage's SignInToPost, which calls this before it navigates.
  const stashDraft = () => savePendingImagination({
    capturedView, canvasAssets, draft, preview,
  });

  useEffect(() => {
    // Only once there is an account to post under, and only when this tab is not already
    // in the middle of something — signing in with a password never leaves the page, so
    // in that case what is in memory is already the right thing and is newer than any
    // parked copy.
    if (identityStatus !== 'signedIn' || capturedView) return undefined;

    let cancelled = false;

    readPendingImagination().then((pending) => {
      if (cancelled || !pending) return;
      setCapturedView(pending.capturedView ?? null);
      setCanvasAssets(pending.canvasAssets ?? []);
      setDraft(pending.draft ?? EMPTY_DRAFT);
      setPreview(pending.preview ?? null);
      clearPendingImagination();
      // Back where they left off, which is the whole point of having parked it.
      setCurrentView('post');
    });

    return () => { cancelled = true; };
  }, [identityStatus, capturedView]);

  const handlePosted = () => {
    // Posted, so there is nothing left to come back to.
    clearPendingImagination();
    setMapFocus(capturedView?.position ?? null);
    setCapturedView(null);
    setCanvasAssets([]);
    setDraft(EMPTY_DRAFT);
    setPreview(null);
    show('map');
  };

  const handleExplore = () => {
    posthog.capture('explore_started');
    show('map');
  };

  // Back to the welcome view, because the account views have nothing to show
  // someone who has just left them.
  const handleSignOut = async () => {
    try {
      await signOutOfPlacer();
    } catch (err) {
      // Nothing useful to offer somebody who cannot sign out, and leaving them on the
      // account page would be worse than sending them home with the session intact.
      console.error('Could not sign out:', err);
    }
    show('welcome');
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
            canvasAssets={canvasAssets}
            onCanvasAssetsChange={setCanvasAssets}
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
            needsAccount={identityStatus === 'signedOut'}
          />
        )}
        {view === 'post' && (
          <PostPage
            t={t}
            draft={draft}
            preview={preview}
            capturedView={capturedView}
            canvasAssets={canvasAssets}
            onBack={() => show('describe')}
            onPosted={handlePosted}
            authorName={profile?.name ?? DEFAULT_NAME}
            accountId={accountId}
            // Posting is the one thing an account is required for. Where there is no
            // project configured there are no accounts either, so identityStatus is
            // 'local' and this stays false — the flow works exactly as it always did.
            needsAccount={identityStatus === 'signedOut'}
            checkingAccount={identityLoading}
            onStashDraft={stashDraft}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: t.page, color: t.ink }}>
      {/* Navigation Bar */}
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
        <UserMenu
          t={t}
          profile={profile}
          onNavigate={show}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      </div>

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
            {/* Passed down rather than read from services/profile inside SandboxPage: with
                accounts the name is behind a request, and a component cannot await one in
                its render body. */}
            <SandboxPage t={t} displayName={profile?.name ?? null} />
          </Suspense>
        )}

        {(view === 'signin' || view === 'signup') && (
          <Suspense fallback={<LoadingFallback />}>
            <AuthPage t={t} mode={view} onNavigate={show} />
          </Suspense>
        )}

        {/* Reachable by URL, so both have to cope with arriving before the session has
            been read, and with arriving logged out. */}
        {(view === 'profile' || view === 'settings') && identityLoading && <LoadingFallback />}

        {(view === 'profile' || view === 'settings') && !identityLoading && !profile && (
          <SignedOutNotice t={t} onSignIn={handleSignIn} />
        )}

        {view === 'profile' && profile && (
          <Suspense fallback={<LoadingFallback />}>
            <ProfilePage t={t} profile={profile} accountId={accountId} onNavigate={show} />
          </Suspense>
        )}

        {view === 'settings' && profile && (
          <Suspense fallback={<LoadingFallback />}>
            <SettingsPage t={t} profile={profile} onSaveProfile={handleSaveProfile} onNavigate={show} />
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
        <span style={{ color: t.inkFaint }}>© 2026 PLACER</span>
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
          {/* An entry point only — a scanned QR code or a typed PIN — so it is its
              own route rather than a view inside MainApp. */}
          <Route path="/join"><Suspense fallback={<LoadingFallback />}><JoinPage t={t} /></Suspense></Route>
          {/* Where every link Supabase mails out comes back to, and the screen that
              link leads to. Both are only ever arrived at cold, from another
              application, so unlike /signin they are routes rather than MainApp views. */}
          <Route path="/auth/callback"><Suspense fallback={<LoadingFallback />}><AuthCallback t={t} /></Suspense></Route>
          <Route path="/reset"><Suspense fallback={<LoadingFallback />}><ResetPasswordPage t={t} /></Suspense></Route>
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
