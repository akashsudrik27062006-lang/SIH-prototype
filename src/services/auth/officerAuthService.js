import { getSupabaseClient } from '../supabase/client.js';

async function officerFromUser(client, user) {
  if (!user) return null;
  const { data: profile, error } = await client.from('profiles').select('id, full_name, email, role, organization_id').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(`Officer profile could not be loaded: ${error.message}`);
  if (!profile || profile.role !== 'officer') throw new Error('This authenticated account is not authorized for the officer workflow.');
  return { user, profile };
}

export async function signInOfficerWithPassword(email, password) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  try {
    return await officerFromUser(client, data.user);
  } catch (profileError) {
    await client.auth.signOut();
    throw profileError;
  }
}

export async function getAuthenticatedOfficer() {
  const client = getSupabaseClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return officerFromUser(client, user);
}

export function onOfficerAuthStateChange(callback) {
  const client = getSupabaseClient();
  return client.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      callback(null, null);
      return;
    }
    officerFromUser(client, session.user).then((officer) => callback(officer, null)).catch((error) => callback(null, error));
  });
}

export async function signOutOfficer() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(`Sign-out failed: ${error.message}`);
}
