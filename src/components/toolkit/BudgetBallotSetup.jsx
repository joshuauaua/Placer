/* PLACER — Toolkit: setting up a Co-Budget room.
 *
 * What the organiser writes before the room opens: how much money there is, and the
 * posts it can be spent on — each with a name, an icon and what one item of it costs.
 * Asked for in stages (the registry entry's `setup.steps`, walked through by
 * SetupSteps): the budget, then the posts. These only edit the setup.
 */

import { useId, useState } from 'react';
import { Icon } from '../Icon';
import { Btn } from '../UI';
import {
  BUDGET, MAX_POSTS, MAX_POST_LABEL, MIN_POSTS, POST_ICONS, formatEuros, newPost,
} from '../../lib/budgetBallot';

const fieldStyle = (t) => ({
  height: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${t.lineStrong}`,
  background: t.surface, color: t.ink, fontFamily: 'var(--placer-font)', fontSize: 15,
});

// A number field's text as a whole number, or NaN while it is empty or not one, so the
// stage's problems can say so rather than the field quietly holding zero.
const wholeNumber = (text) => (text === '' ? NaN : Number(text));

/** The first stage: the budget. */
export function BudgetStep({ t, setup, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 280 }}>
      <label htmlFor={`${id}-budget`} style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>
        Total budget, in euros
      </label>
      <input
        id={`${id}-budget`}
        aria-describedby={`${id}-budget-hint`}
        type="number"
        inputMode="numeric"
        min={1}
        step={1000}
        value={Number.isFinite(setup.budget) ? setup.budget : ''}
        onChange={(event) => onChange({ ...setup, budget: wholeNumber(event.target.value) })}
        style={fieldStyle(t)} />
      <span id={`${id}-budget-hint`} style={{ fontSize: 12.5, color: t.inkDim }}>
        Everybody spends this much across the posts you list next. The Toolkit's own street
        has {formatEuros(BUDGET)}.
      </span>
    </div>
  );
}

/** One post's icon, and the icons to change it to once it is pressed. */
function IconPicker({ t, tool, value, label, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <Btn t={t} type="button" variant="outline" size="sm" icon={value} ariaLabel={`Icon for ${label}`}
        ariaPressed={open} onClick={() => setOpen(!open)}
        style={{ width: 44, height: 44, padding: 0, color: tool.color }} />
      {open && (
        <div role="group" aria-label={`Icons for ${label}`}
          style={{ position: 'absolute', zIndex: 2, top: 50, left: 0, width: 232, padding: 8, borderRadius: 12,
            background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.line}`,
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {POST_ICONS.map((name) => (
            <button key={name} type="button" aria-label={name} aria-pressed={name === value}
              onClick={() => { onChange(name); setOpen(false); }}
              style={{ height: 40, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: name === value ? tool.color : t.ink,
                border: `1px solid ${name === value ? tool.color : 'transparent'}`,
                background: name === value ? tool.wash : 'transparent' }}>
              <Icon name={name} size={18} stroke={2} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The second stage: the posts, each with its icon, name and cost per item. */
export function PostsStep({ t, tool, setup, onChange }) {
  const posts = Array.isArray(setup.posts) ? setup.posts : [];
  const set = (index, change) => onChange({
    ...setup, posts: posts.map((post, i) => (i === index ? { ...post, ...change } : post)),
  });
  const remove = (index) => onChange({ ...setup, posts: posts.filter((_, i) => i !== index) });

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <legend style={{ fontSize: 14, fontWeight: 700, color: t.ink, padding: 0, marginBottom: 4 }}>
        What the budget can go on
      </legend>
      <p style={{ fontSize: 12.5, color: t.inkDim, margin: 0 }}>
        {Number.isFinite(setup.budget) ? `${formatEuros(setup.budget)} to spend. ` : ''}People choose how
        many of each post to buy, until the money runs out.
      </p>
      {posts.map((post, index) => {
        const name = post.label.trim() || `post ${index + 1}`;
        return (
          <div key={post.key} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <IconPicker t={t} tool={tool} value={post.icon} label={name}
              onChange={(icon) => set(index, { icon })} />
            <input aria-label={`Post ${index + 1} name`} type="text" maxLength={MAX_POST_LABEL}
              value={post.label} placeholder="Street trees"
              onChange={(event) => set(index, { label: event.target.value })}
              style={{ ...fieldStyle(t), flex: '1 1 160px', minWidth: 0 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.inkDim }}>
              €
              <input aria-label={`Post ${index + 1} cost per item, in euros`} type="number" inputMode="numeric"
                min={1} step={100} value={Number.isFinite(post.unitCost) ? post.unitCost : ''}
                onChange={(event) => set(index, { unitCost: wholeNumber(event.target.value) })}
                style={{ ...fieldStyle(t), width: 110 }} />
              per item
            </label>
            <Btn t={t} type="button" variant="outline" size="sm" icon="close" ariaLabel={`Remove post ${index + 1}`}
              disabled={posts.length <= MIN_POSTS} onClick={() => remove(index)}
              style={{ width: 40, padding: 0, flexShrink: 0 }} />
          </div>
        );
      })}
      {posts.length < MAX_POSTS && (
        <div>
          <Btn t={t} type="button" variant="outline" size="sm" icon="plus"
            onClick={() => onChange({ ...setup, posts: [...posts, newPost(posts)] })}>
            Add a post
          </Btn>
        </div>
      )}
    </fieldset>
  );
}

/** Both stages on one screen, for a host that does not walk through `steps`. */
export function BudgetBallotSetup(props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <BudgetStep {...props} />
      <PostsStep {...props} />
    </div>
  );
}

export default BudgetBallotSetup;
