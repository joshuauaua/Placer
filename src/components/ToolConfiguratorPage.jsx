/* PLACER — configuring a tool, as a page of its own: /toolkit/<id>/configure.
 *
 * Where Create a tool leads, once a tool has been picked from the Toolkit. It sits
 * under the nav bar, with the rest of the window to itself: no side nav or footer.
 *
 *   slides   — on the left, only for a tool that can run as several slides (`slides`
 *              in toolkit/tools.js): each is the tool with a setup of its own. Add a
 *              slide, pick one to show it on the canvas and configure it in the panel,
 *              or remove one while there are others. It starts with one. Any other
 *              tool is configured as that one slide, with no panel.
 *   top bar  — back to the Toolkit, the tool's name, then the avatars
 *              of the tool's collaborators, a ⋯ menu of its settings, Preview (the
 *              tool as it would look on a desktop and on a phone) and, at the
 *              right-hand end, Publish (put the tool live). A tool has no collaborators
 *              of its own yet, so the avatars are whoever is signed in; and nothing in
 *              the menu, Preview or Publish is built yet: each only says so.
 *   canvas   — the tool itself, as it is set up so far. It is the Toolkit's own
 *              component, given the setup the way it would get it live: a tool that
 *              runs in a room gets it as `room.config` on a room that is not open, any
 *              other as `setup`. A setup with problems is not handed over, so the tool
 *              shows its defaults until it is a setup it can take — the same rule a
 *              room follows (roomSetup in toolkit/useRoom.js).
 *   panel    — on the right, the tool's own configuration: each stage of its setup
 *              (setupSteps in toolkit/tools.js) as a section, one under another,
 *              with whatever is wrong with it underneath. A tool without a setup says
 *              there is nothing to configure.
 *
 * Below 900px any slides become a row over the canvas, and the panel goes under it.
 */

import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Avatar, Btn } from './UI';
import { Icon } from './Icon';
import { findCategory, findTool, setupSteps } from '../toolkit/tools';

/** The tool id in /toolkit/<id>/configure, or null for any other address. */
export function configuredToolIdFrom(path) {
  const match = /^\/toolkit\/([^/?#]+)\/configure\/?$/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * A tool that breaks on the canvas leaves the rest of the page standing: the panel
 * stays usable, and changing the setup tries the tool again (`resetKey`).
 */
class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, key: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error) {
    console.error('The tool could not be drawn on the canvas:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <p role="status" className="placer-configurator-note">
          This tool could not be shown with this setup.
        </p>
      );
    }
    return this.props.children;
  }
}

// A room that is not open: what a room tool is given outside one, carrying the setup.
function previewRoom(config) {
  return {
    capable: false,
    status: 'none',
    error: null,
    roomId: null,
    pin: null,
    joinCode: null,
    expiresAt: null,
    opensAt: null,
    config,
    isHost: false,
    contributions: [],
    participantCount: 0,
    combined: null,
    publish: () => {},
    close: () => {},
    remove: () => {},
  };
}

// How many collaborators' avatars show before the rest are a count.
const MAX_AVATARS = 3;

/** The collaborators' avatars, overlapping, with a count for any past MAX_AVATARS. */
function Collaborators({ people }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, MAX_AVATARS);
  const more = people.length - shown.length;
  const names = people.map((person) => person.name).join(', ');
  return (
    <div role="group" aria-label={`Collaborators: ${names}`} title={names} className="placer-configurator-people">
      {shown.map((person, index) => (
        <span key={person.id ?? `${person.name}-${index}`} className="placer-configurator-person">
          <Avatar name={person.name} photo={person.photo} size={32} ring="#FFFFFF" />
        </span>
      ))}
      {more > 0 && <span className="placer-configurator-person placer-configurator-more-people">+{more}</span>}
    </div>
  );
}

// What the ⋯ menu offers. None of it is built yet.
const TOOL_SETTINGS = [
  { key: 'rename', label: 'Rename', icon: 'pencil' },
  { key: 'duplicate', label: 'Duplicate', icon: 'layers' },
  { key: 'collaborators', label: 'Manage collaborators', icon: 'user' },
  { key: 'delete', label: 'Delete tool', icon: 'trash', divided: true },
];

