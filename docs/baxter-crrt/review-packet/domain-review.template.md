# Baxter CRRT exact-candidate domain review template

Status: `TEMPLATE ONLY — NOT A REVIEW, APPROVAL, AUTHORIZATION, OR SIGNATURE`

Create one candidate-specific copy for exactly one reviewer and exactly one domain. Do not fill this
template in place. A reviewer who is qualified for multiple domains must complete and authenticate a
separate record for each domain.

## 1. Record control and exact candidate

| Field                                    | Required exact value                         |
| ---------------------------------------- | -------------------------------------------- |
| Domain-review record ID                  | `[pending]`                                  |
| Record revision                          | `[pending]`                                  |
| Packet ID                                | `[pending]`                                  |
| Candidate ID copied from frozen manifest | `[pending]`                                  |
| Candidate-manifest controlled location   | `[pending]`                                  |
| Candidate-manifest SHA-256               | `[pending]`                                  |
| Manifest freeze eligibility              | `[must be eligible-clean-commit]`            |
| Full Git commit                          | `[pending]`                                  |
| Build artifact ID and SHA-256            | `[pending]`                                  |
| Deployment/build ID used for review      | `[pending]`                                  |
| Exact learner review URL                 | `[pending]`                                  |
| Exact reviewer review URL                | `[pending or explicitly not used]`           |
| Locale/corpus reviewed                   | `[pending exact locale and corpus revision]` |
| Review opened / completed, with timezone | `[pending]`                                  |
| Supersedes / superseded by               | `[pending or none]`                          |

- [ ] I verified the candidate manifest immediately before beginning the review.
- [ ] I verified that the candidate ID and manifest SHA-256 above match every evidence artifact used.
- [ ] I understand that a dirty worktree, manifest mismatch, consequential change, or missing artifact
      invalidates this record for the affected scope.

## 2. One assigned reviewer domain

Select exactly one. More than one selected domain makes the record invalid.

- [ ] `nephrology`
- [ ] `critical-care`
- [ ] `crrt-nurse-education`
- [ ] `prismax-device`
- [ ] `prismaflex-device`
- [ ] `cross-device-equivalence`
- [ ] `accessibility`
- [ ] `localization`
- [ ] `privacy-data-governance`
- [ ] `entitlement-security`
- [ ] `product-owner`
- [ ] `publication-approval`
- [ ] `protocol-owner`
- [ ] `pharmacy`
- [ ] `nutrition`

Assigned domain ID repeated verbatim: `[pending]`

For `localization`, use one gate record that itemizes the complete released locale/corpus set and
digests any locale-specific evidence; the current runtime rejects duplicate domain entries. For
`protocol-owner`, record exactly one protocol/profile ID and version. For either device domain,
record exactly one target device profile and local configuration. A device record with blended
configurations is invalid.

A `cross-device-equivalence` record is controlled packet evidence for the separate Phase 8
authorization. The runtime domain vocabulary accepts this domain, and Phase 8-aware activation and
publication checks require it together with `prismaflex-device`. This record must never be
represented as another domain, and a resolver pass does not replace the controlled authorization.

## 3. Reviewer identity, qualifications, and independence

| Field                                                                 | Reviewer entry                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Controlled-system reviewer subject ID                                 | `[pending opaque identifier]`                                 |
| Preferred full name                                                   | `[pending]`                                                   |
| Degree(s), credentials, or relevant training                          | `[pending]`                                                   |
| Current professional role                                             | `[pending]`                                                   |
| Organization or institutional role, when applicable                   | `[pending]`                                                   |
| Domain-specific experience                                            | `[pending]`                                                   |
| Qualification-verification evidence ID/location                       | `[pending controlled evidence; do not commit sensitive data]` |
| Conflict-of-interest declaration                                      | `[pending]`                                                   |
| Independence from implementation, or approved exception and rationale | `[pending]`                                                   |
| Assigned scope received from                                          | `[pending controlled subject/record ID]`                      |

A self-stated role, typed name, Git identity, route login, or chat message does not by itself verify
identity, credentials, or authority.

## 4. Exact included and excluded scope

Every reviewed artifact must have its own row. Do not use “all content,” “entire module,” “as
discussed,” or another open-ended scope description.

| Artifact ID | Exact version/hash | Reviewed aspect within this domain | Scope state (`included`, `excluded`, or `not-reviewed`) | Evidence IDs | Finding IDs |
| ----------- | ------------------ | ---------------------------------- | ------------------------------------------------------- | ------------ | ----------- |
| `[pending]` | `[pending]`        | `[pending]`                        | `not-reviewed`                                          | `[pending]`  | `[pending]` |

Explicit exclusions and limitations: `[pending — list every adjacent domain or artifact that could be mistaken as included]`

Scope-table SHA-256 or controlled scope digest: `[pending]`

- [ ] Every artifact in my disposition appears as an `included` row.
- [ ] I did not review or approve any artifact marked `excluded` or `not-reviewed`.
- [ ] I did not infer device behavior from clinical plausibility, clinical approval from device
      fidelity, local policy from a manual, accessibility from automated tests, translation from an
      English review, or publication from any content review.
- [ ] If I hold another project role, I understand this record has no effect in that other domain.

## 5. Evidence package reviewed

