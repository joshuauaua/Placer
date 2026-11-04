/* PLACER — a project's room results, kept up to date while any of them is live.
 *
 * readProjectToolResults once, and again every REFRESH_MS while one of them is open,
 * so a live result fills in as answers come in; once they have all ended there is
 * nothing more to fetch. `results` is null while the first read is under way, and []
 * without a Supabase project, a project, or after a failure (which is logged).
 */

import { useEffect, useState } from 'react';
import { isSupabaseConfigured, readProjectToolResults } from '../../services/rooms';

export const REFRESH_MS = 15000;

export function useToolResults(projectId) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!projectId || !isSupabaseConfigured()) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    let timer = null;
    const read = async () => {
      try {
        const found = await readProjectToolResults(projectId);
        if (cancelled) return;
        setResults(found);
        if (found.some((result) => result.status === 'open')) timer = setTimeout(read, REFRESH_MS);
      } catch (err) {
        console.error('Could not read the project\'s results:', err);
        if (!cancelled) setResults((current) => current ?? []);
      }
    };
    read();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId]);

  return results;
}
