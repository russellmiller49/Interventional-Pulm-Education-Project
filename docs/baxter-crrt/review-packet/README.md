# Baxter CRRT canonical review packet

Status: `template only / no candidate frozen / no review or authorization recorded`

This directory defines the authoritative structure for exact-candidate CRRT review and authorization.
It does not itself contain an approval. Blank fields, unchecked boxes, a template file, an empty
findings array, a missing attestation receipt, a dirty candidate, a candidate-ID mismatch, or a
missing required domain always means **not approved and not authorized**.

## 1. What is and is not an approval

The following are evidence or review aids only:

- status documents, engineering validation logs, source matrices, and provenance registries;
- clinical, device, accessibility, localization, or configuration checklists;
- automated tests, builds, screenshots, browser runs, and assistive-technology notes;
- pilot plans, feedback forms, reviewer comments, chat messages, or development directions; and
- completed technical work, reviewer-only previews, or a route that is accessible after sign-in.

An approval exists only when all of the following are true:

1. a clean, immutable candidate manifest has `freezeEligibility: eligible-clean-commit`;
2. the candidate manifest file has a recorded SHA-256 digest;
3. a domain record identifies the same candidate ID, manifest digest, canonical findings-ledger
   digest, and expected domain-specific scope digest;
4. the record lists the exact included artifacts and explicit exclusions;
5. all stop, critical, and otherwise blocking findings for that scope are closed and retested;
6. the reviewer records one allowed disposition within their assigned domain;
7. an authenticated attestation receipt binds the reviewer subject, domain, candidate ID, manifest
   digest, canonical findings-ledger digest, domain-specific scope digest, disposition, and signed
   timestamp; and
8. the separate authorization required for the intended next state is complete.

Clinical or device review does not activate a learner artifact. Pilot acceptance does not authorize
Phase 7. Phase 7 authorization does not authorize Phase 8. None of those decisions authorizes
publication or competency credit.

## 2. Canonical packet files

| Artifact                                                                      | Purpose                                                                                             | Approval effect while still a template                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [packet-control.template.json](./packet-control.template.json)                | Candidate, evidence, domain-record, and authorization index                                         | None; every gate is fail-closed                          |
| [scope-domain-matrix.md](./scope-domain-matrix.md)                            | Required review domains for every case, drill, tool, Mastery artifact, and Phase 8 transfer surface | None; it defines scope, not disposition                  |
| [findings-ledger.template.json](./findings-ledger.template.json)              | One canonical findings ledger for the candidate                                                     | None; an empty template is not evidence of zero findings |
| [domain-review.template.md](./domain-review.template.md)                      | Reusable exact-candidate form for one reviewer in one domain                                        | None until copied, completed, and authenticated          |
| [pilot-acceptance.template.md](./authorizations/pilot-acceptance.template.md) | Separate decision on the protected three-case pilot                                                 | None while pending                                       |
| [phase-7.template.md](./authorizations/phase-7.template.md)                   | Separate, itemized Phase 7 authorization                                                            | None while pending                                       |
| [phase-8.template.md](./authorizations/phase-8.template.md)                   | Separate, itemized Prismaflex/transfer authorization                                                | None while pending                                       |
| [publication.template.md](./authorizations/publication.template.md)           | Final exact-release publication decision                                                            | None while pending                                       |

Do not fill the template files in place. For a real review packet, copy each needed template into a
controlled candidate-specific directory, assign stable record IDs, and retain these templates
unchanged. The candidate-specific packet may be stored outside the public repository when it
contains identity, credential, or institutional evidence.

## 3. Candidate freeze and manifest procedure

1. Resolve or intentionally preserve all candidate-scope changes in a clean Git commit.
2. Generate the candidate manifest from the exact clean revision. Write it to controlled storage
   outside the repository so the manifest neither includes itself nor dirties the checkout after
   the clean-state check. The repository command
   is:

   ```bash
   npm run crrt:review-candidate -- \
     --require-clean \
     --source-dir <controlled-source-directory> \
     --output <controlled-output-path>/candidate-manifest.json
   ```

3. Calculate the SHA-256 of the generated manifest file. The manifest must remain byte-for-byte
   unchanged after this digest is recorded.
