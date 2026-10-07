/* PLACER — start or edit a project: what kind it is, what it is trying to do, where,
 * and which tools it will use.
 *
 * Starting one is six steps, one screen each: a cover saying what a project is, the
 * kind of project (services/projects.js's PROJECT_TYPES, which work as templates for
 * what follows), the basics, the place, the tools, and an image. Editing one is the
 * same fields on a single page, since whoever is editing already knows what a project
 * is.
 *
 * The place is an address picked from Google Places suggestions (AddressInput), kept
 * with its point so the maps can pin the project there (supabase/project-setup.sql).
 * It replaced an outline drawn on a map; a project that already has one keeps it, and
 * the maps still draw it.
 *
 * Most tools are only chosen here, and set up later, when their room is opened.
 * Reimagine a Space is the exception: it has no room, so it is set up here, with the
 * location and base image everyone imagining for the project draws on (SceneSetup). */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { Icon } from './Icon';
import { ImagePicker } from './ImagePicker';
import { AddressInput } from './AddressInput';
import {
  BUDGET_CURRENCIES, PROJECT_TYPES, VISIBILITIES, createProject, readProjectBudget, readProjectToolConfig,
  readProjectTools, removeProjectImageFile, saveProjectBudget, saveProjectToolConfig, saveProjectTools,
  updateProject, uploadProjectImage, uploadSceneImage,
} from '../services/projects';
import { checkPickedImage, mediaUrl } from '../services/media';
import { isGoogleMapsConfigured } from '../lib/googleMaps';
import { TOOLS, findCategory } from '../toolkit/tools';

// Matches DescribePage's form styling.
const inputStyle = (t) => ({
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  border: `1.5px solid ${t.line}`,
  borderRadius: 12,
  background: t.chrome,
  color: t.ink,
  fontFamily: 'var(--placer-font)',
  outline: 'none',
});

