/* PLACER — start or edit a project: dates, where it is, and what it is trying to do */

import { useEffect, useState } from 'react';
import { Btn } from './UI';
import { ImagePicker } from './ImagePicker';
import { LocationMapPicker } from './LocationMapPicker';
import {
  createProject, removeProjectImageFile, updateProject, uploadProjectImage,
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

/**
 * `project` is null to start a new one, or an existing project (from services/projects'
 * fromRow shape) to edit it in place — the same field set either way, so this is the
 * one form both `/projects/new` and a dashboard's "Edit setup" reach.
 */
export function ProjectSetupPage({ t, accountId, accountName, project: initialProject = null, onSaved, onCancel }) {
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
      };

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

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.page,
      padding: '48px 40px 96px' }} className="placer-scroll">
      <form onSubmit={handleSubmit} style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 className="placer-disp" style={{ fontSize: 40, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>
            {editing ? 'Edit project' : 'Start a project'}
          </h1>
          <p style={{ fontSize: 16, color: t.inkDim, lineHeight: 1.6 }}>
            {editing
              ? 'Change the setup. Collaborators, links and Sandbox sessions live on the dashboard.'
              : 'A project gets a dashboard, a public page, and lets people collaborate with you on it.'}
          </p>
        </div>

        <Field t={t} label="Name *" htmlFor="project-name">
          <input id="project-name" type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Riverside Greenway" style={inputStyle(t)} />
        </Field>

        <Field t={t} label="Goals" htmlFor="project-description"
          hint="What is this project trying to find out or bring about?">
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

        <Field t={t} label="Locations" htmlFor="project-locations"
          hint="Where this project is about — one place per line.">
          <textarea id="project-locations" value={locationsText} rows={3}
            onChange={(e) => setLocationsText(e.target.value)}
            placeholder={'Malmö\nFolkets Park'}
            style={{ ...inputStyle(t), resize: 'vertical' }} />
        </Field>

        <Field t={t} label="Location outline"
          hint="Draw the area this project covers on the map — the polygon tool in its top-center control starts a shape, and clicking its last point closes it. You can draw more than one, and drag a corner afterwards to adjust it.">
          <LocationMapPicker t={t} initialShapes={project?.locationShapes ?? []} onChange={setLocationShapes} />
        </Field>

        {editing && (
          <p style={{ fontSize: 13.5, color: t.inkFaint, marginTop: -10, marginBottom: 26, lineHeight: 1.5 }}>
            Adding or removing collaborators, and attaching links, are on the project's dashboard.
          </p>
        )}

        {error && (
          <div role="alert" style={{ marginBottom: 24, padding: 14, borderRadius: 12,
            background: '#F5F5F5', borderLeft: '4px solid #B3261E', fontSize: 14, color: t.ink, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <Btn t={t} type="submit" variant="primary" icon="check" disabled={!complete || status === 'saving'}>
            {status === 'saving' ? 'Saving…' : editing ? 'Save changes' : 'Start project'}
          </Btn>
          {onCancel && (
            <Btn t={t} variant="ghost" onClick={onCancel}>Cancel</Btn>
          )}
        </div>
      </form>
    </div>
  );
}

export default ProjectSetupPage;