4. Configure the guarded review deployment with `BAXTER_CRRT_REVIEW_CANDIDATE_ID`,
   `BAXTER_CRRT_REVIEW_MANIFEST_SHA256`, and a controlled `BAXTER_CRRT_REVIEW_BUILD_ID`; verify that
   the route displays the same values and still says the manifest must be independently verified.
5. Record both the manifest's `candidateId` and the manifest file SHA-256 in the packet control,
   findings ledger, every domain review, and every authorization. Each domain record must also bind
   the canonical findings-ledger digest and that domain's exact review-scope digest.
6. Verify the manifest against the candidate before each review session and immediately before each
   authorization:

   ```bash
   npm run crrt:review-candidate -- \
     --require-clean \
     --source-dir <controlled-source-directory> \
     --verify <controlled-output-path>/candidate-manifest.json
   ```

7. Any consequential change creates a new candidate. Never copy a prior disposition to the new
   candidate. Record the superseded candidate and collect every affected review again.

The generated manifest is an evidence artifact, not an approval. A provisional dirty-working-tree
manifest is never signable. Verification reconstructs the recorded manifest from its own inputs and
rejects noncanonical or internally inconsistent JSON, dirty/provisional records, and any recorded
source attestation that was not verified.

## 4. Required reviewer domains

Each record covers exactly one domain. If one qualified person serves in more than one role, they
must complete a separate record and a separate authenticated attestation for each role.

| Domain ID                  | Boundary                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `nephrology`               | CRRT indications, prescription, kidney-support mechanisms, monitoring, and renal recovery within recorded scope                       |
| `critical-care`            | Whole-patient critical-care plausibility, hemodynamics, safety, reassessment, and escalation within recorded scope                    |
| `crrt-nurse-education`     | Bedside workflow, nursing operations, communication, monitoring, and educational usability within recorded scope                      |
| `prismax-device`           | Exact target PrisMax configuration, navigation, calculations, displays, alarms, and device workflows only                             |
| `prismaflex-device`        | Exact target Prismaflex configuration, navigation, calculations, displays, alarms, and device workflows only                          |
| `cross-device-equivalence` | Approved canonical-state/action protocol and declared numeric tolerances; it does not replace either device review or clinical review |
| `accessibility`            | Exact routes, locales, browsers, operating systems, assistive technologies, viewports, zoom, motion, semantics, and findings          |
| `localization`             | The complete explicitly listed released locale/corpus set and its clinical/device terminology; omitted locales remain unapproved      |
| `privacy-data-governance`  | Progress, analytics, identity association, retention, access, deletion, export, and incident handling                                 |
| `entitlement-security`     | Pilot/reviewer access cohort, authorization controls, duration, audit, support, and withdrawal                                        |
| `product-owner`            | Intended audience, supervision, competency boundary, pilot operations, support, risk ownership, and activation scope                  |
| `publication-approval`     | Final release state, discoverability, claims, disclaimers, release evidence, and rollback ownership only                              |
| `protocol-owner`           | One exact local protocol/profile, version, applicable unit/roles, and operational rules                                               |
| `pharmacy`                 | Medication, anticoagulation, solution, clearance, concentration, and pharmacy-controlled content when present                         |
| `nutrition`                | Nutrition and electrolyte content when present                                                                                        |

The current runtime-mandatory set is exactly `nephrology`, `critical-care`,
`crrt-nurse-education`, `prismax-device`, `accessibility`, `localization`,
`privacy-data-governance`, `entitlement-security`, `product-owner`, and
`publication-approval`. `prismaflex-device`, `cross-device-equivalence`, `protocol-owner`,
`pharmacy`, and `nutrition` are additional conditional packet domains when their recorded scope is
present. An accepted `publication-approval` domain record satisfies the current activation review
contract but does not replace the separate publication authorization.

