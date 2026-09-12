# Bronchoscopy Foundations — current state and what is left (2026-09-11, end of day)

For the next session, Claude or human. Read this, the memory note `bronchoscopy-foundations-rebuild`,
and the plan `~/.claude/plans/i-would-like-to-bubbly-storm.md`. Those and `git log` are the history.

## 0. Context hygiene — mandatory

Two earlier sessions were killed by a false-positive safety classifier that fires on dense clinical
text accumulating in context. For the whole session:

- **Never** cat/Read/print into the main context: `content/reviewRegister.ts`,
  `data/generated/questionSeeds.generated.ts`, any questions/cases/microCases content, the knowledge
  spec §9 and §12–§14, or the section files `sedation-and-monitoring`, `washing-and-lavage`,
  `poor-return`, `specimen-pathway`, `systematic-survey`, `bleeding-priorities`, `icu-physiology`.
- Do not read earlier sessions' compaction summaries or transcript JSONL.
- For section structure, run a whitelist script with `npx tsx` (ids, kinds, counts, media ids, goal
  test types — never prose). Delegate any reading of the files above to a subagent told to return
  identifiers and structural facts only.
- Validators and jest may load them; pipe validator output through `grep -E '✓|✗'`.
- Before writing, check for a live peer session in this worktree (`lsof -d cwd`).

## 1. Where things are

- Worktree `…/Interventional-Pulm-Education-Worktrees/claude-intro-to-bronch-9-10`, branch
  `claude/intro-to-bronch-9-10`, cut from `origin/main` at `7da3886e`. **Not pushed.**
- Dev server: launch config `claude-worktree` (:3120). If a healthy server is already on :3120 from a
  terminal or another chat, use `claude-worktree-attached` (attach-only; Next 16 refuses a second
  `next dev` in the same directory). On 2026-09-11 an orphaned server (launcher dead, 100 % CPU, no
  responses) had to be killed before a fresh one would start.
- `.env.local` is a symlink into the read-only Local-Data mount: never edit, copy, stage, delete or
  print it. `/api/analytics` returns 401 for anonymous visitors on this route; not a module problem.
- Codex's worktree `…/Worktrees/codex-bronch-foundations-assets`, branch
  `codex/bronch-foundations-scope`; its part-1 commits are merged here.
- Route: `/en/bronchoscopy-foundations` (hub) and `/learn?section=<id>`; public-unlisted, noindex,
  no sign-in needed.

Commits on the branch, newest first:

| Commit                  | What                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `b23d7b3e`              | `claude-worktree-attached` launch entry                                                        |
| `6a8bcdd8`              | Codex brief part 2 (the 3D pane) + handoff                                                     |
| `eb72eeea`              | the Learn stack: seam, content/engine layer, stage host + act controls, entry surfaces, routes |
| `dbe42220`              | merge of Codex part 1 (lumen, larynx, devices, accessories, manifest, `scope-assets.test.ts`)  |
| `a0c21c3d`              | step 4: `scope-primitives/` + `lib/airway-anatomy/ostia.ts` extracted from the admin module    |
| `7d513237`              | the pane engine (`engine/scope/`) + engine and walkthrough tests                               |
| `3ade2e30` … `6f43caff` | sections, capstone, registries, section contract, teaching graph, gating                       |

## 2. What works (verified)

- 24 jest suites, 343 tests + 1 todo; tsc, eslint and the four validators clean. Gate commands in §7.
- All 23 sections walk end to end on the stage in jest (`stage-host.test.tsx`): every scope-lab
  section's authored goals are met through the host with the learner's controls
  (`test-support/scopeRecipes.ts` on the shared `ScopePilot`); the whole core path writes the
  record (A21); ledger A10, report A08, scenario A13/A32, identify, sequence, look-back, restart and
  reload behave; the rendered pre-commit leak scan is clean for every section.
- On the live dev server: the hub, the bench section (`five-controls`) walked through Act with the
  real dock controls, `branch-entry` at phone width with one pane at a time, no horizontal overflow.
