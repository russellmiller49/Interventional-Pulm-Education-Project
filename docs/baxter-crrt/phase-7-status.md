# Baxter CRRT Phase 7 protected-foundation status

Status: `reviewer-candidate engineering implementation complete at the safe stopping boundary; not frozen, formally activated, or approved`

Learner runtime: only protected pilot cases `CRRT-04`, `CRRT-10`, and `CRRT-13`

Release state: authenticated, unlisted, draft, noindex, with an always-guarded reviewer route and
no ability to award Mastery or competency

Formal pilot disposition: `pending`

Formal Phase 7 authorization: `false`

## 1. Scope and claim boundary

The Phase 7 build materializes stable IDs, review requirements, activation rules, progress
isolation, reviewer-only case candidates, and reviewer-facing instructional tools for the planned
PrisMax curriculum. It does not activate an added learner case, rapid drill, Mastery capstone,
local anticoagulation, citrate/calcium, pilot entitlement, competency use, publication, or a
Prismaflex learner runtime. A separately versioned, source-mapped Prismaflex reviewer scaffold is
present for inspection only; it does not satisfy or bypass the formal Phase 8 activation gate.

On 2026-07-16, the repository user explicitly authorized moving to Phase 7 draft development and
stated that they are a critical care physician. That is development direction only. Their name,
credentials, institutional role, review scope, signature, and exact-build disposition remain
pending. It is not pilot acceptance, a clinical sign-off, formal product authorization,
publication approval, or approval for another reviewer domain. The fail-closed decision record is
[pilot-acceptance-and-phase-7-authorization.md](./pilot-acceptance-and-phase-7-authorization.md).

## 2. Version identities

| Artifact                         | Exact draft identity            | Boundary                                                                              |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| Shared engine                    | `0.4.0-phase7-review`           | Adds a reviewer-only audience boundary and locked Mastery gate                        |
| Authored/runtime schema          | `1.1.0-phase7-draft`            | Adds stable full-catalog and pathway types while preserving strict runtime validation |
| Protected pilot content/progress | `0.5.0-pilot-draft.1`           | Still owns the only three learner-runtime cases and detailed progress context         |
| Phase 7 manifest content         | `0.7.0-phase7-draft.2`          | Review-only catalog, candidate cases/tools, drills, evidence, and Mastery manifest    |
| Local progress DTO/key           | v2 / `baxter-crrt-progress-v2`  | Practice and Mastery records are isolated; v1 is not promoted or migrated             |
| PrisMax device profile           | `prismax-aw8035-rb-2xx-draft.2` | Local market/software/configuration remains unresolved                                |
| Local citrate/calcium profile    | `null`                          | Actionable citrate and `CRRT-17` remain disabled                                      |

The Phase 7 manifest version is deliberately separate from the protected pilot version. Registering
or revising non-runnable manifests cannot silently change the review identity of the three-case
pilot or make pilot progress count as Phase 7 completion.

## 3. Implemented foundation and evidence

