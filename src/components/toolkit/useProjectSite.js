/* PLACER — the site a project set a tool up on, for a tool that takes one.
 *
 * Site-Specific Spatial Mapping, opened for a project that set it up on a site
 * (ConfigureToolDialog), is used on that site rather than one picked on the spot. Both
 * places a project's tool is used — the Toolkit page, and the project's own page — read
 * it through this.
 *
 * `site` is undefined while it loads, then the site, or null when there is none and the
 * tool asks for one as it does on its own. `loading` says whether to wait for it.
 */

import { useEffect, useState } from 'react';
import { projectSetupKind } from '../../toolkit/tools';
import { isSupabaseConfigured } from '../../services/rooms';
import { readProjectSite } from '../../services/projects';

export function useProjectSite(tool, projectId) {
  const wanted = Boolean(tool && projectId && projectSetupKind(tool) === 'site') && isSupabaseConfigured();
  const [site, setSite] = useState(undefined);

  useEffect(() => {
    setSite(undefined);
    if (!wanted) return undefined;
    let cancelled = false;
    readProjectSite(projectId, tool.id)
      .then((found) => { if (!cancelled) setSite(found); })
      .catch((err) => {
        console.error('Could not load the project\'s site:', err);
        if (!cancelled) setSite(null);
      });
    return () => { cancelled = true; };
  }, [wanted, projectId, tool?.id]);

  return { site: site ?? null, loading: wanted && site === undefined };
}