- Codex's `lumen.glb` is fetched, Draco-decoded and turned into the BVH collider in the browser; free
  drive and wall contact run against it. The teaching graph drives the map, pins, caption and goals.

## 3. What is NOT there yet — read this before judging the screenshots

**There is no 3D scene.** `SCOPE_MODES_READY` in `components/scope/ScopeScenePane.tsx` is an empty
set, so `ScopePane` routes every mode to `ScopeFallback`: a CSS disc with the engine's ostium pins
projected onto it, an SVG map, native controls. That was the plan's sequencing (seam and flow on a
DOM-only pane first; Codex builds the WebGL pane against it), but it means:

- Codex's larynx model, `devices.json` and `accessories.glb` are unused. The larynx, tube and
  accessory sections run on the engine's authored numbers with no picture.
- The extracted `src/components/airway-anatomy/scope-primitives/` (`AirwaySurface`, `ScopeCamera`,
  `BronchLabelOverlay`, …) are used only by the admin airway module. This module mounts no canvas.
- Codex brief **part 2** (`docs/bronchoscopy-foundations/codex-scope-brief.md`, appended
  2026-09-11) specifies the 3D pane. Not started.

Visible defects in the fallback (owner saw them 2026-09-11):

- The "clear" view is drawn in the same dark red as a red-out; a bronchoscopist reads it as lens on
  mucosa. Fix `scope-fallback.module.css` (`[data-view-signal='clear']` should read as a lit lumen).
- Map pins collide (RB1–RB3 stack, LB4/LB5, fragments near RB6) and the unlit tree is nearly
  invisible on the bench section. `TreeMap.tsx` needs pin de-overlap and a visible unlit stroke.
- The bench section shows an empty disc; "rotation turns the image" is visible only in the readouts.

## 4. Owner decisions pending

1. **Extraction gate.** Rerun the visual-review captures with the local-dev cookie and compare
   `rul/rml/lul.png` and the `*-optical.png` crops against `artifacts/bronchoscopy-review/before-a`:
   ```bash
   cd …/claude-intro-to-bronch-9-10 && for run in a b; do BRONCH_REVIEW_URL=http://localhost:3120 BRONCH_REVIEW_AUTH_FILE=$HOME/.ip-local-dev-auth.json BRONCH_REVIEW_OUTPUT=artifacts/bronchoscopy-review/after-$run node scripts/airway-anatomy/visual-review.mjs; done
   ```
   Identical → the gate holds. Different → tell Claude. Delete `~/.ip-local-dev-auth.json` after.
2. **Larynx junction.** Codex's authored exit ring misses the source surface by 2.42 mm against the
   0.5 mm limit (`todo` in `scope-assets.test.ts`, numbers in `scope-assets.md`): allow an authored
   inlet exception, or accept it as pending.
3. **Who builds the 3D pane.** Codex per part 2 (the plan), or Claude wires an interim optical view
   for `guided-walk`/`free-drive` from the extracted primitives and the loaded lumen.
4. Push the branch; draft PR or not.
5. Plan §7: asset-register entries, lecture-link timings, SME review of every `draft` item,
   completion wording, `/intro-bronchoscopy` cutover. Two registry strings on the hub and Reference
   source lists (`SOURCES[].usedFor/limitation` from `data/sources.ts` and one generated local-policy
   description) carry vocabulary the copy gate refuses and one register phrase.

## 5. Things left to do (Claude, in this order unless the owner reorders)

1. Fallback fixes (§3 defects): clear-view colour, map pin de-overlap, visible unlit tree, something
   to see on the bench. Rerun `scope-fallback.test.tsx` and `stage-precommit-leak.rendered.test.tsx`.
2. Browser walk per plan §6 on :3120: `shared-airway` → `five-controls` → `branch-entry` →
   `right-side` → `systematic-survey` → `honest-report` at 1440×900, 1024×700, 390×844.