| Foundation                          | Implementation                                                        | Focused automated evidence                                                                | Current state                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fail-closed activation contract     | `content/activation.ts`, `content/authorization.ts`                   | `__tests__/phase7Registry.test.ts`                                                        | Requires exact candidate/manifest/ledger/scope-bound reviews, `learner-active`, no blockers, and a matching separate Phase 7 authorization                       |
| Exact 18-case catalog               | `content/schema.ts`, `content/curriculum.ts`                          | `phase7Registry.test.ts`                                                                  | All IDs materialized in canonical order; three learner runtime and seven reviewer-only candidates                                                                |
| Candidate clinical source registry  | `content/phase7ReviewSources.ts`, `content/phase7Evidence.ts`         | `phase7Registry.test.ts`, `phase7ReviewCases.test.ts`                                     | Every source pending, reviewer null, activation forbidden; exact values use per-case synthetic records                                                           |
| Reviewer-only audience boundary     | `engine/learningSession.ts`, `engine/progress.ts`                     | `learningSession.test.ts`, `progress.test.ts`                                             | Learner creation requires the exact immutable pilot-registry object; progress accepts only activated learner IDs and keys                                        |
| Seven reviewer case candidates      | `content/phase7ReviewCases.ts`                                        | `phase7ReviewCases.test.ts`                                                               | `CRRT-01`, `02`, `05`, `06`, `07`, `11`, and `15`; no learner selection, persistence, activation, or competency claim                                            |
| Six instructional-tool manifests    | `content/instructionalTools.ts`                                       | `phase7Registry.test.ts`, focused component/model tests                                   | Six reviewer surfaces exist; citrate is non-actionable/protocol-blocked; every learner, score, and progress flag is false                                        |
| Seven rapid-drill manifests         | `content/rapidDrills.ts`, `content/rapidDrillReview.ts`               | `phase7Registry.test.ts`, `rapidDrillReview.test.ts`                                      | All `runnable: false`; five non-actionable reviewer previews and two policy-blocked manifests                                                                    |
| Mastery manifest                    | `content/mastery.ts`                                                  | `phase7Registry.test.ts`                                                                  | Requirements materialized; `runtimeCaseIds` empty and availability false                                                                                         |
| Mastery composition planner         | `content/masteryReviewPlanner.ts`                                     | `masteryReviewPlanner.test.ts`, `CrrtMasteryReviewPlanner.test.tsx`                       | Ephemeral theme planning only; no capstone case, session, score, progress, analytics, or competence claim                                                        |
| Mastery runtime gate                | `engine/learningSession.ts`, `engine/outcomes.ts`                     | `engine/__tests__/learningSession.test.ts`, `engine/__tests__/outcomes.test.ts`           | Empty immutable activation registry rejects current Mastery creation and forged scoring                                                                          |
| Practice/Mastery progress isolation | `engine/progress.ts`                                                  | `engine/__tests__/progress.test.ts`                                                       | Mastery persistence is locked; Practice is separate; unsafe scores never enter best-safe aggregates                                                              |
| Review-only UI surface              | guarded `/[locale]/baxter-crrt/review` route plus reviewer components | route-guard, case/tool, analytics, release-composition, scaffold, and accessibility tests | Reviewer interactions emit no analytics/progress; reviewer code is outside the learner client graph                                                              |
| Fail-closed publication state       | `content/deviceProfiles.ts`, `content/authorization.ts`               | `publicationGate.test.ts`, layout and release-composition tests                           | Requires exact candidate/manifest/ledger/scope-bound reviews, exact learner composition, deployable artifact, and separate publication authorization             |
| Deterministic candidate identity    | `scripts/baxter-crrt/review-candidate-manifest.ts` and CLI            | `scripts/baxter-crrt/review-candidate-manifest.test.ts`                                   | Schema v2 binds Git/file/source identity; output stays outside the repository; provisional, dirty, noncanonical, inconsistent, or source-unverified records fail |
| Reviewer build identity             | `reviewBuildIdentity.ts`, guarded reviewer-page banner                | `reviewBuildIdentity.test.ts`, reviewer-page test                                         | Missing/malformed declarations show an unfrozen warning; a declared ID still never grants formal-review eligibility                                              |
| Canonical review packet             | `docs/baxter-crrt/review-packet/`                                     | JSON parse, domain-consistency, Prettier, and candidate/review-gate tests                 | One domain per record plus separate authorizations; all records remain templates/pending                                                                         |

Passing an implementation test means only that the code follows this fail-closed contract. It does
not validate a clinical mechanism, device behavior, local policy, scoring rule, reviewer decision,
or release state.

## 4. Exact case catalog

All catalog entries have `reviewStatus: pending`, null reviewer identities, null exact-version
dispositions, and an activation state that cannot pass `canActivateCrrtRecord`.

