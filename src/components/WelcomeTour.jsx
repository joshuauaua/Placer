/* PLACER — when the welcome tour (OnboardingDialog) is open, kept above whatever page is.
 *
 * The tour's steps send somebody somewhere — the projects, the map, the Toolkit, a new
 * project — and the tour carries on over that page, at its next step, so it has to
 * outlive the page it started on. App renders this once, beside the pages rather than inside one.
 *
 * It opens by itself the first time an account reaches its dashboard (`autoOpen`, see
 * services/onboarding.js), and whenever the address carries `?tour` — Settings' "Take
 * the welcome tour again" links to /dashboard?tour — which it then drops, so a reload
 * does not bring it back. However it is closed, it is recorded as seen.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { markOnboarded, needsOnboarding } from '../services/onboarding';

// Loaded when it opens: it reads the Toolkit's categories, which the pages it sits
// over do not all need.
const OnboardingDialog = lazy(() => import('./OnboardingDialog'));

export function WelcomeTour({ t, accountId = null, name = '', autoOpen = false,
  onOpenProjects, onExplore, onOpenToolkit, onNewProject, onEditProfile }) {
  const [location, navigate] = useLocation();
  const requested = new URLSearchParams(useSearch()).has('tour');
  const [open, setOpen] = useState(false);
  // The account whose first visit has been checked, so going back to the dashboard
  // later does not ask again.
  const checked = useRef(null);

  useEffect(() => {
    if (!requested) return;
    setOpen(true);
    navigate(location, { replace: true });
  }, [requested, location, navigate]);

  useEffect(() => {
    if (!accountId || !autoOpen || checked.current === accountId) return undefined;
    checked.current = accountId;
    let cancelled = false;
    needsOnboarding(accountId)
      .then((needed) => { if (!cancelled && needed) setOpen(true); })
      .catch((err) => console.error('Could not check for the welcome tour:', err));
    return () => { cancelled = true; };
  }, [accountId, autoOpen]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    if (accountId) markOnboarded(accountId);
  };

  return (
    <Suspense fallback={null}>
      <OnboardingDialog t={t} name={name} onClose={close} onOpenProjects={onOpenProjects}
        onExplore={onExplore} onOpenToolkit={onOpenToolkit} onNewProject={onNewProject} onEditProfile={onEditProfile} />
    </Suspense>
  );
}

export default WelcomeTour;
