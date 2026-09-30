/* PLACER — the search box in the nav bar, beside the account menu.
 *
 * Finds people, organisations and projects by name (services/search.js). Suggestions
 * drop down as you type, grouped by kind, a moment after the typing stops so that a
 * word is one request rather than one per letter. Arrow keys move through them, Enter
 * opens the highlighted one, Escape or a click elsewhere closes the list.
 *
 * It follows the ARIA combobox pattern: the input owns a listbox, and the highlighted
 * option is announced through aria-activedescendant while focus stays in the input.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from './UI';
import { Icon } from './Icon';
import { MIN_QUERY_LENGTH, search } from '../services/search';

// How long typing has to pause before a search is sent.
const DEBOUNCE_MS = 200;

const GROUPS = [
  { kind: 'person', label: 'People' },
  { kind: 'organisation', label: 'Organisations' },
  { kind: 'project', label: 'Projects' },
];

function Thumbnail({ t, result }) {
  if (result.kind === 'person') return <Avatar name={result.name} photo={result.image} size={32} />;
  return (
    <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 8, flex: '0 0 auto',
      background: result.image ? `center / cover no-repeat url("${result.image}")` : t.surfaceAlt,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkDim }}>
      {!result.image && <Icon name={result.kind === 'organisation' ? 'building' : 'grid'} size={16} stroke={2} />}
    </span>
  );
}

export function NavSearch({ t, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'searching' | 'ready' | 'error'
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const listId = useId();

  const trimmed = query.trim();
  const searchable = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!searchable) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }

    // Only the answer to the latest query counts: an earlier, slower one arriving
    // afterwards must not replace it.
    let current = true;
    setStatus('searching');
    const timer = setTimeout(() => {
      search(trimmed)
        .then((found) => {
          if (!current) return;
          setResults(found);
          setActive(-1);
          setStatus('ready');
        })
        .catch((err) => {
          if (!current) return;
          console.error('Could not search:', err);
          setResults([]);
          setStatus('error');
        });
    }, DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [trimmed, searchable]);

  // A click anywhere outside closes the list, the same dismissal as UserMenu's.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const choose = (result) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    onSelect(result);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else {
        setQuery('');
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((was) => (was + step + results.length) % results.length);
      return;
    }
    if (e.key === 'Enter' && open) {
      const picked = results[active] ?? (results.length === 1 ? results[0] : null);
      if (picked) {
        e.preventDefault();
        choose(picked);
      }
    }
  };

  const showList = open && searchable;
  const optionId = (index) => `${listId}-option-${index}`;

  return (
    <div ref={wrapRef} className="placer-nav-search" style={{ position: 'relative' }}>
      <label className="placer-nav-search-field"
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px',
          borderRadius: 12, border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.ink }}>
        <Icon name="search" size={18} stroke={2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
        <input
          type="search"
          role="combobox"
          aria-label="Search people, organisations and projects"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          value={query}
          placeholder="Search"
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 14.5 }}
        />
      </label>

      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="placer-nav-search-list"
          // Where it sits is in index.css (.placer-nav-search-list), since a phone needs it placed differently.
          style={{ zIndex: 70,
            padding: '6px 0', background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12,
            boxShadow: t.shadow, maxHeight: 'min(70vh, 480px)', overflowY: 'auto' }}>
          {status === 'searching' && results.length === 0 && (
            <p style={{ padding: '10px 14px', fontSize: 14, color: t.inkDim }}>Searching…</p>
          )}
          {status === 'error' && (
            <p role="alert" style={{ padding: '10px 14px', fontSize: 14, color: t.ink }}>
              Could not search. Try again in a moment.
            </p>
          )}
          {status === 'ready' && results.length === 0 && (
            <p style={{ padding: '10px 14px', fontSize: 14, color: t.inkDim }}>
              Nothing matches &ldquo;{trimmed}&rdquo;.
            </p>
          )}
          {GROUPS.map(({ kind, label }) => {
            const inGroup = results.map((result, index) => ({ result, index }))
              .filter(({ result }) => result.kind === kind);
            if (inGroup.length === 0) return null;
            return (
              <div key={kind} role="group" aria-label={label}>
                <div aria-hidden="true" className="placer-caption"
                  style={{ padding: '8px 14px 4px', fontWeight: 700, color: t.inkDim, textTransform: 'uppercase' }}>
                  {label}
                </div>
                {inGroup.map(({ result, index }) => (
                  <div
                    key={`${result.kind}-${result.id}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    // mousedown, not click: the input would lose focus first otherwise.
                    onMouseDown={(e) => { e.preventDefault(); choose(result); }}
                    onMouseEnter={() => setActive(index)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                      cursor: 'pointer', background: index === active ? t.surfaceAlt : 'transparent' }}>
                    <Thumbnail t={t} result={result} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.ink,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {result.name}
                      </span>
                      {result.detail && (
                        <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {result.detail}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NavSearch;
