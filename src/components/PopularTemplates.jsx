/* PLACER — Popular Templates, on the Tools page: a card each, with its picture (or its
 * tool's icon on its category colour standing in for one), its
 * title and, under that, the kind of tool it is, in its category's colour. Choosing
 * one calls `onOpen` with the tool's id. The register is toolkit/templates.js. */

import { Icon } from './Icon';
import { WorkInProgressLabel } from './toolkit/WorkInProgressLabel';
import { CardRow } from './CardRow';
import { bundledImage } from '../lib/responsiveImage';
import { ARROW_ITEM } from '../lib/arrowKeys';
import { TEMPLATES } from '../toolkit/templates';
import { findCategory, findTool } from '../toolkit/tools';

const CARD_SIZES = '(max-width: 640px) 100vw, 300px';

function TemplateCard({ template, onOpen }) {
  const tool = findTool(template.tool);
  const colour = findCategory(tool.category)?.colour;
  return (
    <li>
      <button type="button" {...ARROW_ITEM} onClick={() => onOpen(tool.id)} className="placer-template-card"
        aria-label={`${template.title}, ${tool.name}`}>
        {template.image ? (
          <span className="placer-template-image" style={{ position: 'relative' }}>
            <WorkInProgressLabel tool={tool} />
            <img {...bundledImage(template.image.small, template.image.large, CARD_SIZES)}
              alt={template.image.alt} loading="lazy" />
          </span>
        ) : (
          // A placeholder until the template has a picture: its tool's icon on its
          // category's colour, as My Tools draws a started tool.
          <span className="placer-template-image placer-started-cover"
            style={{ position: 'relative', background: colour?.c100, color: colour?.c700 }}>
            <WorkInProgressLabel tool={tool} />
            <Icon name={tool.icon} size={40} stroke={1.8} />
          </span>
        )}
        <span className="placer-template-text">
          <span className="placer-template-title">{template.title}</span>
          <span className="placer-template-tool" style={{ color: colour?.c700 }}>
            <Icon name={tool.icon} size={15} stroke={2.2} />
            {tool.name}
          </span>
        </span>
      </button>
    </li>
  );
}

export function PopularTemplates({ t, onOpen }) {
  if (TEMPLATES.length === 0) return null;
  return (
    <CardRow t={t} id="popular-templates" title="Popular Templates">
      {TEMPLATES.map((template) => <TemplateCard key={template.id} template={template} onOpen={onOpen} />)}
    </CardRow>
  );
}

export default PopularTemplates;
