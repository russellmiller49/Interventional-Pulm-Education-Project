# Device market and safety evidence refresh — September 17, 2026

The physician-reviewed reference now includes an exact-identity FDA status refresh for 1,911 products: the 1,905 products with unverified market status plus six with unresolved safety identity. Together with the retained August research, all 1,957 atlas products have a research row. A research row does not imply that its findings are affirmative or complete.

The refresh resolves market uncertainty for **1,123 previously unverified products** and establishes dated safety findings for **1,317 previously unverified products**. The latter includes recorded active and historical actions as well as bounded searches with no exact action found; it is not a count of products certified safe.

| Current reference state                     | Products |
| ------------------------------------------- | -------: |
| Confirmed current U.S. distribution         |       63 |
| Likely current U.S. distribution            |    1,094 |
| Market status unverified                    |      766 |
| Conflicting market evidence                 |       34 |
| Recorded active safety notice               |      163 |
| Historical safety notice                    |       33 |
| Safety identity review required             |       99 |
| Safety status unverified                    |       11 |
| No exact action found in the dated searches |    1,651 |

Market and safety rows are separate dimensions. Active notices increased from 22 to 163 products. These products remain visible, with their recommendation gates blocked. All physician review holds and seven previously rejected recall-to-product links remain preserved. Standalone bronchoscopes and sampler sets remain separate products.

## Sources and dates

The public, unauthenticated openFDA API was queried at two requests per second, using pagination and cache receipts. The final evidence package contains 385 completed query groups, 512 response pages and four endpoint metadata receipts. There were no incomplete query groups in the final package. Raw API responses and their cache files remain in Local-Data, outside Git.

| FDA source                 | Dataset date reported by FDA |
| -------------------------- | ---------------------------- |
| GUDID / UDI                | 2026-09-02                   |
| Registration and listing   | 2026-09-07                   |
| Device recalls             | 2026-09-12                   |
| Device enforcement reports | 2026-09-09                   |

Retrieval timestamps are retained separately in the research receipts. A September 17 review does not turn these datasets into September 17 live surveillance. Empty 404 searches have no response metadata; their dataset context comes from a separately acquired, dated metadata receipt for the same endpoint, checked against every dated response. An inconsistent or missing endpoint date prevents a complete dated absence finding.

Primary documentation: [FDA GUDID API](https://open.fda.gov/apis/device/udi/), [registration/listing API](https://open.fda.gov/apis/device/registrationlisting/), [device recall API](https://open.fda.gov/apis/device/recall/), [device enforcement API](https://open.fda.gov/apis/device/enforcement/).

Web searches also checked manufacturer identities and U.S. product listings. Exact examples include [KARL STORZ 10370U](https://www.karlstorz.com/us/en/product-detail-page.htm?cat=1000071971&productID=1000117255), [Olympus BF-1TH190](https://medical.olympusamerica.com/products/bronchoscope/therapeutic-bronchoscope-bf-1th190), and [Cook Arndt blocker sets](https://www.cookmedical.com/products/cc_aebs_webds/). [Novatech's stated U.S. restrictions](https://novatech.fr/en/about-us) prevent its global GSS/EWS/3D family listings from being treated as affirmative U.S. sales evidence.

## Decision rules

- A catalog/model number alone is insufficient. FDA company identity must match the catalog manufacturer or a specifically documented company relationship. Company evidence is recorded in the research package, without changing canonical manufacturer ownership.
- Literal identifier matching preserves letters, numbers, dots and dash suffixes. Recall fields using REF/UDI/lot columns may delimit identifiers with slashes. A family name without an identifier containing a digit cannot produce an exact-product notice.
- All exact GUDID configurations returned by completed searches are evaluated. Primary and package identifiers stay distinct. An ended matching package or conflicting configurations produce a conflict, rather than choosing the favorable record.
- Current GUDID distribution evidence supports **likely current** status. A current exact-device registration/listing or an exact live U.S. manufacturer product listing supplies the second source for **confirmed current** status. Registration is never represented as FDA approval or clearance. Existing clearance alone, a global brochure, and a recall do not establish current distribution.
- Fifty-eight products have only ended GUDID records. They remain unverified pending manufacturer confirmation; they are not automatically classified as discontinued. Another 16 products have newly identified mixed distribution states.
- Recall and enforcement searches cover exact catalog/model/UDI identifiers and manufacturer records, with complete pagination. A different or unresolved recalling firm cannot produce an attached exact-product notice. Such candidates stay in the audit and retain an identity-review hold.
- The refresh projects 294 exact product-to-notice matches across 147 recall numbers: 212 recorded active and 82 historical matches. Multiple notices can apply to one product. The FDA recall database maintains lifecycle updates, while enforcement status may remain as published. A documented recall termination supersedes an older ongoing enforcement report; other contradictory lifecycle evidence remains unresolved.
- A negative search never deletes an existing notice. Physician exclusions remain authoritative. The recommendation gate remains blocked for any recorded active action and stays review-required for unresolved physician checks.
- No-exact-action wording is restricted to completed, dated searches. It is neither recall clearance nor a claim that no other action exists. Lot and serial applicability still require the complete FDA/manufacturer notice and the local device label.

## Artifacts and reproduction

- `data/ip-device-intelligence/research/status-refresh-2026-09-17.json` contains the public query receipts, response hashes, company sources, selected identity fields and unresolved candidates. Full FDA responses, business contacts and lot lists are not copied into Git.
- `data/ip-device-intelligence/generated/status-refresh.json` is the strict runtime projection, pinned to the research file's SHA-256. The original August overlay and physician review remain separate and reproducible.
- Product detail pages show review and dataset dates, GUDID links, corroborating listing queries, and manufacturer sources. Index, comparison and procedure reference views consume the same resulting status reader.
- Canonical product data, preference-card release eligibility, local inventory and procedure approvals are unchanged.

```sh
# Reproduce this dated acquisition using its private Local-Data caches.
npm run ip-intel:status-refresh-acquire
npm run ip-intel:status-refresh
npm run ip-intel:status-refresh -- --check
```

These scripts intentionally pin the September 17 cohort and method. A future refresh should use a new dated acquisition and retain this evidence history. Missing identifiers, unresolved manufacturer identity, overseas catalog coverage and package/configuration ambiguity account for the remaining review backlog.

## Validation

The regression suite checks exact manufacturer matching, identifier suffixes, package conflicts, incomplete searches, current versus historical lifecycle evidence, notice preservation, physician exclusions and all atlas recommendation gates. The before/after coverage counts above are pinned by the runtime integration test. Validation also includes TypeScript, scoped ESLint, deterministic artifact regeneration, the production build and browser inspection of source links, dates and responsive layout.
