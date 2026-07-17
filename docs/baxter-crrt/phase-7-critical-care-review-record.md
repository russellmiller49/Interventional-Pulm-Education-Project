# Baxter CRRT Phase 7 critical-care review record

Status: `awaiting frozen candidate and named reviewer disposition`

This record is for the critical-care reviewer domain only. It does not replace nephrology, CRRT
nurse education, PrisMax device, pharmacy or nutrition where applicable, accessibility,
localization, product/publication, protocol-owner, or local-configuration review.
For a real candidate, copy the canonical
[one-reviewer/one-domain template](./review-packet/domain-review.template.md) into controlled
candidate-specific storage and use this document as the critical-care checklist/scope companion.

The repository user stated on 2026-07-16, and reiterated on 2026-07-17, that they are a critical
care physician and can sign off. Those chat statements are an offer to review, not an authenticated
disposition. Do not check or populate any approval field until the exact candidate below is frozen
and the reviewer supplies their preferred name, credentials, scope, date, and exact-version
decision through the approved attestation process.

## 1. Exact candidate identity

| Field                                      | Frozen value                                        |
| ------------------------------------------ | --------------------------------------------------- |
| Candidate ID                               | `[pending baxter-crrt-rc-v2-sha256-<64 lowercase>]` |
| Candidate-manifest SHA-256                 | `[pending]`                                         |
| Git repository / branch or tag             | `[pending]`                                         |
| Git commit                                 | `[pending]`                                         |
| Git tree OID                               | `[pending]`                                         |
| Candidate freeze timestamp and timezone    | `[pending]`                                         |
| Learner review route                       | `[pending exact URL/build]`                         |
| Reviewer-workspace route                   | `[pending exact URL/build]`                         |
| Deployment/build artifact digest           | `[pending]`                                         |
| Engine version                             | `[pending]`                                         |
| Runtime schema version                     | `[pending]`                                         |
| Protected-pilot content version            | `[pending]`                                         |
| Phase 7 reviewer-candidate content version | `[pending]`                                         |
| Phase 8 reviewer-candidate content version | `[pending]`                                         |
| PrisMax device-profile version             | `[pending]`                                         |
| Prismaflex device-profile version          | `[pending]`                                         |
| Protocol-profile version                   | `null` unless separately approved                   |
| Source-matrix revision/hash                | `[pending]`                                         |
| Local-configuration worksheet digest       | `[pending]`                                         |
| Canonical findings-ledger digest           | `[pending]`                                         |
| Test/build evidence record and digest      | `[pending]`                                         |

- [ ] I verified that every reviewed screen, case, source, score rule, and test belongs to this
      exact candidate.
- [ ] I understand that any consequential clinical, device, scoring, or source change invalidates
      this disposition until the affected material is reviewed again.

## 2. Reviewer identity and scope

| Field                                  | Reviewer entry                           |
| -------------------------------------- | ---------------------------------------- |
| Preferred full name                    | `[pending]`                              |
| Degree(s) / credentials                | `[pending]`                              |
| Critical-care specialty / board status | `[pending]`                              |
| Institutional role (optional)          | `[pending]`                              |
| Relevant CRRT experience               | `[pending]`                              |
| Conflicts of interest                  | `[pending]`                              |
| Credential-verification reference      | `[pending — no credentials stored here]` |
| Controlled-system reviewer subject ID  | `[pending]`                              |
| Assigned review-record ID and revision | `[pending]`                              |
| Evidence custodian                     | `[pending]`                              |

This reviewer should not attest to a device-manual mapping, local protocol, nursing workflow,
pharmacy/nutrition rule, accessibility conformance, translation, or publication decision unless
they are separately assigned and qualified for that independent domain.

### 2.1 Exact critical-care scope inventory

Every row requires an explicit scope and disposition. A blank row means `NOT-REVIEWED`, never
approval. Device-dependent clinical content requires the corresponding independent device review
even when the critical-care row is accepted.

| Artifact group                  | Exact IDs                                                                                                    | Scope (`IN-SCOPE`, `OUT-OF-SCOPE`, `NOT-REVIEWED`) | Disposition (`APPROVED-WITHIN-RECORDED-SCOPE`, `CHANGES-REQUIRED`, `REJECTED-WITHIN-RECORDED-SCOPE`, `ABSTAINED-OR-NOT-REVIEWED`) | Finding IDs / limits                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Protected pilot cases           | `CRRT-04`, `CRRT-10`, `CRRT-13`                                                                              | `NOT-REVIEWED`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       |                                                                              |
| Phase 7 reviewer cases          | `CRRT-01`, `CRRT-02`, `CRRT-05`, `CRRT-06`, `CRRT-07`, `CRRT-11`, `CRRT-15`                                  | `NOT-REVIEWED`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       |                                                                              |
| Manifest/protocol-blocked cases | `CRRT-03`, `CRRT-08`, `CRRT-09`, `CRRT-12`, `CRRT-14`, `CRRT-16`, `CRRT-17`, `CRRT-18`                       | `OUT-OF-SCOPE`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       | No runnable candidate exists                                                 |
| Rapid-drill previews            | `DRILL-AIR`, `DRILL-BLOOD-LEAK`, `DRILL-GAIN-LOSS`, `DRILL-BAG-SCALE`, `DRILL-POWER`                         | `NOT-REVIEWED`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       | Clinical framing only; device workflow requires device review                |
| Policy-blocked drills           | `DRILL-WRONG-SOLUTION`, `DRILL-BLOOD-RETURN`                                                                 | `OUT-OF-SCOPE`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       | No runnable candidate exists                                                 |
| Reviewer instructional tools    | `LAB-TRANSPORT`, `LAB-PRESCRIPTION`, `LAB-PREPOST-DILUTION`, `LAB-PRESSURE-LOCALIZATION`, `LAB-FLUID-LEDGER` | `NOT-REVIEWED`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       |                                                                              |
| Protocol-blocked tool           | `LAB-CITRATE-DASHBOARD`                                                                                      | `OUT-OF-SCOPE`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       | No protocol profile exists                                                   |
| Mastery composition planner     | `MASTERY-COMPOSITION-REVIEW-01`                                                                              | `NOT-REVIEWED`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       | Planner only; no runnable capstone                                           |
| Phase 8 transfer framing        | `TRANSFER-PRISMAX-PRISMAFLEX-01`                                                                             | `NOT-REVIEWED`                                     | `ABSTAINED-OR-NOT-REVIEWED`                                                                                                       | Shared clinical goals only; excludes device fidelity and numeric equivalence |

