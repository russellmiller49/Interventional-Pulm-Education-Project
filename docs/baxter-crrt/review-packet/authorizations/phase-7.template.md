# Baxter CRRT Phase 7 authorization template

Status: `TEMPLATE ONLY — PHASE 7 NOT AUTHORIZED`

This record authorizes only explicitly selected PrisMax Phase 7 items for the exact candidate. It
does not approve content, substitute for a domain review, authorize Prismaflex/Phase 8, publish the
module, or award competency credit.

## 1. Record and candidate binding

| Field                                          | Required exact value              |
| ---------------------------------------------- | --------------------------------- |
| Authorization record ID/revision               | `[pending]`                       |
| Packet ID                                      | `[pending]`                       |
| Candidate ID                                   | `[pending]`                       |
| Candidate-manifest SHA-256                     | `[pending]`                       |
| Candidate freeze eligibility                   | `[must be eligible-clean-commit]` |
| Full Git commit                                | `[pending]`                       |
| Build/deployment IDs and hashes                | `[pending]`                       |
| Exact learner/reviewer URLs and locale(s)      | `[pending]`                       |
| Findings-ledger ID/revision/SHA-256            | `[pending]`                       |
| Accepted pilot authorization record ID/SHA-256 | `[pending]`                       |
| Authorization scope digest                     | `[pending]`                       |

## 2. Prerequisite gate

- [ ] The protected pilot has the exact accepted disposition required for a Phase 7 decision.
- [ ] Every selected artifact has all required domain records from the scope-domain matrix.
- [ ] Every domain record binds the exact candidate ID, candidate-manifest SHA-256, canonical
      findings-ledger SHA-256, and expected domain-specific scope SHA-256 and has a valid
      authenticated receipt.
- [ ] The exact local PrisMax configuration/profile is approved for every selected device behavior.
- [ ] Every protocol, pharmacy, nutrition, or specialty applicability decision is resolved.
- [ ] The canonical ledger is complete with no open `stop`, `critical`, or `high` finding affecting
      selected scope.
- [ ] Accessibility, localization, privacy/data, entitlement/security, and product/pilot operations
      approve the exact selected scope.
- [ ] An accepted `publication-approval` domain record is bound to this candidate, as required by
      the current activation contract; the separate publication authorization remains pending
      unless independently completed.
- [ ] Tests, build, browser/AT evidence, and source/provenance evidence match the candidate.
- [ ] Mastery, competency, analytics, progress, and certificate behavior are separately and explicitly
      bounded below.

## 3. Itemized authorization scope

Every row begins unauthorized. Set a row to `authorized` only when its exact domain-record IDs and
evidence are attached. Omitting an item or authorizing a group by prose leaves it unauthorized.

### Cases

| Artifact ID | Requested state (`not-authorized` or `authorized`) | Required domain-record IDs/hashes | Limitations or excluded behavior                           |
| ----------- | -------------------------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| `CRRT-01`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-02`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-03`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-05`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-06`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-07`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-08`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-09`   | `not-authorized`                                   | `[pending]`                       | Requires exact `PROTO` and any applicable `PHARM` records  |
| `CRRT-11`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-12`   | `not-authorized`                                   | `[pending]`                       | Requires `PHARM + NUTR` while named content remains        |
| `CRRT-14`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-15`   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                |
| `CRRT-16`   | `not-authorized`                                   | `[pending]`                       | Requires `PROTO`; add `PHARM` if applicable                |
| `CRRT-17`   | `not-authorized`                                   | `[pending]`                       | Requires complete citrate/calcium `PROTO + PHARM` records  |
| `CRRT-18`   | `not-authorized`                                   | `[pending]`                       | Requires local stop/blood-return/transition `PROTO` record |

The protected pilot cases remain governed by their exact pilot record and must also be listed here if
their runtime/content is changed as part of this candidate: `[pending exact decision]`.

### Rapid drills

| Artifact ID            | Requested state  | Required domain-record IDs/hashes | Limitations                                 |
| ---------------------- | ---------------- | --------------------------------- | ------------------------------------------- |
| `DRILL-AIR`            | `not-authorized` | `[pending]`                       | `[pending]`                                 |
| `DRILL-BLOOD-LEAK`     | `not-authorized` | `[pending]`                       | `[pending]`                                 |
| `DRILL-GAIN-LOSS`      | `not-authorized` | `[pending]`                       | `[pending]`                                 |
| `DRILL-BAG-SCALE`      | `not-authorized` | `[pending]`                       | `[pending]`                                 |
| `DRILL-POWER`          | `not-authorized` | `[pending]`                       | `[pending]`                                 |
| `DRILL-WRONG-SOLUTION` | `not-authorized` | `[pending]`                       | `PROTO` and any applicable `PHARM` required |
| `DRILL-BLOOD-RETURN`   | `not-authorized` | `[pending]`                       | `PROTO` required                            |

### Instructional tools and Mastery

| Artifact ID                 | Requested state  | Required domain-record IDs/hashes | Limitations                                                                                   |
| --------------------------- | ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `LAB-TRANSPORT`             | `not-authorized` | `[pending]`                       | `[pending]`                                                                                   |
| `LAB-PRESCRIPTION`          | `not-authorized` | `[pending]`                       | `[pending]`                                                                                   |
| `LAB-PREPOST-DILUTION`      | `not-authorized` | `[pending]`                       | `[pending]`                                                                                   |
| `LAB-PRESSURE-LOCALIZATION` | `not-authorized` | `[pending]`                       | `[pending]`                                                                                   |
| `LAB-FLUID-LEDGER`          | `not-authorized` | `[pending]`                       | `[pending]`                                                                                   |
| `LAB-CITRATE-DASHBOARD`     | `not-authorized` | `[pending]`                       | Complete `PROTO + PHARM` required                                                             |
| `MASTERY-PRISMAX-01`        | `not-authorized` | `[pending]`                       | Exact runtime cases, rules, scoring, reassessment, progress, and competency boundary required |

Analytics/progress state authorized for selected items: `[pending exact allowlist or not-authorized]`

Competency-credit state: `not-authorized` unless a separate exact policy and scope are recorded here: `[pending]`

## 4. Phase 7 authorization decision

Select exactly one. Zero or multiple selections means `PHASE-7-NOT-AUTHORIZED`.

- [ ] `PHASE-7-NOT-AUTHORIZED`
- [ ] `PHASE-7-AUTHORIZED-ONLY-AS-ITEMIZED-ABOVE`

Decision repeated verbatim: `[pending]`

Effective date/time/timezone, expiration, review checkpoint, and stop conditions: `[pending]`

## 5. Authenticated product authorization

| Field                                          | Required value                    |
| ---------------------------------------------- | --------------------------------- |
| Product owner controlled subject ID/name/title | `[pending]`                       |
| Approved attestation system                    | `[pending]`                       |
| Attestation receipt ID                         | `[pending]`                       |
| Receipt/signature SHA-256                      | `[pending]`                       |
| Receipt candidate ID and manifest SHA-256      | `[pending; must match section 1]` |
| Receipt authorization-scope digest             | `[pending; must match section 1]` |
| Receipt findings-ledger digest                 | `[pending; must match section 1]` |
| Receipt decision and signed date/time/timezone | `[pending]`                       |

> I authorize only the exact Phase 7 items marked `authorized` in this record. Every omitted or
> `not-authorized` item remains unavailable. This decision does not approve another review domain,
> Phase 8, publication, competency credit, or patient-care use.

- [ ] The authenticated receipt contains or cryptographically binds the complete statement above.

Until the authorized decision and valid receipt are present, `phase7Authorized` remains `false`.
