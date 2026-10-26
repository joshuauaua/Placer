import { SiteMapping } from '../../components/toolkit/SiteMapping';
import { SiteMappingOnPage } from '../../components/toolkit/SiteMappingOnPage';
import { SiteLocationStep, SiteMappingSetup, SiteNameStep } from '../../components/toolkit/SiteMappingSetup';
import { PALETTE } from '../../theme';
import {
  combineSiteAnswers, defaultSiteSetup, emptyRecorded, siteLocationProblems, siteNameProblems, siteSetupProblems,
} from '../../lib/toolkit/siteMapping';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, counted, roomText, tone } from '../toolParts';

export default {
  id: 'site-spatial-mapping',
  added: '2026-09-17',
  category: 'understand',
  name: 'Site-Specific Spatial Mapping Tool',
  tagline: 'Pin a site on the map, answer eighteen cards, stay in touch.',
  blurb: 'Pick a specific site on a map. Work through the eighteen-question survey. Then reflect.',
  ...tone(PALETTE.blue),
  icon: 'pin',
  createdBy: 'Gehl Institute',
  credit: PUBLIC_LIFE_PROTOCOL_CREDIT,
  component: SiteMapping,
  setup: {
    defaults: defaultSiteSetup,
    problems: siteSetupProblems,
    Form: SiteMappingSetup,
    steps: [
      { title: 'Site name', Form: SiteNameStep, problems: siteNameProblems },
      { title: 'Specific location', Form: SiteLocationStep, problems: siteLocationProblems },
    ],
  },
  inquiry: {
    summary: (config) => {
      const answered = Object.values(config?.answers ?? {}).filter((value) => value !== null).length;
      const markers = config?.markers?.length ?? 0;
      return [
        answered > 0 && `${answered} of 18 answered`,
        markers > 0 && counted(markers, 'marker', 'markers'),
      ].filter(Boolean).join(' · ');
    },
  },
  onProjectPage: {
    heading: 'Map the site with us',
    // The heading goes on the site's map, which opens the tool in a dialog.
    cover: true,
    Embed: SiteMappingOnPage,
  },
  room: {
    empty: emptyRecorded,
    combine: combineSiteAnswers,
    label: (config) => roomText(config?.name),
  },
};
