/* PLACER — Toolkit tools to choose from, in a section per category.
 *
 * What a project's tools are chosen from: the "Add tools" step of starting a project
 * (ProjectSetupPage) and the dashboard's Add a tool dialog. Understand, Imagine and
 * Plan in that order (CATEGORIES), each a list of its tools as rows with the icon in
 * the category's colours, as the Toolkit's list view draws them. A category with
 * nothing in `tools` is left out.
 *
 * Given `chosen`, each row is a toggle (aria-pressed) with a tick for the chosen;
 * without it, a row is a button that hands its tool to `onPick` once. The arrow keys
 * move between the rows, across the categories (lib/arrowKeys.js).
 */
import { Icon } from '../Icon';
import { CATEGORIES } from '../../toolkit/tools';
import { ARROW_ITEM, moveWithArrows } from '../../lib/arrowKeys';

function ToolRow({ t, tool, colour, chosen, onClick }) {
  const toggle = chosen !== undefined;
  return (
    <button type="button" aria-pressed={toggle ? chosen : undefined} onClick={onClick} {...ARROW_ITEM}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
        textAlign: 'left', cursor: 'pointer', borderRadius: 10, fontFamily: 'var(--placer-font)', color: t.ink,
        background: chosen ? colour.c50 : 'transparent',
        border: `1.5px solid ${chosen ? colour.c700 : 'transparent'}` }}
      onMouseEnter={(e) => { if (!chosen) e.currentTarget.style.background = t.surfaceAlt; }}
      onMouseLeave={(e) => { if (!chosen) e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, flex: '0 0 auto', background: colour.c100,
        color: colour.c700, boxShadow: `inset 0 0 0 1px ${colour.c700}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center' }}>
        <Icon name={tool.icon} size={18} stroke={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{tool.name}</span>
        {tool.tagline && <span style={{ display: 'block', fontSize: 12.5, color: t.inkDim }}>{tool.tagline}</span>}
      </span>
      {toggle && (
        <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 11, flex: '0 0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: chosen ? colour.c700 : 'transparent',
          border: `1.5px solid ${chosen ? colour.c700 : t.lineStrong}`, color: '#fff' }}>
          {chosen && <Icon name="check" size={14} stroke={2.6} />}
        </span>
      )}
    </button>
  );
}

export function ToolsByCategory({ t, tools, chosen, onPick, label = 'Toolkit tools', idPrefix = 'tools' }) {
  const sections = CATEGORIES
    .map((category) => ({ category, tools: tools.filter((tool) => tool.category === category.id) }))
    .filter((section) => section.tools.length > 0);

  return (
    <div role="group" aria-label={label} onKeyDown={moveWithArrows}
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {sections.map(({ category, tools: inCategory }) => {
        const headingId = `${idPrefix}-${category.id}`;
        return (
          <section key={category.id} aria-labelledby={headingId}>
            <h3 id={headingId} className="placer-mono"
              style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: category.colour.c700, margin: '0 0 2px', padding: '0 12px' }}>
              {category.name}
            </h3>
            <p style={{ fontSize: 12.5, color: t.inkDim, margin: '0 0 6px', padding: '0 12px' }}>{category.description}</p>
            <ul aria-labelledby={headingId} style={{ listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: 2 }}>
              {inCategory.map((tool) => (
                <li key={tool.id}>
                  <ToolRow t={t} tool={tool} colour={category.colour}
                    chosen={chosen ? chosen.includes(tool.id) : undefined}
                    onClick={() => onPick(tool.id)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
