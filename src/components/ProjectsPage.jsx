/* PLACER — Projects: every project this account owns or collaborates on.
 *
 * Reached from the side nav. Opening one goes to its dashboard, and "Create a
 * Project" at the top right starts a new one. Projects need an account and a Supabase project either way — see
 * services/projects.js's header — so a checkout without Supabase says so rather
 * than spending a request finding out.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { PageHeader } from './PageHeader';
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
      padding: '0 40px 48px' }} className="placer-scroll">
      <PageHeader t={t} icon="grid" label="The projects you run or collaborate on" title="Projects"
        actions={projectsAvailable() && onNewProject ? (
          <Btn t={t} variant="primary" icon="plus" onClick={onNewProject}>
            Create a Project
          </Btn>
        ) : null} />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
          <p style={{ fontSize: 14, color: t.inkFaint }}>
            Nothing yet. A project gets a dashboard, a public page, and lets people
            collaborate with you on it.
          </p>
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
