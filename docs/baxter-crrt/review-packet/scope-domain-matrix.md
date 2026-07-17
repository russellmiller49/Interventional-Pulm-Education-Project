# Baxter CRRT scope-to-domain matrix

Status: `requirements template / no disposition recorded`

This matrix identifies which independent review records are required before an artifact can be
activated or published. It is not a checklist and contains no approval. Every required record must
bind to the same candidate ID and candidate-manifest SHA-256.

## Domain-set shorthand

| Code      | Required independent domain records                                                              |
| --------- | ------------------------------------------------------------------------------------------------ |
| `CLIN`    | `nephrology`, `critical-care`, and `crrt-nurse-education`                                        |
| `PM`      | `prismax-device` for the exact target configuration                                              |
| `PF`      | `prismaflex-device` for the exact target configuration                                           |
| `XDEV`    | `cross-device-equivalence`; this is additional to, never a substitute for, `PM`, `PF`, or `CLIN` |
| `A11Y`    | `accessibility` for every included route, workflow, viewport, and supported environment          |
| `L10N`    | one `localization` gate record itemizing the exact released locale corpus                        |
| `DATA`    | `privacy-data-governance` for the exact progress, analytics, feedback, and identity behavior     |
| `ACCESS`  | `entitlement-security` for the exact pilot/reviewer/learner cohort and access duration           |
| `PRODUCT` | `product-owner` for audience, supervision, competency boundary, support, and activation scope    |
| `PUB`     | `publication-approval` for the final deployable artifact and release state                       |
| `PROTO`   | `protocol-owner` for each exact controlled local protocol/profile                                |
| `PHARM`   | `pharmacy` for medication, anticoagulation, solution, or clearance content                       |
| `NUTR`    | `nutrition` for nutrition/electrolyte content                                                    |

For every learner activation under the current runtime contract, `A11Y`, `L10N`, `DATA`, `ACCESS`,
`PRODUCT`, and `PUB` are packet-wide gates in addition to the artifact-specific domains below. The
accepted `publication-approval` domain record is still not the separate publication authorization:
that authorization controls whether the candidate may actually be published. If an artifact never
stores or transmits data, the `privacy-data-governance` reviewer must still verify that negative
claim for the exact candidate.

The runtime accepts one unique `localization` gate attestation. That record must list every released
locale/corpus and digest all underlying locale-specific evidence. Do not ingest duplicate
`localization` domain records; a future multi-record aggregation model would require a reviewed
runtime change.

## 1. Case inventory

Every case requires `CLIN + PM` before PrisMax learner activation. The additional domains column adds
requirements; it never removes a base domain. Current implementation state is descriptive evidence,
not authorization.

| Artifact ID | Current implementation boundary             | Base domains | Additional domains or applicability decision                                                           |
| ----------- | ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| `CRRT-01`   | Reviewer-only candidate                     | `CLIN + PM`  | Product owner must assign any additional sepsis/AKI expertise required by final content                |
| `CRRT-02`   | Reviewer-only candidate                     | `CLIN + PM`  | Product owner must assign any additional electrolyte/acid-base expertise required by final content     |
| `CRRT-03`   | Manifest only                               | `CLIN + PM`  | Named neurocritical-care or liver-failure specialty applicability decision before authoring/activation |
| `CRRT-04`   | Protected pilot learner case                | `CLIN + PM`  | None may be inferred; all packet-wide gates still apply                                                |
| `CRRT-05`   | Reviewer-only bounded qualitative candidate | `CLIN + PM`  | Resolve every disputed or disabled calculation before a quantitative claim                             |
| `CRRT-06`   | Reviewer-only candidate                     | `CLIN + PM`  | None may be inferred; all packet-wide gates still apply                                                |
| `CRRT-07`   | Reviewer-only input-propagation candidate   | `CLIN + PM`  | None may be inferred; all packet-wide gates still apply                                                |
| `CRRT-08`   | Manifest only                               | `CLIN + PM`  | Exact local set, accessory, solution, line, and setup configuration evidence                           |
| `CRRT-09`   | Protocol-blocked                            | `CLIN + PM`  | `PROTO`; add `PHARM` when anticoagulant/drug/solution content is included                              |
| `CRRT-10`   | Protected pilot learner case                | `CLIN + PM`  | None may be inferred; all packet-wide gates still apply                                                |
| `CRRT-11`   | Reviewer-only candidate                     | `CLIN + PM`  | None may be inferred; all packet-wide gates still apply                                                |
| `CRRT-12`   | Manifest only                               | `CLIN + PM`  | `PHARM + NUTR`; neither can be marked not applicable while the named content remains in scope          |
| `CRRT-13`   | Protected pilot learner case                | `CLIN + PM`  | Exact device pressure/alarm behavior remains owned by `PM`                                             |
| `CRRT-14`   | Manifest only                               | `CLIN + PM`  | Exact return-pressure/disconnection mapping and device reaction                                        |
| `CRRT-15`   | Reviewer-only bounded trend candidate       | `CLIN + PM`  | Exact pressure/alarm mapping before actionable device behavior or scoring                              |
| `CRRT-16`   | Manifest only                               | `CLIN + PM`  | `PROTO`; add `PHARM` if anticoagulation content becomes operational                                    |
| `CRRT-17`   | Protocol-blocked                            | `CLIN + PM`  | `PROTO + PHARM`; complete citrate/calcium profile required before any actionable path                  |
| `CRRT-18`   | Manifest only                               | `CLIN + PM`  | `PROTO` for stop, blood-return, transition, and escalation policy                                      |

