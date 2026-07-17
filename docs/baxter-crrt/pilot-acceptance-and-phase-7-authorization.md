# Baxter CRRT pilot acceptance and Phase 7 authorization record

Record status: `pending / inactive`

Governance role: `legacy planning companion only — not a canonical review or authorization record`

Formal decisions must use the candidate-bound [canonical review packet](./review-packet/README.md),
one [domain review record](./review-packet/domain-review.template.md) per domain, and the separate
[pilot](./review-packet/authorizations/pilot-acceptance.template.md) and
[Phase 7](./review-packet/authorizations/phase-7.template.md) authorization templates. Do not collect
signatures, authenticated receipts, or formal decisions in this legacy companion.

Current decision values:

```yaml
pilot_disposition: pending
phase_7_authorized: false
publication_authorized: false
competency_use_authorized: false
```

This is a fail-closed decision record for the exact three-case PrisMax pilot. Empty fields,
unchecked boxes, `pending`, a dirty working tree, a mismatched version, or an unresolved stop-level
finding all mean **pilot acceptance has not occurred and Phase 7 is not authorized**.

Pilot acceptance and Phase 7 authorization are separate decisions. Neither decision authorizes
publication, certification, independent clinical/device competence, citrate dosing, Prismaflex,
or use for patient care.

## Development direction received — not a formal disposition

On 2026-07-16, the repository user explicitly authorized moving to Phase 7 draft development and
stated that they are a critical care physician. This records development direction only. The user's
name, professional credentials, institutional role, review scope, signature, and disposition for an
exact frozen build have not been supplied or verified.

This statement does not constitute pilot acceptance, a critical-care clinical review disposition,
publication approval, formal product-owner authorization under section 7, or approval for
nephrology, nursing, PrisMax device, accessibility, localization, privacy/data, entitlement,
pharmacy, nutrition, or any other reviewer domain. No checkbox or decision value changes as a
result; `pilot_disposition` remains `pending` and `phase_7_authorized` remains `false`.

| Development-direction field    | Recorded value                                     | Formal disposition                                           |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------ |
| Date                           | `2026-07-16`                                       | None                                                         |
| Direction                      | Proceed with Phase 7 draft development             | Not pilot acceptance or formal Phase 7 authorization         |
| Self-stated role               | Critical care physician                            | Identity, credentials, scope, and exact-build review pending |
| Candidate reviewed             | `[pending — no frozen exact candidate identified]` | None                                                         |
| Effect on formal review matrix | No entry or checkbox changed                       | All required domains remain pending                          |

The implemented fail-closed registry, progress, and Mastery boundaries are documented in
[phase-7-status.md](./phase-7-status.md). Their presence does not change this decision record.

## 1. Candidate identity — required before review

The review coordinator must freeze a clean, immutable candidate before collecting dispositions.

| Field                                                                                       | Exact candidate value                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Deterministic candidate ID                                                                  | `[pending baxter-crrt-rc-v2-sha256-<64 lowercase>]`                             |
| Candidate-manifest artifact and SHA-256                                                     | `[pending]`                                                                     |
| Git commit SHA                                                                              | `[pending — must identify a clean committed revision]`                          |
| Git tree OID                                                                                | `[pending]`                                                                     |
| Repository/branch or release tag                                                            | `[pending]`                                                                     |
| Build/deployment identifier                                                                 | `[pending]`                                                                     |
| Learner review route                                                                        | `/[locale]/baxter-crrt`                                                         |
| Guarded reviewer-workspace route                                                            | `/[locale]/baxter-crrt/review`                                                  |
| Review environment and access cohort                                                        | `[pending]`                                                                     |
| Candidate freeze date/time and timezone                                                     | `[pending]`                                                                     |
| Engine version                                                                              | `0.4.0-phase7-review`                                                           |
| Authored/runtime schema version                                                             | `1.1.0-phase7-draft`                                                            |
| Pilot content/progress version                                                              | `0.5.0-pilot-draft.1`                                                           |
| Phase 7 manifest content version                                                            | `0.7.0-phase7-draft.2`                                                          |
| Phase 8 reviewer content version                                                            | `0.8.0-prismaflex-review-draft.1`                                               |
| Progress DTO/key                                                                            | v2 / `baxter-crrt-progress-v2`; v1 not migrated                                 |
| PrisMax profile version                                                                     | `prismax-aw8035-rb-2xx-draft.2`                                                 |
| Prismaflex profile                                                                          | `prismaflex-g5036003-r05-6xx-review-candidate.1` — reviewer-only / non-runnable |
| Local citrate/calcium protocol profile                                                      | `null` — actionable citrate remains disabled                                    |
| Source-matrix file SHA-256                                                                  | `[pending]`                                                                     |
| Clinical checklist file SHA-256                                                             | `[pending]`                                                                     |
| PrisMax checklist file SHA-256                                                              | `[pending]`                                                                     |
| Accessibility checklist file SHA-256                                                        | `[pending]`                                                                     |
| [PrisMax local-configuration worksheet](./prismax-local-configuration-worksheet.md) SHA-256 | `[pending]`                                                                     |
| Canonical findings-ledger SHA-256                                                           | `[pending]`                                                                     |
| Automated validation log/artifact                                                           | `[pending]`                                                                     |
| Browser/assistive-technology evidence artifact                                              | `[pending]`                                                                     |

