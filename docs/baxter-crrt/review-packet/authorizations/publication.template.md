# Baxter CRRT publication authorization template

Status: `TEMPLATE ONLY — PUBLICATION NOT AUTHORIZED`

Publication is the final, separate exact-release decision. No clinical review, device review, pilot
acceptance, Phase 7 authorization, Phase 8 authorization, successful test, or deployment by itself
authorizes publication.

## 1. Exact release candidate and deployable artifact

| Field                                                  | Required exact value              |
| ------------------------------------------------------ | --------------------------------- |
| Publication record ID/revision                         | `[pending]`                       |
| Packet ID                                              | `[pending]`                       |
| Candidate ID                                           | `[pending]`                       |
| Candidate-manifest SHA-256                             | `[pending]`                       |
| Candidate freeze eligibility                           | `[must be eligible-clean-commit]` |
| Full Git commit/release tag                            | `[pending]`                       |
| Deployable build artifact ID/SHA-256                   | `[pending]`                       |
| Deployment ID/environment                              | `[pending]`                       |
| Exact learner URL(s)                                   | `[pending]`                       |
| Exact reviewer/admin URL(s) and intended access state  | `[pending]`                       |
| Released locale(s) and corpus revision/hash per locale | `[pending]`                       |
| Device/profile/configuration IDs                       | `[pending]`                       |
| Protocol profile IDs, or explicit none                 | `[pending]`                       |
| Findings-ledger ID/revision/SHA-256                    | `[pending]`                       |
| Final validation and browser/AT evidence IDs/hashes    | `[pending]`                       |
| Publication-scope digest                               | `[pending]`                       |

## 2. Required approvals and authorization records

Every record must bind the exact candidate ID, candidate-manifest SHA-256, canonical findings-ledger
SHA-256, and expected domain-specific scope SHA-256 and include a valid authenticated receipt. The
single `localization` gate record must itemize every released locale/corpus and digest the locale-
specific evidence. List each device, configuration, and conditional domain separately.

| Required record                                                        | Record ID/SHA-256 | Receipt ID/hash | Exact scope and candidate verified |
| ---------------------------------------------------------------------- | ----------------- | --------------- | ---------------------------------- |
| `nephrology`                                                           | `[pending]`       | `[pending]`     | `[ ]`                              |
| `critical-care`                                                        | `[pending]`       | `[pending]`     | `[ ]`                              |
| `crrt-nurse-education`                                                 | `[pending]`       | `[pending]`     | `[ ]`                              |
| `prismax-device`                                                       | `[pending]`       | `[pending]`     | `[ ]`                              |
| `prismaflex-device`, if Phase 8 is released                            | `[pending]`       | `[pending]`     | `[ ]`                              |
| `cross-device-equivalence`, if transfer is released                    | `[pending]`       | `[pending]`     | `[ ]`                              |
| `accessibility`                                                        | `[pending]`       | `[pending]`     | `[ ]`                              |
| `localization` for the exact released locale corpus                    | `[pending]`       | `[pending]`     | `[ ]`                              |
| `privacy-data-governance`                                              | `[pending]`       | `[pending]`     | `[ ]`                              |
| `entitlement-security`                                                 | `[pending]`       | `[pending]`     | `[ ]`                              |
| `product-owner`                                                        | `[pending]`       | `[pending]`     | `[ ]`                              |
| Applicable `protocol-owner`                                            | `[pending]`       | `[pending]`     | `[ ]`                              |
| Applicable `pharmacy`                                                  | `[pending]`       | `[pending]`     | `[ ]`                              |
| Applicable `nutrition`                                                 | `[pending]`       | `[pending]`     | `[ ]`                              |
| Pilot/Phase 7/Phase 8 authorization records required by released scope | `[pending]`       | `[pending]`     | `[ ]`                              |
| `publication-approval` domain review                                   | `[pending]`       | `[pending]`     | `[ ]`                              |

Applicability decisions for omitted conditional domains: `[pending named records; absence is not N/A]`

## 3. Final release and claims gate

- [ ] The canonical ledger is complete with no open `stop`, `critical`, or `high` finding affecting
      release; every residual medium/low item has a product risk disposition and owner/date.