The runtime domain vocabulary accepts `cross-device-equivalence`, and the Phase 8-aware activation
and publication resolvers require it together with `prismaflex-device`. Activation additionally
requires a typed Phase 8 authorization record bound to the exact candidate/manifest, findings and
scope digests, stable PrisMax candidate/manifest, prerequisite PrisMax authorization records, and
authenticated receipt metadata. Publication requires its own typed authorization bound to the
deployable artifact. These validators check normalized structure and exact bindings; a coordinator
must still authenticate every referenced identity, receipt, decision, scope, allowlist, immutable
record reference, and packet artifact before ingestion. Caller-constructed objects are not
authenticated evidence.

A reviewer may not approve another domain by implication, co-sign a blank scope, or use one broad
statement such as “all CRRT content approved.” A domain marked not applicable requires a named
applicability decision, rationale, evidence, candidate binding, and authenticated receipt from the
responsible product/domain owner.

## 5. Allowed review dispositions

Select exactly one in each completed domain record:

- `APPROVED-WITHIN-RECORDED-SCOPE`
- `CHANGES-REQUIRED`
- `REJECTED-WITHIN-RECORDED-SCOPE`
- `ABSTAINED-OR-NOT-REVIEWED`

There is no generic `approved` and no approval-with-open-conditions state. An unresolved condition
that is required for the reviewed scope means `CHANGES-REQUIRED`. Nonblocking limitations may be
recorded only after the reviewer explicitly states why they do not affect safety, fidelity, access,
or the requested authorization.

Coordinator ingestion uses this exact normalized mapping:

| Packet disposition               | Runtime `exactVersionDisposition` | Gate effect                               |
| -------------------------------- | --------------------------------- | ----------------------------------------- |
| `APPROVED-WITHIN-RECORDED-SCOPE` | `accepted`                        | Eligible only if every other field passes |
| `CHANGES-REQUIRED`               | `changes-required`                | Blocks activation/publication             |
| `REJECTED-WITHIN-RECORDED-SCOPE` | `rejected`                        | Blocks activation/publication             |
| `ABSTAINED-OR-NOT-REVIEWED`      | `null` / remains pending          | Blocks activation/publication             |

Only normalized `accepted` can unlock a gate. Ingestion also requires `reviewStatus: approved`, a
named reviewer, the exact matching candidate ID, candidate-manifest digest, canonical findings-
ledger digest, expected domain-specific scope digest, a valid ISO timestamp with timezone, a
nonblank attestation artifact/receipt ID, and a lowercase 64-hex attestation SHA-256. A packet
record never changes runtime state merely because a Markdown box is checked.

## 6. Findings and invalidation

Use one candidate-bound findings ledger. Do not maintain separate competing ledgers in clinical,
device, accessibility, or product documents. Domain records cite finding IDs from that ledger.

- Open `stop`, `critical`, or `high` findings block all affected approvals and authorizations.
- A lower-severity residual finding requires a named owner, due date, risk owner, and explicit
  disposition in the applicable domain and product records.
- A resolved finding requires resolution evidence, retest evidence, the exact retested candidate,
  and the affected review domains.
- If the fix changes the candidate, the prior candidate's finding may be closed historically, but its
  review disposition does not transfer to the new candidate.

## 7. Authentication and public-repository privacy

An authenticated attestation receipt must come from an approved identity-bearing system, such as a
controlled institutional review system, an approved electronic-signature system, or another product-
approved mechanism with an auditable subject and timestamp. A route login, Git author string,
typed name, email, chat message, or checked Markdown box alone is insufficient.

The public repository should contain only the minimum necessary identity summary and opaque receipt
or evidence identifiers. Do not commit license numbers, personal addresses, unnecessary contact
details, secrets, source-system tokens, protected device configuration, or patient information.

## 8. Authorization order

1. Freeze the candidate and open the canonical ledger.
2. Collect all artifact-required domain reviews from the scope matrix.
3. Resolve, retest, and re-review affected findings.
4. Record pilot acceptance, if a pilot decision is requested.
5. Record Phase 7 authorization only for explicitly selected Phase 7 items.
6. Record Phase 8 authorization only after a stable exact PrisMax v1 candidate and every Prismaflex
   and cross-device prerequisite exist.
7. Record publication authorization last, for the exact deployable artifact, routes, locales,
   audience, access state, and claims.

The packet remains blocked unless every requirement for the requested decision is positively proven.
Silence, absence, an unchecked row, or a missing record never means approval or not applicable.
