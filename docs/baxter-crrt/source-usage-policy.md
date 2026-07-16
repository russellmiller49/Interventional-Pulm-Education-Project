# Baxter CRRT source usage policy

Document status: Phase 0 draft  
Applies to: code, authored cases, UI copy, diagrams, tests, documentation, analytics labels, and
review artifacts for the Baxter CRRT simulator

## 1. Purpose

This policy governs source-grounded original educational implementation without redistributing
copyrighted manuals, marketing artwork, or unsupported clinical rules. It does not grant
redistribution, reproduction, or derivative-work rights; none of the supplied documents includes a
reuse grant. G5036003 explicitly carries a 2005-2011 Gambro Lundia AB copyright notice, and AW8035
and the Nordic sheet carry trademark notices. This policy also prevents a market,
software version, disposable set, or local protocol from being silently generalized.

## 2. Source hierarchy

Use the most authoritative applicable source:

1. Matching-revision device operator manual or IFU for machine behavior.
2. Current approved local protocol for operational clinical rules.
3. Current professional guidance and primary literature for clinical principles and outcome-facing
   educational claims.
4. Peer-reviewed reviews or textbooks for background and cross-checking.
5. Marketing/specification sheets only for nonclinical supporting context.

A lower-level source cannot override a higher-level source. If sources conflict, the affected value
or pathway remains pending and disabled until adjudicated.

## 3. Supplied device documents

| Source ID               | Authoritative scope                                                                  | Limitations                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| PRISMAX-AW8035-RB       | PrisMax Operator's Manual AW8035 Rev B JUN2019, program 2.XX                         | Market/configuration dependent; not proof of the user's installed configuration                                                                 |
| PRISMAFLEX-G5036003-R05 | Prismaflex Operator's Manual G5036003 Revision 05.2011, program 6.xx                 | Older multi-market device generation; not interchangeable with PrisMax                                                                          |
| PRISMAX-NORDICS-2023    | Nordic regional PrisMax specification snapshot, NOR-AT21-230020, printed August 2023 | Marketing/specification source only; lacks software/revision alignment and is not authoritative for any unmatched or non-Nordic release profile |

The numeric download filenames are not source identities. Source records must use the order number,
revision, program version, printed page, PDF page where useful, and SHA-256.

## 4. Repository-safe use

### 4.1 Permitted

- Original TypeScript implementations of source-supported calculations and state transitions.
- Short factual labels needed to model screen vocabulary, when linked to a source record.
- Original paraphrased educational explanations.
- Original CSS and SVG diagrams that teach functional relationships without recreating manufacturer
  artwork.
- Claim-level citations containing source title, revision, page/section, market, implementation
  location, reviewer, and review status.
- Local filenames and cryptographic hashes as provenance metadata.
- Tests that assert source-supported directionality, ranges, workflow gates, and calculations.

### 4.2 Prohibited

- Committing the supplied PDFs.
- Manual screenshots, scanned figures, copied tables, manufacturer logos, trade dress, or device
  photography.
- Long passages, alarm-response instructions, or near-verbatim manual summaries.
- A pixel-perfect replica of a manufacturer interface.
- Long or near-verbatim text, figures, or tables from textbooks or licensed ClinicalKey material.
- Royal College competency text unless it is paraphrased or every applicable attribution and
  distribution condition has been verified and satisfied.
- Marketing claims used as clinical evidence.
- Unreviewed numeric thresholds presented as clinical recommendations.
- Runtime language-model generation of prescriptions, thresholds, physiology, scoring, alarms, or
  clinical correctness.

The product may be recognizable enough to teach location and workflow, but must remain visibly an
independent educational facsimile.

## 5. Required source-record fields

Every consequential claim, value, formula, alarm behavior, or workflow must map to a record with:

- Stable source-record ID.
- Claim.
- Value and unit when numeric.
- Source title and source type.
- Document number, revision, program version, and date.
- Printed page or section and PDF page when pagination could be ambiguous.
- Market/configuration.
- Intended implementation location.
- Reviewer or null.
- Review status: pending, reviewed, or approved.
- Limitations or conflict note.

Device facts should additionally identify the device profile. Clinical and protocol rules should
identify the applicable population and protocol version.

## 6. Version, market, and configuration discipline

- AW8035 facts apply only to the source-mapped PrisMax 2.XX draft profile.
- G5036003 facts apply only to the Prismaflex 6.xx draft profile.
- Alarm taxonomies, setup sequences, scale inventories, flow increments, and screen vocabularies
  must remain adapter-specific.
