/* PLACER — Practitioners Survey Page
 *
 * The practitioner-facing survey at /practitioners-survey: how NGOs, studios,
 * consultancies and collectives run participatory design today, and which
 * feature would help them most. Same shell as the community survey — a content
 * file and the few lines below — with a lead-capture final step, which the
 * `contact` block in that content turns on.
 */

import { SurveyForm } from './survey/SurveyForm';
import { resolveSurveyContent } from './survey/content';
import practitionersContent from './survey/content/practitioners.json';
import { saveSurveyResponse } from '../services/api';

export function PractitionersSurveyPage({ t, content }) {
  return (
    <SurveyForm
      t={t}
      // `??`, not `||`: resolveSurveyContent falls back to the *community*
      // survey when given nothing, which is not the survey this route is.
      content={resolveSurveyContent(content ?? practitionersContent)}
      submit={saveSurveyResponse}
      source="practitioners_survey"
      idPrefix="practitioners-survey"
    />
  );
}

export default PractitionersSurveyPage;
