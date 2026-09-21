const PRODUCTS_KEY = 'labelguard-prototype-manufacturer-products';
const CHECKS_KEY = 'labelguard-prototype-manufacturer-checks';
import { deleteImage, saveImage } from './manufacturerImageStore';

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

export function getManufacturerProducts() {
  return read(PRODUCTS_KEY);
}

export function getManufacturerChecks() {
  return read(CHECKS_KEY);
}

// Keep artwork binaries outside localStorage, but remove them alongside the
// lightweight product/check records when a manufacturer deletes a product.
export async function deleteManufacturerProduct(productId) {
  const products = getManufacturerProducts();
  const checks = getManufacturerChecks();
  const product = products.find((item) => item.id === productId);
  if (!product) return { deleted: false, checkCount: 0, imageCount: 0 };

  const productChecks = checks.filter((item) => item.productId === productId);
  const imageIds = new Set();
  const collectImageIds = (references = []) => references.forEach((reference) => {
    if (reference?.imageId) imageIds.add(reference.imageId);
  });
  (product.artworks || []).forEach((artwork) => collectImageIds(artwork.imageReferences));
  productChecks.forEach((check) => collectImageIds(check.imageReferences));

  // IndexedDB deletion is idempotent: a legacy or already-missing image must
  // not prevent the product metadata and the rest of its artwork from clearing.
  await Promise.allSettled([...imageIds].map((imageId) => deleteImage(imageId)));
  write(PRODUCTS_KEY, products.filter((item) => item.id !== productId));
  write(CHECKS_KEY, checks.filter((item) => item.productId !== productId));

  return { deleted: true, checkCount: productChecks.length, imageCount: imageIds.size };
}

// Earlier prototype records retained data URLs. Move them out of localStorage
// without discarding their artwork, then retain only lightweight references.
export async function migrateLegacyManufacturerImages() {
  const references = new Map();
  const migrateReference = async (reference) => {
    const { dataUrl, ...metadata } = reference || {};
    if (!dataUrl) return metadata;
    if (!references.has(dataUrl)) references.set(dataUrl, (async () => {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      return saveImage(blob, { panel: metadata.type, filename: metadata.filename, contentType: metadata.contentType });
    })());
    const stored = await references.get(dataUrl);
    return { ...metadata, imageId: stored.id };
  };
  const checks = getManufacturerChecks();
  const products = getManufacturerProducts();
  if (![...checks, ...products].some((item) => JSON.stringify(item.imageReferences || item.artworks || []).includes('dataUrl'))) return false;
  const migratedChecks = await Promise.all(checks.map(async (check) => ({ ...check, imageReferences: await Promise.all((check.imageReferences || []).map(migrateReference)) })));
  const migratedProducts = await Promise.all(products.map(async (product) => ({ ...product, artworks: await Promise.all((product.artworks || []).map(async (artwork) => ({ ...artwork, imageReferences: await Promise.all((artwork.imageReferences || []).map(migrateReference)) }))) })));
  write(CHECKS_KEY, migratedChecks);
  write(PRODUCTS_KEY, migratedProducts);
  return true;
}

export function createManufacturerProduct(values) {
  const createdAt = new Date().toISOString();
  const product = {
    id: `MFG-PROD-${Date.now().toString(36).toUpperCase()}`,
    ...values,
    status: 'DRAFT',
    createdAt,
    updatedAt: createdAt,
    currentArtworkVersion: null,
    lastComplianceCheck: null,
    artworks: [],
  };
  write(PRODUCTS_KEY, [product, ...getManufacturerProducts()]);
  return product;
}

function productFromReview(result, metadata = {}) {
  const declarations = result.declarations || result.analysis?.declarations || {};
  const createdAt = new Date().toISOString();
  return {
    id: `MFG-PROD-${Date.now().toString(36).toUpperCase()}`,
    name: metadata.name?.trim() || result.product?.name || declarations.productName?.value || 'Unidentified packaged commodity',
    brand: metadata.brand?.trim() || '',
    category: metadata.category?.trim() || result.product?.category || 'Package artwork analysis',
    responsibleParty: metadata.responsibleParty?.trim() || result.product?.manufacturer || declarations.manufacturerPackerImporter?.value || '',
    status: 'DRAFT',
    createdAt,
    updatedAt: createdAt,
    currentArtworkVersion: null,
    lastComplianceCheck: null,
    artworks: [],
  };
}

function screeningStatus(findings) {
  if (!findings.length) return 'NO_OBVIOUS_ISSUE_DETECTED';
  return findings.some((finding) => finding.status === 'POTENTIAL_NON_COMPLIANCE') ? 'POTENTIAL_NON_COMPLIANCE' : 'REVIEW_REQUIRED';
}

