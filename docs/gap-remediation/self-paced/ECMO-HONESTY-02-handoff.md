# ECMO-HONESTY-02 — removing unsupported local-protocol review and approval claims

Prompt ECMO-HONESTY-02, executed 2026-09-15 by an AI authoring assistant (Claude) at the owner's
request. **Nothing in this batch is clinical, device or institutional approval.** No reviewer, role,
date or reviewed version was added to any record, and nothing that ECMO-03 left `NOT REVIEWED`
became reviewed.

This is a provenance-honesty repair on wording alone. Every clinical instruction the changed
sentences carried is still there, still names the same authorities, and still points the learner at
the same institution.

## Delivery and scope

- Worktree `…/Interventional-Pulm-Education-Worktrees/claude-ecmo-honesty-02`, branch
  `claude/ecmo-honesty-02`, cut from merged `origin/main` at `21fc130a` (the merge of PR #227,
  ECMO-03). The tree was clean and level with `origin/main`; nothing was reset. `origin/main` was
  later merged in at `b5479340` — see [Integration with origin/main](#integration-with-originmain-2026-09-15).
- Read first, as instructed: [ECMO-01](ECMO-01.md), [ECMO-02](ECMO-02-handoff.md),
  [ECMO-03](ECMO-03-handoff.md), the [ECMO-03 claim-review queue](ECMO-03-claim-review-queue.json),
  [SHARED-02](SHARED-02-source-honesty-handoff.md), the ECMO evidence registry and
  `sourceReviewMetadata`, and the current lessons, cases, scenarios, drill panels and stage copy.
- **Module-local.** Every changed runtime, content and test file is under
  `src/features/cardiohelp-ecmo`. The shared critical-care evidence registry, `sourceConflicts.ts`,
  learning-module, routes, catalog, progress, analytics and Device Intelligence are untouched:
  `git diff --stat origin/main` against `src/features/ip-device-intelligence`,
  `src/features/critical-care`, `src/features/learning-module`, `src/lib` and `src/app` is empty.
- G02 was not started.

## What ECMO-03 handed over

ECMO-03's "Findings outside the batch (not changed)" recorded 49 phrase matches across
`clinicalCases.ts`, `practiceSupport.ts`, `scenarios.ts`, `learnLessons.ts` and
`learnPredictionItems.ts` deferring to a "reviewed local process", "reviewed exchange process",
"reviewed configuration strategy" or "approved local protocol", with no local-policy source
registered anywhere in the repository. That is what this batch resolves.

The inventory here is wider than 49 because the scan was widened rather than narrowed: it reads
every `.ts`/`.tsx` file under the module as a TypeScript AST and matches every string literal,
template literal and JSX text node, which picks up the drill teaching panels, the bedside control
strip, the stage hosts, the reducer's history entry and the value guides as well as the five content
files. Nothing found was dropped from the accounting.

## The inventory

[`ECMO-HONESTY-02-review-language-inventory.json`](ECMO-HONESTY-02-review-language-inventory.json)
carries one row per occurrence: file, line, rendered surface, content path, the exact phrase before,
classification, claim type, the supporting source or reviewer if any, the action taken, the
resulting wording and what review is still needed.

|                                                                  |   Count |
| ---------------------------------------------------------------- | ------: |
| **Total occurrences accounted for**                              | **116** |
| A — supported, or asserting no review status at all              |      40 |
| B — clinical teaching stands, review/approval status unsupported |      70 |
| C — historical, non-rendered or dead data                        |       5 |
| D — ambiguous, human review required                             |       1 |
| Occurrences whose wording changed                                |      74 |
| Occurrences left exactly as they were                            |      42 |

The 74 changes are the 70 class-B rows plus four class-C rows that claimed approval in places no
learner reads (a copy-scanner override reason, two code comments and one test contract) and were
corrected anyway because the claim was wrong wherever it sat.

### What "A" means here

Class A covers two different things, and the inventory's `claimType` field says which:

- **`explicit-denial`** (11 rows) — the sentence denies a status rather than claiming one: "not
  manufacturer endorsed", "not a validated patient digital twin", "there is no validated way to do
  it", "does not replace current manufacturer instructions, local protocol, or supervised competency
  validation". These are supported by the module's own review record in
  `content/sourceReviewMetadata.ts`, which says no clinical or device review is recorded.
- **`deferral-no-status-claim`** (20 rows) — the sentence already had the honest shape the prompt
  asks for: "Follow current manufacturer instructions, ELSO guidance, and local policy", "local
  protocols and clinician judgment remain authoritative", "retitrate against perfusion and
  native-heart endpoints under local protocol", "Medication selection and dosing remain
  institution-specific". Nothing to fix.
- **`clinical-use-of-the-word`** (5 rows) — "reviewed"/"approve" describing a clinician reading a
  patient or an image: "cannula position reviewed with the imaging the unit uses", "the patient
  reviewed in a set order", "a list of relationships, not a list of numbers to approve".
- **`learner-activity-state`** (4 rows) — the **Section reviewed** label on the drill and foundation
  stage hosts, which reports this learner's own recorded self-paced visit (ECMO-01) and not a
  faculty review. This follows SHARED-02's decision to leave learner-owned "reviewed" marks alone.

No A row was changed, and no A row was inferred from a publication flag, a file existing, an old
`reviewed` boolean, authored metadata, a source-check date or AI-generated content.

### The one D row

`content/evidence.ts` registers the Badulak 2024 dual-circulation paper under the title **"ELSO-endorsed
position paper on dual circulation during adult VA ECMO"**. ECMO-03-06 recorded that this document
was not available locally and that its year and DOI stand "as registered", so the endorsement
adjective is an unverified attribution about an external document — not a claim about this module.
It is left exactly as it is: retitling a registered source would edit source identity, which ECMO-03
established and this task must not touch. Carried forward as a question for the owner.

## How the class-B rows were rewritten

Two families, handled differently rather than by one substitution.

**1. The canonical air-emergency resumption formula.** "resume support per the current IFU and
approved local protocol", and its long form "your unit's approved ECMO air-emergency protocol". The
deliberate uniformity of this formula is a contract — `resumption-copy-contract.test.ts` exists to
stop an invented shorthand replacing it — so the wording stayed uniform and only the status adjective
went:

| Before                                                                        | After                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| `…per the current IFU and approved local protocol`                            | `…per the current IFU and your local protocol`            |
| `Resume support per current IFU and approved local protocol` (button, labels) | `Resume support per current IFU and local protocol`       |
| `governed by the current IFU and your approved local protocol`                | `governed by the current IFU and your own local protocol` |
| `your unit's approved ECMO air-emergency protocol`                            | `your unit's own ECMO air-emergency protocol`             |
| `the unit's approved protocol`                                                | `the unit's own protocol`                                 |

"Your unit's own" is the honest form: it points at whatever protocol the learner's program holds,
and says nothing about whether anyone reviewed it.

**2. "The reviewed local …" family.** Each of these was reworded in its own context, because they
were not one phrase:

| Before                                                                            | After                                                                                         |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Mobilize the reviewed emergency exchange process while maintaining support.`     | `Mobilize your unit's emergency circuit-exchange process while maintaining support.`          |
| `Exchange the failing component through the reviewed local process…`              | `Exchange the failing component through your unit's exchange process…`                        |
| `clear the lines through the reviewed local process,`                             | `clear the lines through your unit's de-airing process,`                                      |
| `Escalate to the reviewed configuration strategy` (intervention label)            | `Escalate the configuration decision to the ECMO team`                                        |
| `escalate support configuration through the reviewed local pathway.`              | `escalate the support configuration through your local escalation pathway.`                   |
| `execute the reviewed exchange pathway before systemic support collapses.`        | `execute your unit's circuit-exchange pathway before systemic support collapses.`             |
| `escalate under the reviewed exchange protocol.`                                  | `escalate under your unit's circuit-exchange protocol.`                                       |
| `Verify the pattern and escalate the reviewed response` (action label)            | `Verify the pattern and escalate under local protocol`                                        |
| `…restoration of membrane-lung function after the reviewed exchange process.`     | `…restoration of membrane-lung function after the circuit exchange.`                          |
| `then perform the reviewed circuit exchange while reassessing both circulations.` | `then perform the circuit exchange under local protocol while reassessing both circulations.` |
| `Inspect and escalate according to the reviewed local circuit-exchange protocol.` | `Inspect and escalate according to your local circuit-exchange protocol.`                     |
| `…under the reviewed local protocol.` (escalation sentences, six places)          | `…under your local protocol.` / `…under local protocol.` as the sentence reads                |

Full before/after for every one of the 74 is in the inventory.

## Marking the local-policy dependency

Where a statement leans on a local protocol that is not present or registered, the safety boundary is
preserved and the dependency is named rather than invented. Four places, all module-local:

1. **Hub, Evidence boundary and review status.** A new `Local protocol` row on the device profile,
   beside the existing Publication and Clinical-and-device-review rows, reading:

   > **Local protocol** — None recorded. Where this module defers to local protocol it means your
   > own institution's; no local policy is held or reviewed here.

   The text is a new exported constant `ECMO_LOCAL_PROTOCOL_LINE` in `content/sourceReviewMetadata.ts`,
   the module ECMO-03 created for exactly this kind of statement, and is deliberately independent of
   the publication flag, like `ECMO_MODULE_REVIEW_LINE` beside it. A `.deviceProfileWide` rule lets
   the row span the profile grid so a sentence-length value stays readable at every column count.

2. **Both air-emergency case debriefs and both air-drill debriefs** (`clinicalCases.ts` ×2,
   `scenarios.ts` ×2): the existing safety note now ends "…this simulation does not teach that
   choreography **and holds no copy of that protocol**."

3. **The VV air drill teaching panel** boundary: "…that choreography is device- and
   program-specific, **local protocols differ on it, and this module holds no copy of one**."

4. **The same panel's mechanism paragraph**: "…governed by the current IFU and your unit's own ECMO
   air-emergency protocol, **which this module does not hold a copy of**."

No protocol, step order or threshold was invented to fill the gap, and the module still refuses to
teach the clamp/pump/reset choreography.

## What did not change

- Engine equations, coefficients, circuit interlocks, clamp logic, gas-source and bubble safety
  behaviour, scenarios, case parameters, `requiredInterventionIds`, prerequisites and penalties.
- Every question id, option id, intervention id, reassessment option id and answer key. Only display
  labels changed, and only in the four places listed above and in the tables; the ids they hang on
  are untouched.
- ECMO-03's model-boundary findings: the PaCO₂ floor wording, the saturation-ceiling wording and the
  recirculation-limit wording are byte-identical. `git diff origin/main` is empty against
  `content/storyProblems.ts`, `content/foundationLearningItems.ts`, `content/ecmoValueGuides.ts`,
  `content/evidence.ts`, `content/deviceProfile.ts`, `components/teaching/BloodFlowVsSweepPanel.tsx`,
  `components/teaching/VvSeriesPhysiologyPanel.tsx`, `components/CircuitAndMonitors.tsx` and
  `docs/gap-remediation/self-paced/ECMO-03-claim-review-queue.json`.
- Source dates, IFU facts, source identities, the ECMO-03 claim queue and its `NOT REVIEWED`
  decisions, `sourceReviewMetadata`'s existing records, evidence ids, claims and source classes.
- Progress, storage keys, writers, gating, release and publication constants, routes and analytics.
- Device Intelligence: not read for this task beyond confirming the diff is empty, not changed.

## Test-contract migration

| File · assertion                                                                                                  | Old contract                                                                                                                          | New assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/resumption-copy-contract.test.ts` · "uses the canonical IFU wording rather than an invented shorthand" | Instruction had to match `…approved ECMO air-emergency protocol`; action label had to match `current IFU and approved local protocol` | Instruction must match `…own ECMO air-emergency protocol` and must **not** match `approved`; action label must match `current IFU and local protocol` and must not match `approved` or `reviewed`. Both authorities are still required by name                                                                                                                                                                                                                          |
| `__tests__/bubble-resumption-safety.test.ts` · comment at the owner-decision test                                 | "…every approved local protocol"                                                                                                      | "…every local protocol". Comment only; no assertion changed                                                                                                                                                                                                                                                                                                                                                                                                             |
| New `__tests__/ecmo-honesty-02-review-language.test.tsx`                                                          | —                                                                                                                                     | 160 tests: every module file outside `__tests__` is scanned for five unsupported-status patterns; every authored case, drill and lesson string is scanned separately; both air cases still name the IFU, the air-emergency protocol and the "does not reproduce or teach that sequence" disclaimer; all four debriefs carry the dependency note; both drill panels are **rendered** and asserted; the hub declares the local-protocol absence at both publication flags |

Nothing was skipped, disabled or deleted. The banned-phrase lists in `resumption-copy-contract.test.ts`
(resumption-order and "verified protocol" claims) are unchanged and still pass over the rewritten copy.

The new scan's patterns were checked in both directions before being trusted: all thirteen retired
phrasings match, and eleven retained phrasings — including "cannula position reviewed with the
imaging the unit uses", "Section reviewed", "ELSO-endorsed position paper", "not a validated bedside
method" and the new "your unit's own ECMO air-emergency protocol" — match none of them.

## Executed evidence

Local derived evidence (logs and JSON reports) is outside Git in this session's scratch directory;
commands and results are below. No token or environment file is in this PR.

| Check                                                                                                                                                                                                          | Result                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Baseline, clean tree at `21fc130a`: `node node_modules/jest/bin/jest.js --runInBand src/features/cardiohelp-ecmo 'src/app/\[locale\]/cardiohelp-ecmo' src/features/critical-care src/features/learning-module` | **114 suites (111 passed, 3 failed); 2,580 tests (2,577 passed, 3 failed, 0 skipped)**              |
| Final, same command and scope                                                                                                                                                                                  | **115 suites (112 passed, 3 failed); 2,740 tests (2,737 passed, 3 failed, 0 skipped)**              |
| Failure comparison against the baseline                                                                                                                                                                        | The same three failures, with **byte-identical messages**. No new failure, none fixed, none skipped |
| `npx tsc --noEmit`                                                                                                                                                                                             | Exit 0                                                                                              |
| ESLint `--max-warnings=0` on every changed TS/TSX file                                                                                                                                                         | Exit 0, no warnings                                                                                 |
| Prettier `--check` on every changed file                                                                                                                                                                       | Clean                                                                                               |
| `git diff --check`                                                                                                                                                                                             | Clean                                                                                               |

The three pre-existing failures are `main`'s own and unrelated to ECMO: the CRRT pressure-lab
accessible-name expectation in `critical-care/__tests__/accessibility.test.tsx`, the CRRT station
order in `curriculum-sequencing.test.tsx`, and the all-module static scan in `learner-copy.test.ts`.
They are the same three ECMO-03 and SHARED-02 recorded.

### Browser checks

Local Next dev server on port 3128 (`npx next dev --port 3128 --webpack` from this worktree),
in-app browser, unauthenticated. JavaScript was used only to read DOM text and to scroll; nothing was
written to the page state. `POST /api/analytics` returns 500 because this worktree has no Supabase
environment — the same condition ECMO-03 recorded — and no other request failed.

| Surface                                                                                     | Observed                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/en/cardiohelp-ecmo`, hub source area                                                      | Badge still "UNLISTED DRAFT · Clinical and device review: none recorded". The device profile now carries **Local protocol — None recorded. Where this module defers to local protocol it means your own institution's; no local policy is held or reviewed here.** Screenshot inspected |
| Same, at 375×812                                                                            | Full-width row renders and wraps; `scrollWidth - clientWidth` is 0, no horizontal overflow. Screenshot inspected                                                                                                                                                                        |
| `/en/cardiohelp-ecmo/learn?track=vv&lesson=arterial-bubble-stop`                            | Resume control reads "Resume support per current IFU and local protocol". Stepping through with **Continue without doing this step** to the act step, the knob strip reads "…how support is resumed belongs to the current IFU and your unit's air-emergency protocol"                  |
| Same lesson, drill teaching column                                                          | Both rewritten paragraphs read out of the live DOM and confirmed visible (non-zero box, `display: block`): "local protocols differ on it, and this module holds no copy of one" and "your unit's own ECMO air-emergency protocol, which this module does not hold a copy of"            |
| `/en/cardiohelp-ecmo/practice?track=vv&case=clinical-vv-circuit-air-embolism`, Manage stage | "Your task: Isolate the patient from the circuit, correct and clear the air, then resume support per the current IFU and your local protocol." Intervention label and simulator instruction both rewritten. Screenshot inspected                                                        |
| Same case, Debrief stage                                                                    | Safety note renders in full: "…governed by the current manufacturer IFU and your unit's own ECMO air-emergency protocol; this simulation does not teach that choreography and holds no copy of that protocol." Screenshot inspected                                                     |
| `/en/cardiohelp-ecmo/learn?track=va&lesson=va-differential-hypoxemia`                       | All three rewritten panel strings present and visible in the DOM: the boundary, the standing-option note and the fitting-response paragraph                                                                                                                                             |
| Every route above                                                                           | A scan of `document.body.innerText` for "approved local", "reviewed local", "approved ECMO", "approved protocol", "reviewed exchange", "reviewed emergency", "reviewed configuration" and "REVIEW APPROVED" returned **nothing** on any of them                                         |

**Not captured in a screenshot:** the two rewritten drill-panel paragraphs and the VA panel strings.
The teaching column sits far outside the in-app pane's viewport and the page sets `body { overflow:
hidden }`, so a scroll snaps back before the capture — the same pane limitation ECMO-03 recorded.
They were read out of the live DOM instead, and the new suite renders both panels and asserts the
text, so the claim does not rest on the browser walk alone.

## Checks not run

Full `npm test`; production build; Playwright; Safari or Firefox; keyboard-only and screen-reader
passes; tablet widths; Spanish and Simplified Chinese wording (English fallback only); the VA
Practice air case in a browser (its VV twin was walked and the two share the copy pattern);
authenticated sync or remote analytics; learner observation; faculty, device or institutional review;
any URL fetch.

## Holds carried forward

- **Every ECMO-03 hold stands.** All ten claim-queue items remain `NOT REVIEWED`; nothing in this
  batch touched the queue, the model bounds, the IFU facts or the source dates.
- **No local protocol is established for this module.** The rewritten copy tells a learner to use
  their own institution's; the hub now says the module holds none. Whether the deferrals point at the
  right institutional authority in each case is a faculty question, recorded per row in the
  inventory's `reviewStillNeeded` field.
- **The one D row** (the ELSO-endorsed source title) needs an owner or faculty decision, and the
  document itself, before it can be confirmed or retitled.
- **ECMO-03-05** still leaves the supplied case curriculum's review status unestablished; the Practice
  cases that cite it stay draft.

## Findings outside this batch (recorded, not changed)

The same unsupported wording exists in other modules, which this task is explicitly scoped out of.
Raw counts of the five patterns this batch used, over each module's non-test sources:

| Module                                  | Matches | Note                                                                                                                                                                                                                                         |
| --------------------------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/bronchoscopy-foundations` |      19 | Mostly "under the approved protocol" inside case narratives in `deterioration.ts`, `sedation-and-monitoring.ts` and `washing-and-lavage.ts`, plus one generated review-register row                                                          |
| `src/features/baxter-crrt`              |      11 | Mixed: some assert an approved protocol exists, others are gating or requirement wording ("disabled until an approved local protocol registry is supplied", "Those require a reviewed local citrate protocol") that may be honest as written |
| `src/features/tracheostomy`             |       1 | `content/learnContent.ts`                                                                                                                                                                                                                    |

