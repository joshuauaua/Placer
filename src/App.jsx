/* PLACER — Reimagine Your City */

import { useState, useEffect, lazy, Suspense } from 'react';
import posthog from 'posthog-js';
import { Switch, Route, useLocation } from 'wouter';
import { THEME } from './theme';
import { Btn } from './components/UI';
import { Icon } from './components/Icon';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieBanner } from './components/CookieBanner';
// Not lazy: the home view, so there is nothing to defer.
import { LandingPage } from './components/LandingPage';
// Not lazy: the nav bar renders it on every view, so there is nothing to defer.
import { GlassNavbar } from './components/GlassNavbar';
import { SiteFooter } from './components/SiteFooter';
import { SideNav } from './components/SideNav';
import { DEFAULT_NAME } from './services/profile';
import { clearPendingImagination, readPendingImagination, savePendingImagination } from './services/api';
import { useIdentity } from './components/useIdentity';

const StreetScreen = lazy(() => import('./components/StreetScreen'));
const SurveyPage = lazy(() => import('./components/SurveyPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const MapContainer = lazy(() => import('./components/MapContainer'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const ResourcesPage = lazy(() => import('./components/ResourcesPage'));
const TermsAndPrivacyPage = lazy(() => import('./components/TermsAndPrivacyPage'));
const DescribePage = lazy(() => import('./components/DescribePage'));
const PostPage = lazy(() => import('./components/PostPage'));
const AdminImaginations = lazy(() => import('./components/AdminImaginations'));
const SandboxPage = lazy(() => import('./components/SandboxPage'));
const JoinPage = lazy(() => import('./components/JoinPage'));
const DashboardPage = lazy(() => import('./components/DashboardPage'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const AuthCallback = lazy(() => import('./components/AuthCallback'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));
const ProjectSetupPage = lazy(() => import('./components/ProjectSetupPage'));
const ProjectsPage = lazy(() => import('./components/ProjectsPage'));
const ProjectDashboardPage = lazy(() => import('./components/ProjectDashboardPage'));
const PublicProjectPage = lazy(() => import('./components/PublicProjectPage'));

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
  dashboard: '/dashboard',
  projects: '/projects',
  settings: '/settings',
  signin: '/signin',
  signup: '/signup',
};
const ACCOUNT_VIEWS = {
  '/dashboard': 'dashboard',
  // The dashboard's old address, so a bookmark from when it was the profile still works.
  '/profile': 'dashboard',
  '/projects': 'projects',
  '/settings': 'settings',
  '/signin': 'signin',
  '/signup': 'signup',
};

// About, Resources and Terms and Privacy each get a bookmarkable link of their own,
// read off the location the same way the account views and the Sandbox are.
const STATIC_PATHS = {
  about: '/about',
  resources: '/resources',
  terms: '/terms-and-privacy',
};
const STATIC_VIEWS = {
  '/about': 'about',
  '/resources': 'resources',
  '/terms-and-privacy': 'terms',
};

/**
 * `/projects/new`, `/projects/<id>` (the public page) or `/projects/<id>/dashboard`,
 * read off the location the same way the Sandbox is — a project's dashboard and its
 * public page both need a link worth bookmarking or sharing. Null for anything else,
 * including a bare `/projects` with nothing after it.
 */
function projectRouteFrom(path) {
  if (!path.startsWith('/projects/')) return null;
  if (path === '/projects/new') return { mode: 'new' };
  const match = /^\/projects\/([^/]+)(\/dashboard)?$/.exec(path);
  if (!match) return null;
  return { mode: match[2] ? 'dashboard' : 'public', id: match[1] };
}

function LoadingFallback() {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#888' }}>Loading…</div>
    </div>
  );
}

// What /dashboard, /projects and /settings show to someone who has logged out. Not a redirect,
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
          Log back in to see your dashboard, projects and settings.
        </p>
        <Btn t={t} variant="primary" onClick={onSignIn}>Sign in</Btn>
      </div>
    </div>
  );
}

