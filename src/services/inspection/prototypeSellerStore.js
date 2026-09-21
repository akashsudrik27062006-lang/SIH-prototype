const SELLER_AUDITS_KEY = 'labelguard-prototype-seller-audits';
const SELLER_COMPARISONS_KEY = 'labelguard-prototype-seller-comparisons';

const read = () => { try { const value = JSON.parse(localStorage.getItem(SELLER_AUDITS_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const write = (value) => localStorage.setItem(SELLER_AUDITS_KEY, JSON.stringify(value));
const clone = (value) => JSON.parse(JSON.stringify(value));

export const getSellerAudits = () => read();
export const getSellerComparisons = () => { try { const value = JSON.parse(localStorage.getItem(SELLER_COMPARISONS_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };

export function saveSellerAudit(audit) {
  const createdAt = new Date().toISOString();
  const id = `SELLER-AUDIT-${crypto.randomUUID?.() || Date.now().toString(36)}`;
  const saved = { ...clone(audit), id, sellerAuditId: id, createdAt, updatedAt: createdAt, date: new Date(createdAt).toLocaleDateString('en-IN') };
  write([saved, ...read()]);
  return saved;
}

export function saveSellerComparison(comparison) {
  const createdAt = new Date().toISOString();
  const id = `SELLER-COMPARISON-${crypto.randomUUID?.() || Date.now().toString(36)}`;
  const saved = { ...clone(comparison), id, comparisonId: id, createdAt, updatedAt: createdAt, date: new Date(createdAt).toLocaleDateString('en-IN') };
  localStorage.setItem(SELLER_COMPARISONS_KEY, JSON.stringify([saved, ...getSellerComparisons()]));
  return saved;
}