The three protected pilot cases being learner-runnable is not evidence that they are clinically or
device approved. The seven reviewer candidates being inspectable is not learner activation.

## 2. Rapid safety drills

Every drill requires `CLIN + PM + A11Y + L10N + PRODUCT` before learner activation. Add `DATA` if a
score, attempt, event, or result is stored or transmitted.

| Artifact ID            | Current implementation boundary     | Additional required domain or evidence                                                  |
| ---------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `DRILL-AIR`            | Reviewer preview only; non-runnable | Exact target-device alarm/reaction/correction mapping under `PM`                        |
| `DRILL-BLOOD-LEAK`     | Reviewer preview only; non-runnable | Exact target-device response and escalation mapping under `PM + CLIN`                   |
| `DRILL-GAIN-LOSS`      | Reviewer preview only; non-runnable | Configuration-specific fluid-accuracy and escalation evidence                           |
| `DRILL-BAG-SCALE`      | Reviewer preview only; non-runnable | Exact local bag, line, scale, solution, and restart verification evidence               |
| `DRILL-POWER`          | Reviewer preview only; non-runnable | Exact interruption, recovery, and escalation workflow under `PM + CLIN`                 |
| `DRILL-WRONG-SOLUTION` | Policy-blocked; no preview          | `PROTO`; add `PHARM` when the local formulary or medication/solution policy is affected |
| `DRILL-BLOOD-RETURN`   | Policy-blocked; no preview          | `PROTO` for stop/end, blood disposition, clotting, and escalation policy                |

## 3. Instructional tools

| Artifact ID                 | Current implementation boundary | Required content/fidelity domains before learner activation                                                         |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `LAB-TRANSPORT`             | Reviewer-only candidate         | `CLIN + A11Y + L10N + PRODUCT`; add `PM` for any device-specific flow/display claim                                 |
| `LAB-PRESCRIPTION`          | Reviewer-only candidate         | `CLIN + PM + A11Y + L10N + PRODUCT`; unresolved formulas remain unavailable                                         |
| `LAB-PREPOST-DILUTION`      | Reviewer-only candidate         | `CLIN + PM + A11Y + L10N + PRODUCT`; no quantitative device claim while conflicts remain                            |
| `LAB-PRESSURE-LOCALIZATION` | Reviewer-only candidate         | `CLIN + PM + A11Y + L10N + PRODUCT`; disconnection, alarm, threshold, and response mappings remain separately gated |
| `LAB-FLUID-LEDGER`          | Reviewer-only candidate         | `CLIN + PM + A11Y + L10N + PRODUCT`                                                                                 |
| `LAB-CITRATE-DASHBOARD`     | Protocol-blocked scaffold       | `CLIN + PM + PROTO + PHARM + A11Y + L10N + PRODUCT`                                                                 |

Add `DATA` to any tool that persists or transmits interaction state. All learner-accessible tools also
require the packet-wide `ACCESS` gate.

## 4. Mastery