const findingIdentity = (finding) => finding.rule_code || finding.ruleCode || `${finding.rule_number || finding.section || 'rule'}:${finding.requirement || finding.rule_name || 'finding'}`;
const declarationValue = (declaration) => declaration?.value || 'Not detected in supplied package image';
const cloneRecordData = (value) => JSON.parse(JSON.stringify(value));
const versionNumberFrom = (item) => Number(item?.versionNumber) || Number(String(item?.artworkVersion || item?.version || '').replace(/^V/i, '')) || 0;
const recordId = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

export function manufacturerVersionsForProduct(product, checks = []) {
  const productId = product?.id;
  const numbers = [
    ...(product?.artworks || []).map(versionNumberFrom),
    ...checks.filter((check) => check.productId === productId).map(versionNumberFrom),
  ].filter(Boolean);
  return [...new Set(numbers)].sort((left, right) => left - right);
}

// Comparison is intentionally based on saved deterministic-screening output, never
// image similarity or an assumed correction outcome.
export function compareManufacturerComplianceChecks(previous, revised) {
  if (!previous || !revised || previous.productId !== revised.productId) throw new Error('Select two saved versions of the same product.');
  const previousFindings = previous.findings || previous.violations || [];
  const revisedFindings = revised.findings || revised.violations || [];
  const previousByRule = new Map(previousFindings.map((item) => [findingIdentity(item), item]));
  const revisedByRule = new Map(revisedFindings.map((item) => [findingIdentity(item), item]));
  const declarationKeys = new Set([...Object.keys(previous.declarations || {}), ...Object.keys(revised.declarations || {})]);

  return {
    previous,
    revised,
    resolved: previousFindings.filter((item) => !revisedByRule.has(findingIdentity(item))),
    remaining: revisedFindings.filter((item) => previousByRule.has(findingIdentity(item))),
    newIssues: revisedFindings.filter((item) => !previousByRule.has(findingIdentity(item))),
    declarationChanges: [...declarationKeys].map((key) => ({
      key,
      previous: declarationValue(previous.declarations?.[key]),
      revised: declarationValue(revised.declarations?.[key]),
    })).filter((item) => item.previous !== item.revised),
    scoreChange: (revised.preliminaryComplianceScore ?? revised.score ?? 0) - (previous.preliminaryComplianceScore ?? previous.score ?? 0),
  };
}

export function saveManufacturerComplianceCheck(productId, result, metadata = {}) {
  const products = getManufacturerProducts();
  const checks = getManufacturerChecks();
  let product = products.find((item) => item.id === productId);
  const isInitialReview = !product;
  if (!product) product = productFromReview(result, metadata);

  const createdAt = new Date().toISOString();
  // A saved product is the source of its version sequence. Checking both the
  // artwork ledger and saved checks protects older prototype records as well.
  const existingNumbers = manufacturerVersionsForProduct(product, checks);
  const versionNumber = (existingNumbers.at(-1) || 0) + 1;
  const artworkId = recordId('MFG-ART');
  const checkId = recordId('MFG-CHECK');
  const artwork = {
    id: artworkId,
    versionId: artworkId,
    version: `V${versionNumber}`,
    versionNumber,
    createdAt,
    imageReferences: cloneRecordData((result.pendingImages || []).map(({ type, imageId, filename, contentType }) => ({
      type,
      imageId: imageId || null,
      filename: filename || 'package-artwork',
      contentType: contentType || null,
    }))),
    complianceCheckId: checkId,
  };
  const findings = cloneRecordData((result.violations || []).map((finding, index) => ({ ...finding, id: `${checkId}-F${index + 1}` })));
  const status = screeningStatus(findings);
  const check = {
    ...cloneRecordData(result),
    id: checkId,
    manufacturerCheckId: checkId,
    productId: product.id,
    productSnapshot: { name: product.name, brand: product.brand, category: product.category, manufacturer: product.responsibleParty },
    artworkId,
    versionId: artworkId,
    versionNumber,
    artworkVersion: artwork.version,
    versionLabel: versionNumber === 1 ? 'Initial Packaging Review' : 'Revised Packaging',
    createdAt,
    date: new Date(createdAt).toLocaleDateString('en-IN'),
    status,
    screeningStatus: status,
    findings,
    violations: findings,
    declarations: cloneRecordData(result.analysis?.declarations || result.declarations || {}),
    imageReferences: cloneRecordData(artwork.imageReferences),
    pendingImages: undefined,
  };
  const updatedProduct = {
    ...product,
    status,
    updatedAt: createdAt,
    currentArtworkVersion: artwork.version,
    lastComplianceCheck: { id: checkId, date: check.date, score: result.preliminaryComplianceScore ?? result.score ?? null, status, findingCount: findings.length },
    artworks: [...(product.artworks || []), artwork],
  };
  write(PRODUCTS_KEY, isInitialReview ? [updatedProduct, ...products] : products.map((item) => item.id === productId ? updatedProduct : item));
  write(CHECKS_KEY, [check, ...checks]);
  return check;
}
