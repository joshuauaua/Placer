import { SocialSpaceSurvey } from '../../components/toolkit/SocialSpaceSurvey';
import { PALETTE } from '../../theme';
import { PUBLIC_LIFE_PROTOCOL_CREDIT, tone } from '../toolParts';

export default {
  id: 'social-space-survey',
  added: '2026-09-17',
  category: 'understand',
  name: 'The Social Space Survey',
  tagline: 'Eighteen checks that read a space for strangers.',
  blurb: 'A field tool from the Gehl Institute: tick what invites and what blocks, map the spatial patterns that bring strangers together, and judge how well different people could share the place. Walk it in five minutes — take the data with you.',
  ...tone(PALETTE.purple),
  icon: 'bench',
  createdBy: 'Gehl Institute',
  credit: PUBLIC_LIFE_PROTOCOL_CREDIT,
  component: SocialSpaceSurvey,
};