### 2.2 Mandatory exclusions from this record

- PrisMax or Prismaflex controls, setup, pump/clamp/scale behavior, alarms, stop/end, blood-return,
  configuration, or device fidelity.
- Cross-device numeric equivalence, outcome tolerances, or device-action correspondence.
- Local anticoagulation, citrate/calcium, solution, set, escalation, nursing, or competency policy.
- Accessibility conformance, localization, privacy/data governance, entitlement/security, product or
  pilot authorization, and publication.
- Pharmacy/nutrition content unless separately assigned with the appropriate qualifications and a
  separate domain record.

## 3. Critical-care review checklist

- [ ] Goals and indications are framed from the whole simulated clinical context and trends, not
      one isolated number or a universal start threshold.
- [ ] Every exact patient value, time, flow, coefficient, tolerance band, success condition,
      accepted alternative, unsafe action, critical-error candidate, and score trigger is visibly
      synthetic and traceable to the matching `SYNTH-CRRT-xx` or `SYNTH-LAB-*` record for the
      reviewed case/tool.
- [ ] Candidate guidance and trials are used only within their documented limitations; study arms,
      eligibility criteria, and protocol values are not converted into patient-specific rules.
- [ ] Modality, delivered-dose, fluid-balance, and hemodynamic reasoning remain clinically
      plausible for professional education without claiming one universally correct prescription.
- [ ] Machine patient-fluid removal remains distinct from whole-patient inputs, outputs, balance,
      and simulated tolerance.
- [ ] Immediate circuit/device effects remain distinct from delayed simulated physiology and
      laboratory response.
- [ ] Required reassessment, monitoring, communication, and escalation are represented without
      inventing local policy or unsourced device behavior.
- [ ] Accepted alternative paths reach the same reviewed physiologic and safety endpoint without
      exact-setting matching.
- [ ] Unsafe and critical-error candidates are proportionate, explicitly sourced or synthetic,
      independently testable, and not inferred from a generic alarm label.
- [ ] Debriefs explain the causal chain and direct transfer only to supervised local practice.
- [ ] No patient-specific advice, autonomous treatment recommendation, competency certification,
      publication approval, or local-protocol approval is implied.
- [ ] `CRRT-09` and `CRRT-17` remain protocol-blocked; citrate/calcium dosing, targets, adjustments,
      monitoring intervals, and escalation stay absent without a versioned approved local profile.
- [ ] The Pressure Localization Lab exposes synthetic obstruction patterns only; every
      disconnection selection/model remains disabled and no alarm threshold, device reaction, or
      corrective sequence is implied.

## 4. Per-item findings

| Finding ID  | Case/tool | Severity | Source/code/test location | Required change | Owner | Resolution/retest | State  |
| ----------- | --------- | -------- | ------------------------- | --------------- | ----- | ----------------- | ------ |
| `[pending]` |           |          |                           |                 |       |                   | `open` |

- [ ] All critical and stop-level findings are resolved and independently retested.
- [ ] Remaining findings have an explicit owner and accepted risk disposition.
- [ ] Consequential changes reset the affected review status before re-review.

## 5. Exact-version disposition

Select exactly one:

- [ ] `APPROVED-WITHIN-RECORDED-SCOPE`
- [ ] `CHANGES-REQUIRED`
- [ ] `REJECTED-WITHIN-RECORDED-SCOPE`
- [ ] `ABSTAINED-OR-NOT-REVIEWED`

This scope companion never writes a runtime disposition. Coordinator ingestion must use the
canonical domain record and mapping: approved within scope becomes `reviewStatus: approved` plus
`exactVersionDisposition: accepted`; changes required becomes `changes-required`; rejection becomes
`rejected`; abstention remains null/pending. Every other candidate and attestation field must also
pass independently.

Exact disposition statement and residual limitations: `[pending]`

Reviewer preferred name and credentials: `[pending]`

Authentication provider / method: `[pending]`

Authenticated attestation receipt ID: `[pending]`

Attestation artifact SHA-256: `[pending]`

Credential-verification reference repeated: `[pending]`

Signature or authenticated attestation statement: `[pending]`

Date and timezone: `[pending]`

Candidate identity repeated verbatim: `[pending]`

Candidate-manifest SHA-256 repeated verbatim: `[pending]`

Attestation revocation/supersession state: `active only after completion; otherwise pending`

Until this section is complete, the critical-care review requirement remains `pending` with
`reviewer: null`, `exactCandidateIdentity: null`, and `exactVersionDisposition: null`.