MV, MCS, HD, PI, ICU Simulation, Airway Stent Mechanics and the shared critical-care sources have
none. Each of those modules needs its own classification pass — the CRRT and BF strings are not all
the same kind of claim, and deciding which are honest is not a mechanical substitution. **This is a
recorded follow-up, not work started here.**

ECMO-03's other out-of-batch findings are unchanged and still open: the shared device-profile
citation `cardiohelp-i-us-2025` naming "Getinge … January 2025" rather than the printed Maquet
Cardiopulmonary GmbH, and the dormant `terminalRules` mastery and score strings.

## Changed files

Module runtime and content:

- `src/features/cardiohelp-ecmo/content/sourceReviewMetadata.ts` (new `ECMO_LOCAL_PROTOCOL_LINE`)
- `src/features/cardiohelp-ecmo/content/clinicalCases.ts`
- `src/features/cardiohelp-ecmo/content/scenarios.ts`
- `src/features/cardiohelp-ecmo/content/practiceSupport.ts`
- `src/features/cardiohelp-ecmo/content/learnLessons.ts`
- `src/features/cardiohelp-ecmo/content/learnPredictionItems.ts`
- `src/features/cardiohelp-ecmo/content/sectionSpecs.ts`
- `src/features/cardiohelp-ecmo/content/localizationCards.ts` (comment)
- `src/features/cardiohelp-ecmo/components/SourcesPanel.tsx`
- `src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css`
- `src/features/cardiohelp-ecmo/components/EcmoCircuitControls.tsx`
- `src/features/cardiohelp-ecmo/components/stage/drillControlResolver.ts`
- `src/features/cardiohelp-ecmo/components/teaching/drills/ArterialBubbleStopPanel.tsx`
- `src/features/cardiohelp-ecmo/components/teaching/drills/VaDifferentialHypoxemiaPanel.tsx`
- `src/features/cardiohelp-ecmo/engine/reducer.ts` (history entry text only; no logic)