| Station | Case      | Catalog focus                                                           | Activation/runtime state                                               |
| ------: | --------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
|       1 | `CRRT-01` | Septic shock, AKI, and fluid-overload goal definition                   | Reviewer-only draft runtime; no learner/progress path                  |
|       1 | `CRRT-02` | Refractory hyperkalemia and acidemia with instability                   | Reviewer-only draft runtime; no learner/progress path                  |
|       1 | `CRRT-03` | Controlled solute and sodium management in acute brain or liver failure | Manifest only; non-runnable                                            |
|       2 | `CRRT-04` | CVVHD for small-solute clearance                                        | Protected pilot runtime                                                |
|       2 | `CRRT-05` | CVVH with pre- versus post-replacement tradeoffs                        | Bounded reviewer-only qualitative runtime; no learner/progress path    |
|       2 | `CRRT-06` | CVVHDF with prescribed-versus-delivered dose                            | Reviewer-only draft runtime; no learner/progress path                  |
|       3 | `CRRT-07` | Incorrect weight or hematocrit entry                                    | Reviewer-only input-propagation runtime; no learner/progress path      |
|       3 | `CRRT-08` | Set, bag, solution, line, prime, and review verification                | Manifest only; local configuration blocks activation                   |
|       3 | `CRRT-09` | Anticoagulation setup under an approved protocol                        | Protocol-blocked; no actionable pathway authored                       |
|       4 | `CRRT-10` | Machine PFR versus whole-patient net balance                            | Protected pilot runtime                                                |
|       4 | `CRRT-11` | Hemodynamic intolerance of net removal                                  | Reviewer-only draft runtime; no learner/progress path                  |
|       4 | `CRRT-12` | Electrolyte, temperature, medication, or nutrition consequences         | Manifest only; pharmacy/nutrition evidence pending                     |
|       5 | `CRRT-13` | Increasingly negative access pressure                                   | Protected pilot runtime                                                |
|       5 | `CRRT-14` | High return pressure versus return disconnection                        | Manifest only; alarm mapping blocks activation                         |
|       5 | `CRRT-15` | Rising TMP or filter pressure drop from distinct causes                 | Bounded reviewer-only trend runtime; no learner/progress path          |
|       6 | `CRRT-16` | Recurrent filter loss across access, FF, downtime, and anticoagulation  | Manifest only; anticoagulation policy pending                          |
|       6 | `CRRT-17` | Citrate/calcium problem under an approved local profile                 | Protocol-blocked; no dosing, targets, or adjustment algorithm authored |
|       6 | `CRRT-18` | Renal recovery, discontinuation, and transition                         | Manifest only; stop/blood-return/transition policies pending           |

`baxterCrrtLearnerCases` remains the existing three-entry `baxterCrrtPilotCases` registry. The seven
new fixtures live in a distinct immutable code registry whose activation, learner selection,
progress persistence, and competency flags are false. No exact candidate/build is frozen. The
remaining eight non-pilot entries—six manifest-only and two protocol-blocked—do not contain runtime
fixtures. No added case enters a learner selector or learner progress record.

## 5. Instructional-tool candidates

The manifest fixes six tool identities and keeps `learnerAvailable`, `scoringAvailable`, and
`progressPersistenceAvailable` false for every tool:

| Stable ID                   | Reviewer-candidate boundary                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `LAB-TRANSPORT`             | Unitless qualitative transport model; no clearance, dose, prescription, or device-outcome claim                       |
| `LAB-PRESCRIPTION`          | Source-backed device calculations only; clinical targets, local profiles, and disputed expressions unavailable        |
| `LAB-PREPOST-DILUTION`      | Qualitative comparison only; disputed quantitative expressions remain unavailable                                     |
| `LAB-PRESSURE-LOCALIZATION` | Synthetic obstruction patterns only; alarm thresholds/reactions are absent and every disconnection model fails closed |
| `LAB-FLUID-LEDGER`          | Synthetic accounting that separates machine PFR from whole-patient balance; no removal recommendation                 |
| `LAB-CITRATE-DASHBOARD`     | Protocol-blocked scaffold; no dosing, targets, adjustments, or escalation logic                                       |

Reviewer runtime availability means that code can be inspected and exercised inside the protected
review surface. It does not mean the teaching claim, model, source, or device behavior is approved.
`LAB-PRESCRIPTION` and `LAB-PREPOST-DILUTION` share one bounded workbench component but retain
separate stable manifest identities and source/calibration records.

## 6. Rapid-drill manifests

| Stable ID              | Review topic          | State                                                               |
| ---------------------- | --------------------- | ------------------------------------------------------------------- |
| `DRILL-AIR`            | Air detection         | Reviewer preview only; exact device reaction/correction pending     |
| `DRILL-BLOOD-LEAK`     | Blood-leak detection  | Reviewer preview only; exact device behavior/escalation pending     |
| `DRILL-GAIN-LOSS`      | Fluid gain or loss    | Reviewer preview only; configuration-specific behavior pending      |
| `DRILL-BAG-SCALE`      | Bag or scale error    | Reviewer preview only; local bag/line/solution mapping pending      |
| `DRILL-POWER`          | Power interruption    | Reviewer preview only; exact interruption/recovery workflow pending |
| `DRILL-WRONG-SOLUTION` | Wrong solution        | Policy-blocked; local solution/set registry pending                 |
| `DRILL-BLOOD-RETURN`   | Blood-return decision | Policy-blocked; local stop/end/blood-return policy pending          |

