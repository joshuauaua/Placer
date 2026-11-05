/* PLACER — Toolkit: setting up a Pin to Image slide.
 *
 * A question, the picture people pin on, and optionally a timer — the registry entry's
 * `setup.steps`. On the configuration page the picture is added on the canvas itself
 * (PinImageCanvas, `setup.Canvas`), under the question as the slide's title, and the
 * panel has the question and the timer; the project dashboard's setup walks through all
 * three (PinImageField is the picture there).
 *
 * The picture is uploaded straight away, re-encoded and stripped of its metadata, into
 * the project's own folder of the media bucket (uploadSceneImage, as Idea Visualizer's
 * picture is), and the setup keeps its key. It needs the project, as every room of the
 * tool does.
 */

import { useId, useRef, useState } from 'react';
import { Btn } from '../UI';
import { Icon } from '../Icon';
import { PinBoard } from './PinToImage';
import { TimerSelect } from './WordCloudSetup';
import { mediaUrl } from '../../services/media';
import { uploadSceneImage } from '../../services/projects';
import { DEFAULT_PROMPT, MAX_PROMPT_LENGTH } from '../../lib/pinToImage';

/** The question. */
export function PinPromptStep({ t, setup, onChange, compact = false }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {!compact && (
        <label htmlFor={`${id}-prompt`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>The prompt</label>
      )}
      <input id={`${id}-prompt`} aria-label={compact ? 'The prompt' : undefined} type="text"
        maxLength={MAX_PROMPT_LENGTH} value={setup.prompt ?? ''} placeholder={DEFAULT_PROMPT}
        onChange={(event) => onChange({ ...setup, prompt: event.target.value })}
        style={{ height: 48, padding: '0 14px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
          background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 17, fontWeight: 700 }} />
      {!compact && (
        <span style={{ fontSize: 12.5, color: t.inkDim }}>Shown above the picture, as the question people answer.</span>
      )}
    </div>
  );
}

/** The timer: none, or one of Word Cloud's. */
export function PinTimerStep({ t, setup, onChange, compact = false }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={`${id}-timer`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Timer</label>
      <TimerSelect t={t} id={`${id}-timer`} value={setup.timer} onChange={(timer) => onChange({ ...setup, timer })} />
      {!compact && (
        <span style={{ fontSize: 12.5, color: t.inkDim }}>
          Optional. You start it from the room, and when it runs out nobody can pin any more.
        </span>
      )}
    </div>
  );
}

/**
 * The picture: added, replaced or taken away. `projectId` is the project it is
 * uploaded for; without one there is nowhere to put it yet.
 */
export function PinImageField({ t, setup, onChange, projectId = null, large = false }) {
  const input = useRef(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading'
  const [message, setMessage] = useState(null);
  const url = mediaUrl(setup.imagePath);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus('uploading');
    setMessage(null);
    try {
      const imagePath = await uploadSceneImage(projectId, file);
      onChange({ ...setup, imagePath });
    } catch (err) {
      console.error('Could not upload the picture:', err);
      setMessage(err?.message ?? 'Could not upload the picture.');
    } finally {
      setStatus('idle');
    }
  };

  const chooser = (
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick}
      aria-label="Choose a picture" />
  );

  if (!projectId) {
    return (
      <p style={{ margin: 0, padding: 20, borderRadius: 12, border: `1px dashed ${t.lineStrong}`, color: t.inkDim,
        fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>
        Add this tool to a project to add its picture.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {chooser}
      {url ? (
        <>
          <PinBoard t={t} imageUrl={url} label="The picture" maxHeight={large ? '60vh' : 320} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn t={t} type="button" variant="outline" size="sm" icon="image" disabled={status === 'uploading'}
              onClick={() => input.current?.click()}>
              {status === 'uploading' ? 'Uploading…' : 'Replace the picture'}
            </Btn>
            <Btn t={t} type="button" variant="ghost" size="sm" icon="trash" disabled={status === 'uploading'}
              onClick={() => onChange({ ...setup, imagePath: null })}>
              Remove
            </Btn>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={status === 'uploading'}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            minHeight: large ? 320 : 180, padding: 24, borderRadius: 12, border: `2px dashed ${t.lineStrong}`,
            background: t.surfaceAlt ?? 'transparent', color: t.ink, cursor: 'pointer', fontFamily: 'var(--placer-font)' }}>
          <Icon name="image" size={28} stroke={2} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>{status === 'uploading' ? 'Uploading…' : 'Add a picture'}</span>
          <span style={{ fontSize: 13, color: t.inkDim }}>A photo or plan of the place: JPEG, PNG or WebP</span>
        </button>
      )}
      {message && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#B3261E' }}>{message}</p>}
    </div>
  );
}

/** The picture, as a stage of the dashboard's setup. */
export function PinImageStep({ t, project = null, setup, onChange }) {
  return <PinImageField t={t} setup={setup} onChange={onChange} projectId={project?.id ?? null} />;
}

/** The picture on the configuration page's canvas, under the slide's title. */
export function PinImageCanvas({ t, setup, onChange, projectId = null }) {
  return <PinImageField t={t} setup={setup} onChange={onChange} projectId={projectId} large />;
}

/** All three on one screen, for a host that does not walk through `steps`. */
export function PinToImageSetup({ t, project = null, setup, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PinPromptStep t={t} setup={setup} onChange={onChange} />
      <PinImageStep t={t} project={project} setup={setup} onChange={onChange} />
      <PinTimerStep t={t} setup={setup} onChange={onChange} />
    </div>
  );
}

export default PinToImageSetup;