- [ ] Final tests, type-check, lint, build, candidate verification, browser matrix, assistive-
      technology matrix, zoom/reflow, reduced-motion, and locale checks pass for the deployable bytes.
- [ ] The persistent professional-education, simulation, non-endorsement, manual/local-protocol,
      supervised-training, and no-patient-specific-advice boundaries are present and accessible.
- [ ] Public metadata, search, sitemap, navigation, noindex/indexing, authentication, and entitlement
      behavior match the exact requested release state.
- [ ] Intended audience, supervision, support, incident response, withdrawal, rollback, and review
      checkpoint owners are named.
- [ ] Progress, analytics, feedback, identity association, retention, access, deletion, and export
      match the approved privacy/data record.
- [ ] No copy, certificate, analytics event, or completion state implies independent clinical/device
      competence unless separately authorized and itemized.
- [ ] No omitted, reviewer-only, manifest-only, protocol-blocked, policy-blocked, or unauthorized
      Phase 7/8 artifact is reachable from learner runtime or public release composition.
- [ ] Source/copyright, manufacturer artwork, trademark, and attribution boundaries are approved.

## 4. Exact publication scope

| Scope category                  | Exact authorized allowlist | Explicit exclusions |
| ------------------------------- | -------------------------- | ------------------- |
| Devices/profiles/configurations | `[pending]`                | `[pending]`         |
| Cases                           | `[pending]`                | `[pending]`         |
| Drills                          | `[pending]`                | `[pending]`         |
| Instructional tools             | `[pending]`                | `[pending]`         |
| Mastery/competency              | `[pending]`                | `[pending]`         |
| Phase 8 transfer domains        | `[pending]`                | `[pending]`         |
| Protocol pathways               | `[pending]`                | `[pending]`         |
| Routes and locales              | `[pending]`                | `[pending]`         |
| Audience/entitlement            | `[pending]`                | `[pending]`         |
| Progress/analytics/feedback     | `[pending]`                | `[pending]`         |
| Discoverability/indexing        | `[pending]`                | `[pending]`         |

Anything not positively listed in the authorized allowlist remains unpublished.

For the current implementation, the runtime publication gate accepts exactly this learner-release
composition: `CRRT-04`, `CRRT-10`, `CRRT-13`, and `prismax-aw8035-2xx`. Adding, removing, or
substituting any artifact requires a new code revision, clean candidate, evidence run, affected
reviews, and authorizations; prose in this template cannot expand the runtime allowlist.

## 5. Publication decision

Select exactly one. Zero or multiple selections means `REMAIN-DRAFT-NOT-AUTHORIZED`.

- [ ] `REMAIN-DRAFT-NOT-AUTHORIZED`
- [ ] `PUBLICATION-AUTHORIZED-ONLY-AS-ITEMIZED-ABOVE`

Decision repeated verbatim: `[pending]`

Effective date/time/timezone, expiration/review checkpoint, monitoring owner, and rollback trigger: `[pending]`

## 6. Authenticated publication attestation

| Field                                                       | Required value                    |
| ----------------------------------------------------------- | --------------------------------- |
| Publication approver controlled subject ID/name/title       | `[pending]`                       |
| Approved attestation system                                 | `[pending]`                       |
| Attestation receipt ID and receipt/signature SHA-256        | `[pending]`                       |
| Receipt candidate ID/manifest SHA-256                       | `[pending; must match section 1]` |
| Receipt deployable artifact ID/SHA-256                      | `[pending; must match section 1]` |
| Receipt publication-scope digest and findings-ledger digest | `[pending; must match section 1]` |
| Receipt decision and signed date/time/timezone              | `[pending]`                       |

> I authorize only the exact release allowlist and deployable artifact recorded here. I do not
> approve an omitted device, configuration, locale, protocol, case, drill, tool, transfer domain,
> competency claim, audience, data behavior, or later candidate. This authorization is not patient-
> care authorization or manufacturer validation.

- [ ] The authenticated receipt contains or cryptographically binds the complete statement above.

Until the publication-authorized decision and valid receipt are present, the publication state
remains `draft`, and existing authenticated/unlisted/noindex protections remain in force.
