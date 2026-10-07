/* PLACER — the cover page every toolkit tool opens on.
 *
 * The layout of the landingpage branch's User Labs page (PhotoSplit there): a
 * block of the tool's character tint fills the left half where User Labs has
 * its photo, and the copy sits centred on the right, ending in the one button
 * that starts the tool. On a phone they stack, colour first. Everything on it is
 * read from the registry entry, so the tile, the cover and the header above the
 * tool never disagree. The geometry lives in index.css (.placer-cover-*).
 */

import { Icon } from '../Icon';
import { Btn } from '../UI';
import { findCategory } from '../../toolkit/tools';

// `breadcrumb`, when given, replaces All tools: a tool opened for a project leads
// back to the project instead (ToolkitPage's projectTrail).
export function ToolCover({ t, tool, onStart, onBack, breadcrumb = null }) {
  return (
    <div className="placer-cover" style={{ background: t.page }}>
      <div className="placer-cover-color" style={{ background: tool.tint }}>
        <Icon name={tool.icon} size={120} stroke={1.5} style={{ color: t.ink }} />
      </div>

      <div className="placer-cover-copy">
        {breadcrumb ?? (
          <Btn t={t} variant="ghost" size="sm" icon="chevLeft" onClick={onBack}
            style={{ padding: '0 12px 0 6px', marginBottom: 24, color: t.inkDim }}>
            All tools
          </Btn>
        )}

        <div className="placer-caption" style={{ textTransform: 'uppercase', color: tool.color,
          fontWeight: 700, marginBottom: 12 }}>
          {findCategory(tool.category)?.name ?? 'Tool'}
        </div>
        <h1 style={{ color: t.ink }}>
          {tool.name}
        </h1>
        {tool.tagline && (
          <p className="placer-h3" style={{ marginTop: 16, color: t.ink }}>
            {tool.tagline}
          </p>
        )}
        <p className="placer-body-lg" style={{ marginTop: 16, color: t.inkDim }}>
          {tool.blurb}
        </p>
        {(tool.duration || tool.createdBy) && (
          <p className="placer-caption" style={{ marginTop: 16, color: t.inkFaint }}>
            {[tool.duration, tool.createdBy && `By ${tool.createdBy}`]
              .filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="placer-cover-action">
          <Btn t={t} size="lg" onClick={onStart}>Get started</Btn>
        </div>
      </div>
    </div>
  );
}

export default ToolCover;