| Evidence record                               | Exact revision/hash/location | Purpose in this domain            | Result or limitation |
| --------------------------------------------- | ---------------------------- | --------------------------------- | -------------------- |
| Candidate manifest                            | `[pending]`                  | Exact candidate binding           | `[pending]`          |
| Scope-domain matrix                           | `[pending]`                  | Required-domain assignment        | `[pending]`          |
| Canonical findings ledger                     | `[pending]`                  | Findings and closure state        | `[pending]`          |
| Applicable checklist(s)                       | `[pending]`                  | Review aid only                   | `[pending]`          |
| Source matrix/provenance                      | `[pending]`                  | Claim/source traceability         | `[pending]`          |
| Local configuration/protocol, if applicable   | `[pending]`                  | Exact local boundary              | `[pending]`          |
| Test/build/browser/AT evidence, if applicable | `[pending]`                  | Engineering or usability evidence | `[pending]`          |
| Other controlled evidence                     | `[pending]`                  | `[pending]`                       | `[pending]`          |

Checklist completion, passing tests, or source inspection is evidence only and does not choose the
disposition below.

## 6. Canonical findings-ledger binding

| Field                                                  | Required value                                      |
| ------------------------------------------------------ | --------------------------------------------------- |
| Findings-ledger ID and revision                        | `[pending]`                                         |
| Findings-ledger SHA-256                                | `[pending]`                                         |
| Finding IDs raised by this reviewer                    | `[pending, or explicit none after complete review]` |
| Open findings affecting this scope                     | `[pending]`                                         |
| Resolved findings and exact-candidate retest evidence  | `[pending]`                                         |
| Residual medium/low findings, risk owner, and due date | `[pending]`                                         |

- [ ] All review notes and findings have been reconciled into the one canonical ledger.
- [ ] No open `stop`, `critical`, or `high` finding affects an included artifact.
- [ ] Every accepted residual medium/low finding has a named owner, due date, product risk
      disposition, and reason it does not block this domain disposition.

## 7. Domain-specific conclusions

Summarize only conclusions within the selected domain. Identify dissent, uncertainty, missing
evidence, and any requested specialty review.

Conclusion: `[pending]`

Nonblocking residual limitations, if any: `[pending]`

Explicit statements outside this reviewer's authority: `[pending; must agree with exclusions above]`

## 8. Exact-version disposition

Select exactly one. Zero or multiple selections means `pending`.

- [ ] `APPROVED-WITHIN-RECORDED-SCOPE`
- [ ] `CHANGES-REQUIRED`
- [ ] `REJECTED-WITHIN-RECORDED-SCOPE`
- [ ] `ABSTAINED-OR-NOT-REVIEWED`

Disposition repeated verbatim: `[pending]`

Disposition rationale: `[pending]`

An unresolved required condition must use `CHANGES-REQUIRED`; this template has no generic approval
and no approval-with-open-conditions option.

Runtime normalization is fixed: `APPROVED-WITHIN-RECORDED-SCOPE` maps to `accepted`,
`CHANGES-REQUIRED` maps to `changes-required`, `REJECTED-WITHIN-RECORDED-SCOPE` maps to `rejected`,
and `ABSTAINED-OR-NOT-REVIEWED` maps to `null`/pending. Only `accepted` may unlock a gate, and only
when coordinator ingestion also records `reviewStatus: approved`, the exact matching candidate, a
valid ISO timestamp with timezone, a nonblank receipt/artifact ID, and a lowercase 64-hex
attestation SHA-256.

## 9. Authenticated attestation

The attestation receipt must bind the reviewer subject ID, selected domain, candidate ID, candidate-
manifest SHA-256, scope digest, findings-ledger digest, disposition, and signed timestamp. Missing or
mismatched receipt data makes the disposition invalid.

| Field                                           | Required authenticated value      |
| ----------------------------------------------- | --------------------------------- |
| Approved authentication/attestation system      | `[pending]`                       |
| Authenticated reviewer subject ID               | `[pending; must match section 3]` |
| Authentication assurance or verification method | `[pending]`                       |
| Attestation receipt ID                          | `[pending]`                       |
| Attestation receipt SHA-256 or signature digest | `[pending]`                       |
| Receipt's candidate ID                          | `[pending; must match section 1]` |
| Receipt's candidate-manifest SHA-256            | `[pending; must match section 1]` |
| Receipt's selected domain                       | `[pending; must match section 2]` |
| Receipt's scope digest                          | `[pending; must match section 4]` |
| Receipt's findings-ledger digest                | `[pending; must match section 6]` |
| Receipt's disposition                           | `[pending; must match section 8]` |
| Signed date/time and timezone                   | `[pending]`                       |
| Controlled receipt/evidence location            | `[pending]`                       |

Attestation statement:

> I reviewed only the included scope identified in this record, against the exact candidate and
> evidence digests recorded here. My disposition applies only to the selected reviewer domain. It
> does not approve another clinical specialty, device, configuration, protocol, accessibility,
> localization, privacy, entitlement, product, competency, activation, or publication domain, and it
> does not authorize patient care or independent device operation.

- [ ] The authenticated receipt contains or cryptographically binds the complete attestation above.

## 10. Coordinator verification and lifecycle

| Field                                            | Required value                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| Review coordinator controlled subject ID         | `[pending]`                                                        |
| Candidate/manifest match reverified at ingestion | `[pending date/time/timezone]`                                     |
| Receipt integrity verified                       | `[pending]`                                                        |
| Scope/domain uniqueness verified                 | `[pending]`                                                        |
| Packet-control record updated                    | `[pending record revision/hash]`                                   |
| Record state                                     | `[pending, accepted-into-packet, superseded, revoked, or invalid]` |
| Revocation/supersession reason and timestamp     | `[pending or none]`                                                |

Coordinator ingestion does not change the reviewer's disposition and is not an authorization.
