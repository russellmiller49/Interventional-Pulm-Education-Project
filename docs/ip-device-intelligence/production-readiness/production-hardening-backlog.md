# Production-hardening backlog

> **NON-GOVERNED RESEARCH CANDIDATES**
> **NOT CONSUMED BY RUNTIME**
> **PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION**

This is a read-only backlog against frozen commit
`2f26cb7632fe4e8f6835a8528458b672e8f360c2`. It authorizes no runtime or governed-data
change. Evidence candidates must complete physician/owner review before implementation.

## Priority backlog

| ID      | Severity | Surface                         | Frozen finding                                                                                                               | Safe future action                                                                                | Exit evidence                                                                            |
| ------- | -------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| PRB-001 | BLOCKER  | AERO/AERO DV sterile status     | 33 public rows say `Sterile`; current manufacturer IFUs say supplied non-sterile                                             | Physician/owner adjudication, exact governed forward release, source revision attached            | All 33 identities corrected in released data; selector/device-page/saved-card regression |
| PRB-002 | BLOCKER  | EBUS required video system      | BF-UC190F is public; required slot exposes four systems without explicit support; CV-190/CLV-190 path is absent              | Record exact local tower, author approved exact options/edges, reject unsupported states          | Model-level source links, biomed/physician signoff, positive and negative pair tests     |
| PRB-003 | BLOCKER  | Clinical governance             | All 15 procedures draft; no clinical owner recorded                                                                          | Named owner per exemplar and revisioned claim/limitation approval                                 | Signed evidence snapshot and accountable release approval                                |
| PRB-004 | HIGH     | EBUS needle/scope pairing       | Four Pentax/Luer Cook configurations remain public against an Olympus-only public scope cohort                               | Exact hub/model filtering after owner approval                                                    | Every valid pair accepted; every unsupported pair rejected; source visible               |
| PRB-005 | HIGH     | Therapeutic scope/video pairing | Five scopes and four processors are independently selectable without exact edges                                             | Build exact approved system graph and unsupported-state UX                                        | Matrix tests and saved-card reconstruction tests                                         |
| PRB-006 | HIGH     | Chest catheter/drain fit        | ReSolve 14 Fr and Oasis can be co-selected; no exact adapter/direct-fit source located                                       | Obtain exact adapter evidence or block direct-fit implication                                     | Dual-source exact chain and negative fit test                                            |
| PRB-007 | HIGH     | IPC system boundary             | Aspira/Rocket products can mix; 13 rules lack exact target identities                                                        | Resolve exact same-system targets and enforce boundaries                                          | Exact product edges, cross-system rejection, source-linked rationale                     |
| PRB-008 | HIGH     | Rocket R51401                   | Frozen source predates CIB133 valve/clamp change                                                                             | Verify local revision and publish current governed source/safety fact                             | Stock revision confirmation, physician approval, forward release                         |
| PRB-009 | HIGH     | Current primary evidence        | Exact ERBE flexible APC probe and Micro-Tech TT code sources not located                                                     | Manufacturer inquiry; keep exact rows held                                                        | Current exact IFU/UDI/order table or explicit continued hold                             |
| PRB-010 | HIGH     | Tier 1 content gaps             | 23 required/conditional slot rows / 18 roles have no strict public Tier 2 product                                            | Prioritize only clinically necessary gaps; never expose candidate/hidden rows to inflate coverage | Owner-approved exact product evidence or explicit bounded empty state                    |
| PRB-011 | HIGH     | Source-link usability           | Device page exposes no outbound exact source/revision link                                                                   | Add source title, publisher, revision/date, locator, scope, and link near consequential facts     | Keyboard-accessible link and model-linked provenance acceptance                          |
| PRB-012 | MEDIUM   | Source freshness/missing states | Stale/undated current sources are not prominent; missing-source state is weak                                                | Add stale, undated, inaccessible, and exact-source-missing cues                                   | Fixture tests for each state; no silent claim promotion                                  |
| PRB-013 | MEDIUM   | Mobile responsiveness           | THERAPEUTIC_BRONCH root scroll width 402 px at a 375 px viewport                                                             | Wrap/break long rule text and constrain cards/tables                                              | 320/375/768 px screenshots with no unintended horizontal scroll                          |
| PRB-014 | MEDIUM   | Route loading/error/empty       | No route-level `loading.tsx` or `error.tsx`; empty states incomplete                                                         | Add bounded educational fallbacks without exposing candidate content                              | Automated loading/error/empty fixtures plus keyboard/a11y review                         |
| PRB-015 | MEDIUM   | Analytics failure/observability | Local analytics returned 500 when Supabase URL/key was absent                                                                | Fail quietly for users, emit structured non-sensitive diagnostics, document expected config       | No user-blocking error, classified log, test for missing configuration                   |
| PRB-016 | MEDIUM   | Print/screenshot safety         | Print behavior is partial; critical readiness/source context may be lost                                                     | Print stylesheet and screenshot acceptance preserving disclaimer, status, source, and date        | Printed exemplar captures reviewed at desktop/mobile                                     |
| PRB-017 | MEDIUM   | Performance/payload             | Only development behavior inspected; no production payload baseline                                                          | Measure production build after approved runtime work, with route/data budgets                     | Reproducible build artifact and documented budget                                        |
| PRB-018 | MEDIUM   | Accessibility/keyboard          | Core navigation is usable, but full workspace keyboard, focus, table semantics, and contrast were not exhaustively certified | Run structured keyboard/screen-reader/contrast audit after UI changes                             | Zero critical a11y defects; focus and live-region tests                                  |
| PRB-019 | LOW      | Translation/readiness wording   | Disclaimer is good; completeness and consistent beta/readiness wording need review                                           | Translate new states and keep educational/not-institutional language                              | Locale snapshot review and terminology checklist                                         |
| PRB-020 | LOW      | Fine visual polish              | Dense evidence and compatibility text remains difficult to scan                                                              | Improve hierarchy after safety/data work                                                          | Physician usability review without lost context                                          |

