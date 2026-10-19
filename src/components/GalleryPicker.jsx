/* PLACER — the photos on a project's page beside its header image, to add, order and
 * remove.
 *
 * Like ImagePicker, it owns only the controls, the busy state and the error line; what
 * adding, moving and removing do belongs to the caller. `onAdd(files)`,
 * `onMove(from, to)` and `onRemove(index)` are async and throw a readable sentence on
 * failure. `photos` is the list as it stands, each { path, url }. Several files can be
 * picked at once; past `max`, the rest are left out and it says so.
 *
 * A photo is put in order by dragging it (@dnd-kit), with a mouse, a finger, or from
 * the keyboard — focus a photo, Space to pick it up, the arrow keys to move it, Space
 * to put it down. The earlier and later buttons under each do the same one step at a
 * time, for anyone who would rather not drag.
 */

import { useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icon';
import { IMAGE_ACCEPT } from './ImagePicker';

function SmallButton({ t, label, icon, onClick, disabled }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.line}`, background: t.surface,
        color: t.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <Icon name={icon} size={16} stroke={2.2} />
    </button>
  );
}

/** One photo: the picture itself is what is dragged; the buttons are under it. */
function Photo({ t, photo, index, count, busy, onMove, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.path, disabled: busy,
  });
  return (
    <li ref={setNodeRef} style={{ display: 'flex', flexDirection: 'column', gap: 6,
      transform: CSS.Transform.toString(transform), transition, position: 'relative',
      zIndex: isDragging ? 1 : undefined }}>
      <div {...attributes} {...listeners} aria-label={`Photo ${index + 1} of ${count}, drag to reorder`}
        style={{ borderRadius: 10, cursor: busy ? 'default' : (isDragging ? 'grabbing' : 'grab'),
          touchAction: 'none', boxShadow: isDragging ? '0 8px 24px rgba(0, 0, 0, 0.18)' : 'none' }}>
        <img src={photo.url} alt={`Photo ${index + 1}`} draggable={false} style={{ display: 'block', width: '100%',
          aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 10, border: `1px solid ${t.line}` }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <SmallButton t={t} label={`Move photo ${index + 1} earlier`} icon="chevLeft"
          disabled={busy || index === 0} onClick={() => onMove(index, index - 1)} />
        <SmallButton t={t} label={`Move photo ${index + 1} later`} icon="chevRight"
          disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)} />
        <span style={{ flex: 1 }} />
        <SmallButton t={t} label={`Remove photo ${index + 1}`} icon="trash" disabled={busy}
          onClick={() => onRemove(index)} />
      </div>
    </li>
  );
}

export function GalleryPicker({ t, photos, max, onAdd, onMove, onRemove, disabled = false }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'working'
  const [error, setError] = useState(null);
  // A drag starts only once the pointer has moved a little, so a plain click on a
  // photo is still a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const run = (next, action, fallback) => async (...args) => {
    setStatus(next);
    setError(null);
    try {
      await action(...args);
    } catch (err) {
      console.error(fallback, err);
      setError(err?.message ?? fallback);
    } finally {
      setStatus('idle');
    }
  };

  const room = max - photos.length;
  const handleFiles = (e) => {
    const files = [...(e.target.files ?? [])];
    // Cleared so picking the same files again still fires a change.
    e.target.value = '';
    if (files.length === 0) return;
    run('uploading', async () => {
      await onAdd(files.slice(0, room));
      if (files.length > room) {
        throw new Error(`A project can have up to ${max} photos, so only ${room === 1 ? 'one more was' : `${room} more were`} added.`);
      }
    }, 'Could not add those photos. Try again.')();
  };

  const busy = disabled || status !== 'idle';
  const move = run('working', onMove, 'Could not move it. Try again.');
  const remove = run('working', onRemove, 'Could not remove it. Try again.');

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = photos.findIndex((photo) => photo.path === active.id);
    const to = photos.findIndex((photo) => photo.path === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  return (
    <div>
      {photos.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
          accessibility={{ screenReaderInstructions: { draggable:
            'To pick up a photo, press Space or Enter. Use the arrow keys to move it, then Space or Enter to put it down, or Escape to cancel.' } }}>
          <SortableContext items={photos.map((photo) => photo.path)} strategy={rectSortingStrategy}>
            <ul aria-label="Photos" style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {photos.map((photo, index) => (
                <Photo key={photo.path} t={t} photo={photo} index={index} count={photos.length} busy={busy}
                  onMove={move} onRemove={remove} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {room > 0 && (
          // A label rather than a button, so the native file picker opens on click.
          <label className="placer-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 44, padding: '0 18px', borderRadius: 12, border: `1.5px solid ${t.ink}`, color: t.ink,
            fontSize: 15, fontWeight: 500, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            <Icon name="plus" size={18} stroke={2} />
            {status === 'uploading' ? 'Uploading…' : 'Add photos'}
            <input type="file" accept={IMAGE_ACCEPT} multiple onChange={handleFiles} disabled={busy}
              style={{ display: 'none' }} />
          </label>
        )}
        <span className="placer-caption" style={{ color: t.inkDim }}>
          {photos.length} of {max}{photos.length > 1 && ' · drag to reorder'}
        </span>
        {error && (
          <span role="alert" style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>{error}</span>
        )}
      </div>
    </div>
  );
}

export default GalleryPicker;
