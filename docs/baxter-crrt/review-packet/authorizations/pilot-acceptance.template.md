# Baxter CRRT protected-pilot acceptance template

Status: `TEMPLATE ONLY — PILOT NOT ACCEPTED`

This is a separate decision on the exact protected three-case pilot. Domain reviews provide evidence
within their scopes; none of them accepts the pilot. Pilot acceptance does not authorize Phase 7,
Phase 8, competency credit, publication, or patient-care use.

## 1. Record and candidate binding

| Field                                         | Required exact value              |
| --------------------------------------------- | --------------------------------- |
| Authorization record ID/revision              | `[pending]`                       |
| Packet ID                                     | `[pending]`                       |
| Candidate ID                                  | `[pending]`                       |
| Candidate-manifest SHA-256                    | `[pending]`                       |
| Candidate freeze eligibility                  | `[must be eligible-clean-commit]` |
| Full Git commit                               | `[pending]`                       |
| Build artifact ID/SHA-256                     | `[pending]`                       |
| Deployed review build ID                      | `[pending]`                       |
| Learner and reviewer review URLs              | `[pending]`                       |
| Exact locale(s)                               | `[pending]`                       |
| Findings-ledger ID/revision/SHA-256           | `[pending]`                       |
| Pilot plan and feedback-form revisions/hashes | `[pending]`                       |
| Scope digest for this authorization           | `[pending]`                       |

Any mismatch leaves this record `pending` and invalid for acceptance.

## 2. Exact pilot scope

| Artifact             | Included in requested pilot acceptance | Required reviewed behavior/evidence                                                                               | State          |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------- |
| `CRRT-04`            | `[pending yes/no]`                     | All safe, accepted-alternative, unsafe, critical, score, reassessment, debrief, clean-state, device, and UI paths | `not-accepted` |
| `CRRT-10`            | `[pending yes/no]`                     | All safe, accepted-alternative, unsafe, critical, score, reassessment, debrief, clean-state, device, and UI paths | `not-accepted` |
| `CRRT-13`            | `[pending yes/no]`                     | All safe, accepted-alternative, unsafe, critical, score, reassessment, debrief, clean-state, device, and UI paths | `not-accepted` |
| `prismax-aw8035-2xx` | `[pending yes/no]`                     | Exact pilot device-profile identity, target configuration, displays, calculations, and bounded device behavior    | `not-accepted` |

These four rows are the runtime's closed protected-pilot artifact allowlist. No other case, device
profile, drill, tool, Mastery artifact, Prismaflex artifact, or protocol pathway is included.

## 3. Required exact-candidate domain records

Enter one row per record and its digest. A review record must have
`APPROVED-WITHIN-RECORDED-SCOPE`, cover all three pilot cases and the protected PrisMax profile where
applicable, bind to this exact candidate ID, candidate-manifest digest, canonical findings-ledger
digest, and expected domain-specific scope digest, and have a valid authenticated attestation
receipt.

| Required domain                      | Review-record ID/SHA-256 | Authenticated receipt ID/hash | Exact scope confirmed | Disposition valid |
| ------------------------------------ | ------------------------ | ----------------------------- | --------------------- | ----------------- |
| `nephrology`                         | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `critical-care`                      | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `crrt-nurse-education`               | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `prismax-device`                     | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `accessibility`                      | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `localization` for each pilot locale | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `privacy-data-governance`            | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `entitlement-security`               | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |
| `product-owner`                      | `[pending]`              | `[pending]`                   | `[ ]`                 | `[ ]`             |

Conditional domain/applicability records: `[pending; do not infer not applicable]`

## 4. Findings and pilot-operations gate

- [ ] The canonical ledger is complete and all review notes are reconciled.
- [ ] No open `stop`, `critical`, or `high` finding affects the pilot.
- [ ] Every residual medium/low finding has an owner, due date, affected-domain disposition, and
      product risk disposition.
- [ ] The exact participant roles, inclusion/exclusion, supervision, recruitment, notice/consent, and
      compensation decisions are approved.
- [ ] Institutional QI/research/privacy/legal/IRB applicability is documented by its responsible owner.
- [ ] The exact entitlement/cohort, access duration, support, withdrawal, pause, incident, and rollback
      procedures are approved.
- [ ] The exact telemetry/progress fields, purpose, identity association, retention, access, export,
      deletion, and incident response are approved.
- [ ] The supported browser/OS/assistive-technology matrix and reviewed locale boundary match the
      candidate.
- [ ] No certificate or wording implies independent clinical or device competence.

## 5. Pilot disposition

Select exactly one. Zero or multiple selections means `PENDING-NOT-ACCEPTED`.

- [ ] `PILOT-REJECTED`
- [ ] `PILOT-REVISE-AND-REPEAT`
- [ ] `PILOT-ACCEPTED-FOR-SEPARATE-PHASE-7-DECISION`

Disposition repeated verbatim: `[pending]`

Evidence summary and residual limitations: `[pending]`

Pilot effective window and stop/review checkpoints: `[pending]`

## 6. Authenticated authorization attestations

Both receipts must bind the candidate ID, candidate-manifest digest, authorization scope digest,
findings-ledger digest, disposition, and signed timestamp.

| Required authorizer | Controlled subject ID/name/role | Attestation system | Receipt ID and receipt/signature SHA-256 | Signed date/time/timezone |
| ------------------- | ------------------------------- | ------------------ | ---------------------------------------- | ------------------------- |
| Pilot lead          | `[pending]`                     | `[pending]`        | `[pending]`                              | `[pending]`               |
| Product/pilot owner | `[pending]`                     | `[pending]`        | `[pending]`                              | `[pending]`               |

> I accept or decline only the exact protected pilot scope recorded here. This decision does not
> authorize Phase 7 or Phase 8 activation, publication, competency credit, a protocol pathway, or
> approval in any reviewer domain.

- [ ] Each receipt contains or cryptographically binds the complete statement above.

Until every required field and receipt is valid and the accepted disposition is selected,
`pilotAccepted` remains `false`.
