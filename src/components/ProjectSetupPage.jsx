/* PLACER — start or edit a project: what kind it is, what it is trying to do, and where.
 *
 * Starting one is five steps, one screen each: a cover saying what a project is, the
 * kind of project (services/projects.js's PROJECT_TYPES, which work as templates for
 * what follows), the basics, the place, and an image. Editing one is the same fields on
 * a single page, since whoever is editing already knows what a project is. */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { ImagePicker } from './ImagePicker';
import { LocationMapPicker } from './LocationMapPicker';
import {
  PROJECT_TYPES, createProject, removeProjectImageFile, updateProject, uploadProjectImage,
} from '../services/projects';
import { checkPickedImage } from '../services/media';

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

/** locations <-> one line each, so the form needs no add/remove-row plumbing. */
const locationsToText = (locations) => (locations ?? []).join('\n');
const textToLocations = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

/** The five steps of starting a project, in order. */
const STEPS = ['What is a project', 'Project type', 'The basics', 'The place', 'An image'];
const LAST_STEP = STEPS.length - 1;

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
  const [description, setDescription] = useState(project?.description ?? '');
  const [startDate, setStartDate] = useState(project?.startDate ?? '');
  const [endDate, setEndDate] = useState(project?.endDate ?? '');
  const [locationsText, setLocationsText] = useState(locationsToText(project?.locations));
  const [locationShapes, setLocationShapes] = useState(project?.locationShapes ?? []);
  const [projectType, setProjectType] = useState(project?.projectType ?? null);
  const [organisationId, setOrganisationId] = useState(project ? project.organisationId : initialOrganisationId);
  // Which of the five steps a new project is on, 0 to 4. Editing has no steps.
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'error'
  const [error, setError] = useState(null);
  // A new project has no id to name the image's folder until it is created, so the
  // picked file waits here, shown from a local preview, and is uploaded right after.
  const [pending, setPending] = useState(null); // { file, url } | null

  // The preview URL holds the file in memory until it is revoked.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

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

  const complete = name.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!complete || status === 'saving') return;

    setStatus('saving');
    setError(null);
    try {
      const patch = {
        name: name.trim(),
        description: description.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
        locations: textToLocations(locationsText),
        locationShapes,
        projectType,
      };
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
        <input id="project-name" type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Riverside Greenway" style={inputStyle(t)} />
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

  // The map picker reads its shapes once, when it mounts, so a new project hands back
  // what was drawn before rather than the (empty) project's — stepping away and back
  // to the place step keeps the outline.
  const place = (
    <>
      <Field t={t} label="Locations" htmlFor="project-locations"
        hint="Where this project is about — one place per line.">
        <textarea id="project-locations" value={locationsText} rows={3}
          onChange={(e) => setLocationsText(e.target.value)}
          placeholder={'Malmö\nFolkets Park'}
          style={{ ...inputStyle(t), resize: 'vertical' }} />
      </Field>

      <Field t={t} label="Location outline"
        hint="Draw the area this project covers on the map — the polygon tool in its top-center control starts a shape, and clicking its last point closes it. You can draw more than one, and drag a corner afterwards to adjust it.">
        <LocationMapPicker t={t} initialShapes={editing ? (project?.locationShapes ?? []) : locationShapes}
          onChange={setLocationShapes} />
      </Field>
    </>
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

        <p style={{ fontSize: 13.5, color: t.inkFaint, marginTop: -10, marginBottom: 26, lineHeight: 1.5 }}>
          Adding or removing collaborators, and attaching links, are on the project's dashboard.
        </p>

        {errorBox}

        <div style={{ display: 'flex', gap: 12 }}>
          <Btn t={t} type="submit" variant="primary" icon="check" disabled={!complete || status === 'saving'}>
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
  const stepReady = step === 1 ? !!projectType : step === 2 ? complete : true;

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
          : step === 3 ? 'Where is it?' : 'Add an image')}
        {step === 1 && (
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6 }}>
            This shapes how the rest of the project is set up. You can change it later.
          </p>
        )}
      </div>

      {step === 1 && <ProjectTypeChoice t={t} value={projectType} onChange={setProjectType} />}
      {step === 2 && basics}
      {step === 3 && place}
      {step === 4 && image}

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
          <Btn t={t} type="submit" variant="primary" icon="check" disabled={!complete || status === 'saving'}>
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
