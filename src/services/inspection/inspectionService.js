import { getSupabaseClient } from '../supabase/client.js';

const databaseStatus = (finding) => finding.status === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'POTENTIAL';
const decisionStatus = (decision) => ({ VERIFIED: 'VERIFIED', REJECTED: 'REJECTED', MODIFIED: 'MODIFIED' }[decision]);

async function currentOfficer(client) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error('Sign in with an authenticated officer account before saving an inspection.');
  const { data: profile, error: profileError } = await client.from('profiles').select('id, organization_id, role').eq('user_id', user.id).single();
  if (profileError || profile?.role !== 'officer') throw new Error('The signed-in Supabase user is not an authorized officer profile.');
  return { user, profile };
}

const declarationFields = (result) => result.analysis?.declarations || result.declarations || {};

export async function persistInspection(result) {
  const client = getSupabaseClient();
  const { user, profile } = await currentOfficer(client);
  const details = result.inspectionDetails || {};
  const declarations = declarationFields(result);
  const { data: inspection, error: inspectionError } = await client.from('inspections').insert({
    officer_user_id: user.id, officer_profile_id: profile.id,
    product_name: details.productName || result.product?.name || null,
    brand_name: details.brandName || null,
    responsible_party: details.responsibleParty || result.product?.manufacturer || null,
    batch_number: details.batchNumber || null, inspection_location: details.location || result.product?.location || null,
    inspection_type: details.inspectionType || null, officer_remarks: details.remarks || null,
    inspected_at: new Date().toISOString(), scan_status: 'COMPLETED',
    preliminary_compliance_score: result.preliminaryComplianceScore ?? result.score ?? null,
    score_label: result.scoreLabel || 'Preliminary Compliance Score', overall_status: result.status || 'WARNING',
  }).select().single();
  if (inspectionError) throw new Error(`Inspection could not be saved: ${inspectionError.message}`);

  const { data: product, error: productError } = await client.from('products').insert({
    organization_id: profile.organization_id, name: result.product?.name || 'Unidentified packaged commodity',
    brand: details.brandName || null, manufacturer: result.product?.manufacturer || null,
    batch_number: details.batchNumber || null, created_by: profile.id,
  }).select().single();
  if (productError) throw new Error(`Inspection was created, but scan product metadata could not be saved: ${productError.message}`);

  const { error: scanError } = await client.from('scans').insert({
    inspection_id: inspection.id, product_id: product.id, user_id: user.id, scan_type: 'PACKAGE_IMAGE', status: 'COMPLETED',
    score: result.preliminaryComplianceScore ?? result.score ?? null, started_at: new Date().toISOString(), completed_at: new Date().toISOString(), scanned_at: new Date().toISOString(),
    extracted_declarations: declarations, evidence_source: result.analysis?.evidenceSource || 'uploaded_package_image', provider: 'Google Gemini', model: 'gemini-3.1-flash-lite',
  });
  if (scanError) throw new Error(`Inspection was created, but AI scan data could not be saved: ${scanError.message}`);

  const rows = (result.violations || []).map((finding) => ({
    inspection_id: inspection.id, rule_code: finding.rule_code || finding.ruleCode || 'UNSPECIFIED', rule_number: finding.rule_number || finding.section || 'Unspecified',
    rule_name: finding.rule_name || finding.requirement || 'Unspecified finding', requirement: finding.requirement || '',
    detected_value: finding.detected_value ?? finding.detectedValue ?? null, expected_value: finding.expected_value ?? finding.expectedValue ?? null,
    evidence: finding.evidence || [], confidence: finding.confidence ?? null, severity: finding.severity || null,
    status: databaseStatus(finding), recommendation: finding.recommendation || null, source_url: finding.source_url || finding.ruleRef?.url || null,
  }));
  if (rows.length) {
    const { error: findingError } = await client.from('inspection_findings').insert(rows);
    if (findingError) throw new Error(`Inspection was created, but findings could not be saved: ${findingError.message}`);
  }

  for (const image of result.pendingImages || []) {
    if (!image?.file) continue;
    const filename = image.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${inspection.id}/${Date.now()}-${filename}`;
    const { error: uploadError } = await client.storage.from('evidence-images').upload(storagePath, image.file, { upsert: false, contentType: image.file.type });
    if (uploadError) throw new Error(`Inspection was created, but image upload failed: ${uploadError.message}`);
    const { error: imageError } = await client.from('inspection_images').insert({ inspection_id: inspection.id, image_type: image.type || 'package_image', storage_path: storagePath, original_filename: image.file.name, uploaded_by: user.id });
    if (imageError) throw new Error(`Inspection was created, but image metadata could not be saved: ${imageError.message}`);
  }
  return { ...inspection, persisted: true };
}

export async function updatePersistedFinding(findingId, decision, editedValue, officerObservation) {
  const client = getSupabaseClient();
  await currentOfficer(client);
  const payload = { status: decisionStatus(decision), officer_observation: officerObservation || null };
  if (decision === 'MODIFIED') payload.detected_value = editedValue;
  const { data, error } = await client.from('inspection_findings').update(payload).eq('id', findingId).select().single();
  if (error) throw new Error(`Finding decision could not be saved: ${error.message}`);
  return data;
}

export async function listPersistedInspections() {
  const client = getSupabaseClient();
  await currentOfficer(client);
  const { data, error } = await client.from('inspections').select('id, inspection_number, product_name, responsible_party, inspection_location, inspected_at, preliminary_compliance_score, overall_status, inspection_findings(count)').order('inspected_at', { ascending: false });
  if (error) throw new Error(`Inspection history could not be loaded: ${error.message}`);
  return data || [];
}

export async function loadPersistedInspection(inspectionId) {
  const client = getSupabaseClient();
  await currentOfficer(client);
  const { data, error } = await client.from('inspections').select('*, scans(*), inspection_findings(*), inspection_images(*)').eq('id', inspectionId).single();
  if (error) throw new Error(`Inspection could not be opened: ${error.message}`);
  const declarations = data.scans?.[0]?.extracted_declarations || {};
  const fields = Object.fromEntries(Object.entries(declarations).map(([key, declaration]) => [key, declaration?.value || 'Not detected']));
  return {
    id: data.inspection_number, persistedInspectionId: data.id, date: new Date(data.inspected_at).toLocaleDateString('en-IN'), status: data.overall_status,
    score: Number(data.preliminary_compliance_score ?? 0), preliminaryComplianceScore: Number(data.preliminary_compliance_score ?? 0), scoreLabel: data.score_label,
    inspectionDetails: { inspectionType: data.inspection_type, productName: data.product_name, brandName: data.brand_name, responsibleParty: data.responsible_party, batchNumber: data.batch_number, location: data.inspection_location, remarks: data.officer_remarks },
    product: { name: data.product_name || declarations.productName?.value || 'Unidentified packaged commodity', manufacturer: data.responsible_party || declarations.manufacturerPackerImporter?.value || 'Not detected', category: 'Package image analysis', image: '📦', location: data.inspection_location, fields, confidence: Object.fromEntries(Object.entries(declarations).map(([key, item]) => [key, item?.confidence ?? 0])) },
    violations: (data.inspection_findings || []).map((finding) => ({ ...finding, detectedValue: finding.detected_value, expectedValue: finding.expected_value, ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)', section: finding.rule_number, url: finding.source_url }, officerDecision: finding.status === 'POTENTIAL' || finding.status === 'REVIEW_REQUIRED' ? null : finding.status })),
    imageReferences: data.inspection_images || [], analysis: { declarations, evidenceSource: data.scans?.[0]?.evidence_source },
  };
}
