/* PLACER — Waitlist Survey Page
 *
 * A shell: it picks the content and where the answers go, and the short survey
 * in ./waitlistSurvey runs the flow. Rendered only inside the landing page's Join
 * the Waitlist dialog (see HaveYourSay), with a height and an onClose.
 *
 * Its own engine rather than a content file for ./survey: that one is the longer,
 * five-module municipal survey at /survey, and the two content shapes do not
 * overlap enough to share a schema. This one is ported from the landingpage
 * branch, where it is that branch's /survey.
 */

import { SurveyForm } from './waitlistSurvey/SurveyForm';
import { resolveSurveyContent } from './waitlistSurvey/content';
import { saveSurveyResponse } from '../services/api';

export function WaitlistSurveyPage({
  t,
  content,
  source = 'landing_survey',
  idPrefix = 'landing-survey',
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

export default WaitlistSurveyPage;
