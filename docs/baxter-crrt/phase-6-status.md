# Baxter CRRT Phase 6 status record

Status: engineering accessibility/QA and formal review package assembled; independent approvals pending

Release state: authenticated, unlisted, draft

Next action: conduct the required reviews while any user-directed Phase 7 development remains draft, disabled, and non-release

## Deliverables

| Phase 6 deliverable                    | Artifact/evidence                                                                                | State                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Keyboard and screen-reader engineering | Focus/tab/dialog/summary/reflow implementation and focused tests                                 | Implemented; manual AT review pending                              |
| Responsive/reduced-motion engineering  | CSS/tests, historical 390 × 844 walkthrough, and 2026-07-17 authenticated reflow smoke           | 320/tablet smoke passed; 200%/motion/manual review pending         |
| Provisional browser-QA record          | [browser-qa-evidence-2026-07-17.md](./browser-qa-evidence-2026-07-17.md)                         | Structured non-approval evidence; frozen-candidate repeat required |
| Clinical review intake                 | [clinical-review-checklist.md](./clinical-review-checklist.md)                                   | Unchecked / pending                                                |
| PrisMax device review intake           | [prismax-device-review-checklist.md](./prismax-device-review-checklist.md)                       | Unchecked / pending                                                |
| Exact local PrisMax configuration      | [prismax-local-configuration-worksheet.md](./prismax-local-configuration-worksheet.md)           | Blank / unchecked / pending                                        |
| Prismaflex future review intake        | [prismaflex-device-review-checklist.md](./prismaflex-device-review-checklist.md)                 | Deferred Phase 8 / unchecked                                       |
| Accessibility/release intake           | [accessibility-release-checklist.md](./accessibility-release-checklist.md)                       | Unchecked / pending                                                |
| Engine validation record               | [engine-validation.md](./engine-validation.md)                                                   | Engineering evidence assembled; human validation pending           |
| Curriculum architecture                | [curriculum-blueprint.md](./curriculum-blueprint.md)                                             | Pilot mapped; expansion gated                                      |
| Educational capability map             | [competency-matrix.md](./competency-matrix.md)                                                   | No credentialing claim / pending review                            |
| Pilot governance plan                  | [pilot-study-plan.md](./pilot-study-plan.md)                                                     | Planning draft; activation prerequisites unmet                     |
| Pilot feedback artifact                | [pilot-feedback-form.md](./pilot-feedback-form.md)                                               | Planning draft; not approved for collection                        |
| Pilot acceptance / Phase 7 decision    | [pilot-acceptance-and-phase-7-authorization.md](./pilot-acceptance-and-phase-7-authorization.md) | Fail-closed; all formal dispositions pending                       |
| Post-Phase 6 draft foundation          | [phase-7-status.md](./phase-7-status.md)                                                         | Implemented fail-closed; not activated or approved                 |
| Source/copyright policy                | [source-usage-policy.md](./source-usage-policy.md)                                               | Active repository policy                                           |
| Product/engine records                 | [product-requirements.md](./product-requirements.md), [engine-model.md](./engine-model.md)       | Present; review pending                                            |

## Phase 6 engineering evidence

- Focused accessibility tests: 4 suites / 21 tests passed.
- All feature-local Baxter CRRT tests: 24 suites / 152 tests passed.
- Focused CRRT/route/analytics/access/search tests: 28 suites / 169 tests passed.
- Full Jest: 201 suites / 1,372 tests passed.
- TypeScript, CRRT-scoped ESLint, scoped Prettier, and `git diff --check` passed.
- Full lint passed with 13 pre-existing warnings outside CRRT and no errors.
- The production build passed and emitted `/[locale]/baxter-crrt`; the existing Mermaid
  dynamic-require and metadata-base warnings remain.
- The pilot content version now has one canonical `0.5.0-pilot-draft.1` constant shared by case
  content, engine state, and progress; focused version/progress/case tests passed.
- The PrisMax source was visually rechecked at AW8035 PDF/manual pages 12/11, 40/39, 94/93,
  218/217, and 242/241. This is source verification, not device approval.
- Earlier Phase 4-5 browser QA covered desktop Learn/Practice and a 390 × 844 mobile pass with no
  error-level console entries or page-level overflow.
- During the original Phase 6 run, the in-app browser URL policy rejected localhost
  navigation/reload. No workaround was attempted, so no live 320-pixel, 200% zoom, tablet, or
  screen-reader claim belongs to that historical baseline.

### 2026-07-17 authenticated browser follow-up

A later smoke on the expanded, unfrozen working build reached both authenticated local learner and
reviewer routes at 320 × 800 and 768 × 1024. Both routes reported `clientWidth === scrollWidth` at
both viewports. At 320 pixels, module-owned controls measured at least 44 CSS pixels; native reviewer
inputs were excluded when their associated label is the intended target. Open case, instructional-
tool, Mastery, Prismaflex, and cross-device transfer disclosures remained contained, and no
error-level browser logs were observed.

