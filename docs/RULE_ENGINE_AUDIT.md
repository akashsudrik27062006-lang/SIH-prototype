# Rule-engine audit — 20 September 2026

## Scope and outcome

LabelGuard provides preliminary compliance screening for the implemented rule set. It does not claim complete coverage of all Legal Metrology provisions. AI extracts information, deterministic checks generate potential findings or review-required items, and an authorised Legal Metrology Officer makes the final decision.

This audit covers the live JavaScript rule engine only. It does not alter the Gemini Edge Function contract, the Supabase deployment, or the UI.

## A. Current rule inventory (before this change)

`src/services/compliance/ruleEngine.js` contained six hardcoded mandatory checks: common/generic name, net quantity, manufacturer/packer/importer, manufacture/packing date, MRP, and consumer care. It also emitted conditional findings for country of origin, best-before/use-by, and unit sale price.

The prior engine produced `MISSING`, `MALFORMED`, and `REVIEW_REQUIRED` findings. It did not include a rule code, version, source-document metadata, applicability model, severity, or a reliable distinction between image non-detection and package-wide absence.

## B. Current rule references (before this change)

| Existing reference | Audit result |
| --- | --- |
| Rule 6(1)(a), responsible party | Supported for name/address of manufacturer, packer, or importer. |
| Rule 6(1)(b), generic name | Supported. |
| Rule 6(1)(c), net quantity | The live engine was correct; static demo copy elsewhere incorrectly says Rule 6(1)(b). |
| Rule 6(1)(d), date | Supported for the relevant month/year declaration, subject to statutory exceptions and product context. Country of origin was incorrectly cited to this provision. |
| Rule 6(1)(e), MRP | Supported, with the 2021 wording requiring retail sale price in Indian currency. |
| Rule 6(2), consumer care | Not supported by the official materials reviewed. Consumer care is confirmed as a Rule 6 mandatory declaration, but this audit deliberately cites Rule 6 rather than inventing an unsupported sub-clause. |
| `indiankanoon.org` / `legitquest.com` citations | Not authoritative sources. They must not be used as legal authority for new live findings. |

## C. Hardcoded vs data-driven

Before: all live checks, descriptions, recommendations, and citations were hardcoded in the evaluator. The current working tree also has static demo findings in `src/App.jsx` and `src/services/mock/complianceService.js`; those are not the live Gemini route.

After: `src/services/compliance/ruleRepository.js` holds one record per rule/version, and `ruleEngine.js` only evaluates that data. Each rule record has `id`, `rule_code`, `rule_number`, `rule_name`, `requirement`, `description`, `category`, `applicability_conditions`, `validation_type`, `severity`, source metadata, version/effective dates, `active`, and `human_review_required`.

## D. Official-source verification

The authoritative references used are:

- Department of Consumer Affairs, [consolidated Packaged Commodities Rules, 2011 with amendments](https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/Book_on_Legal_Metrology_Packaged_Commodities_Rules%2C2011_with_all_amendments_whatsnews.pdf).
- Department of Consumer Affairs, [2021 amendment, G.S.R. 779(E)](https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/The_Legal_Metrology_Packaged_Commodities_Amendment_Rule%2C_2021_whatsnews.pdf), for Rule 6(1)(e), Rule 6(11), and Rule 4(2).
- Department of Consumer Affairs, [outer retail-package advisory dated 18 January 2023](https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/Declaration_of_mandatory_information_on_the_outer_retail_package_-_reg._whatsnews.pdf), confirming the practical Rule 6 declaration set including country of origin for imports and consumer care.
- Department of Consumer Affairs, [2026 Rule 6(10A) amendment](https://consumeraffairs.gov.in/public/upload/files/2026.02.13%20PCR%201st%20COO%20Filter%20on%20e-commerce%20websites_1771231030.pdf), effective 1 July 2026; the [second 2026 amendment](https://consumeraffairs.gov.in/public/upload/files/2026.4.27%20PCR%202nd%20COO%20from%201.7.2027_1777348487.pdf) is stored as a future version effective 1 July 2027.

## E. Coverage gaps and intentionally excluded automatic rules

No automatic legal finding is made for actual pack-content shortfall/tolerances, standard-pack schedules, physical font-size/PDP area, colour contrast, whether an address/contact is legally adequate, whether a commodity may become unfit for human consumption, other-law/FSSAI overlap, product-size relevance, group-package contents, listing data, or marketplace filter functionality. Those either require physical measurement, product and legal context, listing data, or a future extraction field.

The scanner receives only a supplied image and does not prove that a declaration is absent from the complete package. Therefore a missing current extraction becomes `REVIEW_REQUIRED`; it is not a confirmed violation.

## F. Proposed and implemented core rule set

There are 21 repository records (20 active as of this audit, one future-dated replacement):

| Code family | Source section | Validation | Applicability |
| --- | --- | --- | --- |
| Responsible party presence / adequacy | Rule 6(1)(a) | PRESENCE / MANUAL_REVIEW | Retail package |
| Country of origin | Rule 6, imported products | PRESENCE | Confirmed imported product |
| Common/generic name | Rule 6(1)(b) | PRESENCE | Retail package |
| Net quantity / unit syntax | Rule 6(1)(c) | PRESENCE / FORMAT | Retail package |
| Applicable month-year / syntax | Rule 6(1)(d) | PRESENCE / FORMAT | Retail package, no date exception |
| Best-before/use-by | Rule 6(1)(da) | PRESENCE | Perishable human-consumption commodity, no other-law coverage |
| MRP / currency syntax | Rule 6(1)(e) | PRESENCE / FORMAT | Retail package |
| Consumer care / adequacy | Rule 6 | PRESENCE / MANUAL_REVIEW | Retail package |
| Dimensions | Rule 6(1)(f) | PRESENCE | Size relevant |
| Unit sale price / basis | Rule 6(11) | PRESENCE / FORMAT | Not wholesale |
| Promotional group package | Rule 4(2) | MANUAL_REVIEW | Promotional retail group |
| Legibility and prominence | Rule 9(1)(a) | READABILITY_REVIEW | Retail package |
| E-commerce declaration display | Rule 6(10) | MANUAL_REVIEW | E-commerce listing |
| Imported-product origin filter | Rule 6(10A) | MANUAL_REVIEW | E-commerce imported product; versioned for 2026/2027 |

## G. Repository design

`CORE_RULES` is version-controlled JavaScript data rather than database data because the current application has no deployed rules table and the task forbids changing Supabase deployment. Its schema is deliberately compatible with a future database repository. A future migration can copy the fields without moving requirements into React components.

## H. Applicability design

Rules apply only when their declared conditions are met. Unknown conditions suppress automatic absence findings. Missing fields that Gemini does not currently emit likewise suppress automatic absence findings; the rule remains traceable in the repository. This preserves the existing Gemini payload contract.

## I. Recommended implementation order

1. Preserve and test the data-driven repository and current extracted fields.
2. Extend Gemini only through a versioned, backwards-compatible contract for package type, food/perishability/other-law context, dimensions, listing declarations, and image-panel coverage.
3. Add officer workflows for manual-review rules and evidence across multiple package panels.
4. Add physical measurement and category-specific checks only after the necessary reliable evidence and legal review are available.