## Passing controls to preserve

These frozen behaviors were verified and must not regress:

- public exemplar route resolves;
- hidden product rejects with 404;
- candidate product rejects;
- non-exemplar route rejects;
- alias redirects;
- noindex is present;
- educational disclaimer is present;
- production feature flag was not enabled;
- local enablement requires the exact expected environment value;
- recalled ViziShot 2 FLEX 19G remains hidden;
- no candidate fact is consumed from this packet.

Public-unlisted behavior is a boundary, not a security control. It must remain paired with noindex,
feature gating, strict identity rejection, and explicit educational language.

## Source presentation requirements

A consequential product fact should show:

1. exact product/model/configuration scope;
2. publisher and source title;
3. document identifier and revision/date;
4. page/section/table locator;
5. jurisdiction;
6. evidence status and freshness cue;
7. outbound source link;
8. a visible unresolved/conflicting state when appropriate.

A family source must not appear as exact-model proof unless the exact code is present in the source.
A missing source must produce an explicit gap state, never a blank that looks like approval.

## Error, loading, and empty-state requirements

- Loading must preserve route identity and educational status without showing stale prior-product
  claims.
- Errors must not reveal secrets, environment values, or raw database details.
- Empty roles must say that no reviewed public option is present; they must not pull hidden/candidate
  rows.
- Unsupported combinations must explain the missing evidence boundary without declaring technical
  incompatibility.
- Analytics/telemetry failure must not block educational use, but it must be observable to operators.
- Saved-card reconstruction must fail closed when an exact product or definition set is absent.

## Screenshot and print acceptance

Every AABIP capture should retain:

- unlisted-beta/readiness wording;
- educational disclaimer;
- exact selected product identities;
- unresolved/conflict warnings;
- source/revision/freshness;
- no truncated safety text;
- no unintended horizontal scroll;
- no hidden/candidate/recalled product exposure.

## Active PR classification

**RESOLVED IN ACTIVE PR — VERIFY AFTER MERGE**

- PR #91: owner-disposition corrections F-04, F-05, F-06, and F-10, including the reviewed chest and
  airway role changes.
- PR #92: F-09 rigid-APC requirement behavior plus definition-set retention and the existing launch
  harness.

**PARTIALLY ADDRESSED IN ACTIVE PR — POST-MERGE VERIFICATION REQUIRED**

- Release/reconstruction assurance improves through PR #92, but exact high-risk system edges and
  source presentation remain outside it.
- PR #91's data corrections improve specific frozen findings but do not address the AERO conflict,
  Tier 0 products, EBUS tower, or the source/UX backlog.

Do not duplicate the PR #92 harness. Extend post-merge verification only for findings unique to this
packet.

## Recommended order

1. Merge and verify PR #91/#92 through their own reviews.
2. Close PRB-001 through PRB-003.
3. Bound PRB-004 through PRB-008 before the AABIP demo.
4. Ship source provenance and missing/conflict states.
5. Close mobile, error, analytics, print, accessibility, and performance acceptance.
6. Address content expansion only after the launch surface is safe and governed.

This backlog is educational governance support, not clinical advice.
