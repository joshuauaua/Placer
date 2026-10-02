/* PLACER — Project Examples: projects from across the platform, newest first.
 *
 * Reached from the dashboard's "Getting Started" cards. Unlike the Projects
 * page, which lists the projects an account runs, this is everybody's, and a card
 * opens the project's public page rather than its dashboard. Projects are public to
 * read (supabase/projects.sql), so it needs no account — only a Supabase project.
 */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { ProjectCard } from './ProjectCard';
import { isSupabaseConfigured as projectsAvailable, readAllProjects } from '../services/projects';

export function ProjectExamplesPage({ t, onOpenProject, onNewProject }) {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    if (!projectsAvailable()) {
      setStatus('ready');
      return undefined;
    }

    let cancelled = false;
    readAllProjects()
      .then((found) => {
        if (cancelled) return;
        setProjects(found);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load projects:', err);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px' }} className="placer-scroll">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 20, flexWrap: 'wrap', marginBottom: 40 }}>
          <div>
            <h1 className="placer-disp" style={{ fontSize: 48, fontWeight: 700, color: t.ink,
              letterSpacing: '-0.03em', marginBottom: 8 }}>
              Project Examples
            </h1>
            <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, maxWidth: 680 }}>
              What other people are doing with PLACER: projects from across the platform,
              newest first.
            </p>
          </div>
          {projectsAvailable() && onNewProject && (
            <Btn t={t} variant="primary" icon="plus" onClick={onNewProject}>
              Create a Project
            </Btn>
          )}
        </div>

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
            Could not load projects. Try again in a moment.
          </div>
        )}

        {projectsAvailable() && status === 'ready' && projects.length === 0 && (
          <p style={{ fontSize: 14, color: t.inkFaint }}>
            No projects yet. Yours could be the first.
          </p>
        )}

        {projectsAvailable() && status === 'ready' && projects.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20 }}>
            {projects.map((project) => (
              <ProjectCard key={project.id} t={t} project={project} onOpen={onOpenProject} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectExamplesPage;
