/* PLACER — details shared by the legal page (terms, privacy, GDPR) */

// TODO: replace with the real operating entity before publishing this page.
export const OPERATOR = {
  name: 'Föreningen Stapelbädden (STPLN) and Ankara Aks',
  address: '[Registered address, country]',
  email: 'info@plcr.org',
};

// TODO: replace with the jurisdiction whose law should govern the Terms of Service.
export const GOVERNING_LAW = '[Governing law / jurisdiction]';

// Shown as "Last updated" at the top of the legal page.
export const LAST_UPDATED = '27 September 2026';

// Where map and Street View imagery comes from.
export const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy';

// Who processes the usage analytics, once the visitor has consented to them.
export const POSTHOG_PRIVACY_URL = 'https://posthog.com/privacy';

// Where survey answers are stored, once a Supabase project is configured.
// NOTE: the transfers section of the GDPR page states the project is hosted in
// the EU. Confirm that matches your project's region before publishing — a
// US-hosted project needs the wording there changed.
export const SUPABASE_PRIVACY_URL = 'https://supabase.com/privacy';

// Directory of EU/EEA supervisory authorities, for complaints.
export const EDPB_AUTHORITIES_URL =
  'https://www.edpb.europa.eu/about-edpb/about-edpb/members_en';
