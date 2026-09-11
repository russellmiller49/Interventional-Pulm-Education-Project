# Bronchoscopy Foundations — session handoff (2026-09-11)

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
- For section structure, write a script that builds its output from a **whitelist** (id, act kind,
  workspace kind, view mode/start/controls/assists/defaults/readouts/ledger/script/scriptAirway/
  inaccessible/litAirways, goal tests as event/airway/metric ids, media ids) — never by deleting
  keys from loaded objects. Run it with `npx tsx` from the worktree.
- Delegate any reading of those files to a subagent told to return identifiers and structural facts
  only (no prose, no numbers with units, no drug or organism names).
- Validators and jest may load them; just never print their contents.
- Check for a live peer session in this worktree before writing (ListAgents, or `lsof` for processes
  whose cwd is the worktree). On 2026-09-11 two sessions were writing `engine/scope/` at once.

## 1. Where things are

- Worktree `…/Interventional-Pulm-Education-Worktrees/claude-intro-to-bronch-9-10`, branch
  `claude/intro-to-bronch-9-10` (cut from `origin/main` at `7da3886e`). **Not pushed** at handoff; the
  owner was deciding whether to push (recommended: push, do not merge to main, optionally a draft PR).
- Dev server: launch config `claude-worktree` (`npm run dev:claude`, :3120). The owner symlinked this
  worktree's `.env.local` to `Interventional-Pulm-Local-Data/secrets/.env.local`. Per AGENTS.md it is a
  read-only mount: never edit, copy over, stage or delete it, and never print env values.

Commits on the branch:

| Commit     | What                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `6f43caff` | gating, manifest import, registries, section contract, teaching graph                                    |
| `3ade2e30` | the 23 Learn sections and the capstone                                                                   |
| `959fb795` | correction pass (contract: `narrowing` cords, `scriptAirway`, `depthMm`; item `localPolicyIds`; wording) |
| `d3213d4c` | `build-teaching-graph.mts --check` compares parsed content (prettier reformats committed JSON)           |
| `7d513237` | the pane engine (`engine/scope/`, 19 files) + `scope-engine.test.ts` + `scope-walkthroughs.test.ts`      |
| `c1a10be7` | `docs/bronchoscopy-foundations/codex-scope-brief.md` — Codex brief, part 1 (assets)                      |

## 2. The pane engine (what landed in `7d513237`)

- Location: `src/features/bronchoscopy-foundations/engine/scope/` (the contract header names this
  path; the plan said `engine/`). Twelve files were drafted by the parallel session and reviewed; seven
  are new: `scopeReducer`, `scopeMotion`, `scopeAccessory`, `scopePose`, `scopeRuntime`,
  `scopeEvents`, `anatomyProfiles`.
- API: `createScopeState(view, scopeCase)` and `reduceScope(state, command, inputMode, {view, scopeCase})`.
  The host keeps `ScopeRuntimeState` (contract `ScopeState` + `runtime`: lens smear, red-out cause,
  hold depth); the pane only reads `ScopeState`. A command for a control the view does not offer is
  refused. `loadScopeCase(profile, { fetchJson, loadCollider })` loads the teaching graph and, once
  Codex ships it, `lumen.glb`.
- Contract changes (additive): `location.spineStop`; `OstiumPin.inView` means the **round field
  inscribed in the 4:3 frame**, which makes A06/A28 roll invariance hold by construction. Codex's
  scene must draw the aperture to match (part 2 of the brief).
- Behaviour worth knowing: insertion travels in 0.5 mm increments; the aim guard refuses undecided
  forks in `guided-walk`; advancing with the optical axis at the wall (a proxy from the centerline
  radius) is a contact and puts the lens on the mucosa (red-out) until a 2 mm withdrawal or a 15° bend
  reduction; free drive without a lumen travels the centerline and records `centerline-lock` (A18);
  an exposed accessory is never moved through the channel (A12); `assistant-misreport` resolves only
  after `verify-accessory`.
