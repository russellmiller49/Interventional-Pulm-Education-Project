# CRRT-FELLOW-06 Repair B — bounded implementation handoff

**READY FOR BOUNDED RE-ACCEPTANCE.** This implements only F06-R04, F06-R05 and the
CRRT-owned accessibility/curriculum baseline reds. It is not Prompt 06, independent
acceptance, clinical/device/source approval, module readiness, or release authorization.

## Identity and scope

- Date: 2026-10-07. Fresh isolated checkout:
  `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-crrt-f06-repair-b`.
- Branch: `codex/crrt-f06-repair-b`.
- Initial and final fetched main: `b85da4a00fc1959ff9d5818d8a2b89d98d275723`.
- Prerequisite #334 independently verified **MERGED**, 2026-10-07 01:22:10 UTC,
  merge `a24d80059d020b0b96d90e9d3bf0c84f6f067ad5`; ancestry check exit 0.
- Tested runtime commit: `8e9a1646888eb003d5ab7ed964d5bc840aaad309`.
  The following commit adds only this handoff. Repair-A content, its tests and prior reports
  are unchanged. All 18 definitions and initial/two-hour raw simulation states compare
  identically with untouched same-main; both makeup raw states/device projections also match.
- Untouched baseline comparison: `/tmp/crrt-repair-b-base-20261007`, detached at that main.
- Production: full `npm run build`, Chromium against `next start` at
  `http://127.0.0.1:3366`; workers 1, retries 0. No dev server was used for these browser checks.
- Synthetic process environment: `NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-test-key`, `NEXT_PUBLIC_SHOW_DRAFT_MODULES=true`.
  No environment/secrets file, owner browser, auth/database state or shared Supabase was used.
- Content `1.1.0-sme-review.1`, engine `1.0.0`; neither denotes reviewer approval.

Read root AGENTS/CLAUDE, local-authoring-assets, structured-medical-modules (including
repository/teaching/visual/acceptance references), interventional-pulm-education and
medical-education-modules. Consulted the CRRT implementation pack's common contract,
owner decisions, source/code notes, coordination, feedback ledger and acceptance boundaries;
final F06 acceptance; Repair-A handoff and independent #334 review; and current beta-finish-line
board. Its CRRT work order and section-10 red ownership agree with this task. No other
runtime lane, full Prompt 06 or Batch-05 decision implementation was started.

## F06-R04 — cumulative makeup containment

**REPRODUCED / FIXED at consumer projection; attribution remains OWNER/SOURCE HOLD.**

The existing CRRT-10 `crrtFixtureWithMakeupBag` and `withCrrtMakeupFlow` fixture runs
100 mL/h makeup for 7,200 seconds through the real session reducer. The second checkpoint
returns makeup to zero and advances another 7,200 seconds. Raw balance is approximately
500 then 900 mL (floating-point tolerance only); carried makeup remains 200 mL. The accepted
device already withholds both cumulative totals. Before repair, evidence/patient/debrief
consumers still publish the raw balance and the debrief exposes dependent overload.

The device's unchanged cumulative-validity function is now exported as
`selectCrrtCumulativeFluidView`. It still reads the rate-based ledger and carried makeup bag
volume; it computes no new quantity. Every affected consumer uses that same decision:

| Consumer                               | Makeup running / returned to zero                                 |
| -------------------------------------- | ----------------------------------------------------------------- |
| Activity evidence rail                 | Balance **Withheld**, with explicit unresolved-makeup explanation |
| Patient & trends                       | Balance **Withheld**, with the existing cumulative reason         |
| First/latest observed trend comparison | Both balance endpoints **Withheld** for the unresolved run        |
| Actual-run debrief                     | Balance **Withheld**, with the cumulative reason                  |
| Dependent total fluid overload         | **Withheld**, with the same reason                                |
| Device Operations / guarded chart      | Existing withholding retained unchanged                           |

`fellow06RepairB.test.tsx` renders real components and checks both contaminated checkpoints,
the actual selector, both trend cells, dependent overload, zero-makeup control, reset and
selector non-mutation. Its original assertions fail on unchanged base: four failed / one
passed; the 500/900 mL debrief reproductions are preserved in logs. An initial exact numeric
assertion was corrected to `toBeCloseTo` for floating-point accumulation; the final base red
still fails on all four intended withholding assertions. No source/membrane placement or
patient attribution was guessed. Raw engine/numeric-audit bookkeeping stays raw and intact.
No nonzero-makeup control or fixture route was added to the shipped product.