function Field({ t, label, htmlFor, hint, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <label htmlFor={htmlFor}
        style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
        {label}
      </label>
      {hint && (
        <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

/** The six steps of starting a project, in order. */
const STEPS = ['What is a project', 'Project type', 'The basics', 'The place', 'Tools', 'An image'];
const LAST_STEP = STEPS.length - 1;

// The tool set up on this page rather than when a room opens (toolkit/tools.js).
const REIMAGINE_TOOL = 'reimagine-a-space';

// The database's own limits (projects_name_shape, projects_summary_size), held here
// too so a long name is cut off as it is typed rather than refused on save.
const NAME_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 1000;

/**
 * The place names a project is listed under — the public page's pin line, and what
 * "related projects" matches on. The town and country of a picked address, or the
 * address itself when it was typed by hand.
 */
const placeNames = (address, town) => {
  const name = town || address.trim();
  return name ? [name] : [];
};

/** Public or private (services/projects.js's VISIBILITIES). */
function VisibilityChoice({ t, value, onChange }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 10, padding: 0 }}>
        Who is it for?
      </legend>
      {VISIBILITIES.map((option) => {
        const checked = value === option.key;
        return (
          <label key={option.key}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16, cursor: 'pointer',
              borderRadius: 12, background: checked ? t.surfaceAlt : t.surface,
              border: `1.5px solid ${checked ? t.ink : t.line}` }}>
            <input type="radio" name="project-visibility" value={option.key} checked={checked}
              onChange={() => onChange(option.key)}
              style={{ marginTop: 3, accentColor: t.ink, flex: '0 0 auto' }} />
            <span>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 4 }}>
                {option.title}
              </span>
              <span style={{ display: 'block', fontSize: 14, color: t.inkDim, lineHeight: 1.55 }}>
                {option.description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * The budget question's amount as typed, as a number — null when left empty, which is
 * allowed (there is a budget, but they would rather not say), and NaN when it is not a
 * usable amount.
 *
 * Amounts are written both ways round across the places PLACER is used, so both are
 * read: "250,000" and "1,250.50" group with commas, "250.000" and "1.250,50" with dots,
 * and a lone comma is a decimal point ("1250,50"). Spaces, as in "250 000", are ignored.
 */
export function parseBudgetAmount(text) {
  let trimmed = String(text ?? '').replace(/[\s\u00a0']/g, '');
  if (!trimmed) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)) trimmed = trimmed.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)) trimmed = trimmed.replace(/\./g, '').replace(',', '.');
  else trimmed = trimmed.replace(',', '.');
  const amount = /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
  return Number.isFinite(amount) ? amount : NaN;
}

/**
 * "Do you have a budget for this project?", and how much when the answer is yes.
 * Optional: a project can be started without answering. Private to the project's
 * owner and collaborators (supabase/project-budget.sql), which the hint says, since
 * the rest of the setup is public.
 */
function BudgetQuestion({ t, hasBudget, onHasBudget, amount, onAmount, currency, onCurrency }) {
  const invalid = hasBudget && Number.isNaN(parseBudgetAmount(amount));
  const choice = (value, label) => {
    const checked = hasBudget === value;
    return (
      <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        cursor: 'pointer', borderRadius: 12, background: checked ? t.surfaceAlt : t.surface,
        border: `1.5px solid ${checked ? t.ink : t.line}`, fontSize: 15, fontWeight: 500, color: t.ink }}>
        <input type="radio" name="project-has-budget" checked={checked} onChange={() => onHasBudget(value)}
          style={{ accentColor: t.ink }} />
        {label}
      </label>
    );
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 26px' }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8, padding: 0 }}>
        Do you have a budget for this project?
      </legend>
      <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
        Only you and your collaborators can see this. Optional.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {choice(true, 'Yes')}
        {choice(false, 'No')}
      </div>

      {hasBudget && (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="project-budget-amount"
            style={{ display: 'block', fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>
            Amount
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <input id="project-budget-amount" type="text" inputMode="decimal" value={amount}
              onChange={(e) => onAmount(e.target.value)} placeholder="e.g. 250000"
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? 'project-budget-amount-error' : undefined}
              style={{ ...inputStyle(t), flex: 1, border: `1.5px solid ${invalid ? '#B3261E' : t.line}` }} />
            <select aria-label="Currency" value={currency} onChange={(e) => onCurrency(e.target.value)}
              style={{ ...inputStyle(t), width: 110 }}>
              {BUDGET_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </div>
          {invalid && (
            <div id="project-budget-amount-error" style={{ fontSize: 13, color: '#B3261E', marginTop: 8 }}>
              Enter the amount as a number, like 250000.
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}

/**
 * The Toolkit, as a grid to choose a project's tools from. Each card is a toggle, and
 * all this holds is which ones are chosen. Setting one up happens when its room is
 * opened — or, for Reimagine a Space, in SceneSetup beneath it.
 */
function ToolPicker({ t, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((tool) => tool !== id) : [...value, id]);

  return (
    <ul aria-label="Toolkit tools" style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {TOOLS.map((tool) => {
        const chosen = value.includes(tool.id);
        return (
          <li key={tool.id}>
            <button type="button" aria-pressed={chosen} onClick={() => toggle(tool.id)}
              style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 10,
                padding: 16, textAlign: 'left', cursor: 'pointer', borderRadius: 12,
                background: chosen ? tool.wash : t.surface,
                border: `1.5px solid ${chosen ? tool.color : t.line}`, color: t.ink,
                fontFamily: 'var(--placer-font)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, flex: '0 0 auto', background: tool.tint,
                  boxShadow: `inset 0 0 0 1px ${tool.color}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: tool.color }}>
                  <Icon name={tool.icon} size={18} stroke={2} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{tool.name}</span>
                  <span className="placer-mono" style={{ display: 'block', fontSize: 11, color: t.inkDim,
                    textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {findCategory(tool.category)?.name}
                  </span>
                </span>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 11, flex: '0 0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: chosen ? tool.color : 'transparent',
                  border: `1.5px solid ${chosen ? tool.color : t.lineStrong}`, color: '#fff' }}>
                  {chosen && <Icon name="check" size={14} stroke={2.6} />}
                </span>
              </span>
              <span style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5 }}>{tool.tagline}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Reimagine a Space's setup for this project: where the place is, and the photo of it
 * that people place benches, trees and the rest on. Both are required — without them
 * there is nothing for anyone to draw on. Shown once the tool is chosen.
 */
function SceneSetup({ t, address, point, image, onAddress, onPick, onImage, disabled }) {
  const tool = TOOLS.find(({ id }) => id === REIMAGINE_TOOL);
  return (
    <section aria-label="Set up Reimagine a Space"
      style={{ margin: '0 0 26px', padding: 20, borderRadius: 12, background: tool.wash,
        border: `1.5px solid ${tool.color}` }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: t.ink, margin: '0 0 6px' }}>Set up Reimagine a Space</h2>
      <p style={{ fontSize: 13.5, color: t.inkDim, lineHeight: 1.5, margin: '0 0 20px' }}>
        People imagining for this project place their ideas on a photo you choose, of a place you choose,
        instead of finding a spot in Street View.
      </p>

      <Field t={t} label="Location *" htmlFor="scene-address"
        hint={isGoogleMapsConfigured()
          ? 'Where the photo is of. Pick it from the suggestions, so the ideas are pinned there on the map.'
          : 'Where the photo is of.'}>
        <AddressInput id="scene-address" value={address}
          placeholder="e.g. Folkets Park, Malmö" style={inputStyle(t)}
          onChange={onAddress} onPick={onPick} />
        {isGoogleMapsConfigured() && address.trim() && !point && (
          <div style={{ fontSize: 13, color: t.inkFaint, marginTop: 8 }}>
            Not pinned yet: pick the address from the suggestions.
          </div>
        )}
      </Field>

      <Field t={t} label="Base image *"
        hint="The photo people add to. A wide, landscape photo of the place works best. It is resized, and saved without its location data.">
        {image && (
          <img src={image} alt="The base image" style={{ display: 'block', width: '100%', aspectRatio: '10 / 7',
            objectFit: 'cover', borderRadius: 12, border: `1px solid ${t.line}`, marginBottom: 14 }} />
        )}
        <ImagePicker t={t} hasImage={!!image} uploadLabel="Add a base image" replaceLabel="Choose another"
          onUpload={async (file) => {
            checkPickedImage(file, 'A base image'); // Throws the same sentence the upload would.
            onImage(file);
          }}
          onRemove={async () => onImage(null)} disabled={disabled} />
      </Field>
    </section>
  );
}

function ProjectTypeChoice({ t, value, onChange }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 10, padding: 0 }}>
        What kind of project is it?
      </legend>
      {PROJECT_TYPES.map((type) => {
        const checked = value === type.key;
        return (
          <label key={type.key}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 18, cursor: 'pointer',
              borderRadius: 12, background: checked ? t.surfaceAlt : t.surface,
              border: `1.5px solid ${checked ? t.ink : t.line}` }}>
            <input type="radio" name="project-type" value={type.key} checked={checked}
              onChange={() => onChange(type.key)}
              style={{ marginTop: 3, accentColor: t.ink, flex: '0 0 auto' }} />
            <span>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 4 }}>
                {type.title}
              </span>
              <span style={{ display: 'block', fontSize: 14, color: t.inkDim, lineHeight: 1.55 }}>
                {type.description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * Who a project is run by: the account starting it, or one of the organisations it is
 * an admin of. Only offered to somebody who runs at least one organisation.
 */
function RunByChoice({ t, accountName, organisations, value, onChange }) {
  return (
    <Field t={t} label="Run by" htmlFor="project-organisation"
      hint="Run it in the name of an organisation you are an admin of, and it is credited to the organisation and listed on its page.">
      <select id="project-organisation" value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)} style={inputStyle(t)}>
        <option value="">{accountName ? `Just me (${accountName})` : 'Just me'}</option>
        {organisations.map((organisation) => (
          <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
        ))}
      </select>
    </Field>
  );
}

/**
 * `project` is null to start a new one, or an existing project (from services/projects'
 * fromRow shape) to edit it in place — the same field set either way, so this is the
 * one form both `/projects/new` and a dashboard's "Edit setup" reach.
 */
export function ProjectSetupPage({ t, accountId, accountName, project: initialProject = null,
  organisations = [], initialOrganisationId = null, onSaved, onCancel }) {
  // Normally the project being edited. Starting a new one can set it too: if the
  // project is created but its image then fails to upload, the form carries on as an
  // edit of that project, so trying again cannot start a second one.
  const [project, setProject] = useState(initialProject);
  const editing = !!project;

  const [name, setName] = useState(project?.name ?? '');
  const [summary, setSummary] = useState(project?.summary ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [startDate, setStartDate] = useState(project?.startDate ?? '');
  const [endDate, setEndDate] = useState(project?.endDate ?? '');
  const [address, setAddress] = useState(project?.address ?? '');
  // Where `address` is, and its town and country, when it came from a suggestion; both
  // dropped once it is edited by hand, since the text no longer says where it was.
  const [point, setPoint] = useState(project?.locationPoint ?? null);
  const [town, setTown] = useState('');
  // The tools chosen for it. Editing, they are loaded first, and `toolsReady` stays
  // false until they are, so a failed load can never save over them with nothing.
  const [tools, setTools] = useState([]);
  const [toolsReady, setToolsReady] = useState(!initialProject);
  // Reimagine a Space's scene (SceneSetup). `savedScene` is what the project has now,
  // so a replaced or dropped base image can be deleted once nothing points at it; the
  // picked photo waits in `scenePending` until the save, like a new project's image.
  const [savedScene, setSavedScene] = useState(null);
  const [sceneAddress, setSceneAddress] = useState('');
  const [scenePoint, setScenePoint] = useState(null);
  const [scenePending, setScenePending] = useState(null); // { file, url } | null
  const [sceneImageCleared, setSceneImageCleared] = useState(false);
  // The budget question: null until answered. Loaded first when editing, with the same
  // guard as the tools, so a failed read never saves over it.
  const [hasBudget, setHasBudget] = useState(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState('EUR');
  const [budgetReady, setBudgetReady] = useState(!initialProject);
  const [projectType, setProjectType] = useState(project?.projectType ?? null);
  const [visibility, setVisibility] = useState(project?.visibility ?? 'public');
  const [organisationId, setOrganisationId] = useState(project ? project.organisationId : initialOrganisationId);
  // Which of the six steps a new project is on, 0 to 5. Editing has no steps.
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'error'
  const [error, setError] = useState(null);
  // A new project has no id to name the image's folder until it is created, so the
  // picked file waits here, shown from a local preview, and is uploaded right after.
  const [pending, setPending] = useState(null); // { file, url } | null

  // Only for a project opened to edit. One started here already holds its choice, and
  // reloading would throw it away if the tools failed to save the first time.
  useEffect(() => {
    if (!initialProject) return undefined;
    let cancelled = false;
    Promise.all([readProjectTools(initialProject.id), readProjectToolConfig(initialProject.id, REIMAGINE_TOOL)])
      .then(([saved, scene]) => {
        if (cancelled) return;
        setTools(saved);
        setSavedScene(scene);
        setSceneAddress(scene?.address ?? '');
        setScenePoint(scene?.point ?? null);
        setToolsReady(true);
      })
      .catch((err) => console.error('Could not load the project\'s tools:', err));
    readProjectBudget(initialProject.id)
      .then((budget) => {
        if (cancelled) return;
        if (budget) {
          setHasBudget(budget.hasBudget);
          setBudgetAmount(budget.amount == null ? '' : String(budget.amount));
          setBudgetCurrency(budget.currency);
        }
        setBudgetReady(true);
      })
      .catch((err) => console.error('Could not load the project\'s budget:', err));
    return () => { cancelled = true; };
  }, [initialProject]);

  // The preview URL holds the file in memory until it is revoked.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);
  useEffect(() => () => { if (scenePending) URL.revokeObjectURL(scenePending.url); }, [scenePending]);

  // Editing: the image saves straight away, like a cover in Settings, and the file it
  // replaces is deleted once the project points at the new one.
  const replaceImage = async (nextPath) => {
    const previous = project.imagePath;
    const saved = await updateProject(project.id, { imagePath: nextPath });
    setProject(saved);
    if (previous && previous !== nextPath) await removeProjectImageFile(previous);
  };

  const pickPendingImage = async (file) => {
    checkPickedImage(file, 'A project image'); // Throws the same sentence the upload would.
    setPending({ file, url: URL.createObjectURL(file) });
  };

  const shownImage = editing ? project.image : pending?.url;

  // Only an organisation this account runs can be chosen — the database refuses any
  // other (supabase/organisations.sql section 6). `organisations` can arrive after the
  // form opens, so a `?organisation=` id is held as asked and only counts once it is
  // in the list. A project already run by an organisation this account is not an admin
  // of (a collaborator editing it) has nothing to choose, so the choice is not shown
  // and the project keeps its organisation.
  const runsOrganisation = (id) => organisations.some((organisation) => organisation.id === id);
  const chosenOrganisationId = runsOrganisation(organisationId) ? organisationId : null;
  const offerRunBy = organisations.length > 0
    && (!editing || !project.organisationId || runsOrganisation(project.organisationId));

  const budgetValid = !hasBudget || !Number.isNaN(parseBudgetAmount(budgetAmount));
  const complete = name.trim().length > 0 && budgetValid;

  const reimagining = tools.includes(REIMAGINE_TOOL);
  const sceneImage = scenePending?.url ?? (sceneImageCleared ? null : savedScene?.image ?? null);
  const sceneComplete = !reimagining || (!!sceneImage && sceneAddress.trim().length > 0
    && (!!scenePoint || !isGoogleMapsConfigured()));

  // Choosing Reimagine a Space starts its location at the project's own, which is
  // usually the place in question.
  const chooseTools = (next) => {
    if (next.includes(REIMAGINE_TOOL) && !tools.includes(REIMAGINE_TOOL) && !sceneAddress.trim()) {
      setSceneAddress(address);
      setScenePoint(point);
    }
    setTools(next);
  };

  const pickSceneImage = (file) => {
    setScenePending(file ? { file, url: URL.createObjectURL(file) } : null);
    setSceneImageCleared(!file);
  };

  // After the tools are saved, so the row the scene goes on exists — or is gone, when
  // the tool was dropped, and then only its base image is left to delete.
  const saveScene = async (projectId) => {
    const previousPath = savedScene?.imagePath ?? null;
    if (!reimagining) {
      setSavedScene(null);
      await removeProjectImageFile(previousPath);
      return;
    }
    const imagePath = scenePending ? await uploadSceneImage(projectId, scenePending.file) : previousPath;
    await saveProjectToolConfig(projectId, REIMAGINE_TOOL, {
      address: sceneAddress.trim(), point: scenePoint, imagePath,
    });
    // Saved, so a second try does not upload the same photo again.
    setSavedScene({ address: sceneAddress.trim(), point: scenePoint, imagePath, image: mediaUrl(imagePath) });
    setScenePending(null);
    setSceneImageCleared(false);
    if (previousPath && previousPath !== imagePath) await removeProjectImageFile(previousPath);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!complete || !sceneComplete || status === 'saving') return;

    setStatus('saving');
    setError(null);
    try {
      const patch = {
        name: name.trim(),
        summary: summary.trim(),
        description: description.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
        address: address.trim(),
        locationPoint: address.trim() ? point : null,
        projectType,
        visibility,
      };
      // A project edited without touching its address keeps the place names it has —
      // which, for one set up before addresses, may be several typed by hand.
      if (!editing || address.trim() !== (project.address ?? '')) {
        patch.locations = placeNames(address, town);
      }
      if (offerRunBy) patch.organisationId = chosenOrganisationId;

      let saved = editing
        ? await updateProject(project.id, patch)
        : await createProject({ ownerId: accountId, ownerName: accountName, ...patch });

      if (!editing && pending) {
        try {
          const imagePath = await uploadProjectImage(saved.id, pending.file);
          saved = await updateProject(saved.id, { imagePath });
        } catch (imageError) {
          console.error('Could not add the project image:', imageError);
          setProject(saved);
          setPending(null);
          setError(`The project was started, but its image could not be added: ${imageError.message} `
            + 'Try it again below, or save without one.');
          setStatus('idle');
          return;
        }
      }

      if (toolsReady && (editing || tools.length > 0)) {
        try {
          await saveProjectTools(saved.id, tools, accountId);
        } catch (toolsError) {
          console.error('Could not save the project\'s tools:', toolsError);
          setProject(saved);
          setPending(null);
          setError(`The project was saved, but its tools could not be: ${toolsError.message} `
            + 'Save again to try once more.');
          setStatus('idle');
          return;
        }
      }

      if (toolsReady && (reimagining || savedScene)) {
        try {
          await saveScene(saved.id);
        } catch (sceneError) {
          console.error('Could not set up Reimagine a Space:', sceneError);
          setProject(saved);
          setPending(null);
          setError(`The project was saved, but Reimagine a Space could not be set up: ${sceneError.message} `
            + 'Save again to try once more.');
          setStatus('idle');
          return;
        }
      }

      if (budgetReady && hasBudget !== null) {
        try {
          await saveProjectBudget(saved.id, {
            hasBudget, amount: parseBudgetAmount(budgetAmount), currency: budgetCurrency,
          });
        } catch (budgetError) {
          console.error('Could not save the project\'s budget:', budgetError);
          setProject(saved);
          setPending(null);
          setError(`The project was saved, but its budget could not be: ${budgetError.message} `
            + 'Save again to try once more.');
          setStatus('idle');
          return;
        }
      }

      onSaved(saved);
    } catch (err) {
      console.error(`Could not ${editing ? 'save' : 'start'} that project:`, err);
      setError(err?.message ?? `Could not ${editing ? 'save' : 'start'} that project. Try again.`);
      setStatus('idle');
    }
  };

  const goalsHint = PROJECT_TYPES.find(({ key }) => key === projectType)?.goalsHint
    ?? 'What is this project trying to find out or bring about?';

  // The fields, each once, so the steps and the single edit page lay out the same ones.
  const basics = (
    <>
      {offerRunBy && (
        <RunByChoice t={t} accountName={accountName} organisations={organisations}
          value={chosenOrganisationId} onChange={setOrganisationId} />
      )}

      <Field t={t} label="Name *" htmlFor="project-name">
        <input id="project-name" type="text" value={name} maxLength={NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Riverside Greenway" style={inputStyle(t)} />
      </Field>

      <Field t={t} label="Description" htmlFor="project-summary"
        hint="What the project is, in a sentence or two. Shown on its card and its public page.">
        <textarea id="project-summary" value={summary} rows={3} maxLength={SUMMARY_MAX_LENGTH}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g., Turning the disused rail line along the river into a park."
          style={{ ...inputStyle(t), resize: 'vertical' }} />
      </Field>

      <Field t={t} label="Goals" htmlFor="project-description" hint={goalsHint}>
        <textarea id="project-description" value={description} rows={5}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What the project is for, and what success looks like."
          style={{ ...inputStyle(t), resize: 'vertical' }} />
      </Field>

      <div style={{ display: 'flex', gap: 16, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <Field t={t} label="Start date" htmlFor="project-start">
            <input id="project-start" type="date" value={startDate ?? ''}
              onChange={(e) => setStartDate(e.target.value)} style={inputStyle(t)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field t={t} label="End date" htmlFor="project-end">
            <input id="project-end" type="date" value={endDate ?? ''}
              onChange={(e) => setEndDate(e.target.value)} style={inputStyle(t)} />
          </Field>
        </div>
      </div>

      {budgetReady && (
        <BudgetQuestion t={t} hasBudget={hasBudget} onHasBudget={setHasBudget}
          amount={budgetAmount} onAmount={setBudgetAmount}
          currency={budgetCurrency} onCurrency={setBudgetCurrency} />
      )}

      <VisibilityChoice t={t} value={visibility} onChange={setVisibility} />
    </>
  );

  const image = (
    <Field t={t} label="Image"
      hint="Shown at the top of the project's page and on its card, instead of the map of its area. A landscape photo works best. It is resized, and saved without its location data. Optional.">
      {shownImage && (
        <img src={shownImage} alt="" style={{ display: 'block', width: '100%', aspectRatio: '16 / 9',
          objectFit: 'cover', borderRadius: 12, border: `1px solid ${t.line}`, marginBottom: 14 }} />
      )}
      {editing ? (
        <ImagePicker t={t} hasImage={!!project.image} uploadLabel="Add an image"
          replaceLabel="Replace image"
          onUpload={async (file) => replaceImage(await uploadProjectImage(project.id, file))}
          onRemove={() => replaceImage(null)} disabled={status === 'saving'} />
      ) : (
        <ImagePicker t={t} hasImage={!!pending} uploadLabel="Add an image"
          replaceLabel="Choose another" onUpload={pickPendingImage}
          onRemove={async () => setPending(null)} disabled={status === 'saving'} />
      )}
    </Field>
  );

  const place = (
    <Field t={t} label="Address" htmlFor="project-address"
      hint={isGoogleMapsConfigured()
        ? 'The place this project is about. Pick it from the suggestions and the project is pinned there on the map.'
        : 'The place this project is about.'}>
      <AddressInput id="project-address" value={address}
        placeholder="e.g. Folkets Park, Malmö" style={inputStyle(t)}
        onChange={(next) => { setAddress(next); setPoint(null); setTown(''); }}
        onPick={(picked) => {
          setAddress(picked.address);
          setPoint(picked.point);
          setTown(picked.townAndCountry);
        }} />
      {isGoogleMapsConfigured() && address.trim() && (
        <div style={{ fontSize: 13, color: t.inkFaint, marginTop: 8 }}>
          {point
            ? 'Pinned on the map at this address.'
            : 'Not pinned yet: pick the address from the suggestions to put it on the map.'}
        </div>
      )}
    </Field>
  );

  const toolsField = toolsReady ? (
    <>
      <ToolPicker t={t} value={tools} onChange={chooseTools} />
      {reimagining && (
        <SceneSetup t={t} address={sceneAddress} point={scenePoint} image={sceneImage}
          onAddress={(next) => { setSceneAddress(next); setScenePoint(null); }}
          onPick={(picked) => { setSceneAddress(picked.address); setScenePoint(picked.point); }}
          onImage={pickSceneImage} disabled={status === 'saving'} />
      )}
    </>
  ) : (
    <p style={{ fontSize: 14, color: t.inkDim, marginBottom: 26 }}>Loading the project&rsquo;s tools…</p>
  );

  const errorBox = error && (
    <div role="alert" style={{ marginBottom: 24, padding: 14, borderRadius: 12,
      background: '#F5F5F5', borderLeft: '4px solid #B3261E', fontSize: 14, color: t.ink, fontWeight: 500 }}>
      {error}
    </div>
  );

  const page = (children) => (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '96px 40px' }} className="placer-scroll">
      {children}
    </div>
  );

  const heading = (text) => (
    <h1 className="placer-disp" style={{ fontSize: 40, fontWeight: 700, color: t.ink,
      letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
      {text}
    </h1>
  );

  if (editing) {
    return page(
      <form onSubmit={handleSubmit} style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 36 }}>
          {heading('Edit project')}
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6 }}>
            Change the setup. Collaborators, links and Toolkit sessions live on the dashboard.
          </p>
        </div>

        <ProjectTypeChoice t={t} value={projectType} onChange={setProjectType} />
        {basics}
        {image}
        {place}

        <h2 style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8 }}>Tools</h2>
        <p style={{ fontSize: 13, color: t.inkDim, marginBottom: 14, lineHeight: 1.5 }}>
          The tools this project will use. Most are set up when you open them for people to take part.
        </p>
        {toolsField}

        <p style={{ fontSize: 13.5, color: t.inkFaint, marginTop: -10, marginBottom: 26, lineHeight: 1.5 }}>
          Adding or removing collaborators, and attaching links, are on the project's dashboard.
        </p>

        {errorBox}

        <div style={{ display: 'flex', gap: 12 }}>
          <Btn t={t} type="submit" variant="primary" icon="check"
            disabled={!complete || !sceneComplete || status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save changes'}
          </Btn>
          {onCancel && (
            <Btn t={t} type="button" variant="ghost" onClick={onCancel}>Cancel</Btn>
          )}
        </div>
      </form>
    );
  }

  // Step 1: the cover.
  if (step === 0) {
    return page(
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {heading('Start a project')}
        <p style={{ fontSize: 18, color: t.inkDim, lineHeight: 1.6, marginBottom: 28 }}>
          A project brings people together around a place: to imagine what it could be,
          and to decide or push for what happens to it.
        </p>
        <ul style={{ margin: '0 0 36px', paddingLeft: 20, fontSize: 16, color: t.ink, lineHeight: 1.7 }}>
          <li>A dashboard to run it from, and a public page anyone can open from a link.</li>
          <li>Collaborators who can help you set it up and run it.</li>
          <li>Imaginations posted to it, and Toolkit rooms to gather people&rsquo;s views.</li>
        </ul>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Btn t={t} variant="primary" icon="plus" onClick={() => setStep(1)}>
            Create a new project
          </Btn>
          {onCancel && (
            <Btn t={t} type="button" variant="ghost" onClick={onCancel}>Cancel</Btn>
          )}
        </div>
      </div>
    );
  }

  // What has to be filled in before a step lets you past it.
  const stepReady = step === 1 ? !!projectType : step === 2 ? complete : step === 4 ? sceneComplete : true;

  // Enter in a field moves on a step rather than starting the project early.
  const onStepSubmit = (e) => {
    if (step < LAST_STEP) {
      e.preventDefault();
      if (stepReady) setStep(step + 1);
      return;
    }
    handleSubmit(e);
  };

  return page(
    <form onSubmit={onStepSubmit} style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.inkDim, marginBottom: 10 }}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </div>
        <div aria-hidden="true" style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {STEPS.map((label, i) => (
            <span key={label} style={{ flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? t.ink : t.line }} />
          ))}
        </div>
        {heading(step === 1 ? 'What kind of project?' : step === 2 ? 'The basics'
          : step === 3 ? 'Where is it?' : step === 4 ? 'Add tools' : 'Add an image')}
        {step === 1 && (
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6 }}>
            This shapes how the rest of the project is set up. You can change it later.
          </p>
        )}
        {step === 4 && (
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6 }}>
            Choose the tools this project will use. Most you set up later, when you open them for
            people to take part — and you can change which ones from the project&rsquo;s setup.
          </p>
        )}
      </div>

      {step === 1 && <ProjectTypeChoice t={t} value={projectType} onChange={setProjectType} />}
      {step === 2 && basics}
      {step === 3 && place}
      {step === 4 && toolsField}
      {step === 5 && image}

      {errorBox}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Btn t={t} type="button" variant="outline" onClick={() => setStep(step - 1)}
          disabled={status === 'saving'}>
          Back
        </Btn>
        {step < LAST_STEP ? (
          <Btn t={t} type="submit" variant="primary" icon="arrowRight" disabled={!stepReady}>
            Next
          </Btn>
        ) : (
          <Btn t={t} type="submit" variant="primary" icon="check"
            disabled={!complete || !sceneComplete || status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Start project'}
          </Btn>
        )}
        {onCancel && (
          <Btn t={t} type="button" variant="ghost" onClick={onCancel}>Cancel</Btn>
        )}
      </div>
    </form>
  );
}

export default ProjectSetupPage;