Source artifact identities to reverify for this candidate:

| Source                                      | Required SHA-256                                                   | Verified by/date                              |
| ------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| PrisMax AW8035 Rev B manual                 | `204543b8c205e535cb9d45c970b8231362839177f3795b6164edcef3b834f1ff` | `[pending]`                                   |
| Prismaflex G5036003 Revision 05.2011 manual | `6d311624ec075c86ff539d3a86f3ed77cd2ca467346168ee4985af09f0a9224b` | `[pending — Phase 8 source only]`             |
| PrisMax Nordic 2023 supporting sheet        | `3265a60a947617a80628549cde84dc9a9d7e10c50d8a8b56be8acb63317b501d` | `[pending — supporting/market-specific only]` |
| CRRT coding instructions                    | `4a4176163e6b5a96d2133a604cc2a1bed4221d1d09d218e1d8c9f17b58d79436` | `[pending]`                                   |

- [ ] Candidate commit exists and the reviewed working tree is clean.
- [ ] The candidate manifest was generated and verified using the
      [exact-candidate freeze procedure](./review-candidate-freeze-procedure.md).
- [ ] All version values above match the running review build and generated evidence.
- [ ] The exact [local PrisMax configuration worksheet](./prismax-local-configuration-worksheet.md)
      is complete and signed by the device reviewer.
- [ ] The exact [Phase 7 protected-foundation status](./phase-7-status.md), catalogs, blockers, and
      source/evidence integrity match the running candidate.
- [ ] Draft authentication, unlisted status, noindex metadata, and cohort access are verified.
- [ ] Any change after candidate freeze has created a new candidate and reset affected reviews.

## 2. Legacy review planning index — not accepted as an attestation

Each row points to a separate canonical domain record. Values in this table remain planning notes;
they cannot satisfy the runtime gate because this legacy format does not bind the required scope
digest, receipt ID, attestation hash, and normalized disposition. One reviewer cannot approve
another domain.

| Required domain                                                    | Reviewer name and qualifications | Review date | Exact candidate verified | Disposition (`pending`, `changes-required`, `accepted`) | Finding IDs / notes                               |
| ------------------------------------------------------------------ | -------------------------------- | ----------- | ------------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| CRRT nephrology                                                    | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| Critical care medicine                                             | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| CRRT nurse education/operation                                     | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| PrisMax-trained device review                                      | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| Accessibility                                                      | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| Clinical localization / reviewed-English boundary                  | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| Privacy/data governance                                            | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| Pilot entitlement/security operations                              | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| Product/pilot operations                                           | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               |                                                   |
| Publication approval under the current activation contract         | `[pending]`                      | `[pending]` | `[ ]`                    | `pending`                                               | Separate publication authorization still required |
| Pharmacist, if medication-clearance content is proposed            | `[pending applicability record]` | `[pending]` | `[ ]`                    | `pending`                                               | Absence is not an implicit N/A decision           |
| Nutrition specialist, if nutrition/electrolyte content is proposed | `[pending applicability record]` | `[pending]` | `[ ]`                    | `pending`                                               | Absence is not an implicit N/A decision           |

