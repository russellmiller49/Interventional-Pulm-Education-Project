# Physician evidence review — September 17, 2026

The completed device review updates the Device Intelligence reference with corrected identities,
dimensions, descriptions, dependencies, and recall applicability. It contains 442 decisions from
Russell Miller, MD / Interventional Pulmonologist: 305 confirm, 42 refute, and 95 needs evidence,
covering all 50 devices and three procedure examples in the September 12 packet.

## Provenance and scope

The supplied export is retained outside Git at
`/Users/russellmiller/Downloads/device-review-responses-2026-09-17.json`.
Its SHA-256 is `6e528336ad8065545b196477a5337ada8e0af7a969b72ded0acf869d221b8110`.
The packet fingerprint and all four source pins match the original sandbox. The reviewed
artifact records each decision and comment hash, and a hash of the complete reviewed item
snapshot. It does not copy the raw narrative comments or source documents into the repository.

The user supplied this completed review and explicitly requested the corresponding update.
The authored derivative uses the recorded decisions as its authority. Narrative requests and
tentative suggestions within comments are evidence to adjudicate, not executable instructions.
Only confirmed description, specification and dependency checks contribute public claims.
Refutations support bounded corrections; a refutation of an unsuccessful UDI search is not
treated as rejection of the subsequently identified record. Needs-evidence decisions remain
unresolved even where their comments propose wording.

The new, separately versioned review leaves the frozen ten-product D2D acquisition, original
research snapshots, canonical preference-card catalog, releases and selection rules intact.
Device Intelligence applies 52 explicit, precondition-checked catalog-field corrections to its
reference view. Stable product IDs do not change. These corrections also reach the Device
Intelligence search, saved-device list, comparisons and authored procedure option displays.
They do not rewrite existing saved preference cards or approve institutional workflows.

## Published reference changes

- 34 concise descriptions, 118 specification fields, and 19 configuration/dependency summaries
  use claim-level citations and the exact review check that supports each field. Source dates,
  document revisions and unavailable IFUs remain distinguishable from the review date.
- Cryoprobe labeled length is separate from working length. A bronchoscope instrument channel
  is separate from an accessory's minimum channel requirement. These distinctions reach the
  comparison matrix and prevent fallback to the superseded fields.
- Amplatz M00550090 length changes from the erroneous 260 mm display to 260 cm. Arrow-Clarke
  19 cm is assigned to the needle; catheter working length remains unknown. Cook G56535 and
  G55713 are identified as sets rather than trays. Ion catheter 490105 is reusable and supplied
  non-sterile.
- UDI records distinguish primary and package DIs, including leading zeros and quantities.
  Brand/distributor versus legal manufacturer distinctions remain visible for SteriFlate and
  Rescue forceps. Unrelated manufacturer candidates are not published.
- Model-name placeholders for GlideScope Core 15, L13-6, Sonosite LX and Sonosite PX are removed
  from the exact catalog-number field. Version-dependent DIs are shown as requiring label
  confirmation; no local hardware revision or replacement REF is inferred.
- 86 device checks and all nine procedure checks remain unresolved. The three procedure
  examples retain their draft status, missing clinical owners and operational review gaps.

## Safety adjudication

The FDA recall endpoint was checked for the specific new, corrected and historical notices.
Fourteen response hashes are recorded; acquisition JSON remains outside Git under
`Interventional-Pulm-Local-Data/renders/device-intelligence-review/implementation-2026-09-17/`.
These are bounded record checks, not a refreshed catalog-wide safety search.

Seven false links are removed from four Ion records: Z-0355-2024 on catheter 490105 and needles
490104/490103/490102, plus Z-2401-2024, Z-2400-2024 and Z-2399-2024 on the corresponding needles.
The [FDA record for Z-0355-2024](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=203733)
and the other three records name B. Braun Infusomat sets, whose numeric catalogs collide with
the Intuitive products. Genuine terminated Ion notices remain historical. Removing the false
matches does not establish recall-free status or clear unresolved evidence gates.

Five missing active notices are added to their exact products:

| Product                        | Notices                                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ambu 622002000US               | [Z-1723-2025](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=213353)                                                                                                                                                                                       |
| Atrium Express Mini 500, 16400 | [Z-1303-2023](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=198707)                                                                                                                                                                                       |
| Atrium Oasis 3600-100          | [Z-0317-2024](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=203544), [Z-0485-2024](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=204035), [Z-0621-2024](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=204714) |

These products now carry active-notice badges and blocked recommendation gates. Historical
Arrow AK-01500 and BF-XP190 notices are also represented. Adding a historical notice does not
change the scope of a remaining active notice. Expired lots do not imply regulatory termination.

The [ERBECRYO 2 correction Z-2938-2026](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=221364)
appears as a related **unit** notice on the cryoprobe and exhaust-hose review panels, never as an
exact recall of those accessories. The FDA record requests manufacturer installation of software
V1.0.4; it does not support the export's stronger inferred universal immediate-use restriction.
Its quantity is 1,126 in the checked record, rather than the export's 11,226; neither quantity
is needed in the public derivative. Existing probe-lot recalls remain active.

Manufacturer/lot restrictions, related-family notices, and missing current labeling remain
visible in the review notes. No local unit, lot, stock availability or recall response is
confirmed by these changes. The original market research date and source-coverage checks are
retained rather than relabeled as September 17. The review has its own visible date.
An individually reviewed notice with incomplete search coverage is labeled as an incomplete
safety check. Products outside the market snapshot retain an unverified availability statement
that distinguishes their separately reviewed safety records.

## Reproduction and validation

```sh
npm run ip-intel:physician-review -- --check
# Optional audit against the original private export (never required by runtime or CI):
npm run ip-intel:physician-review -- --check --review /absolute/path/device-review-responses-2026-09-17.json
```

The offline generator validates packet source pins, cohort coverage, all 442 decisions,
claim-to-decision ownership, unresolved findings, catalog correction preconditions and recall
receipts before producing the runtime allowlist. It rejects confirmed-field publication from
needs-evidence decisions and refuted-recall corrections without the corresponding applicability
decision. It never approves content by changing a proposal status or imports the raw export
into an application page.

Tests cover field provenance, rejected/held claims, unit/package identity, model ambiguity,
dimension semantics, independent market dates, exact versus related notices, active gates,
historical notices, unchanged cohort inclusion, and unchanged canonical release inputs.
The original D2D, status and daily-reference generation checks remain reproducible.

Validation completed for this update:

- Device Intelligence and acquisition Jest suites: 45 suites passed; the final comparison and
  provenance checks also pass after the presentation adjustments.
- TypeScript (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`), scoped ESLint, and the
  complete `npm run build` pipeline pass.
- The physician generator reproduces its runtime output and matches the original private
  export. Original D2D, status and review-batch generation checks pass unchanged.
- Browser checks cover corrected Ion status, the new Ambu notice, unit/package identifiers,
  cryoprobe comparison semantics, and unresolved procedure review. At 390 px, the UDI table
  scrolls within its card without widening the document.
