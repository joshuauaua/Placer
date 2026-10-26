/* PLACER — the cover page every toolkit tool opens on.
 *
 * The layout of the landingpage branch's User Labs page (PhotoSplit there): a
 * block of the tool's colour tint fills the left half where User Labs has
 * its photo, and the copy sits centred on the right, ending in the one button
 * that starts the tool, with the language picker beside it. Who made the tool sits
 * right under its name. The way back (All tools,
 * or the project's breadcrumb) sits on the colour block, top left. On a phone they
 * stack, colour first. Everything on it is
 * read from the registry entry, so the tile, the cover and the header above the
 * tool never disagree. The geometry lives in index.css (.placer-cover-*).
 */

import { Icon } from '../Icon';
import { Btn } from '../UI';
import { findCategory } from '../../toolkit/tools';
import { toolText, useText } from '../../i18n';
import { LanguagePicker } from '../LanguagePicker';

// `breadcrumb`, when given, replaces All tools: a tool opened for a project leads
// back to the project instead (ToolkitPage's projectTrail).
export function ToolCover({ t, tool, onStart, onBack, breadcrumb = null }) {
  const { text, language } = useText();
  const category = findCategory(tool.category);
  const tagline = toolText(tool, 'tagline', language);
  return (
    <div className="placer-cover" style={{ background: t.page }}>
      <div className="placer-cover-color" style={{ background: tool.tint }}>
        <div className="placer-cover-back">
          {breadcrumb ?? (
            <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onBack}
              style={{ padding: '0 12px 0 6px', color: t.ink }}>
              {text('tool.allTools')}
            </Btn>
          )}
        </div>
        <Icon name={tool.icon} size={120} stroke={1.5} style={{ color: t.ink }} />
      </div>

      <div className="placer-cover-copy">

        <div className="placer-caption" style={{ textTransform: 'uppercase', color: tool.color,
          fontWeight: 700, marginBottom: 12 }}>
          {category ? text(`tool.categories.${category.id}`) : text('tool.tool')}
        </div>
        <h1 style={{ color: t.ink }}>
          {toolText(tool, 'name', language)}
        </h1>
        {tool.createdBy && (
          <p className="placer-caption" style={{ marginTop: 8, color: t.inkDim }}>
            {text('tool.by', { name: tool.createdBy })}
          </p>
        )}
        {tagline && tool.taglineOnCover !== false && (
          <p className="placer-h3" style={{ marginTop: 16, color: t.ink }}>
            {tagline}
          </p>
        )}
        <p className="placer-body-lg" style={{ marginTop: 16, color: t.inkDim }}>
          {toolText(tool, 'blurb', language)}
        </p>
        {tool.duration && (
          <p className="placer-caption" style={{ marginTop: 16, color: t.inkFaint }}>
            {toolText(tool, 'duration', language)}
          </p>
        )}
        {tool.credit && (
          <p className="placer-caption" style={{ marginTop: 8, color: t.inkFaint }}>
            {tool.credit}
          </p>
        )}

        <div className="placer-cover-action">
          <Btn t={t} size="lg" onClick={onStart}>{text('tool.getStarted')}</Btn>
          <LanguagePicker t={t} />
        </div>
      </div>
    </div>
  );
}

export default ToolCover;