An `accepted` entry means only that the named reviewer accepts the exact pilot within their recorded
scope. It does not change a source record or release state unless the corresponding canonical domain
record, authenticated attestation, checklist, and finding evidence are complete. Conditional-domain
applicability must be resolved by a named, candidate-bound record; this legacy table cannot infer
`not-applicable` from absent content.

## 3. Required review evidence

- [ ] The [clinical review checklist](./clinical-review-checklist.md) is complete for all three cases.
- [ ] The [PrisMax device review checklist](./prismax-device-review-checklist.md) is complete for the exact local configuration.
- [ ] The [accessibility and release checklist](./accessibility-release-checklist.md) includes the approved browser/OS/assistive-technology matrix, 200% zoom, 320-pixel reflow, tablet, reduced-motion, contrast, and keyboard results.
- [ ] The [engine validation record](./engine-validation.md) matches this candidate and all consequential tests pass.
- [ ] Every implemented numeric value, condition band, accepted path, unsafe action, critical-error candidate, device action, score trigger, hint, and debrief is mapped to an authoritative source or a clearly labeled synthetic record with a named reviewer.
- [ ] `CRRT-04`, `CRRT-10`, and `CRRT-13` required, accepted-alternative, unsafe, critical, replay, clean-state, and UI paths are reviewed and pass.
- [ ] Alarm acknowledgement remains distinct from fault correction in both engine behavior and learner feedback.
- [ ] Prescribed/delivered dose and machine-PFR/whole-patient balance remain distinct.
- [ ] No PHI, free-text reasoning, detailed action log, trend array, or screenshot enters CRRT progress or analytics.
- [ ] The reviewed-English fallback and translation boundary are accepted.

## 4. Findings and resolution ledger

Every clinical, device, accessibility, privacy, localization, or product finding receives a stable
ID. A critical or stop-level finding cannot be accepted as residual risk.

| Finding ID  | Domain | Severity | Affected source/case/path/file | Required change | Owner | Resolution evidence | Retest/reviewer | State  |
| ----------- | ------ | -------- | ------------------------------ | --------------- | ----- | ------------------- | --------------- | ------ |
| `[pending]` |        |          |                                |                 |       |                     |                 | `open` |

- [ ] All critical, stop-level, and high-severity findings are resolved and independently retested.
- [ ] Remaining findings have an explicit owner, due date, and product risk disposition.
- [ ] Consequential changes reset affected source/review records to `pending` before re-review.
- [ ] The final finding ledger is attached to the exact candidate identity in section 1.

## 5. Pilot operations and data disposition

| Decision                                                        | Approved value / evidence |
| --------------------------------------------------------------- | ------------------------- |
| Pilot purpose and success/failure questions                     | `[pending]`               |
| Participant roles and target distribution                       | `[pending]`               |
| Recruitment/compensation                                        | `[pending]`               |
| Institutional QI/research/privacy/legal/IRB determination       | `[pending]`               |
| Participant notice/consent                                      | `[pending]`               |
| Pilot entitlement/cohort mechanism                              | `[pending]`               |
| Supported browser/AT matrix                                     | `[pending]`               |
| Telemetry fields and lawful/approved purpose                    | `[pending]`               |
| Identity association and aggregation rules                      | `[pending]`               |
| Data retention, access, export, deletion, and incident response | `[pending]`               |
| Open-comment storage and redaction process                      | `[pending]`               |
| Support, escalation, pause, and restart owners                  | `[pending]`               |
| Reviewed-English/localization boundary                          | `[pending]`               |
| Intended learner roles                                          | `[pending]`               |
| Local competency use                                            | `not authorized`          |

- [ ] The [pilot study plan](./pilot-study-plan.md) is approved for the exact candidate.
- [ ] The [pilot feedback form](./pilot-feedback-form.md) is approved for the specified storage and data plan.
- [ ] Pilot results and denominators are attached without unsupported competence, efficacy, or patient-outcome claims.
- [ ] Every pause/stop event and participant exposure after a serious finding is documented.

## 6. Formal pilot disposition

This section is retained only as historical planning structure. Record an operative pilot decision
in the canonical pilot-acceptance authorization template; a selection here has no gate effect.

Select exactly one disposition after sections 1-5 are complete:

