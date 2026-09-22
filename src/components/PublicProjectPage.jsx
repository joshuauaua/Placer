/* PLACER — a project's public page: what it is, what it has drawn, and what it found */

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Btn, CatTag, Vote } from './UI';
import { ProjectLocationMap } from './ProjectLocationMap';
import { readImaginationsByProject } from '../services/imaginations';
import { readLinks, readProject, readPublicSandboxActivity } from '../services/projects';
import { follow, isFollowing, unfollow } from '../services/follows';

// ISO slice rather than toLocaleDateString, so the output does not shift with the
// machine's locale (matches AdminImaginations, ImaginationPreview).
const formatDate = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '');

function dateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;
  if (startDate && endDate) return `${formatDate(startDate)} → ${formatDate(endDate)}`;
  return formatDate(startDate || endDate);
}

function ImaginationCard({ t, imagination }) {
  const { title, cat, blurb, loc, preview, upvotes = 0 } = imagination;
  return (
    <article style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
      overflow: 'hidden', boxShadow: t.shadow }}>
      {preview && (
        <img src={preview} alt={`Preview of ${title || 'this imagination'}`}
          style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: 16, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cat && <div style={{ marginBottom: 8 }}><CatTag cat={cat} t={t} size="sm" /></div>}
          <h3 style={{ fontSize: 15.5, fontWeight: 700, color: t.ink, lineHeight: 1.3, marginBottom: 4 }}>
            {title || 'Untitled imagination'}
          </h3>
          {blurb && (
            <p style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.5, marginBottom: 6,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {blurb}
            </p>
          )}
          {loc && <span style={{ fontSize: 11.5, color: t.inkFaint }}>{loc}</span>}
        </div>
        <Vote t={t} count={upvotes} size="sm" />
      </div>
    </article>
  );
}

function LinkRow({ t, link }) {
  return (
    <a href={link.url} target="_blank" rel="noreferrer"
      style={{ display: 'block', padding: '12px 0', borderTop: `1px solid ${t.line}`,
        fontSize: 14.5, fontWeight: 700, color: t.ink, textDecoration: 'none' }}>
      {link.title}
      <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.inkDim, marginTop: 2 }}>
        {link.url}
      </span>
    </a>
  );
}

/**
 * `projectId` is read fresh here rather than trusting a `project` prop from App.jsx:
 * this page is the one a shared link actually points at, so it has to work reached
 * cold with nothing but the id in the URL.
 */
export function PublicProjectPage({ t, projectId, accountId, onImagineForProject }) {
  const [project, setProject] = useState(null);
  const [imaginations, setImaginations] = useState([]);
  const [links, setLinks] = useState([]);
  const [sandboxActivity, setSandboxActivity] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error' | 'notFound'
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      readProject(projectId),
      readImaginationsByProject(projectId),
      readLinks(projectId),
      readPublicSandboxActivity(projectId),
    ])
      .then(([proj, imgs, docs, activity]) => {
        if (cancelled) return;
        if (!proj) { setStatus('notFound'); return; }
        setProject(proj);
        setImaginations(imgs);
        setLinks(docs);
        setSandboxActivity(activity);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load this project:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!accountId || status !== 'ready') return;
    let cancelled = false;
    isFollowing('project', projectId)
      .then((value) => { if (!cancelled) setFollowing(value); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accountId, projectId, status]);

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    try {
      if (next) await follow('project', projectId, project.name);
      else await unfollow('project', projectId);
    } catch (err) {
      console.error('Could not update whether you follow this project:', err);
      setFollowing(!next);
    }
  };

  if (status === 'loading') {
    return <div style={{ padding: 48, fontSize: 14, color: t.inkDim, fontWeight: 600 }}>Loading…</div>;
  }

  if (status === 'notFound') {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h1 className="placer-disp" style={{ fontSize: 24, fontWeight: 800, color: t.ink, marginBottom: 8 }}>
          Project not found
        </h1>
        <p style={{ fontSize: 14, color: t.inkDim }}>It may have been removed.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" style={{ padding: 48, fontSize: 14, color: t.ink, fontWeight: 600 }}>
        Could not load this project. See the console for details.
      </div>
    );
  }

  const range = dateRange(project.startDate, project.endDate);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px 96px' }} className="placer-scroll">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <ProjectLocationMap t={t} project={project} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="placer-disp" style={{ fontSize: 44, fontWeight: 900, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.1 }}>
              {project.name}
            </h1>
            <p style={{ fontSize: 15, color: t.inkDim, fontWeight: 600 }}>
              Started by {project.ownerName}
            </p>
          </div>
          {accountId && (
            <Btn t={t} variant={following ? 'outline' : 'primary'} icon="bookmark" onClick={toggleFollow}>
              {following ? 'Following' : 'Follow'}
            </Btn>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 28,
          fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
          {range && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="clock" size={15} stroke={2.1} />{range}
            </span>
          )}
          {project.locations.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="pin" size={15} stroke={2.1} />{project.locations.join(', ')}
            </span>
          )}
        </div>

        {project.description && (
          <p style={{ fontSize: 16, color: t.ink, lineHeight: 1.7, marginBottom: 32, maxWidth: 720 }}>
            {project.description}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 40 }}>
          <Btn t={t} variant="accent" icon="sparkle" onClick={() => onImagineForProject(project.id)}>
            Imagine something for this project
          </Btn>
          {sandboxActivity > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14,
              color: t.inkDim, fontWeight: 600 }}>
              <Icon name="grid" size={16} stroke={2} />
              {sandboxActivity} Sandbox {sandboxActivity === 1 ? 'session' : 'sessions'} run
            </span>
          )}
        </div>

        <h2 className="placer-disp" style={{ fontSize: 26, fontWeight: 900, color: t.ink,
          letterSpacing: '-0.02em', marginBottom: 20 }}>
          Citizen imaginations
        </h2>

        {imaginations.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', background: t.surface,
            border: `1px solid ${t.line}`, borderRadius: 12, marginBottom: 40 }}>
            <p style={{ fontSize: 14, color: t.inkDim }}>
              Nothing posted to this project yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20, marginBottom: 40 }}>
            {imaginations.map((imagination) => (
              <ImaginationCard key={imagination.id} t={t} imagination={imagination} />
            ))}
          </div>
        )}

        {links.length > 0 && (
          <>
            <h2 className="placer-disp" style={{ fontSize: 26, fontWeight: 900, color: t.ink,
              letterSpacing: '-0.02em', marginBottom: 12 }}>
              News &amp; resources
            </h2>
            <div style={{ maxWidth: 600 }}>
              {links.map((link) => <LinkRow key={link.id} t={t} link={link} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PublicProjectPage;
