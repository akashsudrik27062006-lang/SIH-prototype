const fields = [
  ['productName', 'Product Name', 'productName'], ['netQuantity', 'Net Quantity', 'netQuantity'], ['mrp', 'MRP', 'listedMrp'],
  ['manufacturerPackerImporter', 'Manufacturer / Packer / Importer', 'manufacturer'], ['countryOfOrigin', 'Country of Origin', 'countryOfOrigin'],
  ['packingDate', 'Manufacturing / Packing Date', 'packingDate'], ['bestBefore', 'Best Before / Use By', 'bestBefore'], ['consumerCare', 'Consumer Care Details', 'consumerCare'], ['unitSalePrice', 'Unit Sale Price', 'unitSalePrice'],
];

const absent = (value) => !value || /^not detected/i.test(String(value).trim());
const basic = (value) => String(value || '').toLowerCase().replace(/[.,;:()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
const currency = (value) => { const match = String(value || '').replace(/,/g, '').match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i); return match ? Number(match[1]).toFixed(2) : null; };
const quantity = (value) => { const match = String(value || '').toLowerCase().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/); if (!match) return null; const amount = Number(match[1]); const unit = match[2]; if (unit === 'kg') return `mass:${amount * 1000}`; if (unit === 'g') return `mass:${amount}`; if (unit === 'l') return `volume:${amount * 1000}`; return `volume:${amount}`; };
const normalized = (key, value) => key === 'netQuantity' ? quantity(value) || basic(value) : key === 'mrp' || key === 'unitSalePrice' ? currency(value) || basic(value) : basic(value);

export function compareSellerListingToPackage(listing = {}, declarations = {}) {
  const rows = fields.map(([key, label, listingKey]) => {
    const listingValue = listing[listingKey]?.trim() || '';
    const packageValue = declarations[key]?.value?.trim() || '';
    const listingAbsent = absent(listingValue); const packageAbsent = absent(packageValue);
    const status = listingAbsent && packageAbsent ? 'REVIEW_REQUIRED' : listingAbsent ? 'MISSING_FROM_LISTING' : packageAbsent ? 'NOT_DETECTED_ON_PACKAGE' : normalized(key, listingValue) === normalized(key, packageValue) ? 'MATCH' : 'MISMATCH';
    return { key, label, listingValue: listingValue || 'Not provided', packageValue: packageValue || 'Not detected in supplied package image', status, evidence: declarations[key]?.evidence || [] };
  });
  const mismatches = rows.filter((row) => row.status === 'MISMATCH').map((row) => ({ ...row, title: `Potential Listing–Package Mismatch: ${row.label}`, reason: `The online listing value differs from the supplied package evidence for ${row.label.toLowerCase()}.`, recommendation: `Verify the actual product/package and correct the online listing ${row.label.toLowerCase()} before publishing or continuing sale.` }));
  const reviewRows = rows.filter((row) => row.status !== 'MATCH');
  return { rows, mismatches, score: Math.max(0, 100 - mismatches.length * 12 - reviewRows.filter((row) => row.status !== 'MISMATCH').length * 4), status: mismatches.length ? 'REVIEW_REQUIRED' : reviewRows.length ? 'REVIEW_REQUIRED' : 'NO_OBVIOUS_ISSUE_DETECTED' };
}
