/* PLOT — Reimagine Your City */

import { useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { THEME } from './theme';
import { Logo, Btn, Avatar } from './components/UI';
import { Icon } from './components/Icon';
import MapContainer from './components/MapContainer';
import { AboutPage } from './components/AboutPage';
import { ResourcesPage } from './components/ResourcesPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const StreetScreen = lazy(() => import('./components/StreetScreen'));
const SurveyPage = lazy(() => import('./components/SurveyPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

function LoadingFallback() {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#888' }}>Loading…</div>
    </div>
  );
}

function MainApp() {
  const t = THEME;
  const [currentView, setCurrentView] = useState('welcome'); // 'welcome', 'map', 'street', 'about', 'resources'
  const [capturedView, setCapturedView] = useState(null);

  const handleCaptureView = (viewData) => {
    setCapturedView(viewData);
    setCurrentView('street');
  };

  const handleBackToMap = () => {
    setCurrentView('map');
  };

  const handleNextStep = () => {
    alert('Next: Describe your imagination');
  };

  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';


  if (currentView === 'street') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <StreetScreen t={t} onBack={handleBackToMap} onNext={handleNextStep} capturedView={capturedView} />
      </Suspense>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: t.page, color: t.ink }}>
      {/* Navigation Bar */}
      <div style={{ height: 66, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 20,
        padding: '0 22px', background: t.chrome, borderBottom: `1px solid ${t.line}`, zIndex: 60 }}>
        <div onClick={() => setCurrentView('welcome')} style={{ cursor: 'pointer' }}>
          <Logo t={t} size={20} />
        </div>
        <div style={{ width: 1, height: 26, background: t.line }} />
        <nav style={{ display: 'flex', gap: 4 }}>
          <span
            onClick={() => setCurrentView('about')}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
            color: currentView === 'about' ? t.ink : t.inkDim,
            background: currentView === 'about' ? t.surfaceAlt : 'transparent',
            cursor: 'pointer' }}>About</span>
          <span
            onClick={() => setCurrentView('resources')}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 14.5, fontWeight: 600,
            color: currentView === 'resources' ? t.ink : t.inkDim,
            background: currentView === 'resources' ? t.surfaceAlt : 'transparent',
            cursor: 'pointer' }}>Resources</span>
        </nav>
        <div style={{ flex: 1 }} />
        <button style={{ width: 42, height: 42, borderRadius: 10, border: `1.5px solid ${t.line}`, background: 'transparent',
          color: t.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <Icon name="bell" size={20} stroke={2} />
          <span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#D6452F' }} />
        </button>
        <Btn t={t} variant="accent" icon="sparkle" onClick={() => setCurrentView('map')}>Explore</Btn>
        <Avatar name="You There" size={40} ring={t.line} />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {currentView === 'welcome' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${t.page} 0%, ${t.chrome} 100%)` }}>
            <div style={{ maxWidth: 600, textAlign: 'center', padding: 40 }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ width: 80, height: 80, background: t.accent, borderRadius: 16, margin: '0 auto 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="pin" size={44} stroke={2.4} style={{ color: t.accentInk }} />
                </div>
                <h1 className="plot-disp" style={{ fontSize: 48, fontWeight: 900, color: t.ink, letterSpacing: '-0.03em', marginBottom: 16 }}>
                  Reimagine Your City
                </h1>
                <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, marginBottom: 32 }}>
                  PLOT is a community platform for visualizing public space improvements.
                  Place assets, share your vision, and bring better spaces to life.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Btn t={t} variant="accent" size="lg" icon="sparkle" onClick={() => setCurrentView('map')}>
                  Start imagining
                </Btn>
                <Btn t={t} variant="outline" size="lg">
                  Explore ideas
                </Btn>
              </div>
              <div style={{ marginTop: 48, padding: 24, background: t.surface, borderRadius: 12, border: `1px solid ${t.line}`,
                boxShadow: t.shadow }}>
                <div className="plot-mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: t.inkDim,
                  textTransform: 'uppercase', marginBottom: 16 }}>How it works</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, textAlign: 'center' }}>
                  <div>
                    <Icon name="search" size={28} stroke={2} style={{ color: t.accent, margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>Find a spot</div>
                    <div style={{ fontSize: 12, color: t.inkDim }}>Navigate to any location</div>
                  </div>
                  <div>
                    <Icon name="layers" size={28} stroke={2} style={{ color: t.accent, margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>Place assets</div>
                    <div style={{ fontSize: 12, color: t.inkDim }}>Add trees, benches, art</div>
                  </div>
                  <div>
                    <Icon name="share" size={28} stroke={2} style={{ color: t.accent, margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 4 }}>Share it</div>
                    <div style={{ fontSize: 12, color: t.inkDim }}>Get community feedback</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'map' && (
          <MapContainer
            onCaptureView={handleCaptureView}
            apiKey={GOOGLE_MAPS_API_KEY}
          />
        )}

        {currentView === 'about' && (
          <AboutPage t={t} />
        )}

        {currentView === 'resources' && (
          <ResourcesPage t={t} />
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
          <h1 className="plot-disp" style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Access Restricted</h1>
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
    <ErrorBoundary>
      <Routes>
        <Route path="/survey" element={<Suspense fallback={<LoadingFallback />}><SurveyPage t={t} /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<LoadingFallback />}><AdminGate t={t}><AdminDashboard t={t} /></AdminGate></Suspense>} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
