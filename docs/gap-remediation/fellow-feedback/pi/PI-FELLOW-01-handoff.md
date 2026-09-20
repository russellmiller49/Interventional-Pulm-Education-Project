# PI-FELLOW-01 — Peripheral Imaging: truthful examples, controls and navigation

Implementation: September 19, 2026. Prepared by Claude (AI implementation).

**Result: eight of the eleven assigned findings were reproduced on the current build and repaired;
one was already resolved; two are recorded as needing an owner or content decision that this batch
is not authorised to make.** The change is PI-local: the fixed-example state, the stored-frame
acquisition/display boundary, four copy surfaces, one optional retry path, one CSS rule for a state
the markup already reported, and one navigation link. No clinical claim, source record, question id,
answer key, progress key, release flag or storage schema was changed, and nothing about the
self-paced contract was relaxed.

**Evidence provenance.** Every source row below comes from _Peripheral Bronchoscopy Imaging —
First-Year Fellow Walkthrough Feedback Log.pdf_ (48 pages, dated September 18, 2026), an
**AI-assisted browser walkthrough written in a first-year-fellow persona**. It is not a learner
study, not participant data, and not clinical, media or device approval. Where this document says a
finding was "reproduced", that means an agent reproduced the application behaviour on a local build
at the SHA below — not that a human learner encountered it.

## Scope and baseline

