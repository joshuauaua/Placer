/* PLACER — Survey Page
 *
 * A shell: it picks the content and where the answers go, and the shared survey
 * in ./survey runs the flow. A second survey would be another content file and
 * another few lines here.
 *
 * Used as the /survey route and, with a height and an onClose, inside the
 * landing page's "Have your say" dialog (see HaveYourSay).
 */

import { SurveyForm } from './survey/SurveyForm';
import { resolveSurveyContent } from './survey/content';
import { saveSurveyResponse } from '../services/api';

export function SurveyPage({
  t,
  content,
  source = 'community_survey',
  idPrefix = 'community-survey',
  height,
  onClose,
}) {
  return (
    <SurveyForm
      t={t}
      content={resolveSurveyContent(content)}
      submit={saveSurveyResponse}
      source={source}
      idPrefix={idPrefix}
      height={height}
      onClose={onClose}
    />
  );
}

export default SurveyPage;
