# Bronchoscopy Foundations rewrite: handoff

Written 2026-10-08. Start the next session from this file.

## Why this work exists

Russell Miller rejected the direction the module had taken: too conservative, too many protective
statements and references, and it had lost sight of its purpose, which is to teach fellows
bronchoscopy simply. His plan is `~/Downloads/Bronchoscopy Foundations — Rewrite Plan.md`
(15 sections, about 110 minutes, ten authoring rules, a numbers register, pilot first). Read it
before writing anything. Do not reintroduce hedges, disclaimers, model-boundary notes or "ask your
supervisor" answers.

## Where things stand

| PR   | Branch                             | State                                                                                                             |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| #349 | `claude/bf-rewrite-rules`          | Draft. The new rules; no content change.                                                                          |
| #350 | `claude/bf-rewrite-pilot`          | Draft, stacked on #349. The right lung and bleeding, rewritten.                                                   |
| #352 | `claude/bf-rewrite-register`       | Draft, stacked on #350. Register rows 15, 19, 20 and 21 extracted; two sources added (U17, U18). No learner copy. |
| #351 | `claude/bf-3d-retry`               | Draft, from `main`. The 3D-retry fix lifted out of #348, with its three end-to-end cases.                         |
| #348 | `claude/bf-pre-review-04-20261007` | Draft, superseded in direction. Its 3D-retry fix is now #351; close #348 once #351 merges.                        |

Nothing is merged. The work was done in the worktree
`…-Worktrees/claude-bf-pre-review-04-20261007`, which is currently on `claude/bf-rewrite-pilot`.

Owner decisions so far (2026-10-08):

- Rewrite, 15-section structure and "teach the numbers" are accepted (plan decisions 1–3).
- The four Nashville bleeding rows are signed.
- The right lung's prediction stays as reworded in `b06c9009`. It was ambiguous before; see the
  lesson under "Traps".

## How a rewritten section is built

Read `docs/bronchoscopy-foundations/section-authoring-guide.md` (two pages) and use
`content/sections/right-side.ts` and `bleeding-priorities.ts` as the exemplars.

- Mark the section `authoringContract: 2`. The rules in `content/authoringRules.ts` are then
  strict for it.
- Flow in `content/courseFlow.ts`: `hook()` → `check('check')` → `screen(...)` → practice →
  `check('transfer')` → `close([...])`.
- Numbers: `num('id')` from `content/numbers.ts`. A number that is not there gets a `to-extract`
  row, and you stop. Never type a value from memory.
- Check as you go:

```bash
npx tsx scripts/bronchoscopy-foundations/check-section.ts <section-id>
```

- Machinery already available: click-on-image (`find` act; add frames in
  `scripts/bronchoscopy-foundations/build-find-frames.mjs`), several activities per section
  (`moreActs`, `CourseChunk.act`), labelled tour stops (`section.tour`, `CourseChunk.tour`),
  cases where a wrong move plays out (`AuthoredChoice.consequence`, frame `time`, numeric
  `MonitorReading`), first-move cards (`role: 'first-moves'`, `steps`, `callForHelp`).

## What is left

In the plan's order. The plan gates the 13 remaining sections on fellow sessions with the pilot;
ask Russell whether that gate still holds before starting them.

1. **Get #349 and #350 reviewed and merged**, then branch each batch from `origin/main`.
2. **Still open from the pilot, for Russell:**
   - Confirm the bleeding first-move card, especially step 2 (suction).
   - Confirm three orientation statements in the right lung's image questions (carina: membranous
     wall at 7 o'clock; upper lobe: anterior to the left; middle lobe: midline to the left). They
     were derived from the survey's outlines, not from a recorded camera roll.
   - Confirm the basal mnemonic M-A-L-P.
   - Sign the remaining register rows as sections come to use them. None of rows 1–17 is signed.
3. **Register rows still open.** Rows 15, 19, 20 and 21 were extracted on 2026-10-08 (#352) and
   wait for Russell's signature. Three things in them need his decision:
   - Methylene blue: the expert panel (U17) and the product label (U18) give different doses. Both
     are in the register; he picks one.
   - Naloxone and flumazenil doses: ASA 2018 prints none. `reversal-agents` stays `to-extract`
     until a source is chosen (plan decision 4).
   - The ASRA checklist is under review, with an update expected in early 2027.
     Row 22 (scope diameters) needs the instructions for use of the unit's scopes. Rows 1–17 still
     have no recommendation number or page.
4. **Restructure to 15 sections** (`content/sectionIds.ts`, `pathway.ts`, `BRONCH_SECTION_STAGE`,
   phases, `lessonVersions.ts`), with the progress migration map from the plan and a test for it.
   Retire `what-completion-means`.
5. **Rewrite the other 13 sections** from their briefs, in the plan's three batches. Two are new:
   `biopsy-and-specimens` and `ventilated-patient`. Apply the content fixes the briefs name
   (foreign-body aspiration is an indication; site choice from the CT; raising pressure limits is
   recommended, not unsafe).
6. **Rewrite the hub and the closing screen.** The hub still says "authored geometry". It carries
   the course's one boundary statement.
7. **Practice and assessment:** the image bank, about 40 vignettes with numbers, four evolving
   cases, mixed sets of ten, the eight integrated cases with labels hidden until after the answer,
   and about 25 objectives replacing the 108. Self-check mode is plan decision 5, not yet made.
8. **Abnormal images** for sections 8, 10, 12 and 14. Bleeding has no image questions until these
   exist. Rights and de-identification are still pending on all 100 registered files.
9. **Re-decide the review-register refusal rows** (R25, R26 and others) row by row with Russell.
10. **Plan decisions 4–10** are still open, including rescue doses and amending the
    `medical-education-modules` skill (user-level only; back it up before editing).
11. **Cut over from `/intro-bronchoscopy`** after the final pass with fellows.

## Checks

```bash
npx jest src/features/bronchoscopy-foundations "src/app/\[locale\]/bronchoscopy-foundations"
```

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```

```bash
npx eslint src/features/bronchoscopy-foundations
```

```bash
BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3120 npx playwright test -c playwright.bronchoscopy-foundations.config.ts -g "<title>"
```

State at handoff: 39 Jest suites pass; type check and lint are clean; the end-to-end tests that
touch the two pilot sections pass against the dev server. The full end-to-end suite has not been
run. Nine Jest suites in other features fail in this checkout and were not touched by this work.

## Traps

- A stem must describe what the operator did. Never assert an absence the learner can take as a
  fact about the anatomy: "You have not seen a side opening" was read as "none has come yet".
- `tsc` dies in V8 without the larger heap.
- "wrong", "correct" and "score" are still refused in learner copy, step instructions included.
- `BRONCH_SECTIONS` holds resolved copy. Run rule checks on the raw `section` export.
- The lesson of a rewritten section ends on `explain`, not `transfer`; tests branch on
  `authoringContract`.
- Do not key the image control on its answer count; it remounts and skips the feedback.
- Tailwind strips list numbers; set `list-style: decimal` where order matters.
- Sessions on this module have died from a safety-classifier false positive on accumulated
  clinical text. Mine an old section through a subagent digest and write one section per session.
- Do not edit `learning-module/`, the scope engine or the 3D assets. The verdict card's wording
  and the scope pane's notes are changed through props (`REWRITTEN_VERDICT_FRAMES`, `plain`).

Screenshots of the pilot are in Local-Data, `renders/output/bf-rewrite-pilot-2026-10-08/`.