## F06-R05 — real production navigation race

**REPRODUCED IN PRODUCTION / FIXED.** Ordinary speed alone concealed the race: the
unchanged “every Cases option is reachable and all four group boundaries stay truthful” test
passes **50/50** on the baseline production build. That result is not used to dismiss R05.

A separate regression delays only CRRT practice RSC navigation by 250 ms, selects CRRT-18
from CRRT-01, waits for the visible new heading/picker, then reloads immediately without a URL
wait. On the baseline production build, all **3/3 delayed repetitions fail**: the visible
CRRT-18 reloads CRRT-01. All three ordinary-speed controls pass. This reproduces a real
optimistic selection/route-commit gap rather than proving a dev-only artifact.

`BaxterCrrtPractice` now derives its visible identity from the committed route. A push request
keeps the current case/session/visit until the new route arrives, after which the existing
LOAD_CASE effect and visit behavior apply. Local duplicate case identity state is removed.
Same-case updates and role changes preserve the run. Existing route unit tests now explicitly
simulate the route commit and additionally check that pending navigation neither changes the
heading nor records a visit to the requested case. No assertion or URL wait was added to the
historical failing E2E test.

Repaired production stress: **150/150**, no retries: 50 historical boundary tests, 50 ordinary
visible-case/immediate-reload tests and 50 delayed-navigation tests. Each new test exercises
CRRT-18 → CRRT-14 → CRRT-02, immediate reload after visible selection, then Back/Forward.
This supports the bounded identity contract; it is not proof for every possible network/browser.

## The two CRRT-owned shared baseline reds

Both reproduce on fresh same-main: **2 failed / 33 passed**, 35 tests.

- Accessibility: the canonical pressure circuit uses its current title plus directional path
  text, rather than the historical comma-separated path list. The test now pins the canonical
  title, the complete ordered blood-path text, all four pressure sites and the two calculated
  relationships. Radio-selection and axe checks remain. Circuit/runtime markup is unchanged.
- Curriculum sequencing: the self-paced catalog deliberately exposes
  `crrt:assess:MASTERY-PRISMAX-01` as a `practice-case`. The exact expected ordered list now
  includes that trailing activity. Additional assertions pin its title, integration stage,
  stageOrder 2, empty prerequisites and non-credit policy. Authored station ordering and the
  non-alphabetical assertion remain; no content, registry, pathway or sorting rule changed.

## Validation and comparison

| Check                                                    | Result                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| Focused R04 + two owned reds                             | 3 suites / 40 tests passed                                     |
| Full CRRT feature Jest within broad command              | 86 suites / 1,060 tests passed                                 |
| Broad scoped Jest on untouched main                      | 139 suites passed / 3 failed; 1,696 tests passed / 3 failed    |
| Same broad command on Repair B                           | 142 suites passed / 1 failed; 1,703 tests passed / 1 failed    |
| Baseline ordinary production R05                         | 50 passed                                                      |
| Baseline new immediate reload regression                 | 3 ordinary passed / 3 delayed failed                           |
| Repaired production R05 stress                           | 150 passed; zero retries                                       |
| All CRRT production specs before added screenshot matrix | 86 passed / 1 existing conditional skip                        |
| Added production balance screenshot matrix               | 10 passed, including explicit applied-theme assertions         |
| Scoped systemic CRRT layout/UX                           | 52 passed; mouse/keyboard, compact and text200 checks          |
| Full production build, base and repaired                 | PASS, training apps/content/assets/Next/standalone preparation |
| Root type-check, 8 GiB heap                              | PASS                                                           |
| All changed TS/TSX scoped ESLint / Prettier              | PASS                                                           |
| `git diff --check`                                       | PASS                                                           |
| 18-case and makeup raw-state/device comparison           | Identical                                                      |

The remaining broad failure is `critical-care/__tests__/learner-copy.test.ts`: the same eleven
MV/MCS lines as baseline, identical failure message/stack after checkout-root normalization.
It was not edited, disabled or waived. No CRRT feature suite fails. The conditional beta-wrapper
browser skip needs the existing local owner flag; no new skip was added.

