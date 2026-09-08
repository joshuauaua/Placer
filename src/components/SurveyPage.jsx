/* PLACER — Survey Page
 *
 * The route is a shell: it picks the content and where the answers go, and the
 * shared survey in ./survey runs the flow. A second survey would be another
 * content file and another few lines here.
 */

import { SurveyForm } from './survey/SurveyForm';
import { resolveSurveyContent } from './survey/content';
import { saveSurveyResponse } from '../services/api';

export function SurveyPage({ t, content }) {
  return (
    <SurveyForm
      t={t}
      content={resolveSurveyContent(content)}
      submit={saveSurveyResponse}
      source="community_survey"
      idPrefix="community-survey"
    />
  );
}

export default SurveyPage;
