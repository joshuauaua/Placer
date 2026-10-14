/* PLACER — the search in the middle of the nav bar.
 *
 * Finds people, organisations and projects by name (services/search.js). In the bar
 * it is only a button dressed as a search box; pressing it opens the search in a
 * modal, with the field across its top and the suggestions listed under it, grouped
 * by kind, a moment after the typing stops so that a word is one request rather than
 * one per letter. Arrow keys move through them, Enter opens the highlighted one.
 * Escape, a click on the backdrop, or choosing a suggestion closes the modal and
 * hands focus back to the button.
 *
 * The field follows the ARIA combobox pattern: the input owns a listbox, and the
 * highlighted option is announced through aria-activedescendant while focus stays in
 * the input.
 *
 * On a phone the box would crowd the bar, so it collapses to its magnifier (index.css
 * swaps the two below 640px); either opens the same modal. The modal is portalled to
 * <body> so that its backdrop covers the bar too, rather than sitting in the bar's
 * stacking context under it.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const inputRef = useRef(null);
  // Whichever of the box and the magnifier opened the modal, to hand focus back to.
  const openerRef = useRef(null);
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

  // The modal opens ready to type into.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openModal = (e) => {
    openerRef.current = e.currentTarget;
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setActive(-1);
    openerRef.current?.focus();
  };

  const choose = (result) => {
    close();
    onSelect(result);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((was) => (was + step + results.length) % results.length);
      return;
    }
    if (e.key === 'Enter') {
      const picked = results[active] ?? (results.length === 1 ? results[0] : null);
      if (picked) {
        e.preventDefault();
        choose(picked);
      }
    }
  };

  const showList = searchable;
  const optionId = (index) => `${listId}-option-${index}`;

  const list = showList && (
    <div
      id={listId}
      role="listbox"
      aria-label="Search suggestions"
      style={{ padding: '6px 0', borderTop: `1px solid ${t.line}`, overflowY: 'auto', minHeight: 0 }}>
      {status === 'searching' && results.length === 0 && (
        <p style={{ padding: '10px 16px', fontSize: 14, color: t.inkDim }}>Searching…</p>
      )}
      {status === 'error' && (
        <p role="alert" style={{ padding: '10px 16px', fontSize: 14, color: t.ink }}>
          Could not search. Try again in a moment.
        </p>
      )}
      {status === 'ready' && results.length === 0 && (
        <p style={{ padding: '10px 16px', fontSize: 14, color: t.inkDim }}>
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
              style={{ padding: '8px 16px 4px', fontWeight: 700, color: t.inkDim, textTransform: 'uppercase' }}>
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
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
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
  );

  return (
    <div className="placer-nav-search">
      {/* Its display is left to index.css rather than set here: an inline display would
          beat the rule that hides the box on a phone. */}
      <button type="button" className="placer-nav-search-field" onClick={openModal}
        aria-haspopup="dialog" aria-label="Search people, organisations and projects"
        style={{ alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderRadius: 12,
          border: `1px solid ${t.lineStrong}`, background: t.surface, color: t.inkDim, cursor: 'text',
          fontFamily: 'var(--placer-font)', fontSize: 14.5, textAlign: 'left' }}>
        <Icon name="search" size={18} stroke={2} style={{ flex: '0 0 auto' }} />
        <span>Search</span>
      </button>

      <button type="button" className="placer-nav-search-trigger" onClick={openModal}
        aria-haspopup="dialog" aria-label="Search" style={{ color: t.ink }}>
        <Icon name="search" size={20} stroke={2} />
      </button>

      {open && createPortal(
        <div className="placer-search-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Search" className="placer-search-modal"
            style={{ background: t.surface, color: t.ink, borderRadius: 16, boxShadow: t.shadow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 12px 0 16px',
              flex: '0 0 auto' }}>
              <Icon name="search" size={20} stroke={2} style={{ color: t.inkDim, flex: '0 0 auto' }} />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-label="Search people, organisations and projects"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
                value={query}
                placeholder="Search people, organisations and projects"
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                // 16px: iOS zooms the page into any field set smaller than that. The full
                // height of the row keeps the caret clear of the rounded corners every
                // input gets from index.css, which would clip it at the start of the line.
                style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent',
                  color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 16 }}
              />
              <button type="button" onClick={close} aria-label="Close search"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
                  padding: 0, border: 'none', borderRadius: 8, background: 'transparent', color: t.inkDim,
                  cursor: 'pointer', flex: '0 0 auto' }}>
                <Icon name="close" size={18} stroke={2} />
              </button>
            </div>
            {list}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default NavSearch;