| Artifact ID                     | Current implementation boundary                                             | Required domains before activation                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MASTERY-COMPOSITION-REVIEW-01` | Ephemeral reviewer-only planner; no session, score, progress, or competency | `CLIN + PM + A11Y + L10N + PRODUCT` for composition review only; approval does not activate Mastery                                                              |
| `MASTERY-PRISMAX-01`            | Manifest only; empty runtime case allowlist                                 | `CLIN + PM + A11Y + L10N + DATA + ACCESS + PRODUCT`; every case/mechanism/alternative/critical error/score/reassessment must also carry its own required reviews |

Mastery authorization must name the exact capstone runtime IDs, score rules, critical-error rules,
reassessment requirements, progress behavior, and competency wording. Approval of a composition
planner cannot be used as approval of a future capstone.

## 5. Phase 8 Prismaflex and cross-device transfer

No Phase 8 row is learner-active. The Phase 8 product authorization must reference a stable exact
PrisMax v1 candidate in addition to the Phase 8 candidate under review.

| Artifact ID                                      | Current implementation boundary                                           | Required domains before Phase 8 learner activation                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `prismaflex-g5036003-6xx`                        | Reviewer-only device profile; enabled configuration empty                 | `PF + CLIN + A11Y + L10N + PRODUCT` plus exact target configuration                           |
| `prismaflex-g5036003-r05-6xx-review-candidate.1` | Draft profile version only                                                | `PF`; its disposition cannot approve the PrisMax profile or a later Prismaflex profile        |
| Prismaflex calculation candidate                 | Reviewer-only, absent from learner graph                                  | `PF + nephrology + critical-care`; resolve `CONFLICT-010` for any affected claim              |
| Prismaflex adapter/setup/alarm metadata          | Reviewer-only; runtime actions fail closed                                | `PF + crrt-nurse-education + A11Y + L10N + PRODUCT`                                           |
| Prismaflex softkey review console                | Guarded reviewer interface only                                           | `PF + crrt-nurse-education + A11Y + L10N + PRODUCT`                                           |
| `TRANSFER-PRISMAX-PRISMAFLEX-01`                 | Reviewer-only composition plan; no tolerance, runtime, score, or progress | `CLIN + PM + PF + XDEV + A11Y + L10N + DATA + ACCESS + PRODUCT`                               |
| `setup-navigation`                               | Transfer review domain only                                               | `CLIN + PM + PF + XDEV`; matching goals do not establish matching screens or workflow         |
| `prescription-display`                           | Transfer review domain only                                               | `nephrology + critical-care + PM + PF + XDEV`; numeric tolerance and formula context required |
| `pressure-translation`                           | Transfer review domain only                                               | `CLIN + PM + PF + XDEV`; device values/limits are not interchangeable clinical normals        |
| `fluid-accounting`                               | Transfer review domain only                                               | `CLIN + PM + PF + XDEV`; machine values remain distinct from the patient ledger               |
| `alarm-taxonomy`                                 | Transfer review domain only                                               | `CLIN + PM + PF + XDEV`; category names and acknowledgement do not prove correction           |

`XDEV` may approve only the declared canonical-state/action protocol, comparison method, and numeric
tolerances. It cannot approve either device adapter, device configuration, clinical content, or a
competency claim.

The runtime domain vocabulary accepts `XDEV`, and the Phase 8-aware activation and publication
resolvers require it together with `PF`. It remains a controlled Phase 8 packet and authorization
gate: do not change activation/publication state until the exact-candidate `XDEV` record and the
separate authorization are verified.

## 6. Packet-wide decisions

| Requested state            | Required records in addition to every artifact row                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protected pilot acceptance | Exact-candidate domain records required by the three pilot cases, `A11Y`, `L10N`, `DATA`, `ACCESS`, `PRODUCT`, and `PUB`, then the separate pilot-acceptance authorization                |
| Phase 7 activation         | Accepted pilot prerequisite, all selected Phase 7 artifact records, resolved applicability for `PROTO`/`PHARM`/`NUTR`, every packet-wide gate including `PUB`, then Phase 7 authorization |
| Phase 8 activation         | Stable approved PrisMax v1 reference, all selected Prismaflex/transfer records including `PM + PF + XDEV`, every packet-wide gate including `PUB`, then Phase 8 authorization             |
| Publication                | Every applicable exact-candidate domain approval, all requested activation decisions, final validation/deployment evidence, then a separate `PUB` record and publication authorization    |

Approval for one locale, device profile, local configuration, route, case, drill, tool, or phase does
not approve any sibling artifact. Any item omitted from the authorization's included-scope table
remains unavailable.