The environment, exercised route/state matrix, defect, results, and limitations are retained under
evidence ID `CRRT-BROWSER-QA-PROVISIONAL-2026-07-17-01` in
[browser-qa-evidence-2026-07-17.md](./browser-qa-evidence-2026-07-17.md). No browser-version or
screenshot artifact was available, so this record deliberately completes no formal matrix row and
must be repeated against the frozen candidate.

The smoke exposed one rapid-drill implicit-grid clipping defect. The CSS was corrected to use an
explicit `minmax(0, 1fr)` review column with `min-width: 0`; the page was rechecked with zero
overflowing child elements. A static regression assertion was added to
`src/features/baxter-crrt/__tests__/accessibility.test.tsx`.

Post-fix validation passed 44 CRRT feature suites / 299 tests and the full 225-suite / 1,540-test
run. Type-check passed; lint reported zero errors and the same 13 unrelated pre-existing warnings.

This follow-up is engineering evidence only. It does not complete full tab-order traversal, 200%
zoom, VoiceOver/second-AT, OS-level reduced-motion, contrast, or exact-candidate accessibility
review, all of which remain pending.

After the follow-up audit, exhaustive pilot-path tests were added for every declared unsafe action
and critical error across `CRRT-04`, `CRRT-10`, and `CRRT-13`. The tests verify prerequisites,
exact critical IDs, authored fail-safe effects, exclusion from safe completion, and deterministic
causal debriefs. The source matrix was also reconciled to real implementation files and now has a
path-integrity regression test. These additions remain engineering evidence, not review approval.

If the reviewed revision changes, rerun the automated stack and repeat every affected review before
any pilot disposition.

## Human approvals still missing

- `nephrology`: CRRT-experienced nephrologist.
- `critical-care`: on 2026-07-16 the repository user stated that they are a critical care
  physician, but their name, credentials, reviewer scope, exact-candidate review, disposition, and
  signature remain pending.
- `crrt-nurse-education`: CRRT nurse educator.
- `prismax-device`: trained device reviewer for the exact intended market/software/configuration.
- `accessibility`: reviewer using the approved browser/assistive-technology matrix.
- `localization`: reviewer for the exact released locale corpus.
- `privacy-data-governance`: steward for progress, analytics, retention, access, deletion, and export.
- `entitlement-security`: owner for pilot/reviewer access, audit, duration, support, and withdrawal.
- `product-owner`: owner for audience, supervision, competency boundary, operations, and risk.
- `publication-approval`: final exact-candidate domain review; separate publication authorization
  is still required.

Additional unresolved inputs include local sets/accessories/solutions, Auto Effluent availability,
approved anticoagulation approaches, a versioned citrate/calcium protocol, intended competency
roles, pilot participant/data plan, and whether unlisted status ever changes.

The repository user also explicitly authorized moving to Phase 7 draft development on 2026-07-16.
That instruction is recorded in the
[pilot acceptance and Phase 7 authorization record](./pilot-acceptance-and-phase-7-authorization.md)
as development direction only; that record is now a legacy planning companion. Formal decisions use
the candidate-bound [canonical review packet](./review-packet/README.md). The direction is not pilot
acceptance, a clinical review disposition, publication approval, or approval for device,
nephrology, nursing, accessibility, localization, privacy/data, or another reviewer domain.

After this Phase 6 handoff, draft work added engine/schema version updates, the exact 18-case review
catalog, seven reviewer-only case candidates, seven non-runnable drill manifests, six reviewer tool
runtimes, locked Mastery semantics, progress v2 isolation, the schema-v2 candidate-manifest tool,
the guarded reviewer-build identity banner, the canonical packet templates, and the isolated
Prismaflex/transfer scaffold. Current boundaries are documented in
[phase-7-status.md](./phase-7-status.md) and [phase-8-status.md](./phase-8-status.md). Those later
additions do not alter the historical Phase 6 evidence above, expand the three-case learner runtime,
complete a review, or activate either phase.

## Gate disposition

Phase 6 implementation does not equal approval. The module must remain draft, authenticated,
unlisted, noindex, absent from primary navigation, and unable to award Mastery or competency.

Draft Phase 7 development may proceed under the recorded user direction, but it cannot be treated as
formally accepted, activated for a pilot, published, or eligible for competency use. Formal Phase 7
disposition remains closed until the exact pilot revision receives all ten mandatory candidate-
bound attestations and the separate authorization records. Formal Phase 8 activation cannot start
until reviewed PrisMax v1 is stable and the separate Prismaflex and cross-device prerequisites are
met.

No approval is inferred from an unchecked checklist, passing automated test, source inspection,
pilot plan, or feedback form.
