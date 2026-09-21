import { CORE_RULES, PCR_CONSOLIDATED_SOURCE } from './ruleRepository.js';

const FIELD_LABELS = {
  productName: 'Common / Generic Name', netQuantity: 'Net Quantity', mrp: 'MRP',
  manufacturerPackerImporter: 'Manufacturer / Packer / Importer', countryOfOrigin: 'Country of Origin',
  packingDate: 'Manufacturing / Packing Date', bestBefore: 'Best Before / Use By',
  consumerCare: 'Consumer Care', unitSalePrice: 'Unit Sale Price', dimensions: 'Dimensions',
};

const validators = {
  METRIC_QUANTITY: (value) => /\b\d+(?:\.\d+)?\s*(kg|g|l|ml|m|cm|mm|pcs?|nos?|number|piece|pair|set)\b/i.test(value),
  MONTH_YEAR: (value) => /\b(?:0?[1-9]|1[0-2])\s*[/.-]\s*(?:19|20)\d{2}\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*(?:19|20)\d{2}\b/i.test(value),
  INDIAN_CURRENCY_PRICE: (value) => /(?:₹|\brs\.?|\binr)\s*\d+(?:\.\d{1,2})?\b/i.test(value),
  UNIT_SALE_PRICE: (value) => /(?:₹|\brs\.?|\binr)\s*\d+(?:\.\d{1,2})?\s*(?:per\s*)?(g|kg|cm|m|number|no\.?|ml|l)\b/i.test(value),
};

const readable = (declaration) => declaration?.value || 'Not detected in the supplied package image';
const ruleRef = (rule) => ({ law: rule.source_document, section: rule.rule_number, url: rule.source_url || PCR_CONSOLIDATED_SOURCE });

const applies = (rule, context) => Object.entries(rule.applicability_conditions || {}).every(([key, expected]) => {
  if (key === 'retail_package') return expected ? context.packageType !== 'WHOLESALE' : true;
  if (context[key] === undefined) return false;
  return context[key] === expected;
});

const finding = (rule, declaration, status, explanation, recommendation, expectedValue = rule.requirement) => ({
  rule_code: rule.rule_code, rule_number: rule.rule_number, rule_name: rule.rule_name,
  requirement: rule.requirement, section: rule.rule_number, status, severity: rule.severity,
  detected_value: readable(declaration), detectedValue: readable(declaration), expected_value: expectedValue,
  expectedValue, evidence: declaration?.evidence ?? [], confidence: declaration?.confidence ?? 0,
  explanation, recommendation,
  source_url: rule.source_url || PCR_CONSOLIDATED_SOURCE, ruleRef: ruleRef(rule),
});

export function getActiveRules(asOf = new Date().toISOString().slice(0, 10)) {
  return CORE_RULES.filter((rule) => rule.active && rule.effective_from <= asOf && (!rule.effective_to || rule.effective_to >= asOf));
}

export function evaluateDeclarations(declarations = {}, context = {}, asOf) {
  return getActiveRules(asOf).flatMap((rule) => {
    // Rules not supported by the existing Gemini contract are traceable but never
    // turned into an absence finding.
    if (!rule.extraction_key || !(rule.extraction_key in declarations)) return [];
    if (!applies(rule, context)) return [];
    const declaration = declarations[rule.extraction_key];
    const value = declaration?.value?.trim();

    if (rule.validation_type === 'MANUAL_REVIEW' || rule.validation_type === 'READABILITY_REVIEW') return [];
    // A format check is meaningful only when Gemini extracted a value. Presence owns
    // the no-value outcome so an unreadable image panel cannot create duplicate findings.
    if (!value && rule.validation_type === 'PRESENCE') return [finding(
      rule,
      declaration,
      'REVIEW_REQUIRED',
      `The supplied image did not yield ${rule.rule_name.toLowerCase()}. This does not prove that the declaration is absent from the complete package.`,
      `Inspect the remaining package panels and verify whether ${rule.rule_name.toLowerCase()} is declared and applicable before recording any non-compliance.`,
    )];
    if (!value) return [];
    if (rule.validation_type === 'FORMAT' && !validators[rule.validator]?.(value)) return [finding(
      rule,
      declaration,
      'POTENTIAL_NON_COMPLIANCE',
      `The extracted value does not pass LabelGuard's narrow ${rule.validation_type.toLowerCase()} screen. The visible evidence supports a potential issue, but officer review is required before any legal conclusion.`,
      `Compare the extracted value with the package evidence and verify the prescribed representation for ${rule.rule_name.toLowerCase()}.`,
    )];
    return [];
  });
}

export function createLiveResult(analysis) {
  const declarations = analysis.declarations || {};
  const findings = evaluateDeclarations(declarations, analysis.context || {});
  const fields = Object.fromEntries(Object.entries(declarations).map(([key, declaration]) => [FIELD_LABELS[key] || key, declaration?.value || 'Not detected']));
  // This is a preliminary screening score, not a legally determined compliance percentage.
  // Review-required items reflect insufficient image evidence and therefore carry a lower penalty.
  const score = Math.max(0, 100 - findings.reduce((total, item) => total + (item.status === 'POTENTIAL_NON_COMPLIANCE' ? 15 : 5), 0));
  return {
    id: `INSP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    product: {
      id: `live-${Date.now()}`, name: declarations.productName?.value || 'Unidentified packaged commodity',
      manufacturer: declarations.manufacturerPackerImporter?.value || 'Not detected', category: 'Package image analysis', image: '📦',
      fields, confidence: Object.fromEntries(Object.entries(declarations).map(([key, item]) => [key, item?.confidence ?? 0])), ocr: analysis.ocr,
    },
    score, preliminaryComplianceScore: score, scoreLabel: 'Preliminary Compliance Score',
    status: findings.length ? 'WARNING' : 'REVIEW_REQUIRED', violations: findings,
    date: new Date().toLocaleDateString('en-IN'), source: 'LIVE_ANALYSIS',
    screeningNotice: 'LabelGuard provides preliminary compliance screening for the implemented rule set. It does not claim complete coverage of all Legal Metrology provisions.',
  };
}