The first five records also expose prediction-gated, cause-first reviewer previews. Their six review
gates keep acknowledgement distinct from correction and provide no alarm threshold, corrective
sequence, restart authorization, score, analytics, saved progress, or competency. Wrong-solution
and blood-return remain preview-excluded and policy-blocked. No rapid drill can be selected, scored,
or completed by a learner.

## 7. Mastery foundation and lock

Implemented engine/manifest semantics:

- stable candidate ID `MASTERY-PRISMAX-01`;
- an unseen, non-revealing pre-debrief title contract;
- at least two problem domains;
- candidate score at least 80;
- zero critical errors;
- required reassessment;
- an activation contract that requires an exact capstone/runtime/content-version mapping with at
  least two distinct problem domains;
- no hints in any future activated Mastery session; and
- separate capstone progress keys that cannot be written while the activation registry is empty.

Still absent or pending:

- no authored multi-hit capstone fixture;
- no runtime case ID;
- no accepted alternative, critical-error, score, hint, or debrief review package;
- no named clinical/device/accessibility/product reviewers;
- no exact local PrisMax configuration disposition; and
- no formal pilot acceptance or exact-build Phase 7 authorization.

The guarded reviewer route contains an ephemeral composition planner that can group themes from the
seven reviewer cases and display the unapproved candidate rules. It does not create a capstone case,
session, score, result, progress entry, analytics event, or competency record.

Therefore `baxterCrrtMasteryAvailable` is false, the learner-facing Mastery pathway remains disabled,
and engine APIs reject creation, scoring, or persistence of a Mastery result. No competency claim
can be produced.

## 8. Progress v2 and v1 reset boundary

The v2 DTO at `engine/progress.ts` uses `baxter-crrt-progress-v2` and separately stores completed
Practice case IDs and completed Mastery capstone IDs. Composite attempt keys include device, role,
pathway, and case/capstone ID. A Practice result cannot set Mastery completion, and a Mastery
completion must satisfy the fail-closed score, critical-error, hint, and reassessment criteria.
Scores are stored only in `bestSafeScores` when the corresponding attempt has no critical error;
critical events are counted separately in `criticalErrorAttempts`, preventing incompatible attempts
from being combined into an apparently safe high score.

The reader accesses only the v2 key and accepts only version 2 with the exact current engine and
protected-pilot content versions. Existing v1 data is not read, transformed, copied, or promoted;
the v2 reader starts from a clean default when the v2 payload is absent, malformed, stale, denied,
or out of bounds. Completed lists and every composite record key are cross-checked against the
three activated learner cases; the Mastery allowlist is empty, reviewer/arbitrary IDs are rejected,
and metric records must correspond to an allowed attempt key. The v1 key may remain in browser
storage, but it has no effect on v2 progress.

The allowlist continues to exclude PHI, patient state, protocol selection, free text, detailed
actions, trends, timestamps, screenshots, and simulation seeds.

## 9. Review, evidence, and configuration gates

Every Phase 7 evidence requirement remains `pending`, with `reviewer: null` and
`activationAllowed: false`. The following remain unresolved:

- the exact local PrisMax market, software/build, configuration ID, therapies, sets, accessories,
  pumps/scales/syringe behavior, Auto Effluent state, solutions, alarms/help, and stop/end/blood
  return behavior;
- current authoritative clinical evidence for new mechanisms and every exact value, condition,
  alternative, safety rule, score, hint, and debrief;
- approved local non-citrate anticoagulation and citrate/calcium protocol profiles;
- named, accepted attestations from all ten mandatory domains, each bound to the exact candidate ID,
  candidate-manifest SHA-256, canonical findings-ledger SHA-256, and expected domain-specific scope
  SHA-256: nephrology, critical care, CRRT nurse education, PrisMax device, accessibility,
  localization, privacy/data governance, entitlement/security, product owner, and publication
  approval; pharmacy, nutrition, protocol-owner, Prismaflex-device, and cross-device-equivalence
  records remain conditional on affected scope;
