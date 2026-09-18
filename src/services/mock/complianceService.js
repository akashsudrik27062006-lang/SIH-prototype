import { URL_PCR_2011 } from '../../data/mockData';

// Temporary adapter: replace these functions with the Supabase/API implementation later.
export const mockViolations = (product) => {
  if (product.id === 'oil') return [{ requirement: 'Net Quantity Specification', section: 'Rule 6(1)(b)', status: 'MALFORMED', detectedValue: '1 Litre (900 mL)', expectedValue: '1 L or 1000 mL (Consistent SI unit)', explanation: 'Contradictory volume declared: 1 Litre mathematically equals 1000 mL, not 900 mL. This misleads the buyer on true packaged content.', ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(1)(b)', url: URL_PCR_2011 }, recommendation: 'Declare uniform standard metric units without conflicting parenthetical weights.' }];
  if (product.id === 'biscuits') return [{ requirement: 'Maximum Retail Price (MRP)', section: 'Rule 6(1)(e)', status: 'MISSING', detectedValue: 'Not detected on display panel', expectedValue: 'MRP Rs. / ₹ ... (inclusive of all taxes)', explanation: 'The package lacks any visible or unambiguous Maximum Retail Price declaration on the principal display panel.', ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(1)(e)', url: URL_PCR_2011 }, recommendation: 'Print clear, unambiguous MRP inclusive of all applicable taxes.' }];
  if (product.id === 'spices') return [
    { requirement: 'Manufacturer / Packer Identification', section: 'Rule 6(1)(a)', status: 'MISSING', detectedValue: 'Not detected', expectedValue: 'Full corporate name and registered address of Manufacturer/Packer', explanation: 'No registered packer or manufacturing address was found printed on the product packaging.', ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(1)(a)', url: URL_PCR_2011 }, recommendation: 'Add the complete manufacturing or packing enterprise name and postal pin code.' },
    { requirement: 'Consumer Grievance Redressal Mechanism', section: 'Rule 6(2)', status: 'MISSING', detectedValue: 'Not detected', expectedValue: 'Designated helpline phone number, email ID, and postal address', explanation: 'Missing mandatory consumer care helpline credentials for grievance redressal.', ruleRef: { law: 'Legal Metrology (Packaged Commodities) Rules, 2011', section: 'Rule 6(2)', url: URL_PCR_2011 }, recommendation: 'Include active customer care phone and email contact details.' },
  ];
  return [];
};

export const createMockResult = (product) => ({
  id: `INSP-${Math.floor(1000 + Math.random() * 9000)}`,
  product,
  score: product.status === 'COMPLIANT' ? 98 : product.id === 'oil' ? 74 : product.id === 'biscuits' ? 62 : 48,
  status: product.status,
  violations: mockViolations(product),
  date: new Date().toLocaleDateString('en-IN'),
});

export const getStatusTone = (status) => status === 'COMPLIANT' ? 'good' : status === 'WARNING' || status === 'UNDER_REINSPECTION' ? 'warn' : 'bad';