Tests:

- `src/features/cardiohelp-ecmo/__tests__/ecmo-honesty-02-review-language.test.tsx` (new)
- `src/features/cardiohelp-ecmo/__tests__/resumption-copy-contract.test.ts`
- `src/features/cardiohelp-ecmo/__tests__/bubble-resumption-safety.test.ts` (comment)

Documents and tooling:

- `docs/gap-remediation/self-paced/ECMO-HONESTY-02-handoff.md` (this file)
- `docs/gap-remediation/self-paced/ECMO-HONESTY-02-review-language-inventory.json` (new)
- `docs/gap-remediation/self-paced/README.md`
- `docs/gap-remediation/self-paced/test-contracts.md`

## Integration with origin/main (2026-09-15)

`origin/main` was merged into `claude/ecmo-honesty-02` after PR #228 (MV-UX-01) and PR #229
(MCS-AF-PRESENTATION-01) landed. No rebase, no force-push, no recreated PR.

|                      |                                                               |
| -------------------- | ------------------------------------------------------------- |
| `origin/main` merged | `b5479340fe7e0c7ee8cd5cdc2bb17cce2c90617b` (merge of PR #229) |
| Merge commit         | `4ce196c0`                                                    |
| Previous base        | `21fc130a` (merge of PR #227, ECMO-03)                        |
| Conflicted files     | one: `docs/gap-remediation/self-paced/README.md`              |

### How the README conflict was resolved

Both sides inserted a new first entry under `## Implementation handoffs` — this branch's
ECMO-HONESTY-02 entry and main's MCS-AF-PRESENTATION-01 entry — so git could not order them.

Resolved **additively**: both entries kept, this branch's first and main's second, with every
other entry below them untouched. Neither side's file was taken wholesale. The resolved list is
the exact set union, verified by comparing entry ids against both parents: **18 entries on main,
18 on this branch, 19 after the merge**, with nothing present on either side missing and nothing
in the result that was on neither side.

One observation, not acted on: **MV-UX-01 has no README entry on current main.** PR #228 did not
add one, so its absence is main's own state rather than something this merge dropped. Adding an
entry for another module's batch would be outside this integration, so it is recorded here
instead.

### `.claude/launch.json` restored

PR #230 previously carried one added entry in `.claude/launch.json` — a dev-server launch
configuration on port 3128, used only to reproduce the browser walk from this worktree. Nothing
in `src`, the test suites or `package.json` references it (the only other "3128" matches in the
repository are coincidental substrings inside hashes, geometry coordinates and product CSVs), so
it is not required by the bounded product change.

It has been **restored to current `origin/main`**: `git diff origin/main -- .claude/launch.json`
is empty, and the file no longer appears in this PR's diff. The handoff's browser-evidence
section now names the plain command (`npx next dev --port 3128 --webpack`) instead of the launch
entry. A temporary entry was added locally to drive the post-merge browser walk and reverted
before committing; it is in no commit on this branch.

### ECMO runtime and content during conflict resolution

**No ECMO runtime or content file conflicted, and none was touched by the resolution.** The only
overlap between the two sides was the README. MV and MCS files came in from main unchanged.

One unrelated post-merge edit was made in this branch, and it is not a conflict resolution: the
file-level doc comment in `__tests__/resumption-copy-contract.test.ts` still described the
canonical fifth step as "the unit's approved ECMO air-emergency protocol", which the batch had
already changed in the assertion below it. The comment now reads "the unit's own …". Comment
only; no assertion, no learner-facing string.

### Post-merge verification

Both runs use the same command and scope: `node node_modules/jest/bin/jest.js --runInBand
src/features/cardiohelp-ecmo 'src/app/\[locale\]/cardiohelp-ecmo' src/features/critical-care
src/features/learning-module`. The baseline ran in a detached worktree at `b5479340`.

| Check                                                                                                                   | Result                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current `origin/main` (`b5479340`), ECMO integration scope                                                              | 114 suites (111 passed, 3 failed); 2,580 tests (2,577 passed, 3 failed, 0 skipped)                                                                              |
| Merged branch, same scope                                                                                               | **115 suites (112 passed, 3 failed); 2,740 tests (2,737 passed, 3 failed, 0 skipped)**                                                                          |
| Failure comparison                                                                                                      | **The same three failures, no regressions, nothing fixed, nothing skipped.** After normalizing the worktree path prefix the messages are byte-identical, 3 of 3 |
| Merged branch, MV and MCS suites (`src/features/mechanical-ventilation`, `src/features/mechanical-circulatory-support`) | **73 suites, 1,506 tests, all passed** — the newly merged #228 and #229 work is intact                                                                          |
| `npx tsc --noEmit`                                                                                                      | Exit 0                                                                                                                                                          |
| ESLint `--max-warnings=0` on every changed TS/TSX file                                                                  | Exit 0, no warnings                                                                                                                                             |
| Prettier `--check` on every changed file                                                                                | Clean                                                                                                                                                           |
| `git diff --check`                                                                                                      | Clean                                                                                                                                                           |

The +1 suite and +160 tests against main are this batch's own
`ecmo-honesty-02-review-language.test.tsx`. The MV and MCS suites #228 and #229 added fall outside
the ECMO integration scope, which is why that scope's totals do not move with them; they are
covered by the separate MV/MCS run above.

The three failures are main's own and unrelated to ECMO — the CRRT pressure-lab accessible name in
`critical-care/__tests__/accessibility.test.tsx`, the CRRT station order in
`curriculum-sequencing.test.tsx`, and the all-module static scan in `learner-copy.test.ts`. They are
the same three ECMO-03, SHARED-02 and this batch's pre-merge run recorded. **None is classified as a
regression.**

### Preservation re-checked on the merged tree

|                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory                             | 116 items, ids unique, declared counts match the rows: A 40, B 70, C 5, D 1; 74 changed, 42 unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Banned wording in the ECMO module     | None. The only remaining matches are negative assertions (`not.toMatch`) and the ECMO-HONESTY-02 rationale comment                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ECMO-03 claim-review queue            | 10 items, **all `NOT REVIEWED`**; no reviewer, role, date or reviewed version is filled in anywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Held ELSO source title                | Present and unchanged in `content/evidence.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ECMO-03 protected files               | `git diff origin/main` empty for `storyProblems.ts`, `foundationLearningItems.ts`, `ecmoValueGuides.ts`, `evidence.ts`, `evidenceResolver.ts`, `deviceProfile.ts`, `drillSpecs.ts`, `BloodFlowVsSweepPanel.tsx`, `VvSeriesPhysiologyPanel.tsx`, `CircuitAndMonitors.tsx`, `components/evidence`, `engine/simulation.ts`, `engine/types.ts`, `engine/progress` and the ECMO-03 claim queue — so the PaCO₂ floor, saturation-ceiling and recirculation-limit wording, the source identities, dates and revisions, the engine and the progress layer are all byte-identical to main |
| Device Intelligence and other modules | `git diff origin/main` empty for `src/features/ip-device-intelligence`, `src/features/mechanical-ventilation`, `src/features/mechanical-circulatory-support`, `src/features/critical-care`, `src/features/learning-module`, `src/lib`, `src/app` and `.claude`                                                                                                                                                                                                                                                                                                                   |

### Post-merge browser checks

Local Next dev server on port 3128 from this worktree, in-app browser, unauthenticated.
JavaScript read DOM text and scrolled only; nothing was written to page state.

| Surface                                                                                | Observed                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/en/cardiohelp-ecmo`, hub source area                                                 | Badge "UNLISTED DRAFT · Clinical and device review: none recorded"; Publication "Unlisted draft"; **Local protocol — None recorded. Where this module defers to local protocol it means your own institution's; no local policy is held or reviewed here.** Screenshot inspected                                                                                       |
| Same, at 375×812                                                                       | Full-width row wraps and renders; `scrollWidth - clientWidth` is 0. Screenshot inspected                                                                                                                                                                                                                                                                               |
| `/en/cardiohelp-ecmo/learn?track=vv&lesson=arterial-bubble-stop`                       | Control reads "Resume support per current IFU and local protocol"; the knob strip reads "…belongs to the current IFU and your unit's air-emergency protocol". Both dependency markers — "holds no copy of one" and "does not hold a copy of" — present and visible in the DOM                                                                                          |
| `/en/cardiohelp-ecmo/practice?track=vv&case=clinical-vv-circuit-air-embolism`, Debrief | Safety note renders in full: "…governed by the current manufacturer IFU and your unit's own ECMO air-emergency protocol; this simulation does not teach that choreography and holds no copy of that protocol." The case source list still shows ECMO-03's dating and "Clinical and device review of how this module uses it: none recorded yet." Screenshots inspected |
| `/en/cardiohelp-ecmo/learn?track=va&lesson=va-differential-hypoxemia`                  | All three rewritten VA panel strings present and visible                                                                                                                                                                                                                                                                                                               |
| Every route above                                                                      | A scan of `document.body.innerText` for "approved local", "reviewed local", "approved ECMO", "approved protocol" and "REVIEW APPROVED" returned **nothing**                                                                                                                                                                                                            |
| Network                                                                                | Every page, chunk, font and GLB 200. The only failures are `POST /api/analytics → 500`, because this worktree has no Supabase environment — the same condition ECMO-03 recorded and unchanged by the merge. The remaining console errors are the in-app pane's HMR WebSocket retries                                                                                   |

### Post-merge checks not run

Full `npm test`; production build; Playwright; Safari or Firefox; keyboard-only and screen-reader
passes; tablet widths; Spanish and Simplified Chinese wording; the VA Practice air case in a
browser; authenticated sync or remote analytics; learner observation; faculty, device or
institutional review. **MV-UX-01 and MCS-AF-PRESENTATION-01 were confirmed present by their full
test suites passing and by a byte-identical diff against `origin/main`, not by a browser walk**;
neither module was modified.

## Stop boundary

One bounded PR, then stop. Do not merge or deploy as part of this task, do not begin G02, do not
start the other modules' review-language pass, and do not modify Device Intelligence.