function MainApp({ initialView = 'welcome' }) {
  const t = THEME;
  // 'welcome', 'map', 'street', 'describe', 'post', 'about', 'resources', 'sandbox', 'terms'
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
  // Set by a project's public page's "Imagine something for this project" button, so
  // the imagination that comes out the other end of the capture flow is attached to
  // it. Cleared by posting, and by starting a capture any other way (handleExplore) —
  // otherwise a project visited earlier in the session could tag something unrelated.
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Who is signed in, and how that question is being answered — a real Supabase account
  // where a project is configured, the localStorage record from before accounts existed
  // where there is none. useIdentity is the only thing that knows the difference; here
  // `profile` is { name, bio } or null either way. `status` is 'loading' until a session
  // has been read once, which is a state worth waiting out rather than rendering as
  // signed out.
  const { profile, status: identityStatus, accountId, email: accountEmail, signIn: handleSignIn,
    signOut: signOutOfPlacer, saveProfile: handleSaveProfile } = useIdentity();
  const identityLoading = identityStatus === 'loading';

  // The Sandbox is the one view that lives in the URL, because every experiment has a
  // link worth sharing. So it is read off the location rather than held in state, and
  // `show` keeps the two in step: going to the Sandbox writes the URL, and leaving it
  // writes the URL back.
  //
  // It is deliberately not its own <Route> with an initialView. Switch reconciles two
  // sibling Routes as the same component instance, so MainApp is never remounted when
  // the matched Route changes and an initialView prop only ever applies on first mount
  // — which works for a URL that is only an entry point, and silently does nothing for
  // one you can navigate to from inside the app.
  // The account views, and About, Resources and Terms and Privacy, are read off the
  // location the same way, and for the same reason: every one of them is reachable
  // both from a link and from inside the app.
  const [location, navigate] = useLocation();
  const inSandbox = location.startsWith('/sandbox');
  const accountView = ACCOUNT_VIEWS[location];
  const staticView = STATIC_VIEWS[location];
  const projectRoute = projectRouteFrom(location);
  const projectView = projectRoute && { new: 'projectNew', public: 'projectPublic', dashboard: 'projectDashboard' }[projectRoute.mode];
  const view = accountView ?? staticView ?? (inSandbox ? 'sandbox' : projectView ?? currentView);

  const showNewProject = () => navigate('/projects/new');
  const showProjectDashboard = (id) => navigate(`/projects/${id}/dashboard`);
  const showProjectPublic = (id) => navigate(`/projects/${id}`);
  // Sent straight to the chosen experiment with the project attached, rather than
  // to the gallery, because the gallery has nowhere to carry ?project= through into
  // picking one. Only 'budget-ballot' and 'open-vote' can actually host a room today —
  // see supabase/rooms.sql's sandbox_rooms_experiment_known constraint — so ?project=
  // is inert on any other experiment until it opts in too.
  const showProjectSandbox = (id, experimentId) =>
    navigate(`/sandbox/${encodeURIComponent(experimentId)}?project=${encodeURIComponent(id)}`);
  // A room the project already has, from its dashboard — the dashboard has already
  // told this browser it may run it, so it opens as the facilitator's view.
  const showProjectRoom = (experimentId, roomId) =>
    navigate(`/sandbox/${encodeURIComponent(experimentId)}?room=${encodeURIComponent(roomId)}`);

  const show = (next) => {
    if (next === 'sandbox') {
      navigate('/sandbox');
      return;
    }
    if (ACCOUNT_PATHS[next]) {
      navigate(ACCOUNT_PATHS[next]);
      return;
    }
    if (STATIC_PATHS[next]) {
      navigate(STATIC_PATHS[next]);
      return;
    }
    if (inSandbox || accountView || staticView) navigate('/');
    setCurrentView(next);
  };

  const handleImagineForProject = (id) => {
    setActiveProjectId(id);
    show('map');
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
      // Back where they left off, which is the whole point of having parked it. Off
      // /dashboard first, where the redirect below will already have sent them.
      navigate('/', { replace: true });
      setCurrentView('post');
    });

    return () => { cancelled = true; };
  }, [identityStatus, capturedView, navigate]);

  // The dashboard is home for anyone with a real account: signing in lands on it, and
  // so does opening the app cold with a session, or the logo. The landing page is only
  // for visitors who are signed out. Not in the local, no-project mode, where everybody
  // is "signed in" under the default name and the landing page would never show.
  useEffect(() => {
    if (view === 'welcome' && identityStatus === 'signedIn') navigate('/dashboard', { replace: true });
  }, [view, identityStatus, navigate]);

  const handlePosted = () => {
    // Posted, so there is nothing left to come back to.
    clearPendingImagination();
    setMapFocus(capturedView?.position ?? null);
    setCapturedView(null);
    setCanvasAssets([]);
    setDraft(EMPTY_DRAFT);
    setPreview(null);
    setActiveProjectId(null);
    show('map');
  };

  const handleExplore = () => {
    posthog.capture('explore_started');
    // The ordinary way onto the map, as opposed to arriving through a project's
    // public page — see activeProjectId's own comment.
    setActiveProjectId(null);
    show('map');
  };

  // With no project there are no accounts to create, so Create Account does
  // what Log In does there: the instant local sign-in. Otherwise, the sign-up form.
  const handleCreateAccount = () => {
    if (identityStatus === 'local') handleLogIn();
    else show('signup');
  };

  // The nav bar's Log In, as opposed to the sign-in prompts inside a page, which leave
  // somebody where they were. Locally there is no /signin to come back from, so this is
  // where the dashboard gets to be the first thing after logging in.
  const handleLogIn = () => {
    handleSignIn();
    if (identityStatus === 'local') show('dashboard');
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
            projectId={activeProjectId}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: t.page, color: t.ink }}>
      <GlassNavbar
        t={t}
        profile={profile}
        loading={identityLoading}
        onNavigate={show}
        onSignIn={handleLogIn}
        onCreateAccount={handleCreateAccount}
        onSignOut={handleSignOut}
      />

      {/* Main Content. The map fills it and has no footer. Every other view scrolls
          here, with the footer after it — see .placer-scroll-view in index.css. The
          side nav shares a row with the page rather than with the whole area, so it
          ends where the page does and the footer runs the full width beneath both. */}
      <div className={`placer-under-glass-nav${view === 'map' ? '' : ' placer-scroll-view'}`}
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: view === 'map' ? 'hidden' : undefined }}>
        <div className="placer-app-row">
          {/* Only once somebody is signed in: everything on it is a place an account
              goes back to. Held back while the session is still being read, the same as
              the nav bar's right-hand end. */}
          {!identityLoading && profile && (
            <SideNav t={t} view={view} onNavigate={show} onExplore={handleExplore}
              onNewProject={showNewProject} />
          )}

          <div className="placer-app-page">
            {/* Held back while the session is read, so somebody signed in does not see the
                landing page flash up before the redirect to their dashboard. */}
            {view === 'welcome' && identityLoading && <LoadingFallback />}
            {view === 'welcome' && !identityLoading && <LandingPage t={t} />}

            {view === 'map' && (
              <Suspense fallback={<LoadingFallback />}>
                <MapContainer
                  onCaptureView={handleCaptureView}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  initialCenter={mapFocus}
                  accountId={accountId}
                  authorName={profile?.name ?? DEFAULT_NAME}
                  onSignIn={handleSignIn}
                  onOpenProject={showProjectPublic}
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
                <SandboxPage
                  t={t}
                  displayName={profile?.name ?? null}
                  // Only opening a room is gated. Joining, contributing and reading are not.
                  needsAccount={identityStatus === 'signedOut'}
                  onSignIn={handleSignIn}
                />
              </Suspense>
            )}

            {(view === 'signin' || view === 'signup') && (
              <Suspense fallback={<LoadingFallback />}>
                <AuthPage t={t} mode={view} onNavigate={show} />
              </Suspense>
            )}

            {/* Reachable by URL, so both have to cope with arriving before the session has
                been read, and with arriving logged out. */}
            {(view === 'dashboard' || view === 'settings' || view === 'projects') && identityLoading && <LoadingFallback />}

            {(view === 'dashboard' || view === 'settings' || view === 'projects') && !identityLoading && !profile && (
              <SignedOutNotice t={t} onSignIn={handleSignIn} />
            )}

            {view === 'dashboard' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <DashboardPage t={t} profile={profile} accountId={accountId} onNavigate={show}
                  onNewProject={showNewProject} onOpenProjectDashboard={showProjectDashboard}
                  onSignIn={handleSignIn} />
              </Suspense>
            )}

            {view === 'projects' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <ProjectsPage t={t} accountId={accountId} onNewProject={showNewProject}
                  onOpenProjectDashboard={showProjectDashboard} />
              </Suspense>
            )}

            {view === 'settings' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <SettingsPage t={t} profile={profile} email={accountEmail}
                  onSaveProfile={handleSaveProfile} onNavigate={show} />
              </Suspense>
            )}

            {view === 'terms' && (
              <Suspense fallback={<LoadingFallback />}>
                <TermsAndPrivacyPage t={t} />
              </Suspense>
            )}

            {/* projectNew and projectDashboard need an account, the same shape the dashboard and
                settings are gated — starting or managing a project is not something a
                signed-out visitor can do. projectPublic needs nothing: a project's public
                page is exactly the thing anyone should be able to open cold, unsignedin,
                from a shared link. */}
            {view === 'projectNew' && identityLoading && <LoadingFallback />}

            {view === 'projectNew' && !identityLoading && !profile && (
              <SignedOutNotice t={t} onSignIn={handleSignIn} />
            )}

            {view === 'projectNew' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <ProjectSetupPage t={t} accountId={accountId} accountName={profile.name}
                  onSaved={(project) => showProjectDashboard(project.id)}
                  onCancel={() => show('dashboard')} />
              </Suspense>
            )}

            {view === 'projectDashboard' && identityLoading && <LoadingFallback />}

            {view === 'projectDashboard' && !identityLoading && !profile && (
              <SignedOutNotice t={t} onSignIn={handleSignIn} />
            )}

            {view === 'projectDashboard' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <ProjectDashboardPage t={t} accountId={accountId} projectId={projectRoute.id}
                  onOpenSandbox={showProjectSandbox}
                  onOpenRoom={showProjectRoom}
                  onNavigateToPublic={showProjectPublic} />
              </Suspense>
            )}

            {view === 'projectPublic' && (
              <Suspense fallback={<LoadingFallback />}>
                <PublicProjectPage t={t} projectId={projectRoute.id} accountId={accountId}
                  onImagineForProject={handleImagineForProject} />
              </Suspense>
            )}
          </div>
        </div>
        {view !== 'map' && (
          <SiteFooter t={t} view={view}
            onNavigate={(next) => (next === 'map' ? handleExplore() : show(next))} />
        )}
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
          {/* Everything else, /sandbox, /about, /resources and /terms-and-privacy
              included — MainApp reads those off the location itself. */}
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