- Authored numbers (simulator geometry, owner review pending) are in `scopeScripts.ts`: glottis
  30 mm / exit 45 mm in the model larynx, breath cycle 4 s with a cough every third breath, tube from
  35 to 70 mm down the trachea, carina zone 20 mm, 5 s hold, 0.5 mm drift tolerance.
- Tests (node env, on the committed teaching graph, not case-001): profile vs teaching tree, frame
  sign convention, the roll-invariance property over every airway × 3 starts × 7 rotations, ledger
  rules (A07/A30), every authored scope view against `scopeViewErrors`, the copy gate on every
  engine string, and `scope-walkthroughs.test.ts`, whose pilot meets **every authored goal of all nine
  scope-lab sections** with learner controls. Re-run it after any section or engine change.

## 3. In progress at handoff: step 4, the scope-primitives extraction

Plan §2 "Extraction from AirwayAnatomyModule.tsx": move `AirwaySurface` (+ `dracoDecoderPath?`),
`ScopeCamera`/`updateScopeCamera` (+ `fovDeg`), `BronchLabelOverlay`/`projectToViewport`
(+ `renderPin?`), `ScopeBody`/`Polyline`, `SteeringRing`/`SteerButton`/`HoldButton`/`useHoldRepeat`,
`useElementSize`, `AdaptiveViewportQuality` and the key map into
`src/components/airway-anatomy/scope-primitives/`; the pure ostia helpers (`buildUpcomingOstia`,
`resolveOstiaForChild`, `firstLabeledDescendant`, `shortAnatomicalLabel`) into
`src/lib/airway-anatomy/ostia.ts` with a unit test; export `edgePathToNode` from `airway-game.ts`
(the module has a private duplicate). Composites, calibration, VR, the game and the ScopeTracker loop
stay. Admin behaviour must not change.

Line anchors in `src/components/airway-anatomy/AirwayAnatomyModule.tsx` at `c1a10be7`: `STEER_ANGLES`
1237, `SteeringRing` 1239, `SteerButton` 1268, `HoldButton` 1319, `useHoldRepeat` 1357,
`BronchLabelOverlay` 1563, `AirwaySurface` 1763, `ScopeCamera` 1832, `updateScopeCamera` 1841,
`ScopeBody` 1857, `Polyline` 1962, `projectToViewport` 2013, `buildUpcomingOstia` 2027,
`resolveOstiaForChild` 2081, `firstLabeledDescendant` 2123, `shortAnatomicalLabel` 2147,
`useElementSize` 2156, `edgePathToNode` 2213, `AdaptiveViewportQuality` 2265.

**Verification gate — the owner runs the captures.** `/learn/anatomy/airway` needs `site_admin` or the
local-dev cookie. Claude must never sign in, read the token or inject it. The owner wrote their token
to `~/.ip-local-dev-auth.json` (mode 600; do not read it) and was running the baseline twice:

```bash
cd …/claude-intro-to-bronch-9-10 && for run in a b; do BRONCH_REVIEW_URL=http://localhost:3120 BRONCH_REVIEW_AUTH_FILE=$HOME/.ip-local-dev-auth.json BRONCH_REVIEW_OUTPUT=artifacts/bronchoscopy-review/before-$run node scripts/airway-anatomy/visual-review.mjs; done
```

Next steps:

1. Compare sha256 of `rul.png`, `rml.png`, `lul.png` and the `*-optical.png` crops between
   `artifacts/bronchoscopy-review/before-a` and `before-b` (`artifacts/` is gitignored). Identical →
   byte-identical is the gate. Different → capture is not deterministic; tell the owner and compare
   with a pixel tolerance instead.
2. Extract; run `npx tsc --noEmit -p tsconfig.json`, `npm test -- airway`, eslint on the touched paths.
3. Ask the owner to rerun the loop with `after-$run`; compare against the baseline; commit.
4. Remind the owner to delete `~/.ip-local-dev-auth.json` afterwards.

## 4. Codex (Astra)

