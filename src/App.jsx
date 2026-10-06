/* PLACER — Reimagine Your City */

import { useState, useEffect, lazy, Suspense } from 'react';
import posthog from 'posthog-js';
import { Switch, Route, Redirect, useLocation, useSearch } from 'wouter';
import { THEME } from './theme';
import { Btn, LoadingMark } from './components/UI';
import { Icon } from './components/Icon';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieBanner } from './components/CookieBanner';
import { BugReportButton } from './components/BugReportButton';
// Not lazy: the home view, so there is nothing to defer.
import { LandingPage } from './components/LandingPage';
// Not lazy: the nav bar renders it on every view, so there is nothing to defer.
import { GlassNavbar } from './components/GlassNavbar';
import { SiteFooter } from './components/SiteFooter';
import { SideNav } from './components/SideNav';
import { DEFAULT_NAME } from './services/profile';
import { clearPendingImagination, readPendingImagination, savePendingImagination } from './services/api';
import { useIdentity } from './components/useIdentity';
import { isSupabaseConfigured, readMyOrganisations } from './services/organisations';

const StreetScreen = lazy(() => import('./components/StreetScreen'));
const SurveyPage = lazy(() => import('./components/SurveyPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const MapContainer = lazy(() => import('./components/MapContainer'));
const ExplorePage = lazy(() => import('./components/ExplorePage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const UserLabsPage = lazy(() => import('./components/UserLabsPage'));
const ResourcesPage = lazy(() => import('./components/ResourcesPage'));
const ResourceArticlePage = lazy(() => import('./components/ResourceArticlePage'));
const GuidesPage = lazy(() => import('./components/GuidesPage'));
const FaqPage = lazy(() => import('./components/FaqPage'));
const QuickstartPage = lazy(() => import('./components/QuickstartPage'));
const ProjectExamplesPage = lazy(() => import('./components/ProjectExamplesPage'));
const ContactPage = lazy(() => import('./components/ContactPage'));
const TermsAndPrivacyPage = lazy(() => import('./components/TermsAndPrivacyPage'));
const DescribePage = lazy(() => import('./components/DescribePage'));
const PostPage = lazy(() => import('./components/PostPage'));
const AdminImaginations = lazy(() => import('./components/AdminImaginations'));
const ToolkitPage = lazy(() => import('./components/ToolkitPage'));
const JoinPage = lazy(() => import('./components/JoinPage'));
const DashboardPage = lazy(() => import('./components/DashboardPage'));
const ActivityPage = lazy(() => import('./components/ActivityPage'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const AuthCallback = lazy(() => import('./components/AuthCallback'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));
const ProjectSetupPage = lazy(() => import('./components/ProjectSetupPage'));
const ProjectsPage = lazy(() => import('./components/ProjectsPage'));
const ProjectDashboardPage = lazy(() => import('./components/ProjectDashboardPage'));
const PublicProjectPage = lazy(() => import('./components/PublicProjectPage'));
const PublicProfilePage = lazy(() => import('./components/PublicProfilePage'));
const OrganisationsPage = lazy(() => import('./components/OrganisationsPage'));
const OrganisationSetupPage = lazy(() => import('./components/OrganisationSetupPage'));
const OrganisationDashboardPage = lazy(() => import('./components/OrganisationDashboardPage'));
const PublicOrganisationPage = lazy(() => import('./components/PublicOrganisationPage'));

const EMPTY_DRAFT = { title: '', cat: '', blurb: '' };

// The three steps of making an imagination. They render full-bleed, without the nav
// bar and footer the other views sit inside.
const FLOW_VIEWS = ['street', 'describe', 'post'];

// The Toolkit tool the imagination flow belongs to (toolkit/tools.js).
const REIMAGINE_TOOL = 'reimagine-a-space';

// The account views live in the URL, for the same reason the Toolkit does: a
// settings page you cannot bookmark or refresh into is a worse settings page.
//
// Sign in and sign up are in here rather than being routes of their own, and that is
// load-bearing rather than tidy: every one of these paths is matched by the catch-all
// Route below, so moving between them never unmounts MainApp. Somebody who reaches the
// Post step signed out can therefore sign in and come back to the capture, the drawing
// and the draft they left in MainApp's state. A sibling Route would throw all of it away.
const ACCOUNT_PATHS = {
  dashboard: '/dashboard',
  activity: '/activity',
  projects: '/projects',
  organisations: '/organisations',
  settings: '/settings',
  signin: '/signin',
  signup: '/signup',
};
const ACCOUNT_VIEWS = {
  '/dashboard': 'dashboard',
  // The dashboard's old address, so a bookmark from when it was the profile still works.
  '/profile': 'dashboard',
  '/activity': 'activity',
  '/projects': 'projects',
  '/organisations': 'organisations',
  '/settings': 'settings',
  '/signin': 'signin',
  '/signup': 'signup',
};

// Explore, About, Contact, Resources, Guides, the FAQ, Terms and Privacy and User
// Labs each get a bookmarkable link of their own, read off the location the same way the account
// views and the Toolkit are. Explore is still 'map' inside the app, which is what
// the side nav, the footer and the dashboard all ask for.
const STATIC_PATHS = {
  map: '/explore',
  about: '/about',
  contact: '/contact',
  resources: '/resources',
  guides: '/guides',
  faq: '/faq',
  quickstart: '/quickstart',
  projectExamples: '/project-examples',
  terms: '/terms-and-privacy',
  // Linked from the landing page's Apply to User Labs card.
  userLabs: '/user-labs',
};
const STATIC_VIEWS = Object.fromEntries(
  Object.entries(STATIC_PATHS).map(([view, path]) => [path, view]),
);

/**
 * `/projects/new`, `/projects/<id>` (the public page) or `/projects/<id>/dashboard`,
 * read off the location the same way the Toolkit is — a project's dashboard and its
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

/**
 * `/organisations/new`, `/organisations/<id>` (the public page) or
 * `/organisations/<id>/dashboard` — the same three shapes a project has, for the same
 * reasons. Null for anything else, including a bare `/organisations`, which is the
 * list of this account's own.
 */
function organisationRouteFrom(path) {
  if (!path.startsWith('/organisations/')) return null;
  if (path === '/organisations/new') return { mode: 'new' };
  const match = /^\/organisations\/([^/]+)(\/dashboard)?$/.exec(path);
  if (!match) return null;
  return { mode: match[2] ? 'dashboard' : 'public', id: decodeURIComponent(match[1]) };
}

/**
 * `/people/<account id>`, somebody's public profile — read off the location for the
 * same reason a project's public page is. Null for anything else.
 */
function personIdFrom(path) {
  const match = /^\/people\/([^/]+)$/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * `/resources/<slug>`, one article from Storyblok — read off the location for the
 * same reason a person's public profile is. The slug is the story's full slug, so it
 * may contain slashes when the story sits in a folder. Null for anything else.
 */
function resourceSlugFrom(path) {
  const match = /^\/resources\/(.+)$/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}

function LoadingFallback() {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingMark />
    </div>
  );
}

// Views that need an account, and say so to someone who has logged out.
const SIGNED_IN_VIEWS = ['dashboard', 'activity', 'settings', 'projects', 'organisations',
  'projectNew', 'projectDashboard', 'organisationNew', 'organisationDashboard'];

// What /dashboard, /projects and /settings show to someone who has logged out. Not a redirect,
// so the URL still works once they log back in.
function SignedOutNotice({ t, onSignIn }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: t.page, color: t.ink }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <Icon name="user" size={48} stroke={2} style={{ color: t.inkDim, margin: '0 auto 16px' }} />
        <h1 className="placer-disp" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
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
  // 'welcome', 'map', 'imagine', 'street', 'describe', 'post', 'about', 'contact',
  // 'resources', 'guides', 'faq', 'toolkit', 'terms'. 'map' is Explore; 'imagine' is
  // the map an imagination is captured from, which is not Explore's and has no URL,
  // since the capture flow it starts lives in this state too.
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
  // Set when Reimagine a Space is started for a project (opened from the project's
  // page, so its URL carries ?project=), so the imagination that comes out the other
  // end of the capture flow is attached to it. Cleared by posting, and by starting a capture any other way (handleExplore) —
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

  // The organisations this account is an admin of, which the Organisations page lists
  // first, and in the name of any of which a new project can be run. Re-read whenever something here changes the answer —
  // creating one, leaving one, closing one, claiming one.
  const [organisations, setOrganisations] = useState([]);
  const [organisationsVersion, setOrganisationsVersion] = useState(0);
  const refreshOrganisations = () => setOrganisationsVersion((v) => v + 1);

  useEffect(() => {
    if (!accountId || !isSupabaseConfigured()) {
      setOrganisations([]);
      return undefined;
    }
    let cancelled = false;
    readMyOrganisations(accountId)
      .then((found) => { if (!cancelled) setOrganisations(found); })
      .catch((err) => {
        // Before organisations.sql has run there is no table to read. Nothing else
        // depends on this, so the page simply shows none as yours.
        if (!cancelled) console.error('Could not load your organisations:', err);
      });
    return () => { cancelled = true; };
  }, [accountId, organisationsVersion]);

  // The Toolkit is the one view that lives in the URL, because every tool has a
  // link worth sharing. So it is read off the location rather than held in state, and
  // `show` keeps the two in step: going to the Toolkit writes the URL, and leaving it
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
  const inToolkit = location.startsWith('/toolkit');
  const accountView = ACCOUNT_VIEWS[location];
  const staticView = STATIC_VIEWS[location];
  const projectRoute = projectRouteFrom(location);
  const projectView = projectRoute && { new: 'projectNew', public: 'projectPublic', dashboard: 'projectDashboard' }[projectRoute.mode];
  const organisationRoute = organisationRouteFrom(location);
  const organisationView = organisationRoute
    && { new: 'organisationNew', public: 'organisationPublic', dashboard: 'organisationDashboard' }[organisationRoute.mode];
  // `/projects/new?organisation=<id>`, from an organisation's dashboard: the new
  // project starts out run in that organisation's name.
  const newProjectOrganisationId = new URLSearchParams(useSearch()).get('organisation');
  const personId = personIdFrom(location);
  const resourceSlug = resourceSlugFrom(location);
  const view = accountView ?? staticView
    ?? (inToolkit ? 'toolkit' : projectView ?? organisationView ?? (personId ? 'profilePublic'
      : resourceSlug ? 'resourceArticle' : currentView));

  // The imagine map fills the window and does not scroll, so it has no footer. Explore
  // scrolls like a page, its map in a frame of its own, with the footer under it.
  const fullHeight = view === 'imagine';

  const showNewProject = () => navigate('/projects/new');
  const showNewOrganisationProject = (organisationId) =>
    navigate(`/projects/new?organisation=${encodeURIComponent(organisationId)}`);
  const showNewOrganisation = () => navigate('/organisations/new');
  const showOrganisationDashboard = (id) => navigate(`/organisations/${encodeURIComponent(id)}/dashboard`);
  const showOrganisationPublic = (id) => navigate(`/organisations/${encodeURIComponent(id)}`);
  // A person's, organisation's or project's public page, from a search suggestion or a
  // followed item. A person is 'person' to search and 'user' to follows.
  const showPublicPage = (kind, id) => {
    if (kind === 'person' || kind === 'user') showPublicProfile(id);
    else if (kind === 'organisation') showOrganisationPublic(id);
    else showProjectPublic(id);
  };
  const showProjectDashboard = (id) => navigate(`/projects/${id}/dashboard`);
  const showProjectPublic = (id) => navigate(`/projects/${id}`);
  const showPublicProfile = (id) => navigate(`/people/${encodeURIComponent(id)}`);
  // Sent straight to the chosen tool with the project attached, rather than
  // to the gallery, because the gallery has nowhere to carry ?project= through into
  // picking one. Only 'budget-ballot' and 'open-vote' can actually host a room today —
  // see supabase/rooms.sql's toolkit_rooms_tool_known constraint — so ?project=
  // is inert on any other tool until it opts in too.
  const showProjectToolkit = (id, toolId) =>
    navigate(`/toolkit/${encodeURIComponent(toolId)}?project=${encodeURIComponent(id)}`);
  // A room the project already has, from its dashboard — the dashboard has already
  // told this browser it may run it, so it opens as the facilitator's view.
  const showProjectRoom = (toolId, roomId) =>
    navigate(`/toolkit/${encodeURIComponent(toolId)}?room=${encodeURIComponent(roomId)}`);

  const show = (next) => {
    if (next === 'toolkit') {
      navigate('/toolkit');
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
    if (inToolkit || accountView || staticView || personId || resourceSlug || organisationRoute) navigate('/');
    setCurrentView(next);
  };

  // Imagining is the Toolkit's Reimagine a Space now, opened like any tool — from the
  // Toolkit, or from a project's page with the project attached. Its Get started hands
  // back here to run the flow.
  const handleLaunchTool = (toolId, projectId) => {
    if (toolId !== REIMAGINE_TOOL) return;
    posthog.capture('imagination_started', { project: Boolean(projectId) });
    setActiveProjectId(projectId ?? null);
    show('imagine');
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
    show('imagine');
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
    show('imagine');
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
        onSearchSelect={({ kind, id }) => showPublicPage(kind, id)}
      />

      {/* Main Content. The imagine map fills it and has no footer. Every other view scrolls
          here, with the footer after it — see .placer-scroll-view in index.css. The
          side nav shares a row with the page rather than with the whole area, so it
          ends where the page does and the footer runs the full width beneath both. */}
      <div className={`placer-under-glass-nav${fullHeight ? '' : ' placer-scroll-view'}`}
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: fullHeight ? 'hidden' : undefined }}>
        <div className="placer-app-row">
          {/* Only once somebody is signed in: everything on it is a place an account
              goes back to. Held back while the session is still being read, the same as
              the nav bar's right-hand end. */}
          {!identityLoading && profile && (
            <SideNav t={t} view={view} onNavigate={show} onExplore={handleExplore}
              onNewProject={showNewProject} showOrganisations={isSupabaseConfigured()} />
          )}

          <div className="placer-app-page">
            {/* Held back while the session is read, so somebody signed in does not see the
                landing page flash up before the redirect to their dashboard. */}
            {view === 'welcome' && identityLoading && <LoadingFallback />}
            {view === 'welcome' && !identityLoading && <LandingPage t={t} />}

            {view === 'map' && (
              <Suspense fallback={<LoadingFallback />}>
                <ExplorePage
                  apiKey={GOOGLE_MAPS_API_KEY}
                  homeCenter={profile?.locationPoint ?? null}
                  accountId={accountId}
                  onSignIn={handleSignIn}
                  onOpenProject={showProjectPublic}
                  onOpenOrganisation={showOrganisationPublic}
                />
              </Suspense>
            )}

            {view === 'imagine' && (
              <Suspense fallback={<LoadingFallback />}>
                <MapContainer
                  onCaptureView={handleCaptureView}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  initialCenter={mapFocus}
                  homeCenter={profile?.locationPoint ?? null}
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

            {view === 'userLabs' && (
              <Suspense fallback={<LoadingFallback />}>
                <UserLabsPage t={t} />
              </Suspense>
            )}

            {view === 'resources' && (
              <Suspense fallback={<LoadingFallback />}>
                <ResourcesPage t={t} />
              </Suspense>
            )}

            {view === 'contact' && (
              <Suspense fallback={<LoadingFallback />}>
                <ContactPage t={t} />
              </Suspense>
            )}

            {view === 'guides' && (
              <Suspense fallback={<LoadingFallback />}>
                <GuidesPage t={t} />
              </Suspense>
            )}

            {view === 'quickstart' && (
              <Suspense fallback={<LoadingFallback />}>
                <QuickstartPage t={t} onNewProject={showNewProject} />
              </Suspense>
            )}

            {view === 'projectExamples' && (
              <Suspense fallback={<LoadingFallback />}>
                <ProjectExamplesPage t={t} onOpenProject={showProjectPublic}
                  onNewProject={profile ? showNewProject : undefined} />
              </Suspense>
            )}

            {view === 'faq' && (
              <Suspense fallback={<LoadingFallback />}>
                <FaqPage t={t} />
              </Suspense>
            )}

            {view === 'resourceArticle' && (
              <Suspense fallback={<LoadingFallback />}>
                <ResourceArticlePage t={t} slug={resourceSlug} />
              </Suspense>
            )}

            {view === 'toolkit' && (
              <Suspense fallback={<LoadingFallback />}>
                {/* Passed down rather than read from services/profile inside ToolkitPage: with
                    accounts the name is behind a request, and a component cannot await one in
                    its render body. */}
                <ToolkitPage
                  t={t}
                  displayName={profile?.name ?? null}
                  // Only opening a room is gated. Joining, contributing and reading are not.
                  needsAccount={identityStatus === 'signedOut'}
                  onSignIn={handleSignIn}
                  onLaunchTool={handleLaunchTool}
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
            {SIGNED_IN_VIEWS.includes(view) && identityLoading && <LoadingFallback />}

            {SIGNED_IN_VIEWS.includes(view) && !identityLoading && !profile && (
              <SignedOutNotice t={t} onSignIn={handleSignIn} />
            )}

            {view === 'dashboard' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <DashboardPage t={t} profile={profile} accountId={accountId} onNavigate={show}
                  onNewProject={showNewProject}
                  onSignIn={handleSignIn} onSignOut={handleSignOut} onExplore={handleExplore}
                  onOpenPublicProfile={showPublicProfile}
                  onOpenProject={showProjectDashboard} onOpenProjectPage={showProjectPublic}
                  onOpenOrganisationPage={showOrganisationPublic} />
              </Suspense>
            )}

            {view === 'activity' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <ActivityPage t={t} onOpenProject={showProjectPublic} onOpenOrganisation={showOrganisationPublic} />
              </Suspense>
            )}

            {view === 'projects' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <ProjectsPage t={t} accountId={accountId} onNewProject={showNewProject}
                  onOpenProjectDashboard={showProjectDashboard} />
              </Suspense>
            )}

            {view === 'organisations' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <OrganisationsPage t={t} organisations={organisations}
                  onNewOrganisation={showNewOrganisation}
                  onOpenOrganisationDashboard={showOrganisationDashboard}
                  onOpenOrganisation={showOrganisationPublic} />
              </Suspense>
            )}

            {view === 'organisationNew' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <OrganisationSetupPage t={t} accountId={accountId}
                  onSaved={(organisation) => {
                    refreshOrganisations();
                    showOrganisationDashboard(organisation.id);
                  }}
                  onCancel={() => show('settings')} />
              </Suspense>
            )}

            {view === 'organisationDashboard' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <OrganisationDashboardPage t={t} accountId={accountId}
                  organisationId={organisationRoute.id}
                  onNavigateToPublic={showOrganisationPublic}
                  onNewProject={showNewOrganisationProject}
                  onOpenProjectDashboard={showProjectDashboard}
                  onChanged={refreshOrganisations}
                  onLeft={() => { refreshOrganisations(); show('dashboard'); }} />
              </Suspense>
            )}

            {/* Public, like a project's page: anyone with the link can open it cold. */}
            {view === 'organisationPublic' && (
              <Suspense fallback={<LoadingFallback />}>
                <PublicOrganisationPage t={t} organisationId={organisationRoute.id} accountId={accountId}
                  isAdmin={organisations.some(({ id }) => id === organisationRoute.id)}
                  onOpenDashboard={showOrganisationDashboard}
                  onOpenProject={showProjectPublic}
                  onClaimed={refreshOrganisations} />
              </Suspense>
            )}

            {view === 'settings' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <SettingsPage t={t} profile={profile} email={accountEmail}
                  onSaveProfile={handleSaveProfile} onNavigate={show}
                  organisations={organisations} onNewOrganisation={showNewOrganisation}
                  onOpenOrganisationDashboard={showOrganisationDashboard} />
              </Suspense>
            )}

            {view === 'terms' && (
              <Suspense fallback={<LoadingFallback />}>
                <TermsAndPrivacyPage t={t} />
              </Suspense>
            )}

            {/* projectNew and projectDashboard need an account (SIGNED_IN_VIEWS) —
                starting or managing a project is not something a signed-out visitor can
                do. projectPublic needs nothing: a project's public page is exactly the
                thing anyone should be able to open cold, unsignedin, from a shared link. */}
            {view === 'projectNew' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <ProjectSetupPage t={t} accountId={accountId} accountName={profile.name}
                  organisations={organisations}
                  initialOrganisationId={newProjectOrganisationId}
                  onSaved={(project) => showProjectDashboard(project.id)}
                  onCancel={() => show('dashboard')} />
              </Suspense>
            )}

            {view === 'projectDashboard' && profile && (
              <Suspense fallback={<LoadingFallback />}>
                <ProjectDashboardPage t={t} accountId={accountId} projectId={projectRoute.id}
                  organisations={organisations}
                  onOpenToolkit={showProjectToolkit}
                  onOpenRoom={showProjectRoom}
                  onNavigateToPublic={showProjectPublic}
                  onDeleted={() => show('projects')} />
              </Suspense>
            )}

            {/* Public, like a project's page: anyone with the link can open it cold. */}
            {view === 'profilePublic' && (
              <Suspense fallback={<LoadingFallback />}>
                <PublicProfilePage t={t} userId={personId} accountId={accountId} onOpen={showPublicPage} />
              </Suspense>
            )}

            {view === 'projectPublic' && (
              <Suspense fallback={<LoadingFallback />}>
                <PublicProjectPage t={t} projectId={projectRoute.id} accountId={accountId}
                  onBack={() => show('projects')}
                  onOpenProject={showProjectPublic}
                  onOpenOrganisation={showOrganisationPublic}
                  onOpenToolkit={showProjectToolkit}
                  onOpenRoom={showProjectRoom} />
              </Suspense>
            )}
          </div>
        </div>
        {!fullHeight && (
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
          <h1 className="placer-disp" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Access Restricted</h1>
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

/**
 * The Toolkit used to be the Sandbox, at /sandbox. Links to it are out there in
 * messages and project pages, so they are sent on to the same place under /toolkit,
 * query string (a room or a project) and all.
 */
function SandboxRedirect() {
  // Inside the nested /sandbox route, so the location is what came after it, and a
  // leading ~ makes the target absolute rather than relative to /sandbox.
  const [rest] = useLocation();
  const search = useSearch();
  const path = rest === '/' ? '' : rest;
  return <Redirect to={`~/toolkit${path}${search ? `?${search}` : ''}`} replace />;
}

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
          <Route path="/sandbox" nest><SandboxRedirect /></Route>
          <Route path="/join"><Suspense fallback={<LoadingFallback />}><JoinPage t={t} /></Suspense></Route>
          {/* Where every link Supabase mails out comes back to, and the screen that
              link leads to. Both are only ever arrived at cold, from another
              application, so unlike /signin they are routes rather than MainApp views. */}
          <Route path="/auth/callback"><Suspense fallback={<LoadingFallback />}><AuthCallback t={t} /></Suspense></Route>
          <Route path="/reset"><Suspense fallback={<LoadingFallback />}><ResetPasswordPage t={t} /></Suspense></Route>
          {/* Everything else, /toolkit and the STATIC_PATHS pages included —
              MainApp reads those off the location itself. */}
          <Route><MainApp /></Route>
        </Switch>
      </ErrorBoundary>
      {/* Outside the boundary so a crashed route still leaves the consent
          choice reachable. */}
      <CookieBanner t={t} />
      {/* Outside it too: a crash is exactly when somebody wants to report one. */}
      <BugReportButton t={t} />
    </>
  );
}

export default App;
