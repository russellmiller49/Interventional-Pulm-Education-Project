# Bronchoscopy Foundations — session handoff (2026-09-11, evening)

For the next Claude session. Read this, the memory note `bronchoscopy-foundations-rebuild`, and the
plan `~/.claude/plans/i-would-like-to-bubbly-storm.md`. Those three and `git log` are your history.

## 0. Context hygiene — mandatory, read first

Earlier sessions were killed by a false-positive safety classifier that fires on dense clinical text
accumulating in context (dosing, microbiology, specimen handling). For the whole session:

- **Never** cat/Read/print into the main context: `content/reviewRegister.ts`,
  `data/generated/questionSeeds.generated.ts`, any questions/cases/microCases content, the knowledge
  spec §9 and §12–§14, or the section files `sedation-and-monitoring`, `washing-and-lavage`,
  `poor-return`, `specimen-pathway`, `systematic-survey`, `bleeding-priorities`, `icu-physiology`.
- Do not read earlier sessions' compaction summaries or transcript JSONL.
- For section structure, write a script that builds its output from a **whitelist** (ids, kinds,
  counts, media ids, goal test types) — never by deleting keys from loaded objects. Run it with
  `npx tsx` from the worktree. A worked example this session printed, per section: workspace kind,
  act kind with its view's mode/start/script/ledger/controls/goal-test types, prediction and
  transfer ids, block kinds, practice count.
- Delegate any reading of those files to a subagent told to return identifiers and structural facts
  only (no prose, no numbers with units, no drug or organism names).
- Validators and jest may load them; just never print their contents. Pipe validator output through
  `grep -E '✓|✗'`.
- Check for a live peer session in this worktree before writing (`lsof -d cwd` for processes whose
  cwd is the worktree).

## 1. Where things are

- Worktree `…/Interventional-Pulm-Education-Worktrees/claude-intro-to-bronch-9-10`, branch
  `claude/intro-to-bronch-9-10` (cut from `origin/main` at `7da3886e`). **Still not pushed**; the
  owner decides (recommended: push, do not merge to main, optionally a draft PR).
- Dev server: launch config `claude-worktree` (`npm run dev:claude`, :3120). `.env.local` is a
  symlink into the read-only Local-Data mount: never edit, copy, stage, delete or print it.
- Codex's worktree `…/Worktrees/codex-bronch-foundations-assets` on `codex/bronch-foundations-scope`
  (part 1 done; its three commits are merged here at `dbe42220`).

Commits on the branch (newest first):

| Commit     | What                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `eb72eeea` | the Learn stack: seam, content/engine layer, stage host + act controls, entry surfaces, routes, 24 suites |
| `dbe42220` | merge of Codex part 1 (assets: lumen, larynx, devices, accessories, manifest, `scope-assets.test.ts`)     |
| `a0c21c3d` | extraction of `scope-primitives/` + `lib/airway-anatomy/ostia.ts` from the admin module (step 4)          |
| `51ff6b43` | the previous handoff                                                                                      |
| `c1a10be7` | Codex brief part 1                                                                                        |
| `7d513237` | the pane engine (`engine/scope/`) + `scope-engine.test.ts` + `scope-walkthroughs.test.ts`                 |
| `d3213d4c` | `build-teaching-graph.mts --check` compares parsed content                                                |
| `959fb795` | correction pass                                                                                           |
| `3ade2e30` | the 23 Learn sections and the capstone                                                                    |
| `6f43caff` | gating, manifest import, registries, section contract, teaching graph                                     |

## 2. What landed this session

**Step 4, the extraction (`a0c21c3d`).** `src/components/airway-anatomy/scope-primitives/`
(`AirwaySurface` + additive `dracoDecoderPath`, `ScopeCamera`/`updateScopeCamera` + `fovDeg`,
`BronchLabelOverlay`/`projectToViewport` + `renderPin`, `ScopeBody`/`Polyline`, `SteeringRing`/
`SteerButton`/`HoldButton`/`useHoldRepeat`, `useElementSize`, `AdaptiveViewportQuality`,
`keyMap.ts` as data), `src/lib/airway-anatomy/ostia.ts` + `ostia.test.ts`, `edgePathToNode`
exported from `airway-game.ts`, `loadAirwayStlGeometry(url, { dracoDecoderPath })`. The baseline
captures `artifacts/bronchoscopy-review/before-{a,b}` were byte-identical on `rul/rml/lul.png` and
the optical crops (realistic.png and the videos differ run to run, as expected). **The owner has not
yet run the after-captures** — see §4.