Exact broad command on both checkouts:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install jest --runInBand \
  src/features/baxter-crrt src/features/critical-care src/features/learning-module \
  'src/app/.*/baxter-crrt' src/app/api/analytics src/app/sitemap.baxter-crrt.test.ts \
  src/features/module-beta src/lib/draft-modules.baxter-crrt.test.ts \
  src/lib/site-search.baxter-crrt.test.ts --json --outputFile=<evidence-json>
```

Playwright used the saved `crrt-repair-b-playwright.config.cjs`, matching all
`baxter-crrt-*.spec.ts`, localhost 3366, one worker, no retries:

```sh
npx --no-install playwright test -c /tmp/crrt-repair-b-playwright.config.cjs
npx --no-install playwright test -c /tmp/crrt-repair-b-playwright.config.cjs \
  --grep 'every Cases option|F06-R05' --repeat-each=50
npx --no-install playwright test -c /tmp/crrt-repair-b-playwright.config.cjs \
  --grep 'F06-R04 zero-makeup'
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3366 SYSTEMIC_UX_OUTPUT_DIR=<evidence>/systemic \
  npx --no-install playwright test -c playwright.systemic-ux.config.ts \
  e2e/systemic-ux.spec.ts e2e/systemic-ux-stabilization.spec.ts --grep 'CRRT|crrt'
```

The additional screenshot matrix runs zero-makeup CRRT-10 at two hours, Patient & trends and
actual debrief, 1280×900, 1440×900, 1024×768, 390×844 and 320×740, both themes. It verifies
balance remains numerical, zero page overflow and zero page errors. A first harness run used
an unnamespaced panel selector; the corrected run resolves the existing namespace and retains
all visibility/output assertions. Applied-theme assertions were added before final captures.
Inspected representative 1280 patient, 320 debrief, compact circuit and text200 circuit captures.
The circuit intentionally scrolls internally at compact widths. Systemic tests check keyboard
focus/navigation and 200% root text; this is not native browser zoom.

Applicable structured-module checks: H5/H8/H9/H10/H11/H12 PASS for this bounded repair
(rendered outputs, identical raw state, honest committed-case visits, explicit withholding,
authorized diff, production/component/responsive evidence). H1–H4/H6/H7 are preservation
checks only, with existing CRRT suites green; their curriculum/teaching/feedback designs were
not changed or newly independently accepted. No claim of full H1–H12/module compliance.

## Evidence, holds and NOT RUN

Raw evidence remains outside Git:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/crrt-repair-b-20261007/`.

Principal files: `base-reds.json/.log`; `base-r04-red-final.log`; `base-r05-production.json/.log`;
`base-r05-slow-navigation.json/.log` and its failure screenshots/traces; `head-r05-production.json/.log`;
`base-jest.json/.log`, `head-jest-final.json/.log`, `baseline-comparison.json`;
`base-runtime.json`, `head-runtime.json`; `head-production-full.json/.log`;
`head-responsive-verified-theme.json/.log` and patient/debrief PNGs; `systemic.log` and captures;
`base-build.log`, `head-build-final.log`, final type-check/lint/format logs; saved config/snapshot
script. Superseded harness/build logs remain clearly separate from final evidence.

Makeup `CONFLICT-CRRT-MAKEUP-001`, CONFLICT-001/002, G01-CRRT-02 and O-01–O-10 remain
unresolved as before. No new physiological relationship, clinical threshold, source status,
reviewer or device mapping was added. Shared feedback is outside this scope and remains with
its owner. Repair A's R01–R03 behavior is preserved and its unchanged production tests pass.

Batch-05 decision queue SHA-256 unchanged:
`fa4b7656f06df44008d99b0d5c92f55aeecb4dd40771e488d1a7d7e15522363b`.
G01 queue SHA-256 unchanged:
`7a80a66e1afa32bdbe7f3cc06bf5732b3ade9e49ed145749673a5b6ce48efc8d`.

**NOT RUN:** new full Prompt-06 acceptance; independent re-acceptance of this implementation;
all-repository Jest/lint; dev-server stress (production race established instead); new original
clinical/manufacturer source adjudication; nonzero-makeup browser route (not shipped; tested
with real reducer/rendered components); human screen reader/native zoom, Firefox/WebKit,
physical touch/PrisMax, real fellows, localization, account sync/live beta/non-admin checks,
owner walkthrough, database/auth writes, merge, deployment or readiness changes.

**Next bounded step:** independent re-acceptance of R04/R05 and the two CRRT reds at this PR's
exact head, preserving Repair A and all owner/source holds. One draft Repair-B PR; stop here.
