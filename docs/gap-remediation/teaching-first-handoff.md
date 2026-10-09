# Teaching-first redo: handoff

Updated 2026-10-08 at the end of the third session. Start here, then read
`docs/teaching-first-rules.md`.

## What this work is

On 2026-10-08 the owner (Russell Miller) reviewed the beta modules and found that review and
release rules had made withholding the default: guideline numbers removed, answers keyed on
"escalate" or "local policy", a boundary note on almost every screen, and review status shown to
learners. His direction: these modules teach concepts to supervised fellows; they are not
guidelines. Fix every issue in the audit, high priority first.

Two owner documents drive the work. Both are in `~/Downloads`, outside the repository:

- `Beta Modules — Learner-Experience Audit.md` (all modules; ratings, evidence, rebuild order)
- `EBUS Guided Course — visual and 3D review.docx` (eight visual problems, six recommendations)

Bronchoscopy Foundations is being rewritten in another worktree (PRs #349 to #360). Do not touch it.

## State of the pull requests

All are drafts awaiting the owner. Nothing is merged. Worktree:
`Interventional-Pulm-Education-Worktrees/claude-education-redo`.

| PR   | Branch                         | Base                                        | Head     | What it is                                                               |
| ---- | ------------------------------ | ------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| #353 | `claude/teaching-first-rules`  | `main`                                      | this doc | Rules, charter, release gate, numbers register, digit bans removed       |
| #354 | `claude/mv-teach-numbers`      | `claude/mv-pre-review-04-20261007` (#347)   | ae4749f2 | Mechanical Ventilation: numbers, first moves, SpO₂ linked to the lesion  |
| #356 | `claude/ebus-teach-and-visual` | `codex/ebus-step13-owner-approved-20261007` | b5912cbb | EBUS: sourced numbers, bleeding first moves, visual review steps         |
| #357 | `claude/crrt-teach`            | `codex/crrt-f06-repair-b` (#343)            | 0837ddf4 | CRRT, both tranches: dose, citrate targets, alarm names, cases, checks   |
| #361 | `claude/mcs-teach`             | `claude/teaching-first-rules`               | 96b026f7 | MCS: IABP and LVAD models fixed, numbers, first moves; contains #345     |
| #363 | `claude/hd-teach`              | `claude/teaching-first-rules`               | 1d750699 | ICU Hemodynamics: numbers, first moves, shock profiles; contains #326    |
| #365 | `claude/ecmo-teach`            | `claude/teaching-first-rules`               | f1f884ac | Cardiohelp ECMO: limits, starting values, air and differential hypoxemia |
| #366 | `claude/pi-teach`              | `claude/teaching-first-rules`               | 78821d31 | Peripheral Imaging: one model statement, dose numbers, radial EBUS views |
| #367 | `claude/bbt-teach`             | `claude/teaching-first-rules`               | b11e8828 | Branch Tracing: verdict from the CT's air, 13 junctions; contains #342   |

Each module branch is based on, or contains a merge of, `claude/teaching-first-rules`, so its diff
shows the rules files until #353 merges. Where a module had an earlier open PR, the branch is
stacked on it or contains a merge of it, to avoid conflicts.

## What is done

**Shared (#353).** `docs/teaching-first-rules.md` (reviewer charter and authoring rules);
`AGENTS.md` points to it; release gate 3 and the promotion default rewritten; shared register at
`src/features/learning-module/numbers/teachingNumbers.ts` with `npm run numbers:signoff`; the
shared vocabulary gate allows `%`, "percent", "test", "assessment"; digit bans and the
"keep … below N" check removed from MCS, ECMO, ICU Hemodynamics and Ventilation.

**Mechanical Ventilation (#354).** 19-row register; `ReferenceValues` box and PEEP/FiO₂ tables;
lung-protection and safety units rewritten; four safety questions re-keyed; shunt falls after
decompression (MV-14) and after the branch-correct treatment (MV-13); review status stripped.

**EBUS Guided (#356).** 13-row register from the PRE-REVIEW-05 packet; bleeding and desaturation
first moves; boundary notes 26 → 8; visual review steps (`guided/stageLook.ts`, three-pane row,
one-screen acquisition console, view chips, hub with hero image).

**CRRT (#357).** 19-row register; pressure-signal first moves; PrisMax alarm titles; eight
narrative cases rewritten with values in the stem and a first move as the key; ten promoted cases
cleaned; 25 checks rewritten (key longest in 5, was 23); rapid drills from the PrisMax manual;
status chrome and boundary notes removed.

**MCS (#361).** IABP trace draws augmentation; HeartMate 3 displayed flow is an estimate from
power, and thrombosis raises power and the estimate while real flow falls; Impella flow from the
IFU P-level tables; 34 boundary boxes → 3; 10-row register; Section 9 lets the learner choose.

**ICU Hemodynamics (#363).** 19-row register plus the four shock profiles; both import guards
removed; ectopy, resistance, spontaneous wedge, deterioration and tracing-does-not-return keyed
on first moves under the same ids; case actions name drugs with ranges; key longest in 11 of 44
items (was about 33); seven of nine section boundary notes removed.

**Cardiohelp ECMO (#365).** 24-row register (Cardiohelp factory limits, usual circuit pressures,
flows, sweep, heparin, ACT, anti-Xa, aPTT); "ask for local reference values" replaced on every
channel; air emergency, differential hypoxemia, LV distension and oxygenator failure written out
as first moves; review status and per-step footers removed; prediction items halved.

**Peripheral Imaging (#366).** 13-row register (AAPM levels, ICRP limits, published dose-area
products, VESPA, radial EBUS yield); per-step "Model limitations" aside removed; owner items 2.6,
2.7, 5.4, 6.5 and CW3 closed; eccentric item re-keyed; a radial EBUS read step (no images).

**Branch Tracing (#367).** `markVerdict` from air masks of the shipped slices
(`scripts/branch-tracing/build-answer-plane-air.mjs`); all 13 junctions explained; first
bifurcation lesson task on slice 372 (routes keep 387); a/b letters and naming questions on;
scope view on by default; status text removed.

## What is next, in order

1. **Device Atlas** (Moderate): one "About this reference" link in place of the repeated
   disclaimers; merge reviewed specs into key specs; a filterable scope working channel (the
   BF-1TH190 page reports none although its reviewed profile records 2.8 mm); "how it's used".
2. **EUS-B simulator** (one badge, the painted-node notice once, a guided round, a link from the
   EBUS course) and the **two anatomy tools**: Live Anatomy `airway-map.ts:460` ("RB7+8" should be
   LB7+8) and `:660`; the RB4/RB5 orientation conflict with Synchronized Anatomy; hide developer
   controls. These are in the audit's "errors to fix now" list.
3. **MV `learningCurriculum.ts:324`** credits 4–8 mL/kg and plateau <30 to the 2024 ATS update;
   check whether #354 already corrected it to the 2017 guideline.
4. **Text length.** No module reached the audit's 40% cut: Hemodynamics about 7%, ECMO about 6%,
   Peripheral Imaging none (its stated minutes were raised from 106 to 207 instead). A separate
   cutting pass per module is still owed.
5. **Simulator and copy now disagree in places** (listed in each PR): ECMO right-arm saturation
   is fixed and resumption is one press; Hemodynamics teaches balloon volume, resistance and
   ectopy in words only; Branch Tracing has no verdict band on the full routes.

Left open in finished modules:

- Ventilation: MV-03 is still a worked explanation; questions beyond the four safety items;
  hedged lines in `content/postActionCoaching.ts`.
- EBUS: device assets, split-screen clip comparison, click-to-pick and the six-label limit,
  lesson 16 on real frames (needs stills held under OD-07), 45 of 108 keys still the longest.
- CRRT: keyed case actions still have `effects: []`; no citrate dose; filtration fraction is a
  constant in the engine.
- MCS: no HeartMate 3 IFU or Abbott card locally, so no typical flow, power or PI ranges.
- Peripheral Imaging: a radial EBUS section on the owner's own stills; `modelBoundary` text still
  renders under the 3D suite.
- Number-only sources (textbook chapters) are not yet records in each module's source registry
  (Hemodynamics, ECMO, Peripheral Imaging).

## Waiting on the owner

- Sign the register rows: `npm run numbers:signoff`. Unsigned: Ventilation 19, EBUS 13, CRRT 19,
  MCS 10, Hemodynamics 19, ECMO 24, Peripheral Imaging 13.
- Rows read as abstracts or secondary pages only: Ventilation driving pressure (Amato 2015
  abstract); EBUS AQuIRE rates; ECMO ACT and anti-Xa (two textbooks quoting ELSO 2014);
  Peripheral Imaging CONFIRM, VESPA and Chen 2014 (abstracts) and the ICRP limits (ICRPaedia).
- Unsourced first-move lines kept and listed in each PR: EBUS bleeding sequence; Hemodynamics
  hemoptysis sequence and "vasopressin is the usual second vasopressor"; ECMO resume clamp order
  (assembled from two IFU passages); Peripheral Imaging radial EBUS technique steps.
- Decisions reversed because the audit asks for it: EBUS OD-10/OD-11; ECMO-FELLOW-01,
  ECMO-HONESTY-02, ECMO-FELLOW-04 OV-2; Peripheral Imaging 2.6 (RAO/LAO mapping adopted);
  Branch Tracing OD-03 and OD-06.
- #357: the eight new case stems; three departures from proposals P-03, P-05 and P-08.
- #361: the model constants (augmentation 1.5 pulse pressures, thrombus +3.6 W and half the
  flow); a HeartMate 3 parameter card if available.
- #363: wedge duration (no source found, so none is taught); CI endpoint 2.0 in three cases
  against 2.2 in the register.
- #367: saved drafts on the first-bifurcation lesson are set aside; slice numbers where a wall
  appears are threshold arithmetic.
- CRRT: no sourced systemic ionized calcium target.
- Shared fixes 5 and 6 of the audit: amend the education skill, and decide the open packets.

## Method that worked

1. Branch from `claude/teaching-first-rules`; merge the module's open PR branch if there is one.
2. A read-only subagent inventories learner-visible text in four classes (review status, withheld
   numbers, deferral keys, model notes), plus where live values render, the checks, and every
   sourced number in the module's packets. Ask it to quote, with `path:line`.
3. Verify each number against a source before it goes in the register. Useful local texts are in
   `Interventional-Pulm-Local-Data/private-references/critical-care-full-textbooks/` and
   `device-manuals/`; extract with `pdftotext` into the scratchpad. Record honestly in `checkedBy`
   when only an abstract or a packet was read.
4. Rewrite the copy; render numbers from the register.
5. A second subagent repairs tests under a brief that forbids production edits: delete assertions
   that required a hedge, update pinned wording, invert behavior tests, add a
   `teaching-numbers.test.ts`, and report anything that looks like a real bug.
6. Review the test pass's production findings and fix them yourself: every run found real
   contradictions (a sentence broken by an interpolated value, a key that disagreed with a list
   on the same panel, leftover status words).
7. Draft PR with: what a fellow now sees, the register table with how each row was checked, what
   the owner should check, what is not done, and what was not run.

## Traps

- **Recorded owner decisions win** over a rewrite, unless the audit itself asks for the change.
  Keep an approved sentence verbatim and add the number after it.
- Each module has more hedge locks than the audit lists: `not.toMatch(/\d/)` in tests, per-module
  digit guards (Peripheral Imaging still has them), and review-packet JSON fixtures that freeze
  question wording. Sync the fixture instead of weakening the test.
- `.next/dev/types` goes stale after running a dev server and breaks `tsc`: delete it.
- `tsc --noEmit` needs `NODE_OPTIONS=--max-old-space-size=8192`.
- Prettier reformats long lines, so a later scripted string replace can miss silently. Assert that
  the old text was found.
- Never run Prettier on `EBUS-course/` files.
- Ventilation and CRRT routes need a signed-in tester and 404 locally. EBUS Guided loads without
  sign-in (`npm run dev:claude`, port 3120) after `node scripts/build-socal-ebus-course.mjs`.
  Rebuild the embed after every course-app edit.
- EBUS Playwright specs: use a throwaway config with `baseURL: 'http://127.0.0.1:3120'` and no
  `webServer`; run `ebus-label-spacing` with `--workers=1`.
- The built-in browser pane throttles `requestAnimationFrame` when hidden, so iframe resize
  messages never fire there. Measure with a Playwright script.
- "Too many active WebGL contexts" in a spec means a renderer is being rebuilt on render.
- Before editing a worktree another session used, check file modification times, not only
  `git status`: a copy-pass subagent from the earlier session was still writing an hour later.
- Register values such as "above 2.5" or "10 mL, iced" break sentences that already say "above"
  or continue after the value. Read every interpolated sentence once.
- Never put backticks in an unquoted shell heredoc (a PR body had commands executed and text
  removed). Use `<<'EOF'` and `--body-file`.
- zsh does not word-split `$FILES`: pipe a file list through `xargs`.
- A word replacement across learner strings ("authored" → "model") leaves clumsy phrases; ask
  the test pass to grep for them.
- A guideline may not print the number a lead attributes to it (AAPM MPPG 12.a has no
  dose-area-product level). Search the whole document before registering.
- A module-specific reference patient breaks any "one patient across devices" comparison.
- An HU flood fill needs a mask crop guard: a mark outside the crop must give no verdict.
- Baseline reds on `main`: the critical-care static-copy guard (three MCS "seed" findings) and two
  CRRT tests that #343 fixes.

## Prompt for the next session

```text
Continue the teaching-first redo of the beta modules.

Read first, in this order:
1. docs/gap-remediation/teaching-first-handoff.md (on branch claude/teaching-first-rules, PR #353)
2. docs/teaching-first-rules.md
3. ~/Downloads/Beta Modules — Learner-Experience Audit.md

Work in the worktree Interventional-Pulm-Education-Worktrees/claude-education-redo. Draft PRs
#353, #354, #356, #357, #361, #363, #365, #366 and #367 are open and unmerged; do not redo them.
Bronchoscopy Foundations is in another worktree; leave it alone.

Do next, in order:
1. Device Atlas: one "About this reference" link, reviewed specs merged into key specs, a
   filterable scope working channel (fix BF-1TH190), "how it's used" lines.
2. EUS-B simulator and the two anatomy tools, including the audit's "errors to fix now" for Live
   Anatomy (airway-map.ts:460 and :660) and the RB4/RB5 orientation conflict.
3. A text-cutting pass on Hemodynamics, ECMO and Peripheral Imaging toward the audit's 40%.

Follow the method and traps in the handoff. Verify every number against a source before it goes
in a register, say in the PR how each was checked, and open each module as a draft PR that lists
what the owner should check and what was not run.
```
