# Teaching-first redo: handoff

Written 2026-10-08 at the end of the first session. Start here, then read
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

Bronchoscopy Foundations is being rewritten in another worktree (PRs #349, #350). Do not touch it.

## State of the pull requests

All are drafts awaiting the owner. Nothing is merged. Worktree:
`Interventional-Pulm-Education-Worktrees/claude-education-redo`.

| PR   | Branch                         | Base                                        | Head     | What it is                                                              |
| ---- | ------------------------------ | ------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| #353 | `claude/teaching-first-rules`  | `main`                                      | this doc | Rules, charter, release gate, numbers register, digit bans removed      |
| #354 | `claude/mv-teach-numbers`      | `claude/mv-pre-review-04-20261007` (#347)   | ae4749f2 | Mechanical Ventilation: numbers, first moves, SpO₂ linked to the lesion |
| #356 | `claude/ebus-teach-and-visual` | `codex/ebus-step13-owner-approved-20261007` | b5912cbb | EBUS: sourced numbers, bleeding first moves, visual review steps        |
| #357 | `claude/crrt-teach`            | `codex/crrt-f06-repair-b` (#343)            | 78ee69bb | CRRT first tranche: dose, citrate targets, alarm names, first moves     |

Each module branch contains a merge of `claude/teaching-first-rules`, so its diff shows the rules
files until #353 merges. Each is also stacked on an earlier open PR for that module, to avoid
conflicts; the owner agreed to that for EBUS and it was repeated for CRRT and Ventilation.

## What is done

**Shared (#353).** `docs/teaching-first-rules.md` (reviewer charter and authoring rules);
`AGENTS.md` points to it; release gate 3 and the promotion default rewritten; shared register at
`src/features/learning-module/numbers/teachingNumbers.ts` with `npm run numbers:signoff`; the
shared vocabulary gate allows `%`, "percent", "test", "assessment"; digit bans and the
"keep … below N" check removed from MCS, ECMO, ICU Hemodynamics and Ventilation.

**Mechanical Ventilation (#354).** 19-row register; `ReferenceValues` box and PEEP/FiO₂ tables in
the teaching panels; lung-protection and safety units rewritten; four safety questions re-keyed;
shunt now falls after decompression/drainage (MV-14) and after the branch-correct treatment
(MV-13); review status stripped.

**EBUS Guided (#356).** 13-row register from the PRE-REVIEW-05 packet; bleeding and desaturation
first moves; boundary notes 26 → 8. Visual review: `guided/stageLook.ts` (lighting, shell
material, palette); demonstrations open on scope, fan and target; three-pane row; one-screen
acquisition console at 1100 px and wider; view chips; hub with hero image and "Up next".

**CRRT (#357), first tranche.** 12-row register; pressure-signal first moves; PrisMax alarm titles;
status chrome removed from lessons, cases, source lists and hub.

## What is next, in order

1. **CRRT second tranche** on `claude/crrt-teach`:
   - seven case decisions keyed on "escalate", "coordinate" or "verify" (`content/completeCases.ts`
     lines near 1655, 1696, 1735, 1778, 1856, 1894, 1935) and thirteen deferring alternatives;
   - the 25 checks (23 have the longest option as the key; proposals P-01 to P-10 are in
     `docs/gap-remediation/fellow-review/CRRT-FELLOW-04-owner-proposals.md`);
   - rapid drills (`content/rapidDrills.ts`);
   - per-surface boundary notes on the pressure lab, live pressure device, builder and operations
     view; "synthetic" in lesson and case prose; raw version strings in `CrrtSourceRecord.tsx`.
2. **Mechanical Circulatory Support** (Severe). Fix the two models first: IABP augmentation, and
   the direction of the LVAD power-to-flow estimate. Then drop the "never a number" rule from the
   copy, teach Impella flows by P-level, IABP pressure relationships, HeartMate 3 ranges and the
   MAP goal, and let the learner choose the device in the capstone. Open Codex PR: #345.
3. **ICU Hemodynamics** (balloon volume, injectate, BSA/SVRI, vasoactive ranges, a shock-profile
   section; re-key the "stop and escalate" items). Open PRs: #326, #321.
4. **Cardiohelp ECMO**, **Peripheral Imaging**, **Bronchial Branch Tracing**, then Device Atlas,
   EUS-B and the two anatomy tools. The audit's "errors to fix now" list has seven small items.

Left open in finished modules:

- Ventilation: MV-03 is still a worked explanation (intrinsic PEEP alternates on paired breaths);
  questions beyond the four safety items; hedged lines in `content/postActionCoaching.ts`.
- EBUS: device assets (needs the owner's review of proportions), split-screen clip comparison,
  click-to-pick and the six-label limit, console layout for the clip and model labs, lesson 16 on
  real frames (needs stills held under OD-07), 45 of 108 keys still the longest option.

## Waiting on the owner

- Sign the register rows: `npm run numbers:signoff` (44 rows across three modules).
- Ventilation: driving pressure ≤15 was checked against the Amato 2015 abstract only.
- EBUS: the bleeding sequence is unsourced; AQuIRE rates are from the abstract; the PR reverses
  the Oct 4 OD-10/OD-11 "retain generic" decisions, as the audit asked.
- CRRT: no sourced systemic ionized calcium target; confirm the pressure-signal first moves and
  the alarm mapping.
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
6. Draft PR with: what a fellow now sees, the register table with how each row was checked, what
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
#353 (rules), #354 (Mechanical Ventilation), #356 (EBUS) and #357 (CRRT first tranche) are open
and unmerged; do not redo them. Bronchoscopy Foundations is in another worktree; leave it alone.

Do next, in order:
1. CRRT second tranche on claude/crrt-teach: re-key the seven case decisions and thirteen
   alternatives that defer to "escalate / coordinate / verify", rewrite the 25 checks, fix the
   rapid drills, and remove the remaining per-surface boundary notes. Push to PR #357.
2. Mechanical Circulatory Support: fix the IABP augmentation and LVAD power-to-flow models first,
   then the numbers and first moves. New branch from claude/teaching-first-rules, stacked on the
   open MCS PR (#345) if it still applies.
3. ICU Hemodynamics, then ECMO, Peripheral Imaging and Branch Tracing, following the audit.

Follow the method and traps in the handoff. Verify every number against a source before it goes
in a register, say in the PR how each was checked, and open each module as a draft PR that lists
what the owner should check and what was not run.
```