- pilot entitlement, data, support, competency, and publication decisions; and
- a clean frozen candidate with hashes and resolved findings.

The user's self-stated critical-care role does not fill the critical-care review record because
their name, credentials, scope, signature, and exact-build disposition are pending. No other
reviewer domain may be inferred from that statement.

Use the [local configuration worksheet](./prismax-local-configuration-worksheet.md) and canonical
[review packet](./review-packet/README.md) for those inputs and formal decisions. The legacy
[pilot acceptance/Phase 7 planning record](./pilot-acceptance-and-phase-7-authorization.md) has no
gate effect. The user's offered physician review can be recorded later in a candidate-specific copy
of the canonical domain template, with the
[Phase 7 critical-care review record](./phase-7-critical-care-review-record.md) used only as its
scope companion. All approval and authorization fields remain pending.

## 10. Verification disposition

The expanded `0.4.0-phase7-review` / `0.7.0-phase7-draft.2` working candidate completed this
integrated engineering run on 2026-07-17:

| Check                                                    | Result                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CRRT feature plus candidate-manifest tests               | Passed: 48 suites / 342 tests                                                        |
| Adversarial workflow/focus affected set                  | Passed: 9 suites / 81 tests                                                          |
| Focused activation/publication authorization gates       | Passed: 2 suites / 28 tests                                                          |
| Candidate-manifest integrity tooling                     | Passed: 1 suite / 11 tests                                                           |
| `npm run type-check`                                     | Passed                                                                               |
| `npm run lint`                                           | Passed with 13 pre-existing warnings outside CRRT and no errors                      |
| `npm test -- --runInBand`                                | Passed: 228 suites / 1,575 tests                                                     |
| `npm run build`                                          | Passed; 516 static pages generated and both CRRT routes emitted                      |
| Scoped Prettier, `git diff --check`, and whitespace scan | Passed                                                                               |
| Authenticated learner/reviewer reflow smoke              | Passed at 320 × 800 and 768 × 1024; full manual accessibility matrix remains pending |

The selection covers the catalog/runtime boundary, protocol gates, seven-drill non-runnability,
source/evidence ID integrity, exact-candidate reviewer gates, locked Mastery rejection at session,
outcome, and progress boundaries, best-safe-score aggregation, composed-UI identity masking, and
the locked learner pathway.

This run supersedes the earlier 44-suite/299-test evidence and its “no remaining P0/P1” statement.
The later adversarial pass found and fixed additional canonical phase/focus, domain-review digest,
authorization-reference, exact-release-composition, and candidate-manifest integrity gaps.
External receipt authentication and immutable-record resolution remain controlled-system
prerequisites rather than properties proved by these structural validators.

The closed learner-release composition remains exactly `CRRT-04`, `CRRT-10`, `CRRT-13`, and
`prismax-aw8035-2xx`. Phase 7 artifacts remain reviewer-only until a later code revision and all
candidate-specific review, pilot, authorization, and publication gates are complete.

An earlier authenticated desktop walkthrough confirmed the collapsed disclosures and bounded
reviewer case/tool surfaces before they moved to the separate guarded route. On 2026-07-17, a new
authenticated local smoke covered both learner and guarded reviewer routes at 320 × 800 and
768 × 1024. Both routes had `clientWidth === scrollWidth`; module-owned controls measured at least
44 CSS pixels at 320, subject to the documented native-input/label exception. Open case, tools,
Mastery, Prismaflex, and transfer disclosures remained contained. One rapid-drill grid clipping
defect was CSS-fixed, reverified with zero child overflow, and given a static accessibility
regression test. No error-level browser logs were observed.

This smoke is not an exact-candidate accessibility disposition. Full tab-order traversal, 200%
zoom, VoiceOver/second-AT, OS-level reduced motion, contrast, and the formal accessibility review
remain pending. Automated and browser engineering evidence does not replace those checks or any
clinical/device review.

The only current conclusion is:

> Phase 7 reviewer-candidate infrastructure exists and fails closed. The protected three-case pilot
> remains the entire learner runtime. No additional curriculum item, drill, Mastery capstone,
> protocol pathway, competency use, pilot activation, publication state, or Phase 8 learner runtime
> is approved by this record. Prismaflex reviewer scaffolding does not satisfy the separate Phase 8
> prerequisites.