- Task file: `01_PI_TRUTH_AND_STATE.md` from the PI Claude implementation pack, read at
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/module_update_9_19/PI_Claude_Implementation_Pack`
  (an identical copy sits under the Personal-Knowledge-Files tree). `FEEDBACK_LEDGER.md`,
  `OWNER_DECISIONS.md` and `SOURCE_CONTEXT.md` from the same pack were read.
- Branch `claude/pi-9-19`, in the worktree
  `Interventional-Pulm-Education-Worktrees/claude-pi-9-19`. Starting SHA
  **`77a141ccfd574a984f91e74abc9018b5d67e8202`** — `git fetch origin` returned the same commit for
  `HEAD` and `origin/main`, and the tree was clean before any edit. This is the pack's preparation
  snapshot, reached by fetching rather than by rolling anything back.
- **Checkout note.** The harness pins this session's working directory to that worktree, so the
  branch was cut there rather than in a newly created one. The substantive condition is met: the
  checkout was clean, level with merged `origin/main`, and owned by no other session.
- Open PRs touching these files at the start: **none**. The most recent merges into the files this
  batch owns are PR #245/#246 (SYSTEMIC-UX-01 post-merge regression and SYSTEMIC-UX-02) and PR #247
  (owner-local feedback); all three are in `origin/main` at the starting SHA and were extended, not
  recreated.
- Read before implementing: [SYSTEMIC-UX-01](../../systemic-ux/SYSTEMIC-UX-01-handoff.md),
  [SYSTEMIC-UX-02](../../systemic-ux/SYSTEMIC-UX-02-handoff.md), the
  [G02 PI consolidated release audit](../../self-paced/G02-PI-consolidated-release-audit.md),
  [PI-01](../../self-paced/PI-01-handoff.md), [PI-02](../../self-paced/PI-02-handoff.md),
  [PI-FOCUS-01](../../self-paced/PI-FOCUS-01-handoff.md),
  [PI-OUTLINE-01](../../self-paced/PI-OUTLINE-01-handoff.md),
  [PI-WRAP-01](../../self-paced/PI-WRAP-01-handoff.md) and
  [PI-HELP-01](../../self-paced/PI-HELP-01-handoff.md).
- Browser work ran against a **local development build** on `127.0.0.1:3126`
  (`next dev --port 3126 --webpack`) on the **direct module routes** (`/en/peripheral-imaging/**`).
  Neither the beta-wrapped route nor the live deployment was exercised; P4 and the wrapper belong to
  batch 05.
- Evidence retained outside Git at
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/pi-fellow-01-2026-09-19-77a141cc/`
  with `before/`, `after/`, `before-playwright-failures/` and the probe scripts.

## Disposition of every assigned source ID

| ID       |             PDF page | Status                    | What the current build actually did, and what changed                                                                                                                                                                                                                                                                                          |
| -------- | -------------------: | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O1**   |                    4 | **Reproduced → repaired** | A returning device showed only `Resume — Fixed C-arm CBCT workflow · Section 13 of 19`; there was no link to the first section and the outline was closed. Added `ImagingStartAtFirstSectionLink` beside the existing call to action on the Learn landing and the hub.                                                                         |
| **1.2**  |                   10 | **Reproduced → repaired** | Five checks with no visual at all still said "Inspect the image and acquisition context"; five debriefs in sections with no hands-on image work said "the evidence from the image work". Both prompts are now chosen from what the activity renders.                                                                                           |
| **1.4**  |                   11 | **Reproduced → repaired** | `imaging-questions:evidence` is a `read` activity with nothing to select, titled "Choose evidence for the next question". Renamed to "Compare what each modality can and cannot show". The activity id is unchanged.                                                                                                                           |
| **1.7**  |                   12 | **Reproduced → repaired** | The reference disclosure printed five rows of "monitoring only" in sections that adjust nothing. The list now renders only where the section's strip distinguishes one control from another; the section's own sentence stays.                                                                                                                 |
| **1.10** |                   13 | **Reproduced → repaired** | After Check, all six rows locked with no way back. Added an optional "Place these again". **No score, no first-attempt record and no correctness requirement were added** — the report's "5 of 6" line is deliberately not implemented.                                                                                                        |
| **2.1**  | 16 (screenshot p.22) | **Reproduced → repaired** | See [section 1](#1-report-21--the-fixed-example).                                                                                                                                                                                                                                                                                              |
| **2.12** | 20 (screenshot p.26) | **Reproduced → repaired** | See [section 2](#2-report-212--baseline-and-current).                                                                                                                                                                                                                                                                                          |
| **4.5**  |                   34 | **Reproduced → repaired** | "Acquired projections" carried `aria-pressed="true"` on load with identical computed background, border and weight to the other two. Added a pressed rule for the dock. No input event is synthesised.                                                                                                                                         |
| **8.1**  |                   44 | **Reproduced → repaired** | Section 19 still read "The eight case decisions follow on the Assess page, once every section has been worked through." Replaced with the Integrated cases name and the open-at-any-time rule. The `/peripheral-imaging/assess` alias is unchanged and still opens the integrated cases.                                                       |
| **8.2**  |                   44 | **Reproduced → repaired** | The activity matches eight findings to the six components of image formation; its prompt already said so, its title said "next useful decision". Renamed to "Match each finding to its component of image formation". No clinical decision was invented to justify the old title.                                                              |
| **PR2**  |                   45 | **Already resolved**      | The Section-reviewed card already links the section's own practice case (`data-paired-practice-case`), optional and non-gating: signal → "Poor lesion conspicuity in a large patient". Six sections have no authored practice case and correctly link none. A regression now pins the mapping and the six exclusions so no case is fabricated. |

### Items recorded as needing an owner or content decision

Neither is a code defect and neither is repaired here.

1. **The fixed image of a text-scenario check (affects `current-anatomy`, `changing-anatomy`,
   `staff-protection`).** Their check stems are written clinical scenarios — a new dependent
   opacity, motion during a CBCT spin, holding an accessory in the primary beam — that the
   registration and safety models do not simulate. Their fixed example is now the section's own
   authored baseline state, which is stable and truthful, but the image does not depict the stem,
   while the banner says "the question and the image match". **Owner/content decision needed:**
   either soften that banner for scenario checks, or author an image the stem can be read from.
   This overlaps report 2.11 and belongs to batch 03/04, not here.
2. **`projection:alignment` (Section 5) is a reading screen titled "Choose a view for alignment or
   advancement".** Exactly the 1.4 defect class, in a section neither the walkthrough nor this batch
   was assigned. **Not renamed.** A test pins the inventory at this one occurrence so it cannot grow
   silently: `truthful-surfaces.test.ts` → "pins the remaining reading screen whose title still says
   choose".

## 1. Report 2.1 — the fixed example

### Reproduction on the current build

`/en/peripheral-imaging/learn?section=chain-walk` (Section 2 of 19, "How a fluoroscopic image is
formed"). Advance to activity 2, the component walk, set **C-arm obliquity**, continue to activity 4,
"Interpret a changed example". Its banner reads "This example stays fixed so the question and the
image match" and its stem reads "The needle tip and the nodule are superimposed on the image
although they are two centimetres apart along the X-ray path."

The locked dock on that check read, in three separate anonymous contexts:

| Obliquity set during the walk | Obliquity shown on the "fixed" example |
| ----------------------------- | -------------------------------------- |
| not touched                   | `0°`                                   |
| `47°`                         | **`47°`**                              |
| `-28°`                        | **`-28°`**                             |

`before/21-baseline.json`. The report's own screenshot (p.22) shows the same 47° state.

### Cause

`ImagingStageHost` resolved a check's image state with
`independentValues(sectionId, round) ?? session.lab?.values`. `independentValues` was authored for
four sections and returned `null` for the rest, so for every other section the pane was handed the
learner's own lab values. Disabling the dock froze the controls, not the image behind them.

Six sections could inherit learner state this way: `chain-walk`, `good-image`, `current-anatomy`,
`cbct-acquisition`, `changing-anatomy`, `staff-protection`. (`signal`, `field`, `time` and
`dose-reporting` draw self-contained panels at round 0 and never could; the transfer round carries
no image in any section.)

### Repair

- `content/teachingExamples.ts`: added `SECTION_FIXED_EXAMPLE`, an explicit authored state per
  section, each entry commented with the stem or demonstration it comes from; and
  `fixedExampleValues` / `fixedExampleIdentity`, a **total** resolver that cannot return null and
  returns a fresh object, so no caller can fall back to learner state or mutate the table.
  The four previously authored sections are byte-identical.
- `chain-walk`'s example is `{ orbit: 0, tilt: 0, depth: 20 }`, established from its own stem:
  zero obliquity puts the tool tip and the lesion on the same detector point, and `depth: 20` is the
  two centimetres the stem states. Zero was **not** assumed to be universally correct —
  `cbct-acquisition` is `{ offsetX: 0, offsetDepth: 25 }`, the offset scout its own stem describes.
- `ImagingStageHost` now spreads `exampleValues` with no fallback and tags the pane
  `data-authored-example="<section>:example:<round>"`.
- Learner exploration is untouched: the check's `onLabChange` still writes only to
  `independentDisplay`, the session reducer is not called, no capture is cleared and no session is
  reset. Entering, revealing and retrying the example create no performed-work event.

### After the repair

All four prior histories (untouched, `47°`, `-28°`, `75°`) produce an identical reading: identity
`chain-walk:example:0`, obliquity `0°`, tilt `0°`, dock disabled, banner present. Returning to the
walk still shows the learner's own `47°`. `after/21-baseline.json`, `after/21-prior-*.png`.

## 2. Report 2.12 — baseline and current

### Reproduction on the current build

`/en/peripheral-imaging/learn?section=good-image`, activity 2, "Compare acquisition controls with
stored display". On entry both panels carried **two** field masks — the acquired field _and_ the
electronic display crop — so "Baseline acquisition A" and "Current simulated projection" were the
same cropped picture and the authored comparison showed nothing:

```
before  baseline masks: ["acquired-field", "display-crop"]
        current  masks: ["acquired-field", "display-crop"]
after   baseline masks: ["acquired-field"]
        current  masks: ["acquired-field", "display-crop"]
```

`before/baseline.json` and `after/baseline.json`; the report's screenshot is p.26.

### Cause — traced separately

- **Original acquisition pixels:** `DrrTextureSource.snapshot().toDataURL()`, frozen once. Correct,
  and unchanged by this repair.
- **Saved baseline identity and metadata:** `acquisition-<n>`, with pose, depth, acquired field,
  offset and frame context. Correct, and unchanged.
- **Current acquisition:** the live canvas, driven by the demonstration's selected example.
- **Display transforms:** `zoom` (display zoom) and `displayMask` (the electronic crop).
  `captureBaseline` copied both into the stored frame. Because the authored comparison's first
  example is "Crop the baseline stored frame", the automatic first-frame capture happened with the
  crop already on and baked it into the reference.

So both panels did receive the same display transform, and it was mutable state leaking into the
baseline — not an intentional shared transform. The stored frame's own caption says "acquired field
100%", which the cropped rendering contradicted.

### Repair

`StoredProjection` no longer carries `zoom` or `displayMask`. A stored frame is the pixels that were
read out, the overlays describing the geometry they were acquired at, and the acquisition metadata;
an electronic crop and a display zoom are operations on a stored frame and apply to the current view
only. This is the distinction the section teaches. `FieldMask` now reports
`data-mask-kind="acquired-field" | "display-crop"` so the two are separable in the DOM and in tests,
and the baseline panel reports `data-monitor-zoom="1"`.

No new acquisition is invented, no pixels are regenerated and no irradiation is modelled: the visual
difference between the panels is entirely the display operation applied to the current view. The
"Save baseline image" helper text now says so.

### After the repair

Baseline: acquired-field mask only, `data-monitor-zoom="1"`, caption unchanged. Current: the crop
mask on the crop example, `data-monitor-zoom="1.5"` on the zoom example. The baseline's caption,
pixels, zoom and masks are byte-identical after **Replay demonstration** and after resizing
1440 × 1050 → 1024 × 768 → back.

## 3. Tests

All committed. Each regression below was confirmed to **fail** against a locally reconstructed
pre-repair build and to pass after; the pre-repair Playwright failure captures are retained in
`before-playwright-failures/`.

| File                                                                                                  | Covers                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/peripheral-imaging/__tests__/fixed-example-state.test.ts` (new, 8 tests)                | 2.1 at the data level: the resolver is total, returns a fresh object, is non-empty for every suite-backed check, fits every control range, leaves the four previously authored sections unchanged, and puts `chain-walk` at the superimposition its own stem describes.                                                          |
| `src/features/peripheral-imaging/__tests__/fixed-example-history.rendered.test.tsx` (new, 3 tests)    | 2.1 on the real stage: four prior histories produce one identical rendered reading; looking back still shows the learner's own `47°`; reveal-and-retry writes no answer, no performed step and nothing but the section visit to the record.                                                                                      |
| `src/features/peripheral-imaging/__tests__/truthful-surfaces.test.ts` (new, 11 tests)                 | 1.2, 1.4, 8.1, 8.2, PR2, and the two recorded-not-fixed inventories (1.7's no-control sections, the one remaining "Choose" reading screen).                                                                                                                                                                                      |
| `src/features/peripheral-imaging/__tests__/fellow-feedback-surfaces.rendered.test.tsx` (new, 5 tests) | 1.7, 1.10 and O1 as rendered: no five-row template where nothing is adjusted and the five rows kept where one control is in play; the placements come back live and pre-filled with the reveal still available and nothing recorded; the link appears beside Resume and stays away when the recommendation is already Section 1. |
| `src/features/peripheral-imaging/__tests__/stage-session.test.ts` (+1 test)                           | `RETRY_SORT`: clears the set, un-performs the step, and is a no-op with nothing to take back, after the learner moved past, when finished, or for an unknown step.                                                                                                                                                               |
| `e2e/peripheral-imaging.spec.ts` (+3 tests)                                                           | 2.1, 2.12 and 4.5 in a real browser against the running module, with real slider input, real clicks and computed styles.                                                                                                                                                                                                         |

### Commands run

| Command                                                                                                                                             | Result                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `node node_modules/jest/bin/jest.js src/features/peripheral-imaging src/features/learning-module 'src/app/[locale]/peripheral-imaging' --runInBand` | **54 suites, 440 tests passed** (was 50/412 at G02).                                                                                     |
| `PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3126 playwright test --config=playwright.peripheral-imaging.config.ts`                                | **34/34 passed**, 4.4 min, exit 0 (31 pre-existing + 3 new).                                                                             |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                                                                         | Exit 0.                                                                                                                                  |
| `npm run lint`                                                                                                                                      | Exit 0; **0 errors, 15 warnings**, none in a changed file (all pre-existing, in `src/components/**`, `src/hooks/**` and other features). |
| `npx prettier --write` on the changed paths, then `--check`                                                                                         | Clean.                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run build`                                                                          | **Exit 0.** Invalid preview values; no stored credentials, no deployment.                                                                |

Known build warnings, all pre-existing and recorded by G02, retained rather than hidden: embedded
training-app chunks over 500 kB, Node `DEP0205 module.register()`, and `metadataBase` unset.

### Presentation conditions measured

The repairs that change layout are O1's link and 4.5's pressed rule; 2.1 and 2.12 change rendered
state, not geometry. The new link was measured on the Learn landing for a returning device at
**1280 × 900, 1440 × 900, 1024 × 768, 390 × 844, 320 × 740** at normal root text, and at
**1440 × 900, 390 × 844, 320 × 740 with `html { font-size: 200% }`** (verified 32 px). In all eight
the link stays inside the viewport and does not overlap the primary call to action
(`after/o1-layout.json`, `after/O1-*.png`).

Document overflow at 390/200% (418 px) and 320/200% (416 px) is **G02's existing C03**, not new: the
same page measured **416 px and 418 px with the link hidden**, and the widest element in both cases
is the outline group card, which this batch does not own.

**Labelled accurately:** these are _root-text enlargement_ probes, not CSS `zoom`, not device pixel
ratio and not native browser zoom. **Not executed:** a native-browser-zoom pass — the in-app browser
pane in this session runs hidden, so `requestAnimationFrame` never fires and the 3D scene never
signals ready; the Playwright harness cannot set native tab zoom. G02's native-zoom result at
`d8ffd843` stands and nothing here changes scene sizing.

## 4. What was deliberately not done

- **No score, mastery threshold, attempt count, first-attempt record, weighting or assistance-use
  tracking.** Report 1.10's "5 of 6" line is not implemented; the retry is optional and records
  nothing.
- **No gate.** Every section, case and explanation stays open; no repair makes optional teaching
  conditional on an action. The one real prerequisite — an actual acquisition before work is claimed
  as performed — is untouched.
- **No learner record was cleared, reinterpreted or migrated.** No question id, choice id, answer
  key, activity id or storage key changed; the renames are learner-facing titles only.
- **No clinical, source, media, device, human-review or publication status changed.** Draft content
  is still draft. Passing tests are not clinical validation, and an AI walkthrough is not learner
  evidence.
- **Nothing outside Peripheral Imaging was touched** — the shared `learning-module` stage, Device
  Intelligence, Airway Stent Mechanics, ICU Simulation, EBUS and every other module are unchanged.
  `INDEPENDENT_IMAGE_PANEL_SECTIONS` moved from `TeachingPanels.tsx` into
  `content/learningActivities.ts`; `TeachingPanels` still exports `hasIndependentImagePanel` and no
  caller changed.
- **No paid API call, deployment, migration, external submission, mass deletion or merge.** No
  protected environment file or stored secret was read, written or exposed.
- **G02 was not rerun** and batches 02, 03, 04 and 05 were not started.

## 5. Limitations

- Everything here is developer verification of application behaviour. It is not a learner study, not
  PI-02, and not clinical, source, media or release approval.
- Browser results are from a **local development build** on the **direct module routes**. The
  beta-wrapped routes and the live deployment were not exercised.
- The `before/` evidence set was produced by reverting the 2.1, 2.12 and 4.5 repairs only; the O1,
  1.2, 1.4, 1.7, 1.10, 8.1 and 8.2 repairs were in place for that run, so those rows in
  `before/baseline*.json` show the repaired state. Their pre-repair values are quoted in this
  document and were captured before any edit.
- The two owner/content decisions above are open. Nothing in this batch resolves report 2.11, the
  image-evidence matrix (PR1/IC3), or any item assigned to batches 02–05.

## 6. Files changed

Application:

- `src/features/peripheral-imaging/content/teachingExamples.ts` — the authored fixed-example table and its total resolver (2.1)
- `src/features/peripheral-imaging/components/stage/ImagingStageHost.tsx` — use the resolver with no fallback; tag the example; offer the sort retry (2.1, 1.10)
- `src/features/peripheral-imaging/components/suite/Monitor.tsx` — a stored frame carries acquisition, not display (2.12)
- `src/features/peripheral-imaging/components/suite/views/FieldView.tsx` — `data-mask-kind` (2.12)
- `src/features/peripheral-imaging/components/suite/suite-scene.module.css` — the dock's pressed state (4.5)
- `src/features/peripheral-imaging/engine/stageSession.ts` — `RETRY_SORT` (1.10)
- `src/features/peripheral-imaging/content/stageLessons.ts` — truthful check and debrief prompts (1.2)
- `src/features/peripheral-imaging/content/learningActivities.ts` — two honest titles; `INDEPENDENT_IMAGE_PANEL_SECTIONS` (1.4, 8.2, 2.1)
- `src/features/peripheral-imaging/components/stage/TeachingPanels.tsx` — delegate to that constant (2.1)
- `src/features/peripheral-imaging/content/controlPanel.ts` — `controlStripDistinguishes` (1.7)
- `src/features/peripheral-imaging/components/stage/ImagingTeachingColumn.tsx` — drop the generic strip where nothing is adjusted (1.7)
- `src/features/peripheral-imaging/data/lessons.ts` — the Integrated cases name and rule (8.1)
- `src/features/peripheral-imaging/components/hub/ImagingPathwayAccordion.tsx` — `ImagingStartAtFirstSectionLink` (O1)
- `src/features/peripheral-imaging/components/PeripheralImagingLearnLanding.tsx`, `PeripheralImagingHub.tsx`, `peripheral-imaging-hub.module.css` — place and style it (O1)

Tests: the four new files above, plus `stage-session.test.ts` and `e2e/peripheral-imaging.spec.ts`.

Documentation: this file.

## 7. Reproduction index

Every row is `http://127.0.0.1:3126` + the path, dark mode, anonymous local context.

| ID   | Route                                                     | Steps                                                                                                                                                                                          |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1   | `/en/peripheral-imaging/learn`                            | Seed `ip-peripheral-imaging-self-paced-v1` with `lastLocation` = `fixed-suite`, reload. Before: Resume only. After: "Start at Section 1" beside it.                                            |
| 1.2  | `/en/peripheral-imaging/learn?section=imaging-questions`  | Continue to activity 4. Before: "Inspect the image and acquisition context" with no image on screen. After: "Read the scenario." Activity 5 likewise.                                          |
| 1.4  | same                                                      | Activity 2's heading.                                                                                                                                                                          |
| 1.7  | same                                                      | Reach the last activity, open "Troubleshooting and control reference". Before: five "monitoring only" rows. After: none, sentence kept. Compare `?section=chain-walk`, where five rows remain. |
| 1.10 | same                                                      | Activity 3: place all six rows, Check. Before: rows locked, no way back. After: "Place these again".                                                                                           |
| 2.1  | `/en/peripheral-imaging/learn?section=chain-walk`         | Activity 2: set C-arm obliquity to 47. Continue to activity 4 and read the locked dock.                                                                                                        |
| 2.12 | `/en/peripheral-imaging/learn?section=good-image`         | Continue once to activity 2 and compare the two panels; then press "Zoom the baseline stored frame".                                                                                           |
| 4.5  | `/en/peripheral-imaging/learn?section=dts-interpretation` | Continue once to activity 2 and inspect the "Image source" buttons before clicking anything.                                                                                                   |
| 8.1  | `/en/peripheral-imaging/learn?section=suite-cases`        | Activity 1's teaching text.                                                                                                                                                                    |
| 8.2  | same                                                      | Activity 2's heading against its own prompt and origins.                                                                                                                                       |
| PR2  | `/en/peripheral-imaging/learn?section=signal`             | Work to the end and read the Section-reviewed card.                                                                                                                                            |
