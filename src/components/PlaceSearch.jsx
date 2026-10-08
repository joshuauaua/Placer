/* PLACER — a text field that suggests places as it is typed.
 *
 * The suggestions are OpenStreetMap's, from Photon (lib/geocode.js), asked for once the
 * typing pauses. Arrow keys move through them, Enter or a click picks one, Escape puts
 * them away. Enter never submits the form the field is in, picked or not, so a half-
 * typed address cannot send a form off by accident.
 *
 * Picking reports the result — { label, name, point, townAndCountry } — through
 * `onPick`; the field's text becomes its label. Typing reports only the text, through
 * `onChange`. If the geocoder cannot be reached it is simply a text field.
 *
 * `regions` keeps to towns, cities and regions. `placement="above"` opens the list
 * upwards, for a field at the bottom of the screen.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { THEME } from '../theme';
import { searchPlaces } from '../lib/geocode';

// Long enough that a word being typed is one request, not one per letter.
const DEBOUNCE_MS = 350;
const MIN_LENGTH = 3;

export function PlaceSearch({ id, value, onChange, onPick, placeholder, style, inputRef,
  regions = false, near = null, placement = 'below', maxLength = 200, ariaLabel, t = THEME }) {
  const generatedId = useId();
  const listId = `${id ?? generatedId}-suggestions`;
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Set when a pick fills the field, so that text is not searched for all over again.
  const pickedRef = useRef(false);
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    if (pickedRef.current) {
      pickedRef.current = false;
      return undefined;
    }
    const text = (value ?? '').trim();
    if (text.length < MIN_LENGTH) {
      setResults([]);
      setOpen(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(text, { regions, near: nearRef.current, signal: controller.signal })
        .then((found) => {
          setResults(found);
          setActive(-1);
          setOpen(found.length > 0);
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') console.error('Could not load place suggestions:', error);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, regions]);

  const pick = (result) => {
    pickedRef.current = true;
    setOpen(false);
    setResults([]);
    onChange?.(result.label);
    onPick?.(result);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && active >= 0 && results[active]) pick(results[active]);
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const listPosition = placement === 'above'
    ? { bottom: 'calc(100% + 6px)' }
    : { top: 'calc(100% + 6px)' };

  return (
    <div style={{ position: 'relative', flex: style?.flex, minWidth: style?.minWidth, width: '100%' }}>
      <input id={id} ref={inputRef} type="text" value={value} maxLength={maxLength}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off" placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        // Late enough that a click on a suggestion lands first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: '100%', ...style }} />
      {open && (
        <ul id={listId} role="listbox" style={{ position: 'absolute', left: 0, right: 0, ...listPosition,
          zIndex: 30, listStyle: 'none', margin: 0, padding: 6, borderRadius: 12,
          background: t.surface, border: `1px solid ${t.line}`, boxShadow: t.shadow,
          maxHeight: 280, overflowY: 'auto' }}>
          {results.map((result, index) => (
            <li key={`${result.label}-${index}`} id={`${listId}-${index}`} role="option"
              aria-selected={index === active}
              // mousedown rather than click, so the field keeps its focus.
              onMouseDown={(event) => { event.preventDefault(); pick(result); }}
              onMouseEnter={() => setActive(index)}
              style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                lineHeight: 1.4, color: t.ink, textAlign: 'left',
                background: index === active ? t.surfaceAlt : 'transparent' }}>
              {result.label}
            </li>
          ))}
          <li aria-hidden="true" style={{ padding: '6px 10px 2px', fontSize: 11, color: t.inkFaint }}>
            Search by Photon · © OpenStreetMap contributors
          </li>
        </ul>
      )}
    </div>
  );
}

export default PlaceSearch;
