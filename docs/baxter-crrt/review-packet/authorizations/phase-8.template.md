# Baxter CRRT Phase 8 authorization template

Status: `TEMPLATE ONLY — PHASE 8 NOT AUTHORIZED`

This record authorizes only explicitly itemized Prismaflex and cross-device transfer artifacts. A
critical-care, PrisMax, or Prismaflex review alone cannot authorize Phase 8. Phase 8 authorization
does not publish the module or establish competency.

## 1. Record, Phase 8 candidate, and stable PrisMax prerequisite

| Field                                                   | Required exact value              |
| ------------------------------------------------------- | --------------------------------- |
| Authorization record ID/revision                        | `[pending]`                       |
| Packet ID                                               | `[pending]`                       |
| Phase 8 candidate ID                                    | `[pending]`                       |
| Phase 8 candidate-manifest SHA-256                      | `[pending]`                       |
| Candidate freeze eligibility                            | `[must be eligible-clean-commit]` |
| Full Git commit/build/deployment IDs and hashes         | `[pending]`                       |
| Exact learner/reviewer URLs and locale(s)               | `[pending]`                       |
| Findings-ledger ID/revision/SHA-256                     | `[pending]`                       |
| Stable reviewed PrisMax v1 candidate ID                 | `[pending]`                       |
| Stable PrisMax candidate-manifest SHA-256               | `[pending]`                       |
| PrisMax v1 activation/publication record IDs and hashes | `[pending]`                       |
| Phase 8 authorization-scope digest                      | `[pending]`                       |

“Stable PrisMax v1” is not a prose assertion; every reference above must resolve to an immutable,
approved candidate and the exact PrisMax profile used by the transfer comparison.

## 2. Prerequisite gate

- [ ] The target Prismaflex market, installed software, configuration, therapies, sets, accessories,
      solutions, anticoagulation options, flow ranges/increments, alarms, and local workflows are
      documented in an exact approved profile.
- [ ] Separate authenticated `prismax-device` and `prismaflex-device` records approve their own exact
      profiles; neither record is treated as approving the other.
- [ ] `CLIN` records approve only the clinical content included below.
- [ ] Every domain record binds the exact candidate ID, candidate-manifest SHA-256, canonical
      findings-ledger SHA-256, and expected domain-specific scope SHA-256 and has a valid
      authenticated receipt.
- [ ] An authenticated `cross-device-equivalence` record approves the exact canonical-state/action
      protocol and declared numeric tolerances.
- [ ] `CONFLICT-010` and every other affected formula/source conflict has an explicit disposition.
- [ ] Every selected setup, calculation, pressure, alarm, stop/end, case, alternative, unsafe path,
      critical error, scoring rule, reassessment, and debrief has all required domain reviews.
- [ ] `A11Y`, the single `L10N` gate record itemizing every released locale/corpus, `DATA`, `ACCESS`,
      and `PRODUCT` match the exact Phase 8 scope.
- [ ] An accepted `publication-approval` domain record matches the exact Phase 8 candidate, as
      required by the current activation contract; it does not replace the separate publication
      authorization.
- [ ] The canonical ledger is complete with no open `stop`, `critical`, or `high` finding affecting
      selected scope.
- [ ] Protocol-gated anticoagulation/citrate behavior remains unavailable unless exact `PROTO` and
      applicable `PHARM` records are attached.

## 3. Itemized Phase 8 authorization scope

Every row begins unauthorized. “Prismaflex approved” is not a valid substitute for row-level scope.

| Artifact ID/surface                            | Requested state (`not-authorized` or `authorized`) | Required domain-record IDs/hashes | Limits/exclusions                                                                            |
| ---------------------------------------------- | -------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `prismaflex-g5036003-6xx` exact target profile | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                                                  |
| Prismaflex calculation adapter                 | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                                                  |
| Prismaflex setup/navigation workflow           | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                                                  |
| Prismaflex alarm/help workflow                 | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                                                  |
| Prismaflex stop/end/blood-disposition workflow | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                                                  |
| Prismaflex learner interface                   | `not-authorized`                                   | `[pending]`                       | `[pending]`                                                                                  |
| `TRANSFER-PRISMAX-PRISMAFLEX-01`               | `not-authorized`                                   | `[pending]`                       | Exact runtime, schedule, tolerance, scoring, reassessment, and clean-state behavior required |
| Transfer domain `setup-navigation`             | `not-authorized`                                   | `[pending]`                       | Matching goals do not imply matching screens/workflow                                        |
| Transfer domain `prescription-display`         | `not-authorized`                                   | `[pending]`                       | Formula contexts and numeric tolerance must be explicit                                      |
| Transfer domain `pressure-translation`         | `not-authorized`                                   | `[pending]`                       | Device values/limits are not interchangeable clinical normals                                |
| Transfer domain `fluid-accounting`             | `not-authorized`                                   | `[pending]`                       | Device fluid values do not equal whole-patient balance                                       |
| Transfer domain `alarm-taxonomy`               | `not-authorized`                                   | `[pending]`                       | Category/acknowledgement does not prove cause correction                                     |

Exact Prismaflex learner case IDs, if any: `[pending explicit allowlist; empty means none authorized]`

Analytics/progress state: `[pending exact allowlist or not-authorized]`

Competency-credit state: `not-authorized` unless separately and explicitly approved: `[pending]`

## 4. Phase 8 authorization decision

Select exactly one. Zero or multiple selections means `PHASE-8-NOT-AUTHORIZED`.

- [ ] `PHASE-8-NOT-AUTHORIZED`
- [ ] `PHASE-8-AUTHORIZED-ONLY-AS-ITEMIZED-ABOVE`

Decision repeated verbatim: `[pending]`

Effective date/time/timezone, expiration, review checkpoint, and stop conditions: `[pending]`

## 5. Authenticated product authorization

| Field                                                         | Required value                    |
| ------------------------------------------------------------- | --------------------------------- |
| Product owner controlled subject ID/name/title                | `[pending]`                       |
| Approved attestation system                                   | `[pending]`                       |
| Attestation receipt ID and receipt/signature SHA-256          | `[pending]`                       |
| Receipt Phase 8 candidate ID/manifest SHA-256                 | `[pending; must match section 1]` |
| Receipt stable PrisMax candidate ID/manifest SHA-256          | `[pending; must match section 1]` |
| Receipt authorization-scope digest and findings-ledger digest | `[pending; must match section 1]` |
| Receipt decision and signed date/time/timezone                | `[pending]`                       |

> I authorize only the exact Phase 8 items marked `authorized` in this record. This decision does not
> expand either device review, approve an omitted transfer domain, establish an undeclared
> equivalence, publish the module, award competency, or authorize patient-care use.

- [ ] The authenticated receipt contains or cryptographically binds the complete statement above.

Until the authorized decision and valid receipt are present, `phase8Authorized` remains `false`.
