/* PLACER — organisations.
 *
 * A profile page for a group rather than one account, run by one or more admins —
 * see supabase/organisations.sql for the rules, all of which the database enforces.
 * Like services/projects.js, it needs an account and a Supabase project: every
 * function throws with no project configured, and the UI asks isSupabaseConfigured()
 * before it offers any of it.
 *
 * camelCase in, camelCase out; the table's own column names stay in this file.
 */

import { getSupabase, isSupabaseConfigured } from './supabase';
import { normaliseWebsite } from './auth';

export const ORGANISATIONS_TABLE = 'organisations';
export const ADMINS_TABLE = 'organisation_admins';

export { isSupabaseConfigured };

async function client() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      'Organisations need a Supabase project: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

const ORGANISATION_COLUMNS = 'id, name, contact_email, website, location, description, '
  + 'created_by, unadministered_since, created_at';

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    contactEmail: row.contact_email ?? '',
    website: row.website ?? '',
    location: row.location ?? '',
    description: row.description ?? '',
    createdBy: row.created_by ?? null,
    // Set once its last admin's account is gone, until a former admin claims it.
    unadministeredSince: row.unadministered_since ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toRow(patch) {
  const columns = {
    name: 'name', contactEmail: 'contact_email', website: 'website',
    location: 'location', description: 'description',
  };
  const row = {};
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] === undefined) continue;
    row[column] = key === 'website' ? normaliseWebsite(patch[key]) : (patch[key] ?? '').trim();
  }
  return row;
}

/**
 * Create an organisation. `createdBy` is checked against auth.uid() by the insert
 * policy, and the database makes that account its first admin in the same statement.
 */
export async function createOrganisation({ createdBy, ...fields }) {
  if (!createdBy) throw new Error('Creating an organisation needs an account.');

  const supabase = await client();
  const { data, error } = await supabase
    .from(ORGANISATIONS_TABLE)
    .insert({ created_by: createdBy, ...toRow(fields) })
    .select(ORGANISATION_COLUMNS)
    .single();

  if (error) throw new Error(`Could not create that organisation: ${error.message}`);
  return fromRow(data);
}

/** One organisation by id, or null. Public — no account needed to read it. */
export async function readOrganisation(id) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(ORGANISATIONS_TABLE)
    .select(ORGANISATION_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Could not load that organisation: ${error.message}`);
  return data ? fromRow(data) : null;
}

/**
 * Every organisation this account is an admin of, by name. Two queries, the same
 * reason readMyProjects gives: the roster's read policy only tells an account about
 * its own rows.
 */
export async function readMyOrganisations(accountId) {
  if (!accountId) return [];

  const supabase = await client();
  const { data: memberships, error } = await supabase
    .from(ADMINS_TABLE)
    .select('organisation_id')
    .eq('user_id', accountId);

  if (error) throw new Error(`Could not load your organisations: ${error.message}`);

  const ids = (memberships ?? []).map((row) => row.organisation_id);
  if (ids.length === 0) return [];

  const { data, error: orgError } = await supabase
    .from(ORGANISATIONS_TABLE)
    .select(ORGANISATION_COLUMNS)
    .in('id', ids)
    .order('name', { ascending: true });

  if (orgError) throw new Error(`Could not load your organisations: ${orgError.message}`);
  return (data ?? []).map(fromRow);
}

/** Change an organisation's details. Admins only; only the fields given are touched. */
export async function updateOrganisation(id, patch) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(ORGANISATIONS_TABLE)
    .update(toRow(patch))
    .eq('id', id)
    .select(ORGANISATION_COLUMNS)
    .single();

  if (error) throw new Error(`Could not save that organisation: ${error.message}`);
  return fromRow(data);
}

/**
 * Close an organisation: delete it. Admins only. Its projects stay, credited to
 * whoever started each one.
 */
export async function closeOrganisation(id) {
  const supabase = await client();
  const { error } = await supabase.from(ORGANISATIONS_TABLE).delete().eq('id', id);
  if (error) throw new Error(`Could not close that organisation: ${error.message}`);
  return { success: true };
}

/** The organisation's admins, oldest first. Admins only. */
export async function readAdmins(organisationId) {
  const supabase = await client();
  const { data, error } = await supabase
    .from(ADMINS_TABLE)
    .select('user_id, email, display_name, created_at')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Could not load the organisation's admins: ${error.message}`);
  return (data ?? []).map((row) => ({
    userId: row.user_id, email: row.email ?? '', displayName: row.display_name, createdAt: row.created_at,
  }));
}

/** Make another account an admin, by the email it signs in with. Admins only. */
export async function addAdmin(organisationId, email) {
  const supabase = await client();
  const { error } = await supabase.rpc('organisation_add_admin', {
    p_organisation_id: organisationId, p_email: email,
  });
  if (error) throw new Error(`Could not add that admin: ${error.message}`);
  return { success: true };
}

/**
 * Remove an admin — or, with your own id, leave. Refused for the last admin: an
 * organisation always keeps at least one.
 */
export async function removeAdmin(organisationId, userId) {
  const supabase = await client();
  const { error } = await supabase.rpc('organisation_remove_admin', {
    p_organisation_id: organisationId, p_user_id: userId,
  });
  if (error) throw new Error(`Could not remove that admin: ${error.message}`);
  return { success: true };
}

/** Whether this account may claim an organisation that has no admin. */
export async function canClaimOrganisation(organisationId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc('organisation_can_claim', { p_organisation_id: organisationId });
  if (error) throw new Error(`Could not check that organisation: ${error.message}`);
  return data === true;
}

/** Become the admin of an organisation that has none. Former admins only. */
export async function claimOrganisation(organisationId) {
  const supabase = await client();
  const { error } = await supabase.rpc('organisation_claim', { p_organisation_id: organisationId });
  if (error) throw new Error(`Could not claim that organisation: ${error.message}`);
  return { success: true };
}
