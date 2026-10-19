/* PLACER — the sections of a project's page, to put in order and retitle.
 *
 * Edit project's Page field. `sections` are the page's sections as arrangeSections
 * (lib/projectSections.js) gives them: in the order they are shown, each with its
 * `defaultTitle` and the `customTitle` written over it, if any. `onChange(sections)`
 * hands back the list as it now stands; saving it is the form's, with Save changes.
 *
 * A row is put in order by dragging its handle (@dnd-kit), with a mouse, a finger or
 * from the keyboard, or a step at a time with the buttons beside it. Its title field
 * shows the default as its placeholder, so emptying it goes back to the default. Its
 * Hide title box keeps the title off the page (screen readers still have it); a photo
 * shown on its own starts with it ticked.
 */

import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icon';
import { SECTION_TITLE_MAX } from '../lib/projectSections';

/** What kind of section a row is, said under its title field. */
function describe(section) {
  if (section.kind === 'about') return 'The project’s description';
  if (section.kind === 'goals') return 'The project’s goals';
  if (section.kind === 'photos') return 'Its photo gallery';
  if (section.kind === 'photo') return 'A photo on its own';
  return section.tool.name;
}

function StepButton({ t, label, icon, onClick, disabled }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.line}`, background: t.surface,
        color: t.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <Icon name={icon} size={15} stroke={2.2} />
    </button>
  );
}

function Row({ t, section, index, count, onMove, onTitle, onHide, disabled }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.key, disabled,
  });
  const fieldId = `page-section-${index}`;
  return (
    <li ref={setNodeRef} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: 12, border: `1px solid ${t.line}`, background: t.chrome,
      transform: CSS.Transform.toString(transform), transition, position: 'relative',
      zIndex: isDragging ? 1 : undefined, boxShadow: isDragging ? '0 8px 24px rgba(0, 0, 0, 0.14)' : 'none' }}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
        aria-label={`Drag ${section.title} to reorder`}
        style={{ width: 30, height: 36, border: 'none', background: 'transparent', color: t.inkDim, flex: '0 0 auto',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
          cursor: disabled ? 'default' : (isDragging ? 'grabbing' : 'grab'), touchAction: 'none' }}>
        <Icon name="move" size={18} stroke={2} />
      </button>
      {section.kind === 'photo' && (
        <img src={section.photo.url} alt="" style={{ width: 52, height: 40, objectFit: 'cover', borderRadius: 6,
          border: `1px solid ${t.line}`, flex: '0 0 auto' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <label htmlFor={fieldId} className="placer-caption"
          style={{ display: 'block', color: t.inkDim, marginBottom: 4 }}>
          {index + 1}. {describe(section)}
        </label>
        <input id={fieldId} type="text" value={section.customTitle} placeholder={section.defaultTitle}
          maxLength={SECTION_TITLE_MAX} disabled={disabled}
          onChange={(e) => onTitle(index, e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 15, borderRadius: 8,
            border: `1.5px solid ${t.line}`, background: t.page, color: section.hideTitle ? t.inkDim : t.ink,
            fontFamily: 'var(--placer-font)', textDecoration: section.hideTitle ? 'line-through' : 'none' }} />
        <label className="placer-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 6, color: t.inkDim, cursor: disabled ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={Boolean(section.hideTitle)} disabled={disabled}
            onChange={(e) => onHide(index, e.target.checked)} style={{ accentColor: t.ink, margin: 0 }} />
          Hide title
        </label>
      </div>
      <StepButton t={t} label={`Move ${section.title} up`} icon="chevUp"
        disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)} />
      <StepButton t={t} label={`Move ${section.title} down`} icon="chevDown"
        disabled={disabled || index === count - 1} onClick={() => onMove(index, index + 1)} />
    </li>
  );
}

export function PageLayoutEditor({ t, sections, onChange, disabled = false }) {
  // A drag starts only once the pointer has moved a little, so a click is a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = (from, to) => onChange(arrayMove(sections, from, to));
  const retitle = (index, customTitle) => onChange(sections.map((section, i) => (i === index
    ? { ...section, customTitle, title: customTitle.trim() || section.defaultTitle }
    : section)));

  const hide = (index, hideTitle) => onChange(sections.map((section, i) => (i === index
    ? { ...section, hideTitle }
    : section)));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((section) => section.key === active.id);
    const to = sections.findIndex((section) => section.key === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  if (sections.length === 0) {
    return (
      <p style={{ fontSize: 14, color: t.inkDim }}>
        Nothing on the page to arrange yet. Add a description, photos or a tool first.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
      accessibility={{ screenReaderInstructions: { draggable:
        'To pick up a section, press Space or Enter. Use the arrow keys to move it, then Space or Enter to put it down, or Escape to cancel.' } }}>
      <SortableContext items={sections.map((section) => section.key)} strategy={verticalListSortingStrategy}>
        <ol aria-label="Page sections" style={{ listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map((section, index) => (
            <Row key={section.key} t={t} section={section} index={index} count={sections.length}
              onMove={move} onTitle={retitle} onHide={hide} disabled={disabled} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

export default PageLayoutEditor;