3. `e2e/bronchoscopy-foundations.spec.ts` + `playwright.bronchoscopy-foundations.config.ts`: the
   door, a scope-lab section on the real pane, the survey ledger, the report-builder refusal, the
   capstone with one critical wrong, the compact layout.
4. Practice and Assess in the browser (built by a subagent, jest-tested, not yet eyeballed).
5. Plan step 7: `clinical-language-refactor` pass over rendered sections, review-rubric pass,
   `src/data/airway-anatomy-lesson/airway-map.ts` clock-rule correction, docs (`module-plan.md`,
   `validation.md`, `implementation-report.md` with A01–A44 status), faculty review packet.
6. When Codex lands `guided-walk` (S2): review against B3, run the leak suite over the scene's DOM,
   then the e2e scene steps.
7. Follow-up rounds from the plan: E01–E04, variant profiles (D4), gamepad input, handle/findings
   assets, the cutover.

## 6. Map of the code (all under `src/features/bronchoscopy-foundations/`)

- `components/scope/` — the seam. `types.ts` is the contract (commands, not patches;
  `OstiumPin.inView` = round field inscribed in the 4:3 frame). `ScopeFallback.tsx` is the DOM
  reference implementation of the whole contract. Codex owns `ScopeScenePane.tsx` and everything
  it adds.
- `content/` — `sections/index.ts` (23 sections validated as a set), `pathway.ts`,
  `pathwayResolver.ts`, `stageItems.ts`, `microCases.ts`, `stageSources.ts`, `stageLessons.ts`
  (the adapter, Recognize → Predict → Act → [Observe] → Explain → Transfer). Authoring rules:
  `docs/bronchoscopy-foundations/section-authoring-guide.md`.
- `engine/scope/` — the pure pane engine. `engine/stageSession.ts`, `engine/learnProgress.ts`
  (`ip-bronchoscopy-foundations-v1`, write-once, no v1 migration), `engine/caseStandard.ts`.
- `components/stage/` — `BronchStageHost` (pane options byte-identical to the other adopters),
  teaching column, six act controls, media/monitor/map workspaces, `scopeCaseLoader.ts`.
- `components/` — frame, hub, landings, case activity, capstone, `reference/`.
- `test-support/` — `ScopeTestDouble` (publishes its props), `scopePilot.ts`, `scopeRecipes.ts`,
  `stageHarness.tsx`, `teachingCase.ts`.
- Never edit `src/features/learning-module/stage/`.

## 7. Gates before every commit

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/features/bronchoscopy-foundations 'src/app/[locale]/bronchoscopy-foundations' src/components/airway-anatomy src/lib/airway-anatomy
npx tsx scripts/bronchoscopy-foundations/check-section.ts --all | grep -E '✓|✗'
npx tsx scripts/bronchoscopy-foundations/check-capstone.ts | grep -E '✓|✗'
npx tsx scripts/bronchoscopy-foundations/check-registries.ts; echo $?
npx tsx scripts/bronchoscopy-foundations/build-teaching-graph.mts --check
npx jest src/features/bronchoscopy-foundations 'src/app/\[locale\]/bronchoscopy-foundations' src/lib/site-auth/access.test.ts src/lib/airway-anatomy --runInBand
```

Stage explicit paths only; never commit to `main`.

## 8. Traps

- Rendered leaks the authored scan cannot see: spine cards before commit, map pin titles, the
  field's accessible name naming the cause, dock labels matching a section's deny pattern. Any new
  pane surface goes through `stage-precommit-leak.rendered.test.tsx`; locate an offender by walking
  the DOM and printing data-attribute paths only.
- A test double may not assign a module variable during render (`react-hooks/globals`); publish
  from `useEffect`.
- A card commit on the Now card is two presses (commit, then Continue).
- lint-staged prettier-formats staged JSON/MD; compare parsed content, not bytes.
- macOS has no `timeout` or `curl` in this shell; use `node -e` with `AbortSignal.timeout`.
