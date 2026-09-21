const INSPECTIONS_KEY = 'labelguard-prototype-inspections';
const COMPLAINTS_KEY = 'labelguard-prototype-complaints';

function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function getPrototypeInspections() {
  return read(INSPECTIONS_KEY);
}

export function savePrototypeInspection(result) {
  const id = `INSP-${Date.now().toString(36).toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const findings = (result.violations || []).map((finding, index) => ({
    ...finding,
    id: `${id}-F${index + 1}`,
    officerDecision: finding.officerDecision || null,
  }));
  const record = {
    ...result,
    id,
    prototypeInspectionId: id,
    date: new Date(createdAt).toLocaleDateString('en-IN'),
    createdAt,
    violations: findings,
    imageReferences: (result.pendingImages || []).map(({ type, file }) => ({
      type,
      filename: file?.name || 'package-image',
      contentType: file?.type || null,
    })),
    pendingImages: undefined,
  };
  const records = [record, ...getPrototypeInspections()];
  write(INSPECTIONS_KEY, records);
  return record;
}

export function updatePrototypeInspection(id, update) {
  const records = getPrototypeInspections().map((record) => record.prototypeInspectionId === id ? { ...record, ...update } : record);
  write(INSPECTIONS_KEY, records);
  return records.find((record) => record.prototypeInspectionId === id) || null;
}

export function getPrototypeComplaints() {
  return read(COMPLAINTS_KEY);
}

export function savePrototypeComplaint(complaint) {
  const record = { ...complaint, id: complaint.id || `CMP-${Date.now().toString(36).toUpperCase()}` };
  write(COMPLAINTS_KEY, [record, ...getPrototypeComplaints()]);
  return record;
}