- The Nordic sheet may corroborate a feature but cannot activate it.
- A feature shown in one source is not enabled until the release market/configuration and installed
  software support it.
- Optional sets, accessories, blood warmers, Auto Effluent, solution profiles, and anticoagulation
  methods require explicit configuration records.
- Service and administrator-only settings remain excluded even when described in a source.

## 7. Clinical evidence boundary

The supplied manuals support device behavior. They are not sufficient sources for:

- Indication prioritization among real patients.
- A universal CRRT dose target.
- Patient-specific fluid-removal rates.
- Electrolyte or acid-base treatment thresholds.
- Medication dosing or clearance adjustments.
- Nutrition prescriptions.
- Anticoagulation selection.
- Filter-life targets.
- Liberation criteria.
- Critical-error scoring that claims a universally correct clinical response.

Until approved clinical sources and reviewers are added, case numbers remain synthetic,
source-mapped to their educational mechanism, labeled simulated, and reviewStatus: pending.

## 8. Local protocol boundary

Regional citrate anticoagulation requires a versioned local protocol profile. The following must not
be inferred from a generic review, manual option, or another institution:

- Citrate dose or concentration.
- Calcium product and concentration.
- Calcium starting dose or adjustment.
- Post-filter and systemic ionized-calcium targets.
- Total-calcium ratio thresholds.
- Sampling intervals.
- Solution selection.
- Acid-base or sodium adjustment rules.
- Escalation, stopping, or contraindication criteria.

Before approval, code may define types, a disabled dashboard, and explanatory non-actionable
relationships. It must not expose a runnable citrate dosing algorithm or an active citrate case.

## 9. Formula adjudication policy

Formulas are not implemented merely because they appear in a manual. Before activation:

1. Capture the exact source and units.
2. Check dimensions and sign convention.
3. Compare adjacent definitions, figures, and specifications.
4. Determine whether the formula is shared clinical math or device-specific displayed math.
5. Add unit, boundary, invariant, and time-equivalence tests.
6. Obtain device review for displayed calculations and clinical review for educational
   interpretation.

Two supplied PrisMax passages require explicit resolution:

- AW8035 manual p218 prints a post-filter ultrafiltration expression whose sign conflicts with the
  adjacent filtration-fraction numerator.
- AW8035 manual p220 prints a pre-infusion expression that is visually/dimensionally ambiguous.

The implementation must not silently repair or reinterpret these expressions. Related profile
fields remain pending until a matching-revision authoritative clarification is reviewed.

## 10. Alarm and critical-error policy

For each alarm:

- Source the device name/category, detection input, stopped pumps/clamps, acknowledgement behavior,
  clearing condition, and allowed override separately.
- Model the underlying fault independently of display acknowledgement.
- Keep operating points and alarm limits in the device profile.
- Do not label a pressure as universally normal or abnormal outside the profile and scenario.
- Paraphrase the cause-first workflow; do not copy long manual instructions.

For each critical error:

- Cite the device and clinical basis.
- State the simulated consequence.
- Verify that the rule does not punish a source-reviewed accepted alternative.
- Require independent clinical and device approval.
- Keep the rule pending and draft-only until approval.

## 11. Provenance in learner and reviewer surfaces

The learner source panel should show:

- Profile name, order number, revision, program version, and draft market.
- Evidence class and page/section.
- A short paraphrased claim and limitation.
- Review status.
- The professional-education, source-boundary, and non-endorsement disclaimer.

The reviewer view may additionally show local filename, SHA-256, implementation path, test IDs, and
conflict notes. Local filesystem paths must not be exposed to learners or analytics.

## 12. Review-state transitions

| State    | Meaning                                                           | Allowed use                                                              |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| pending  | Source captured but not independently checked                     | Draft scaffolding, disabled option, or clearly synthetic test fixture    |
| reviewed | Named reviewer checked source transcription and interpretation    | Authenticated pilot only if the publication owner accepts remaining risk |
| approved | Required reviewers and publication owner signed the exact version | Eligible for published behavior subject to all other gates               |

Changing a source, formula, device version, local protocol, or consequential implementation resets
the affected record to pending.

## 13. Document retention

The public repository retains only:

- Original code and artwork.
- Paraphrased educational copy.
- Source citations, hashes, versions, and page ranges.
- Review status and approval records.

The supplied PDFs remain outside version control in their current local location or in an approved
restricted document system. Temporary text extracts and rendered pages used during development must
be removed before completion and never committed.
