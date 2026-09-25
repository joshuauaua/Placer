/* PLACER — Projects: every project this account owns or collaborates on.
 *
 * The same list the profile carries under "Your projects", given a page of its
 * own so the side nav has somewhere to send it. Opening one goes to its
 * dashboard. Projects need an account and a Supabase project either way — see
 * services/projects.js's header — so a checkout without Supabase says so rather
 * than spending a request finding out.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { ProjectCard } from './ProjectCard';
import { isSupabaseConfigured as projectsAvailable, readMyProjects } from '../services/projects';

export function ProjectsPage({ t, accountId = null, onNewProject, onOpenProjectDashboard }) {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    if (!projectsAvailable() || !accountId) {
      setProjects([]);
      setStatus('ready');
      return undefined;
    }

    let cancelled = false;

    readMyProjects(accountId)
      .then((found) => {
        if (cancelled) return;
        setProjects(found);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load your projects:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [accountId]);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.03em', marginBottom: 8 }}>
          Projects
        </h1>
        <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, marginBottom: 40 }}>
          The projects you run or collaborate on.
        </p>

        {!projectsAvailable() && (
          <p style={{ fontSize: 14, color: t.inkFaint }}>
            Projects are not available in this environment.
          </p>
        )}

        {projectsAvailable() && status === 'loading' && (
          <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>Loading projects…</div>
        )}

        {projectsAvailable() && status === 'error' && (
          <div role="alert" style={{ padding: 16, borderRadius: 12, background: '#F5F5F5',
            borderLeft: '4px solid #B3261E', fontSize: 14, fontWeight: 500, color: t.ink }}>
            Could not load your projects. See the console for details.
          </div>
        )}

        {projectsAvailable() && status === 'ready' && projects.length === 0 && (
          <div>
            <p style={{ fontSize: 14, color: t.inkFaint, marginBottom: 16 }}>
              Nothing yet. A project gets a dashboard, a public page, and lets people
              collaborate with you on it.
            </p>
            <Btn t={t} variant="primary" size="sm" icon="plus" onClick={onNewProject}>
              Start a project
            </Btn>
          </div>
        )}

        {projectsAvailable() && status === 'ready' && projects.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20 }}>
            {projects.map((project) => (
              <ProjectCard key={project.id} t={t} project={project} onOpen={onOpenProjectDashboard} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectsPage;
