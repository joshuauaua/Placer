/* PLACER — an organisation's public page, at /organisations/<id>.
 *
 * Laid out like a person's public profile (PublicProfilePage, and the same
 * .placer-profile-* classes): the name and location on a band across the top, a
 * Details card, then what the organisation does and the projects run in its name.
 * Needs no session — a link to it is something to share.
 *
 * An organisation whose last admin's account was deleted says so, and offers the
 * claim button to anyone who used to be one of its admins (supabase/organisations.sql).
 */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Avatar, Btn, LoadingMark } from './UI';
import { ProjectCard } from './ProjectCard';
import {
  canClaimOrganisation, claimOrganisation, isSupabaseConfigured, readOrganisation,
} from '../services/organisations';
import { readOrganisationProjects } from '../services/projects';

function ClaimNotice({ t, organisation, accountId, onClaimed }) {
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accountId) return undefined;
    let cancelled = false;
    canClaimOrganisation(organisation.id)
      .then((answer) => { if (!cancelled) setCanClaim(answer); })
      .catch((err) => console.error('Could not check whether you can claim this organisation:', err));
    return () => { cancelled = true; };
  }, [accountId, organisation.id]);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      await claimOrganisation(organisation.id);
      onClaimed?.();
    } catch (err) {
      console.error('Could not claim this organisation:', err);
      setError(err?.message ?? 'Could not claim this organisation.');
      setClaiming(false);
    }
  };

  return (
    <div role="status" style={{ padding: 20, marginBottom: 32, borderRadius: 12, background: t.surfaceAlt,
      border: `1px solid ${t.line}` }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginBottom: 4 }}>
        This organisation has no admin at the moment.
      </p>
      <p style={{ fontSize: 14, color: t.inkDim, lineHeight: 1.6, marginBottom: canClaim ? 16 : 0 }}>
        Nobody can change it or start projects in its name until somebody who used to run it
        claims it back.
      </p>
      {canClaim && (
        <Btn t={t} variant="primary" size="sm" icon="check" onClick={claim} disabled={claiming}>
          {claiming ? 'Claiming…' : 'Claim this organisation'}
        </Btn>
      )}
      {error && <p role="alert" style={{ fontSize: 13, color: '#B3261E', marginTop: 10 }}>{error}</p>}
    </div>
  );
}

export function PublicOrganisationPage({ t, organisationId, accountId = null, isAdmin = false,
  onOpenDashboard, onOpenProject, onClaimed }) {
  const [organisation, setOrganisation] = useState(null);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'notFound' | 'error'
  // Bumped after a claim, so the page reads the organisation again without its notice.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus('notFound');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    Promise.all([readOrganisation(organisationId), readOrganisationProjects(organisationId)])
      .then(([found, run]) => {
        if (cancelled) return;
        if (!found) {
          setStatus('notFound');
          return;
        }
        setOrganisation(found);
        setProjects(run);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // Not a uuid at all is, to whoever followed the link, the same as no such page.
        if (/invalid input syntax for type uuid/i.test(err?.message ?? '')) {
          setStatus('notFound');
          return;
        }
        console.error('Could not load this organisation:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [organisationId, version]);

  if (status === 'loading') {
    return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><LoadingMark /></div>;
  }

  if (status === 'notFound') {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <h1 style={{ color: t.ink, marginBottom: 8 }}>Organisation not found</h1>
        <p style={{ fontSize: 16, color: t.inkDim }}>The link may be wrong, or the organisation may have been closed.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" style={{ padding: 48, fontSize: 14, color: t.ink, fontWeight: 500 }}>
        Could not load this organisation. Try again in a moment.
      </div>
    );
  }

  // The address as people read it, without the https:// or a trailing slash.
  const websiteLabel = organisation.website.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const notShared = <span style={{ color: t.inkFaint }}>Not shared</span>;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page }}
      className="placer-scroll">
      <header className="placer-profile-cover" style={{ background: t.surfaceAlt }}>
        <div className="placer-profile-cover-inner" style={{ color: t.ink }}>
          <Avatar name={organisation.name} size={72} ring={t.line} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500,
              color: t.inkDim, marginBottom: 6 }}>
              <Icon name="building" size={16} stroke={2} />
              Organisation
            </p>
            <h1 className="placer-disp placer-profile-title">{organisation.name}</h1>
            {organisation.location && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 500,
                marginTop: 6, opacity: 0.92 }}>
                <Icon name="pin" size={16} stroke={2.1} />
                {organisation.location}
              </p>
            )}
          </div>
          {isAdmin && onOpenDashboard && (
            <Btn t={t} variant="outline" size="sm" icon="arrowRight" onClick={() => onOpenDashboard(organisation.id)}>
              Open the dashboard
            </Btn>
          )}
        </div>
      </header>

      <div className="placer-profile-body">
        <aside className="placer-profile-details">
          <section style={{ padding: 24, background: t.surface, border: `1px solid ${t.line}`,
            borderRadius: 12, boxShadow: t.shadow }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 16 }}>Details</h2>
            <dl className="placer-profile-dl">
              <dt style={{ color: t.inkFaint }}>Name</dt>
              <dd style={{ color: t.ink }}>{organisation.name}</dd>
              <dt style={{ color: t.inkFaint }}>Location</dt>
              <dd style={{ color: t.ink }}>{organisation.location || notShared}</dd>
              <dt style={{ color: t.inkFaint }}>Email</dt>
              <dd style={{ color: t.ink }}>
                {organisation.contactEmail
                  ? <a href={`mailto:${organisation.contactEmail}`} style={{ color: t.ink }}>{organisation.contactEmail}</a>
                  : notShared}
              </dd>
              <dt style={{ color: t.inkFaint }}>Website</dt>
              <dd style={{ color: t.ink }}>
                {organisation.website
                  ? <a href={organisation.website} target="_blank" rel="noopener noreferrer nofollow"
                      style={{ color: t.ink }}>{websiteLabel}</a>
                  : notShared}
              </dd>
            </dl>
          </section>
        </aside>

        <main className="placer-profile-main">
          {organisation.unadministeredSince && (
            <ClaimNotice t={t} organisation={organisation} accountId={accountId}
              onClaimed={() => { onClaimed?.(); setVersion((v) => v + 1); }} />
          )}

          <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.02em', marginBottom: 12 }}>
            About
          </h2>
          <p style={{ fontSize: 16, color: organisation.description ? t.inkDim : t.inkFaint, lineHeight: 1.7,
            maxWidth: 680, whiteSpace: 'pre-line', marginBottom: 40 }}>
            {organisation.description || 'No description yet.'}
          </p>

          <h2 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.02em', marginBottom: 16 }}>
            Projects
          </h2>
          {projects.length === 0 ? (
            <p style={{ fontSize: 16, color: t.inkFaint }}>No projects yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
              {projects.map((project) => (
                <ProjectCard key={project.id} t={t} project={project} onOpen={(id) => onOpenProject?.(id)} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default PublicOrganisationPage;
