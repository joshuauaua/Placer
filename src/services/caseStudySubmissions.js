/* PLACER — case study submissions, from the Resources page's "Submit a case study" form.
 *
 * A customer or partner tells us about a project they ran with PLACER: the company,
 * its industry, the problem, the solution, the results, an optional testimonial, and
 * who to contact. With a Supabase project configured that is a row in
 * public.case_study_submissions (see supabase/case-study-submissions.sql), which the
 * browser can add to and never read back. With no project there is nowhere to send
 * one, so the caller offers an email instead — submitCaseStudyByEmailHref() builds that
 * link from the same fields.
 *
 * Somebody signed in may also attach a logo and a picture. Those go to R2 through the
 * media function first (services/media.js), under 'case-studies/<user id>/', and the
 * row keeps their keys.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { isMediaConfigured, preparePhoto, uploadPhoto } from './media';
import { isValidEmail } from './toolSubmissions';
import { OPERATOR } from '../legal';
import { track } from '../analytics';

export const CASE_STUDY_SUBMISSIONS_TABLE = 'case_study_submissions';

// Match the table's constraints, so the form can stop somebody before the database does.
export const MAX_COMPANY_LENGTH = 200;
export const MAX_INDUSTRY_LENGTH = 120;
export const MAX_STORY_LENGTH = 4000;
export const MAX_TESTIMONIAL_LENGTH = 2000;
export const MAX_NAME_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 320;

// The industry list offered in the form. 'Other' lets somebody type their own.
export const INDUSTRIES = [
  'Local government',
  'Urban planning & design',
  'Architecture & landscape',
  'Real estate & development',
  'Community organisation / non-profit',
  'Transport & mobility',
  'Education & research',
  'Culture & the arts',
  'Other',
];

export { isSupabaseConfigured, isValidEmail };

/** Whether attaching a logo or picture can work at all in this build. */
export function canAttachPictures() {
  return isSupabaseConfigured() && isMediaConfigured();
}

export const EMPTY_CASE_STUDY = {
  company: '', industry: '', otherIndustry: '', problem: '', solution: '', results: '',
  testimonial: '', contactName: '', contactEmail: '',
};

/** The fields as they are stored: trimmed, the industry resolved, an empty testimonial null. */
export function cleanCaseStudy(fields) {
  const text = (key) => String(fields?.[key] ?? '').trim();
  const industry = text('industry') === 'Other' ? text('otherIndustry') : text('industry');
  return {
    company: text('company'),
    industry,
    problem: text('problem'),
    solution: text('solution'),
    results: text('results'),
    testimonial: text('testimonial') || null,
    contact_name: text('contactName'),
    contact_email: text('contactEmail'),
  };
}

/**
 * Every field that would be refused, as { field: sentence }, or null if it is fine to
 * send. The keys are the form's own field names, so each message can sit under its field.
 */
export function validateCaseStudy(fields) {
  const row = cleanCaseStudy(fields);
  const problems = {};
  const need = (key, value, max, missing) => {
    if (!value) problems[key] = missing;
    else if (value.length > max) problems[key] = `Keep this under ${max} characters.`;
  };
  need('company', row.company, MAX_COMPANY_LENGTH, 'Enter the company or organisation name.');
  if (!String(fields?.industry ?? '').trim()) problems.industry = 'Choose an industry.';
  else need('otherIndustry', row.industry, MAX_INDUSTRY_LENGTH, 'Name the industry.');
  need('problem', row.problem, MAX_STORY_LENGTH, 'Describe the problem you faced.');
  need('solution', row.solution, MAX_STORY_LENGTH, 'Describe the solution.');
  need('results', row.results, MAX_STORY_LENGTH, 'Describe the results or impact.');
  if (row.testimonial && row.testimonial.length > MAX_TESTIMONIAL_LENGTH) {
    problems.testimonial = `Keep the quote under ${MAX_TESTIMONIAL_LENGTH} characters.`;
  }
  need('contactName', row.contact_name, MAX_NAME_LENGTH, 'Enter a contact name.');
  if (!isValidEmail(row.contact_email) || row.contact_email.length > MAX_EMAIL_LENGTH) {
    problems.contactEmail = 'Enter a valid email address, like name@example.org.';
  }
  return Object.keys(problems).length ? problems : null;
}

async function uploadPicture(supabase, userId, file, name, what) {
  const photo = await preparePhoto(file, 'submission', what);
  try {
    return await uploadPhoto(supabase, `case-studies/${userId}/${name}-${Date.now()}`, photo);
  } catch (error) {
    throw new Error(`Could not upload the ${what.toLowerCase().replace(/^an? /, '')}: ${error.message}`);
  }
}

/**
 * Send a submission, with an optional `logo` and `image` (File objects). Throws if it
 * is incomplete, there is no project, a picture is refused, or the insert is refused.
 */
export async function submitCaseStudy(fields, { logo = null, image = null } = {}) {
  const problems = validateCaseStudy(fields);
  if (problems) throw new Error(Object.values(problems)[0]);

  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Case study submissions need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const row = cleanCaseStudy(fields);
  if (logo || image) {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) throw new Error('Sign in to attach a logo or picture.');
    if (logo) row.logo_path = await uploadPicture(supabase, userId, logo, 'logo', 'A logo');
    if (image) row.image_path = await uploadPicture(supabase, userId, image, 'image', 'A picture');
  }

  // No .select(): the table has no read policy, so asking for the row back would fail.
  const { error } = await supabase.from(CASE_STUDY_SUBMISSIONS_TABLE).insert(row);
  if (error) throw new Error(error.message || 'The submission could not be sent.');
  track('case_study_submitted', { logo: Boolean(logo), image: Boolean(image) });
}

/** A mailto: link carrying the same submission, for a build with no Supabase project. */
export function submitCaseStudyByEmailHref(fields) {
  const row = cleanCaseStudy(fields);
  const body = [
    `Company: ${row.company}`,
    `Industry: ${row.industry}`,
    '', 'Problem faced:', row.problem,
    '', 'Solution provided:', row.solution,
    '', 'Results / impact:', row.results,
    ...(row.testimonial ? ['', 'Testimonial:', row.testimonial] : []),
    '', '---', `Contact: ${row.contact_name} <${row.contact_email}>`,
  ].join('\n');
  return `mailto:${OPERATOR.email}?subject=${encodeURIComponent(`PLACER case study: ${row.company}`)}`
    + `&body=${encodeURIComponent(body)}`;
}