- [ ] `REJECTED` — The pilot is not accepted; the candidate must not advance.
- [ ] `REVISE-AND-REPEAT` — Changes and another exact-version pilot are required.
- [ ] `ACCEPTED-FOR-PHASE-7-DECISION` — Required reviewers accept the pilot within their scopes; this is not yet Phase 7 authorization.

Pilot lead: `[pending name/role/signature/date]`

Product owner acknowledgement of pilot disposition: `[pending name/signature/date]`

Summary of evidence and residual limitations: `[pending — approved record location]`

Until the third box is selected with complete evidence, `pilot_disposition` remains `pending` and
Phase 7 stays closed.

## 7. Separate Phase 7 authorization

This section is retained only as historical planning structure. Record an operative decision in
the canonical Phase 7 authorization template; a selection or signature here has no gate effect.

The product owner completes this section only after the formal pilot disposition is
`ACCEPTED-FOR-PHASE-7-DECISION`.

- [ ] I verified the exact candidate identity and all required reviewer dispositions.
- [ ] I verified all stop-level findings are closed and affected reviews were repeated after changes.
- [ ] I approve the exact scope of Phase 7 work listed below; unlisted work remains unauthorized.
- [ ] I understand this decision does not authorize publication, competency certification, citrate without a local protocol, or Prismaflex.

Authorized Phase 7 learner/pilot activation scope (select and describe each approved item). Pending
reviewer-only prototypes may exist before these boxes are selected; they remain isolated and cannot
enter learner runtime, saved progress, competency, publication, or formal activation:

- [ ] All 15 nonpilot PrisMax cases for learner activation, with per-case clinical/device/source review.
- [ ] Rapid safety drills, with per-drill device/alarm/cause-action review.
- [ ] Mastery capstone, with reviewed mechanisms, accepted alternatives, critical errors, and scoring.
- [ ] Transport Mechanism Lab.
- [ ] Full Prescription Workbench.
- [ ] Pressure Localization Lab.
- [ ] Pre/post-dilution experiment.
- [ ] Expanded fluid-balance and time-control tools.
- [ ] Systemic anticoagulation content under the approved approach: `[pending / not authorized]`.
- [ ] Citrate-calcium pathway under versioned local protocol ID: `[pending / not authorized]`.
- [ ] Other explicitly bounded scope: `[pending]`.

Product owner authorization decision:

- [ ] `PHASE-7-NOT-AUTHORIZED`
- [ ] `PHASE-7-AUTHORIZED-AS-SCOPED-ABOVE`

Product owner: `[pending name/title/signature/date]`

Formal activation effective date: `[pending]`

Review checkpoint and stop conditions: `[pending]`

Until `PHASE-7-AUTHORIZED-AS-SCOPED-ABOVE` is selected, signed, and tied to the exact accepted pilot,
`phase_7_authorized` remains `false`.

## 8. Invalidation and re-review rules

The acceptance/authorization record becomes invalid for affected domains when any of the following
changes after signature:

- Git commit, engine, schema, content, device profile, protocol profile, or source-matrix identity.
- Patient/circuit model coefficients, values, conditions, time behavior, or deterministic seed logic.
- Case action, accepted alternative, unsafe/critical rule, score, hint, reassessment, or debrief.
- Device workflow, calculation, display correction, pressure/alarm mapping, stop/end, or clean-state behavior.
- Supported market/software/configuration, sets, accessories, solutions, Auto Effluent, or local policy.
- Accessibility semantics, focus, reflow, motion, safety announcements, or supported browser/AT matrix.
- Progress, analytics, entitlement, identity association, retention, or pilot data handling.
- Translation, learner role, competency language, disclaimer, discoverability, or publication state.
- A new source conflict, serious adverse finding, privacy incident, or reproducibility failure.

The product owner and affected reviewer must document the invalidation scope, reset the applicable
dispositions to `pending`, retest the exact new candidate, and issue a new signed record.

## 9. Downstream boundaries

Phase 7 authorization does not establish a stable reviewed PrisMax v1. Phase 8 remains closed until
the full PrisMax curriculum, rapid drills, Mastery, instructional tools, and their exact-version
reviews are accepted and the separate Prismaflex configuration/reviewer/equivalence prerequisites
are complete.

Publication remains a separate exact-version decision after all applicable clinical, device,
accessibility, localization, privacy, entitlement, product, and release approvals.
