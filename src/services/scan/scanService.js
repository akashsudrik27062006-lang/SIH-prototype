import { getSupabaseClient } from '../supabase/client';

export async function analyzePackageImage(file) {
  const client = getSupabaseClient();
  const formData = new FormData();
  formData.append('image', file, file.name);
  const { data, error } = await client.functions.invoke('analyze-package', { body: formData });
  if (error) {
    const payload = await error.context?.json?.().catch(() => null);
    const stage = payload?.error?.stage ? `[${payload.error.stage}] ` : '';
    throw new Error(`${stage}${payload?.error?.message || error.message || 'Package analysis request failed.'}`);
  }
  if (!data?.declarations) throw new Error('The Gemini analysis service returned an incomplete response.');
  return data;
}
