/* PLACER — Popular Templates, on the Tools page: a card each, with its picture, its
 * title and, under that, the kind of tool it is, in its category's colour. Choosing
 * one calls `onOpen` with the tool's id. The register is toolkit/templates.js. */

import { Icon } from './Icon';
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
        <span className="placer-template-image">
          <img {...bundledImage(template.image.small, template.image.large, CARD_SIZES)}
            alt={template.image.alt} loading="lazy" />
        </span>
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
    <section aria-labelledby="popular-templates-title" style={{ marginBottom: 32 }}>
      <h2 id="popular-templates-title" className="placer-caption" style={{ textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 700, color: t.inkDim, marginBottom: 12 }}>
        Popular Templates
      </h2>
      <ul className="placer-template-grid">
        {TEMPLATES.map((template) => <TemplateCard key={template.id} template={template} onOpen={onOpen} />)}
      </ul>
    </section>
  );
}

export default PopularTemplates;