- Brief `docs/bronchoscopy-foundations/codex-scope-brief.md` (`c1a10be7`), **assets only**: teaching
  `lumen.glb` (+ routes-in-lumen review), model larynx + `larynx.json`, `devices.json`,
  `accessories.glb`, `manifest.json`, `scope-assets.test.ts`. Spike first (lumen, reference views,
  decode/BVH timings), then report before continuing.
- The owner was creating Codex's worktree `…/Worktrees/codex-bronch-foundations-assets` on
  `codex/bronch-foundations-scope` from this branch. Codex's paths do not overlap step 4's.
- Part 2 (the 3D pane) cannot start until Claude lands the seam (§5). When it does, append part 2
  to the brief (plan §4 B1–B5, B7, the round optical field, `SCOPE_MODES_READY`,
  `resolveScopeInputs`/`scopeViewErrors` now live in `engine/scope/`).

## 5. Plan-vs-repo gaps still open

- **S0 was never finished**: no `test-support/ScopeTestDouble.tsx`, `stageHarness.tsx`,
  `components/scope/{ScopePane,ScopeScenePane (stub),ScopeFallback,TreeMap,TreeAnswerFieldset,
LocationCaptionStrip}.tsx`, no `src/app/[locale]/bronchoscopy-foundations/**` routes, no
  `__tests__/release-boundary.test.ts`. Gating registrations exist (`access.ts`, `draft-modules.ts`,
  `non-public-modules.ts`, in `6f43caff`). This is the natural next block after step 4.
- The content layout diverged from plan §2 by design: per-section files
  `content/sections/<id>.ts` validated by `sectionValidation.ts` against `content/types.ts`, ids and
  phases in `sectionIds.ts`, authoring rules in `docs/bronchoscopy-foundations/section-authoring-guide.md`
  (read the guide before touching sections; it holds no flagged content). There is no `pathway.ts`,
  `sectionSpecs.ts`, `lessons.ts` or `stageLessons.ts` yet — the stage adapter is still to write.
- The plan's Step 1 jest suites (`registries.test`, `review-register.test`) do not exist; the
  equivalents are tsx validators (below).
- The teaching graph was built by Claude from case-001 (not Codex B6(i)); tests use it.

## 6. Gates before every commit

```bash
npx tsc --noEmit -p tsconfig.json
npx tsx scripts/bronchoscopy-foundations/check-section.ts --all
npx tsx scripts/bronchoscopy-foundations/check-capstone.ts
npx tsx scripts/bronchoscopy-foundations/check-registries.ts
npx tsx scripts/bronchoscopy-foundations/build-teaching-graph.mts --check
npx jest src/features/bronchoscopy-foundations 'src/app/\[locale\]/bronchoscopy-foundations' src/lib/site-auth/access.test.ts src/lib/airway-anatomy --runInBand
```

At `c1a10be7`: tsc clean, eslint clean, 23/23 sections, capstone and registries clean, graph check
passes, jest 10 suites / 120 tests. Pipe validator output through `grep -E '✓|✗'` so section text
never prints. Stage explicit paths only; never commit to `main`.

## 7. Traps met this session

- lint-staged runs prettier on staged `.json`/`.md` and eslint `--fix` on `.ts`: committed JSON bytes
  differ from generator output, so hash or compare after formatting.
- `tsc` is incremental and finishes in seconds; in zsh read exit codes with `${pipestatus[1]}`, not
  `PIPESTATUS`, and an unmatched glob aborts the whole command.
- The preview tool may "reuse" a server started before an env change; Next reloads `.env.local`
  (look for `Reload env` in `preview_logs`).
- The in-app browser cannot reach admin routes without the owner signing in; do not try.

## 8. Owner decisions pending

1. Push the branch (recommended) and whether to open a draft PR; no merge to main until every core
   section walks end to end.
2. Review of the engine's authored numbers (§2).
3. Plan §7 items: asset register entries, lecture-link timings, SME review of every draft item,
   completion wording, the `/intro-bronchoscopy` cutover.
