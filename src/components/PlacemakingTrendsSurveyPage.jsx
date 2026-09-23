/* PLACER — Placemaking Trends Survey Page
 *
 * The route is a shell: it picks the content and where the answers go, and the
 * shared survey in ./placemakingSurvey runs the flow — the same shape
 * SurveyPage.jsx uses for the shorter survey at /survey.
 *
 * A separate engine rather than a second content file for ./survey: that one is
 * built around three sections, one choice-question type and an unconditional
 * email step (see src/components/survey/content.js). This is the longer,
 * five-module municipal-practitioner survey, ported from the Development branch,
 * which needs a `scale` question type, opt-ins and a contact step the schema
 * there has no room for. See ./placemakingSurvey/content.js for the reasoning.
 */

import { SurveyForm } from './placemakingSurvey/SurveyForm';
import { resolveSurveyContent } from './placemakingSurvey/content';
import { saveSurveyResponse } from '../services/api';

export function PlacemakingTrendsSurveyPage({ t, content }) {
  return (
    <SurveyForm
      t={t}
      content={resolveSurveyContent(content)}
      submit={saveSurveyResponse}
      source="placemaking_trends_survey"
      idPrefix="placemaking-trends-survey"
    />
  );
}

export default PlacemakingTrendsSurveyPage;