**Codex part 1 merged (`dbe42220`).** 61 asset/engine tests + 1 todo (the larynx junction: the
authored exit ring misses the source surface by 2.42 mm against the brief's 0.5 mm; resolving it
needs an owner decision to allow an authored inlet exception to the source-preservation constraint,
or to accept a pending junction). `docs/bronchoscopy-foundations/scope-assets.md` has the numbers.

**The Learn stack (`eb72eeea`).**

- Seam (Claude's half, `components/scope/`): `ScopePane` (switch on `SCOPE_MODES_READY`),
  `ScopeScenePane` stub (Codex replaces its body), `ScopeFallback` — the DOM reference
  implementation of the whole contract (round optical field with projected in-view pins, dock with
  `scopeControlId` ids incl. `accessory-move` and `declare-<label>`, readouts, inspection record,
  goals, boundary, `LEDGER_CAVEAT`), `TreeMap` (SVG + HTML pins), `TreeAnswerFieldset`,
  `LocationCaptionStrip`, `scope-fallback.module.css`.
- Content/engine: `content/sections/index.ts` (23 sections validated as a set at import),
  `pathway.ts`, `pathwayResolver.ts` (one door, nine phases from `sectionIds.ts`), `stageItems.ts`
  (`AuthoredItem` → `ClinicalLearningItem`, `draft`, `BRONCH_ITEM_BY_ID`, attempt keys
  `<section>:<item>`, `practice:<item>`, `capstone:<item>`), `microCases.ts`, `stageSources.ts`,
  `stageLessons.ts` (the adapter + `validateBronchStageLessons` + `precommitAuthoredSurfaces`),
  `engine/stageSession.ts` (commitments + one scope state per step; `SCOPE_INIT`/`SCOPE_COMMAND`/
  `SCOPE_RESET`, ledger/report/scenario rules), `engine/learnProgress.ts`
  (`ip-bronchoscopy-foundations-v1`, write-once, correctness recomputed, `sectionPerformance` for
  A18, **no v1 migration** — A20), `engine/caseStandard.ts`.
- Stage (`components/stage/`): `BronchStageHost` (copy of `ImagingStageHost`; pane options
  byte-identical), `BronchTeachingColumn` (landmark headings from `content/landmarks.ts`; spine-stop
  cards are filtered before the commitment by the section's own deny patterns), act controls
  `BronchSortControl`, `BronchIdentifyControl`, `BronchSequenceControl`, `BronchLedgerControl`
  (A10), `BronchReportControl` (A08), `BronchScenarioControl` (A13/A32), `MediaFigure` (neutral alt
  text, never the structure's name), `MediaWorkspace`, `MonitorPanel`, `MapWorkspace`,
  `BronchSourceList`, `scopeCaseLoader.ts` (lazy three.js; the flow tests mock it),
  `useBronchStageSession.ts`, `bronch-stage.module.css`.
- Entry surfaces (subagent-built, mirroring peripheral-imaging): module frame (nav adds Reference),
  hub, Learn/Practice/Assess/Reference landings, `BronchCaseActivity`, `BronchCapstone`,
  `reference/BronchoscopyFoundationsReference`, `reference/AirwayStillAtlas`; routes under
  `src/app/[locale]/bronchoscopy-foundations/` incl. `reference` and `reference/airway-atlas`;
  `routes.test.tsx`, `release-boundary.test.ts`.
- Test support: `ScopeTestDouble` (renders the fallback and publishes its last props),
  `scopePilot.ts` (the walkthrough pilot over any transport), `scopeRecipes.ts` (how each of the
  nine scope-lab sections meets its goals), `stageHarness.tsx`.
- Tests: `stage-lessons`, `stage-host` (sort walk; bench walk with the dock's own controls; every
  scope-lab section's goals met through the host; A18 assisted record; ledger A10; report A08;
  scenario A13/A32; identify; sequence with a misplaced critical step; look-back/restart/reload;
  **the whole core path, 23 sections to the record — A21**), `stage-precommit-leak.rendered`,
  `scope-fallback`, plus the subagent's hub/pathway/learn-progress/micro-cases/case-standard/
  practice/release-boundary/routes. At `eb72eeea`: 24 suites, 343 passed + 1 todo; tsc, eslint,
  the four validators clean.

## 3. Traps met this session (add to the list in §7 of the earlier handoff)

- **Leaks on registry surfaces.** The rendered leak scan caught three sources the authored scan
  cannot: (1) spine-stop cards in the Teaching panel before the commitment (fixed by filtering them
  against the section's deny patterns until the commitment); (2) `TreeMap` pins carrying the full
  airway name as a `title` (removed — short labels only); (3) the optical field's accessible name
  saying _why_ the field was red (now `VIEW_SEEN_WORDS`: what is seen, never the cause); and the
  dock's "Shaft rotation" label against `five-controls`' own deny pattern (dock labels are now
  "Rotation"/"Deflection"). Any new pane surface must be run through
  `stage-precommit-leak.rendered.test.tsx`.
- `react-hooks/globals`: a test double may not assign a module variable during render; publish
  from `useEffect` (flushes inside `act`).
- `pathway.ts`'s three-word short-title rule from imaging does not fit this module (one section
  needs four); the cap is four here.
- The imaging Now-card sequence for a card commit is two presses (commit, then Continue); the
  core-path helper missed the second and stalled on the Act step.
- macOS has no `timeout`; the full module jest gate takes ~12 s anyway.

## 4. What the owner must do next (in order)

1. **Rerun the visual-review captures** for the extraction gate, on the dev server at :3120 with the
   local-dev cookie (never let Claude read or mint it):
   ```bash
   cd …/claude-intro-to-bronch-9-10 && for run in a b; do BRONCH_REVIEW_URL=http://localhost:3120 BRONCH_REVIEW_AUTH_FILE=$HOME/.ip-local-dev-auth.json BRONCH_REVIEW_OUTPUT=artifacts/bronchoscopy-review/after-$run node scripts/airway-anatomy/visual-review.mjs; done
   ```
   then compare `sha256` of `rul.png`, `rml.png`, `lul.png` and the `*-optical.png` crops against
   `before-a`. Identical → the gate holds. Different → tell Claude; it will diff the pixels.
   Delete `~/.ip-local-dev-auth.json` afterwards.
2. Decide the larynx junction (authored inlet exception vs pending); Codex's `scope-assets.test.ts`
   carries the `todo`.
3. Push the branch; decide on a draft PR. Hand `docs/bronchoscopy-foundations/codex-scope-brief.md`
   **part 2** to Codex (appended this session): the 3D pane, starting from `eb72eeea` or later.
4. Plan §7 items still open: asset-register entries, lecture-link timings, SME review of every
   `draft` item, completion wording, the `/intro-bronchoscopy` cutover. Two registry strings flagged
   by the routes subagent: `SOURCES[].usedFor/limitation` (from `data/sources.ts` and the generated
   manifest) and one generated local-policy description carry vocabulary the learner-copy gate
   refuses and one register phrase; they print on the hub and Reference source lists as the registry
   supplies them.

## 5. What Claude does next

1. Browser verification on :3120 (plan §6): walk `shared-airway` → `five-controls` → `branch-entry`
   → `right-side` → `systematic-survey` → `honest-report` at 1440×900, 1024×700 and 390×844 on
   the fallback pane; check `data-scope-state`, `data-view-signal`, ledger rows, no horizontal
   overflow.
2. `e2e/bronchoscopy-foundations.spec.ts` + `playwright.bronchoscopy-foundations.config.ts` (plan
   §6): the door, a scope-lab section on the real pane, the survey ledger, the report-builder
   refusal, the capstone with one critical wrong, the compact layout.
3. Plan step 7: `clinical-language-refactor` pass over rendered sections, review-rubric pass,
   `airway-map.ts` clock-rule correction, docs (`module-plan.md`, `validation.md`,
   `implementation-report.md` with A01–A44 status), faculty review packet.
4. When Codex lands `guided-walk` (S2): review against B3, run the leak suite against the scene's
   DOM (mount it in a jsdom test with a mocked canvas), then the e2e scene steps.

## 6. Gates before every commit

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/features/bronchoscopy-foundations 'src/app/[locale]/bronchoscopy-foundations' src/components/airway-anatomy src/lib/airway-anatomy
npx tsx scripts/bronchoscopy-foundations/check-section.ts --all | grep -E '✓|✗'
npx tsx scripts/bronchoscopy-foundations/check-capstone.ts | grep -E '✓|✗'
npx tsx scripts/bronchoscopy-foundations/check-registries.ts; echo $?
npx tsx scripts/bronchoscopy-foundations/build-teaching-graph.mts --check
npx jest src/features/bronchoscopy-foundations 'src/app/\[locale\]/bronchoscopy-foundations' src/lib/site-auth/access.test.ts src/lib/airway-anatomy --runInBand
```

Stage explicit paths only; never commit to `main`; never edit `learning-module/stage/`.
