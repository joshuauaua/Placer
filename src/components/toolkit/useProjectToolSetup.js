/* PLACER — a project's setup of a tool kept without a room (projectSetupKind 'config'
 * in toolkit/tools.js), for the tool to start from as its `setup`.
 *
 * `ready` is false until it has been read, so the tool can wait for it rather than
 * start without it and have to change underfoot. For any other tool, or outside a
 * project, there is nothing to read: ready at once, with a null setup. A failure to
 * read is logged and leaves the tool as it is outside a project.
 */

import { useEffect, useState } from 'react';
import { projectSetupKind } from '../../toolkit/tools';
import { readProjectToolSetup } from '../../services/projects';
import { isSupabaseConfigured } from '../../services/rooms';

export function useProjectToolSetup(projectId, tool) {
  const wanted = Boolean(projectId && tool && projectSetupKind(tool) === 'config' && isSupabaseConfigured());
  const key = wanted ? `${projectId}:${tool.id}` : null;
  const [state, setState] = useState({ key: null, setup: null });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    readProjectToolSetup(projectId, tool.id)
      .then((setup) => { if (!cancelled) setState({ key, setup }); })
      .catch((err) => {
        console.error(`Could not load how ${tool.name} is set up for this project:`, err);
        if (!cancelled) setState({ key, setup: null });
      });
    return () => { cancelled = true; };
  }, [key, projectId, tool]);

  if (!key) return { ready: true, setup: null };
  return { ready: state.key === key, setup: state.key === key ? state.setup : null };
}