/**
 * The ⋯ button and its menu of the tool's settings. Escape, or a press anywhere
 * else, closes it, the same as UserMenu.
 */
function SettingsMenu({ onChoose }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    wrapRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const onMenuKeyDown = (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const items = [...wrapRef.current.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    items[(at + step + items.length) % items.length]?.focus();
  };

  return (
    <div ref={wrapRef} className="placer-configurator-settings">
      <button ref={buttonRef} onClick={() => setOpen((was) => !was)} aria-label="Tool settings"
        aria-haspopup="menu" aria-expanded={open} title="Tool settings" className="placer-configurator-dots">
        <Icon name="more" size={20} stroke={2} />
      </button>
      {open && (
        <div role="menu" aria-label="Tool settings" onKeyDown={onMenuKeyDown} className="placer-configurator-menu">
          {TOOL_SETTINGS.map(({ key, label, icon, divided }) => (
            <button key={key} role="menuitem" onClick={() => { setOpen(false); onChoose(label); }}
              className={`placer-configurator-menu-item${divided ? ' is-divided' : ''}`}>
              <Icon name={icon} size={17} stroke={2} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ t, tool, people, notice, onBack, onSetting, onPreview, onPublish }) {
  return (
    <header aria-label="Configure a tool" className="placer-configurator-bar">
      <div className="placer-configurator-bar-start">
        <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onBack} ariaLabel="Back to the Toolkit"
          title="Back to the Toolkit" />
        {tool && (
          <div className="placer-configurator-title">
            <span className="placer-configurator-name">{tool.name}</span>
          </div>
        )}
      </div>
      <div className="placer-configurator-bar-end">
        <span role="status" className="placer-configurator-notice">{notice}</span>
        {tool && (
          <>
            <Collaborators people={people} />
            <SettingsMenu onChoose={onSetting} />
            {/* Their words go below 600px (index.css), leaving the icons; the names stay. */}
            <Btn t={t} variant="quiet" size="sm" icon="eye" onClick={onPreview} ariaLabel="Preview">
              <span className="placer-configurator-btn-label">Preview</span>
            </Btn>
            <Btn t={t} variant="primary" size="sm" icon="send" onClick={onPublish} ariaLabel="Publish">
              <span className="placer-configurator-btn-label">Publish</span>
            </Btn>
          </>
        )}
      </div>
    </header>
  );
}

function ConfigPanel({ t, tool, setup, onChange }) {
  const steps = setupSteps(tool);
  return (
    <aside aria-label="Configuration" className="placer-configurator-panel">
      <h2 className="placer-configurator-panel-heading">Configure</h2>
      {steps.length === 0 ? (
        <p className="placer-configurator-note">This tool has nothing to configure. It is ready as it is.</p>
      ) : (
        steps.map((step, index) => {
          const problems = step.problems(setup);
          const Form = step.Form;
          return (
            <section key={step.title ?? index} className="placer-configurator-section"
              aria-label={step.title ?? tool.name}>
              {step.title && <h3 className="placer-configurator-section-heading">{step.title}</h3>}
              <Form t={t} tool={tool} setup={setup} onChange={onChange} />
              {problems.length > 0 && (
                <ul className="placer-configurator-problems">
                  {problems.map((problem) => <li key={problem}>{problem}</li>)}
                </ul>
              )}
            </section>
          );
        })
      )}
    </aside>
  );
}

// Slides need ids of their own, so removing one never confuses which is which.
let nextSlideId = 1;
function newSlide(tool) {
  return { id: `slide-${nextSlideId++}`, setup: tool?.setup?.defaults() ?? null };
}

function SlidesPanel({ tool, slides, selectedId, onSelect, onAdd, onRemove }) {
  const category = findCategory(tool.category);
  return (
    <nav aria-label="Slides" className="placer-configurator-slides">
      <h2 className="placer-configurator-slides-heading">Slides</h2>
      <ol className="placer-configurator-slide-list">
        {slides.map((slide, index) => {
          const selected = slide.id === selectedId;
          return (
            <li key={slide.id} className="placer-configurator-slide-item">
              <button onClick={() => onSelect(slide.id)} aria-current={selected ? 'true' : undefined}
                aria-label={`Slide ${index + 1}`}
                className={`placer-configurator-slide${selected ? ' is-selected' : ''}`}>
                <span className="placer-configurator-slide-number">{index + 1}</span>
                <span className="placer-configurator-slide-thumb"
                  style={{ background: category?.colour?.c50, color: category?.colour?.c700 }}>
                  <Icon name={tool.icon} size={22} stroke={2} />
                </span>
              </button>
              {slides.length > 1 && (
                <button onClick={() => onRemove(slide.id)} aria-label={`Remove slide ${index + 1}`}
                  title="Remove slide" className="placer-configurator-slide-remove">
                  <Icon name="close" size={14} stroke={2.4} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <button onClick={onAdd} className="placer-configurator-slide-add">
        <Icon name="plus" size={16} stroke={2.2} />
        <span>Add slide</span>
      </button>
    </nav>
  );
}

export function ToolConfiguratorPage({ t, profile = null }) {
  const [location, navigate] = useLocation();
  const tool = findTool(configuredToolIdFrom(location));
  const Tool = tool?.component;

  // The tool's slides, each with its own setup, and the one on the canvas.
  const [slides, setSlides] = useState(() => [newSlide(tool)]);
  const [selectedId, setSelectedId] = useState(() => slides[0].id);
  // Another tool, from the same page: start again from one slide of its defaults.
  const [slidesFor, setSlidesFor] = useState(tool?.id ?? null);
  if ((tool?.id ?? null) !== slidesFor) {
    const first = newSlide(tool);
    setSlidesFor(tool?.id ?? null);
    setSlides([first]);
    setSelectedId(first.id);
  }
  const selected = slides.find((slide) => slide.id === selectedId) ?? slides[0];
  const setup = selected.setup;
  const setSetup = (next) => setSlides((all) => all.map((slide) => (slide.id === selected.id ? { ...slide, setup: next } : slide)));

  const addSlide = () => {
    const slide = newSlide(tool);
    setSlides((all) => [...all, slide]);
    setSelectedId(slide.id);
  };
  // Removing the slide on the canvas puts the one before it there (or the next, for the first).
  const removeSlide = (id) => {
    const at = slides.findIndex((slide) => slide.id === id);
    const rest = slides.filter((slide) => slide.id !== id);
    if (rest.length === 0) return;
    setSlides(rest);
    if (id === selected.id) setSelectedId(rest[Math.max(0, at - 1)].id);
  };

  // Only a setup the tool would accept reaches the canvas.
  const usable = useMemo(
    () => (tool?.setup && setup && tool.setup.problems(setup).length === 0 ? setup : null),
    [tool, setup],
  );

  const [notice, setNotice] = useState('');
  const back = () => navigate('/toolkit');

  return (
    <div className="placer-configurator">
      <TopBar t={t} tool={tool} notice={notice} onBack={back}
        people={profile?.name ? [{ id: profile.id ?? 'me', name: profile.name, photo: profile.photo ?? null }] : []}
        onSetting={(label) => setNotice(`${label} is not built yet.`)}
        onPreview={() => setNotice('Preview is not built yet.')}
        onPublish={() => setNotice('Publishing is not built yet.')} />

      {!tool ? (
        <main className="placer-configurator-missing">
          <p>There is no tool here to configure.</p>
          <Btn t={t} variant="outline" icon="arrowRight" onClick={back}>Go to the Toolkit</Btn>
        </main>
      ) : (
        <div className="placer-configurator-body">
          {tool.slides && (
            <SlidesPanel tool={tool} slides={slides} selectedId={selected.id}
              onSelect={setSelectedId} onAdd={addSlide} onRemove={removeSlide} />
          )}
          <main aria-label="Canvas" className="placer-configurator-canvas">
            <div className="placer-configurator-frame">
              {/* Keyed by slide, so each slide's tool starts afresh rather than keeping
                  what was typed into the one before. */}
              <CanvasBoundary key={selected.id} resetKey={usable}>
                {Tool && (tool.room
                  ? <Tool t={t} tool={tool} room={previewRoom(usable)} />
                  : <Tool t={t} tool={tool} setup={usable} />)}
              </CanvasBoundary>
            </div>
          </main>
          <ConfigPanel t={t} tool={tool} setup={setup} onChange={setSetup} />
        </div>
      )}
    </div>
  );
}

export default ToolConfiguratorPage;
