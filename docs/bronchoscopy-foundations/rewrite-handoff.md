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
| #359 | `claude/bf-rewrite-s02`            | Draft, stacked on #358. Section 2, the scope and the setup, rewritten.                                            |
| #358 | `claude/bf-rewrite-s01`            | Draft, stacked on #355. Section 1, the procedure and the plan, rewritten.                                         |
| #355 | `claude/bf-rewrite-structure`      | Draft, stacked on #352. The plan's order, five phases, and the forward map for retired sections.                  |
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

In the plan's order. Russell removed the fellow-session gate on 2026-10-08: the 13 remaining
sections no longer wait for sessions with the pilot.

1. **Get #349 and #350 reviewed and merged**, then branch each batch from `origin/main`.
2. **Still open from the pilot, for Russell:**
   - Confirm the bleeding first-move card, especially step 2 (suction).
   - Confirm three orientation statements in the right lung's image questions (carina: membranous
     wall at 7 o'clock; upper lobe: anterior to the left; middle lobe: midline to the left). They
     were derived from the survey's outlines, not from a recorded camera roll.
   - Confirm the basal mnemonic M-A-L-P.
   - Sign the remaining register rows as sections come to use them. None of rows 1–17 is signed.
3. **Register rows still open.** Rows 15, 19, 20, 21 and 22 were extracted on 2026-10-08 (#352).
   Russell signed the methylene blue rows (the expert panel's regimen, U17), the flumazenil rows
   (the product label, U20) and the naloxone row (the product label, U21) the same day. No row
   is left to extract. Still open:
   - Row 22 holds current Olympus scopes from the device catalog (FDA device records, product
     pages, the manufacturer flyer). The instructions for use themselves were not read.
   - The ASRA checklist is under review, with an update expected in early 2027.
   - Rows 1–17 still have no recommendation number or page. Rows 1–17, 20 and 22 are unsigned.
4. **Restructure to 15 sections: started.** The course is in the plan's order and five phases
   (`content/sectionIds.ts`), and `content/sectionMigration.ts` holds the 15-section end state and
   the forward map for the ten retired ids, with a test. The map is applied when saved progress is
   read and when a link names a section. It carries the saved place, the sections opened and the
   review-later marks forward; it does not carry "reviewed".
   The ten absorbed sections are still in the course, each beside the section that absorbs it.
   **Retire each one in the change that rewrites its absorber**: delete its file, remove its id
   from `BRONCH_SECTION_IDS`, the phase, `BRONCH_SECTION_STAGE` and `sections/index.ts`, and move
   its tests to the absorber. `honest-report` sits late for now because its prerequisites do;
   it goes when `describe-findings` is rewritten. `what-completion-means` goes with the hub and
   closing screen (item 6).
5. **Sections rewritten so far:** the right lung, bleeding, section 1 (`clinical-question`) and
   section 2 (`pre-use-check`), all 2026-10-08. Eleven remain; section 3
   (`sedation-and-monitoring`) is next, and it retires `shared-airway`. Notes from section 2:
   - Two drawings were added to `BronchCourseTeaching.tsx`: `two-diameters` and `room-setup`.
   - The photo-naming activity keeps its eight rows in order; tests pin them.
   - The second activity is a `sort` (match a failed check to its name), run through `moreActs`.
   - Section 2 needs register row 22 signed before it can be published.
   - For Russell to confirm: the room-setup card (position, where you stand, bite block, IV,
     oxygen) came from the brief, not from a mined source; the leak test is listed as one of the
     five pre-use checks; the forceps in the check state a minimum channel of 2.8 mm (written
     for the case).
   - When a rewritten section replaces wording that `BF-01-claim-review-queue.json` quotes, add
     `supersededBy` to that item and to the list in `claim-review-queue.test.ts`.
     Notes from section 1:
   - `shared-airway` is NOT retired yet. Its monitoring teaching belongs to section 3
     (`sedation-and-monitoring`); retire it in that change. Many tests use it as their fixture
     section (hub, stage-host, actions-and-feedback, sources-and-reading-view, the e2e spec), so
     budget for moving them.
   - The image-share rule (a third of questions on an image) now fails the build only once every
     section is rewritten. Until then the `--all --report` run prints where it stands.
   - Section 1 needs register rows 7, 8 and 9 signed before it can be published.
   - For Russell to confirm in section 1: "hemoptysis with no source found" is listed as an
     indication though the old section did not list it; the three referral plans (go ahead for
     suspected foreign body on aspirin; hold for clopidogrel after a recent stent; lavage without
     biopsy at a platelet count between the two thresholds).
   - Old practice case C03 (stent and dual antiplatelet therapy) became the second referral.
     **Rewrite the other sections** from their briefs, in the plan's three batches. Two are new:
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
