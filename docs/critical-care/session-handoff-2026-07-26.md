# Critical Care — session handoff

**Date:** 2026-07-26
**Branch of record:** `codex/ip-preference-card-builder-v0-1` (what the dev server runs)
**Work branch:** `claude/curricular-sequencing-updates-b351b1`
**Head at handoff:** `8aaffc1`, plus an **uncommitted** working tree carrying §1.4

---

## 1. What was done

Three work packages, in the order they landed: WP10 curricular sequencing (§1.1), the mechanical
ventilation teaching workspace and the defects that surfaced with it (§1.2, §1.3), and per-device
ventilator console fidelity (§1.4). Everything through §1.3 is committed and merged; §1.4 is
uncommitted.

### 1.1 WP10 — curricular sequencing across all modules (complete)

Implements `Critical_Care_Reference/WP10-curricular-sequencing-PROMPT.md` in full, all nine steps.

**Metadata (§2).** `curriculumStage` (`orientation → foundation → mechanism → application → integration`)
and `stageOrder` added to `CriticalCareActivityDefinition` and its `.strict()` Zod schema, authored on
every activity. The section-derived `difficulty` default is deleted — every seed declares its own.

Validators run inside the existing import-time catalog throw:

- `validateCurriculumStaging` — `stageOrder` unique per `(module, stage)`; no integration activity
  precedes its module's first foundation.
- `validateCriticalCareLearningPathways` — one integration section per pathway, ≥1 foundation per
  module, sections resolve to same-module activities with matching stage and minutes, `stageOrder`
  ascends within a stage.
- `validateLearningPathwayCoverage` — every catalog module declares a pathway.

> **Design note.** "Exactly one integration activity per track" is enforced over declared
> **pathways**, not the flat activity list. A track is a property of a pathway (ECMO declares one per
> support mode), and ECMO legitimately has both an integration _lesson_ and an integration
> _assessment_ per track.

**Shared abstraction (§3).** `src/features/learning-module/curriculum/` — `LearningPathway` types plus
`PathwayNav`, `PathwayLanding` (single column, deliberately), `PathwaySectionCompletion`. Hemodynamics
consumes them; its pathway file is now a thin binding over the shared registry.

**Two order-destroying bugs (§4).**

- _Bug A_ — the case library and concept detail sorted by `difficulty` then title. Because difficulty
  was section-constant the first term was always zero and the sort collapsed to alphabetical,
  scrambling CRRT's station order and ECMO's track order. Replaced by
  `content/curriculumOrder.ts` — `(stage, stageOrder)` with a stable sort so authored catalog order is
  the tiebreak. `localeCompare` is gone as both primary and secondary key.
- _Bug B_ — CRRT gave two different answers to "what's next": the hub walked station order
  (`1,2,3,6,7,4,5`) while the Learn workbench walked lesson order. `nextRecommendedCrrtActivity()` is
  now the single recommender for both. `ordinal` retired.
- ECMO's `capstone must remain a standalone challenge` rule relaxed to permit exactly one
  integration-stage lesson per track, extracted as `capstoneLessonErrors` and covered both ways.

**Five authored pathways (§5) — 14 new sections.**

| Module  | Structural change                                                                       | New prose                                                                 |
| ------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| CRRT    | circuit anatomy moved to 2nd — transport and prescription both assume the blood path    | 1 — pressure-profile integration capstone                                 |
| MCS     | device tabs replaced by the ordered rail inside Learn                                   | 1 — cross-device selection capstone                                       |
| MV      | waveforms moved ahead of modes (modes are device-facing)                                | 1 — high-peak-pressure capstone                                           |
| ICU-sim | reordered by interacting-system count; entry point is now the 6 h single-mechanism case | 1 — workspace + `Review → Classify → Intervene → Advance → Reassess` loop |
| ECMO    | **console orientation moved from 1st to 7th**                                           | 10 — 4 shared foundation, 2 track physiology, 2 normal-state, 2 capstones |

ECMO's new sections are **didactic prose** on the existing route rather than simulator drills — a
drill player cannot teach the circuit it already assumes. The existing drill lessons and scenarios are
unchanged. The anti-Xa disagreement (0.2–0.3 units/mL vs 0.3–0.7 IU/mL) renders as a held
disagreement with both sources on the ECMO normal-state sections; neither becomes a threshold.

**Surfacing (§6).** Learn landings with an arc sentence over a single-column ordinal list in every
module (ECMO, CRRT, MCS and ICU-sim previously had none — the route dropped straight into a
workbench). `PathwayNav` inside every section including the ICU simulator. "Continue to next section:
{title}" throughout. Both `<select>` lesson switchers removed.

**Non-negotiables held:** nothing gates; every section reachable by URL; every nav button enabled; no
engine, activity ID, route, storage key, or progress envelope changed.

### 1.2 Mechanical Ventilation — three-pane teaching workspace

Ports the reading arrangement that makes `icu-hemodynamics` legible, for **three flagship sections**
so the pattern could be judged before the rest adopt it.

- `ResizableTeachingWorkspace` extracted into `learning-module/curriculum/` — three independently
  scrolling panes, pointer and arrow-key resizable separators, tab fallback on narrow viewports.
  **CRRT, MCS and ECMO can adopt it without a second port.**
- Pane order is **Ventilator · Teaching · Your turn** — the live device, the teaching panel, then the
  surface the learner acts through. This mirrors hemodynamics.
- Teaching panels, all computed from live engine state, each with a computed `aria-label` and a text
  equivalent:
  - **Mechanics** — peak pressure as a live stacked sum (baseline + elastic + resistive), with
    per-component explanation on selection.
  - **Waveforms** — five-step reading sequence over one complete breath, selected trace emphasized,
    zero-flow reference on the flow limb.
  - **High peak pressure** — pick a mechanism, see what it predicts for each discriminating signal,
    graded against live measurements.
- The other six sections show `VentilationSectionOverview`: their own authored six-phase objectives
  and references, with an explicit note that the illustrated figure is pending. No empty panes.

**No numeric thresholds anywhere in these panels** — this module's source reconciliation is still
pending, so every claim is about relationships between signals.

### 1.3 Defects found and fixed

Several were only findable by running the thing; two the test suite actively missed.

1. **Capstone route crashed on load.** The new MV lesson had no entry in
   `mechanicalVentilationLessonItems`. `lesson-runtime.test.ts` iterated the items map instead of
   indexing it per lesson, so it stayed green over a page that threw. Fixed, and three assertions now
   derive counts from `mechanicalVentilationLessons.length`.
2. **The decomposition figure lied at a glance** — the cumulative pressure sat beside the band name,
   so the resistive band read as the peak value. Magnitudes now sit inside bands, console pressures
   outside on leader ticks.
3. **The pathway rail silently collapsed** to ~20 px and clipped its own buttons inside the workbench
   grid; it has `overflow: hidden` and cannot rely on natural row sizing. Given a `min-height`.
4. **A clinical overclaim** — patient effort was marked "argues against" a resistive mechanism. It
   does not discriminate. Added `neutral` and `invalidates` verdicts; effort now makes
   plateau-derived rows "Measurement invalid" rather than evidence either way. Test asserts the panel
   never claims effort argues against a resistive rise.
5. **Learn never ran the clock.** Practice runs a `setInterval`; Learn only advanced time in bursts,
   so the console sat frozen at 0 s and read as broken. Learn now runs continuously.
6. **Lessons opened paused.** `createInitialSimulationState` primes four seconds of waveform then sets
   `paused: true`. Lessons now open with the ventilator cycling.
7. **The activity surface was invisible.** Guided actions rendered only inside the collapsible task
   panel. Moved into the "Your turn" pane; the task panel keeps the framing and no longer duplicates.
8. **The activity pane inherited the dark theme.** The workbench theme sets its tokens on `<body>` via
   `:has()`, so a nested theme root cannot override it — the pane re-declares light values locally.
   Enabled controls were rendering dark on a light workspace and reading as disabled.
9. **Inspiratory hold showed the wrong tracing.** `performConsoleHold` set `holdUntil` from the current
   instant, so with a typical I:E ratio the maneuver almost always landed mid-expiration and froze the
   model near zero volume and baseline pressure — a flat trace with no plateau. Holds now advance to
   the correct boundary first (end-inspiration / end-expiration) and occlude there. A second bug fell
   out of the same function: cases authoring their own `inspiratory-hold` intervention short-circuited
   before any hold was scheduled, so the maneuver was recorded but never drawn.
10. **`Paw` read as PEEP** — it was the instantaneous sample, which sits at baseline most of the
    cycle. Replaced with the derived pressures a real console keeps on screen: **Ppeak, Pplat, Pmean,
    PEEP**.
11. **Pressure components now labelled while paused** — dashed reference levels naming peak, plateau,
    PEEP and the resistive gap. Paused-only so they do not chase a moving trace. Included in the
    strip's text alternative.

### 1.4 Ventilator device fidelity — all four consoles

Making each ventilator console display information the way that device actually does. **Complete
for all four devices**; uncommitted on `codex/ip-preference-card-builder-v0-1`.

Nine manuals were supplied across two passes — note that the first of the original six is **not** a
Hamilton document:

- `9513888_1_enUS.pdf` (384 pp) — **Dräger Evita V800 / V600 instructions for use, SW 3.1n**
- `662436517-PB980-Service-Manual.pdf` (378 pp)
- `puritan-bennett-980-...-interactive-brochure.pdf` (12 pp)
- `evita-v800-sw2n-pi-dmc-106133-en-master.pdf` (12 pp)
- `Quick-Guide-Evita-V800-V600-...-V3.pdf` (24 pp)
- `RC_AVEA-Modes-Guide_UG_EN.pdf` (52 pp)
- `HAMILTON-C6_ops-manual_v1.2.x_en_10197564.00.pdf` (372 pp) — second pass
- `HAMILTON-C6_quick-guide_en_624972.00.pdf` (48 pp) — second pass
- `The new HAMILTON-C6 - screens.pdf` — marketing page for the **current** C6, a later generation
  than the 1.2.x profile; read for orientation, not used as a source

> **The Hamilton manuals arrived in a second pass** and the C6 was then rebuilt against them. The
> supplied `HAMILTON-C6_ops-manual_v1.2.x_en_10197564.00.pdf` hashes to
> `5de5eeff…3f3d511f78`, matching the SHA-256 the registry already recorded, so the registered
> source is now verified rather than merely cited. The quick guide (`624972/00`) is newly
> registered as `hamilton-c6-quick-guide`.

**What was the gap.** `MechanicalVentilatorConsole` branched on `deviceId` in three places, all
cosmetic string swaps for AVEA. Everything else was shared, so a Dräger and a PB980 rendered as a
Hamilton with a different title bar.

**What now exists.** `VentilatorDisplayProfile` on every device profile (`engine/types.ts`,
authored in `content/deviceProfiles.ts`), resolved through `content/deviceDisplay.ts`:

| Field                             | Carries                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `pressureUnit` + `pressureLabels` | mbar vs cmH₂O, and PIP/PPEAK/Ppeak on the Paw trace                                    |
| `monitorLayout`                   | `left-column` (C6), `right-column` (Evita), `right-tiles` (AVEA), `top-banner` (PB980) |
| `monitorFields`                   | which measurements, in what order, under which abbreviation and unit                   |
| `waveforms`                       | trace order, axis legends, vendor default scales, and per-trace color                  |
| `monitorFooter`                   | the C6's SpO2 strip below the MMP column                                               |
| `controlOrder` / `controlGroups`  | the order and grouping each vendor presents its settings in                            |
| `showBreathPhase`                 | the PB980 Control / Assist / Spontaneous letter                                        |
| `bezelKeys` + `knobPosition`      | the documented off-screen keys, straddling the knob on the PB980                       |

Per device, against the sources:

- **Evita** — mbar throughout; monitoring column `FiO2 / PIP / PEEP / MVe / RR / VTe` with label and
  unit above a large right-aligned value (pocket guide pp. 5, 8-9; IFU §4.1). Its display unit
  carries only alarm silence and the rotary knob — maneuvers live under Procedures, as on the device.
- **PB980** — patient-data banner across the top opened by the breath-phase letter, with
  `fTOT / V̇E TOT / VTE / PEEP / I:E / PPEAK / PMEAN` (Table 2-10 symbol names, Table 2-12 display
  resolution). Eight-key bezel per §1.11.1. Alarm-limit labels fixed: `↑PPEAK` and `↑TI SPONT` had
  been transcribed with a literal `2` where the source prints an up arrow; `V̇MAX` and `V̇SENS`
  likewise lost their flow dots.
- **AVEA** — waveform legends and scales exactly as the mode figures print them (`Paw` −40 to 80,
  `Flow` −80 to 80, `Vt` −500 to 1500); control names from the primary-control tables pp. 43-46;
  navigation relabelled to the real membrane keys
  `MAIN / MODE / ADV SETTINGS / ALARM LIMITS / LOOP / MANEUVER`.
- **C6** — rebuilt from the operator's manual. The MMP column moved to the **left** of the display
  where §2.2.2 and §8.2.1 put it, with a large value over its name and unit, and an **SpO2 strip**
  beneath it (Figures 2-6, 8-1, 8-2). Parameters renamed to the manual's own vocabulary:
  `Ppeak cmH2O · ExpMinVol l/min · VTE ml · fTotal b/min · I:E` — `MinVol` and `/min` were both
  wrong. Waveforms take the C6's documented trace colors (Paw **yellow** per §8.3.3.3, flow
  magenta, volume green); no other device documents trace colors, so they still draw alike.
  Control names corrected to Table 5-9 (`ΔPcontrol`, `ΔPsupport`, `Pause`), and bezel legends to
  quick guide §1.1 (`Audio Pause · O2 enrichment · Manual breath · Screen lock`).

**Control ordering — each vendor's own.** `VentilatorDisplayProfile.controlOrder` (a per-device
precedence list) and `controlGroups` (labelled groups) now drive the settings screen, so the four
devices no longer present the same list in the same order:

| Device | Order                                                                                                | Source                            |
| ------ | ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| C6     | grouped **CO2 elimination · Oxygenation · Patient synchronization · Patient, TRC, and apnea**        | Figures 7-2 to 7-12               |
| Evita  | `FiO2 · VT · Ti · RR · PEEP · ΔPsupp · Slope · Flow` therapy bar                                     | pocket guide pp. 5, 8-9           |
| AVEA   | `Rate · Volume · Insp Pres · Peak flow · Insp time · Insp pause · PSV · PEEP · Flow trig · % oxygen` | modes guide pp. 43-46             |
| PB980  | engine order, deliberately                                                                           | no Vent Setup layout is published |

Also: the inspiratory pause renders in the unit each device sets it in — `Tplat` / `TPL` /
`Insp pause` in seconds on Evita, PB980, and AVEA, with the C6 keeping the engine's percentage
(`Pause`, which Table 5-9 confirms is a percentage of breath-cycle time). Pressure **settings** now
carry the device's pressure unit too, so the Evita reads `PEEP 5 mbar`.

Four display defects fell out of the work and are fixed: the four Paw readouts were clipped to
24 px each in a 70 px gutter; `.mmpPanel` was hard-coded to five rows so a sixth value would have
been crushed; and the trigger/flow-pattern selects and the mode-feature cards were painted with
fixed dark values, so they rendered navy-on-navy and near-invisible once the Evita's light screen
existed — the same `:has()`-adjacent theming trap noted in §1.3 item 8. All four now take
`var(--screen-panel)` / `var(--screen-line)` from the device palette.

**How it was verified.** Suite results are in §2. Layouts were checked visually with an offline
esbuild + `renderToStaticMarkup` harness — the module routes sit behind login, so the running app
cannot be screenshotted without credentials. The recipe is in §4.

**Left undone, deliberately.** The PB980 settings order is unsourced. Control _units_ other than
pressure are still shared (the C6 prints `ml` and `b/min` where the simulator prints `mL` and
`/min` on the settings tiles — the monitored column is correct). Monitored-parameter sets are the
documented subsets, not the full configurable monitor screens, and each `displayNote` says so.

---

## 2. Current state

### Commits (work branch, in order)

| Commit              | Contents                                                              |
| ------------------- | --------------------------------------------------------------------- |
| `da4bf33`           | WP10 — curriculum staging and per-module learning pathways            |
| `7a8e592`           | MV three-pane teaching workspace and section panels                   |
| `a5ae5ad`           | MV lesson clock + activity-pane remap                                 |
| _(merge)_ `4aa8921` | running ventilator by default + activity-pane theme                   |
| `8aaffc1`           | hold timing, Ppeak/Pplat/Pmean/PEEP readouts, paused component labels |

All merged into `codex/ip-preference-card-builder-v0-1` via `--no-ff` merges (`e22b519`, `b8dc38d`,
`b3bfab7`, `4aa8921`, `8aaffc1`). Clean merges throughout — WP10 and the preference-card builder share
zero files.

### Uncommitted — §1.4, ventilator device fidelity

Nothing in §1.4 is committed. `git status` on the branch of record:

| Path                                           | Change                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `engine/types.ts`                              | `VentilatorDisplayProfile` and its member types; `spontaneous` on `WaveformSample`   |
| `engine/physics.ts`                            | `deriveVolumeFlowTimeSeconds` split out so pause can be expressed in seconds         |
| `engine/simulation.ts`                         | flags each sample spontaneous, for the PB980 breath-phase letter                     |
| `content/deviceProfiles.ts`                    | the four `display` blocks, corrected control labels, the Hamilton quick guide source |
| `content/deviceDisplay.ts`                     | **new** — metric resolution, control ordering and grouping, breath phase             |
| `components/MechanicalVentilatorConsole.tsx`   | profile-driven monitor panel, waveform stack, bezel, control groups                  |
| `components/WaveformStrip.tsx`                 | per-trace color                                                                      |
| `components/SourcesPanel.tsx`                  | surfaces each device's `displayNote`                                                 |
| `components/mechanical-ventilation.module.css` | four monitor layouts, control groups, device-palette fixes                           |
| `__tests__/device-display.test.tsx`            | **new** — 15 tests over the display profiles and the rendered consoles               |
| `__tests__/components.test.tsx`                | three label expectations updated to the sourced names                                |

Commit or discard before starting anything else — the tree is otherwise clean.

[PR #26](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/26) targets
`main` from the work branch and contains the WP10 commit only. It has **not** been updated with the MV
work — decide whether to retarget, extend, or close it.

### Verification status

| Check                                   | Result                                                       |
| --------------------------------------- | ------------------------------------------------------------ |
| `npm run type-check`                    | clean                                                        |
| `npm test`                              | **2355 passed / 316 suites** on the working tree incl. §1.4  |
| `npm run lint`                          | 0 errors; clean across `src/features/mechanical-ventilation` |
| `npm run test:a11y`                     | 4 passed                                                     |
| `npm run validate:critical-care-assets` | passed (19 assets)                                           |
| `npm run build`                         | **NOT VERIFIED**                                             |
| `npm run test:e2e`                      | **NOT RUN**                                                  |

**`npm run build` was never completed.** Its first step, `contentlayer2 build`, ran 42 minutes on the
MDX corpus in a fresh worktree without finishing; `next build --webpack` against reused contentlayer
output was still compiling after 80 minutes. This is a machine/throughput issue, not a known failure —
but it means **CI is the gate on the production build.**

**`test:e2e` was skipped deliberately.** Playwright hardcodes `baseURL: 127.0.0.1:3001` with
`reuseExistingServer`, and port 3001 was serving a different checkout. A run would have passed against
the wrong tree. Needs that server stopped or a port override.

### Known wrinkles

- **`npm test` from the main checkout double-collects.** `jest.config.cjs` only ignores
  `<rootDir>/e2e/`, so it also picks up the nested `.claude/worktrees/.../src/**` copy — 624 suites
  instead of 315, three of which fail on path assumptions. Until the worktree is removed, use:
  `npx jest src --testPathIgnorePatterns "/node_modules/" "/.claude/worktrees/"`.
  Adding `'/.claude/worktrees/'` to `testPathIgnorePatterns` fixes it permanently.
- **Git identity** — commits are authored as `Russell Miller <russellmiller@MacBook-Pro.local>`
  because no `user.email` is configured. Amend before any push you care about.
- **`.claude/launch.json`** gained an `mv-teaching` entry (worktree dev server on port 3010). Harmless;
  drop if unwanted. The `trainer-prod-static` entry (`public/` over :8099) is what the offline render
  harness in §4 serves through — keep that one.
- **One flaky suite** — `cardiohelp-ecmo/learn-walkthrough` timed out once at 28 s during a full run,
  then passed three times in isolation. Watch it; may need a timeout bump.

---

## 3. Future sessions

Roughly in priority order.

1. **Ventilator device fidelity** — display layer and per-vendor control ordering both done (§1.4).
   What remains is a sourced PB980 settings layout and per-device control units.
2. **Hold interaction wrinkle.** Performing the inspiratory hold requires "Open ventilator tools",
   which switches the console off the Monitoring screen — so the maneuver happens while the learner is
   _not looking at the waveform_, then they must click back to see the plateau. That undercuts the
   point. Either return to Monitoring automatically after the hold, or keep the pressure trace visible
   on the tools screen. **Needs a decision on which.**
3. **`Step one breath` pauses the run** as an unlabelled side effect. Defensible for a step control,
   but it reads as the sim stopping on its own.
4. **Remaining six MV teaching panels** — Modes, Timing, Dyssynchrony, Oxygenation, Ventilation,
   Safety. The pattern is proven; these are authoring plus a figure each.
5. **Extend the three-pane workspace to CRRT, MCS and ECMO.** `ResizableTeachingWorkspace` is already
   shared and unused by them.
6. **MV clinical reconciliation** — still blocked on the ventilation synthesis and the owner's
   reconciliation rule (implementation report, decision 2). WP10 deliberately did structure only; the
   MV landing says so. Numeric thresholds stay out until this lands.
7. **Per-module content passes** (v5.1 §11) — unchanged by this work, still outstanding for every
   module except hemodynamics.
8. **Housekeeping** — `testPathIgnorePatterns` fix; confirm the production build in CI; run `test:e2e`
   against the right tree; resolve PR #26.

---

## 4. Orientation for whoever picks this up

**Key files**

- `src/features/critical-care/content/activities.ts` — the 140-activity catalog and its validators.
  Throws at import if the catalog is inconsistent, so a bad edit fails loudly and early.
- `src/features/critical-care/content/learningPathways.ts` — every module's authored order, in one
  place. This is the artifact WP10 added.
- `src/features/critical-care/content/curriculumOrder.ts` — the single ordering rule for every surface
  that lists activities. Never sort by title.
- `src/features/learning-module/curriculum/` — the shared pathway abstraction and the three-pane
  workspace.
- `src/features/mechanical-ventilation/components/MechanicalVentilationTeachingPanel.tsx` — the three
  MV teaching panels plus the run control and the generic section overview.
- `src/features/mechanical-ventilation/content/deviceProfiles.ts` — the four device profiles and the
  source registry. Everything a console shows about a device is authored here; each `display` block
  carries a `displayNote` naming the pages it came from.
- `src/features/mechanical-ventilation/content/deviceDisplay.ts` — the pure resolvers behind those
  profiles: metric lookup, control ordering and grouping, the PB980 breath-phase letter.
- `src/features/mechanical-ventilation/components/MechanicalVentilatorConsole.tsx` — reads both.
  **Do not branch on `deviceId` here.** Adding a device means authoring a profile, not editing the
  component. The only three `deviceId` checks left are AVEA's Touch-Turn-Touch idiom — the
  15-second pending timeout and the `MODE ACCEPT` / `ACCEPT` legends — which is behavior, not
  display.

**Traps that cost time**

1. **Barrel imports drag components into data modules.** `learning-module/curriculum/index.ts`
   re-exports React components that reach `next-intl` navigation. Content modules must import from
   `curriculum/types` directly, or Jest fails to parse ESM. Same applies to the activity barrel: import
   `learning-module/activity/types`, not the barrel, from anything reachable by a public client
   component — the barrel pulls the analytics/progress-sync graph with it.
2. **`curl` cannot verify these routes, and neither can the browser without a login.** The MV lesson
   sits behind a viewport-measuring launch gate, so the workspace only mounts client-side; pages
   return 200 with the lesson title and none of the panel content. `src/proxy.ts` then gates the
   route itself. What works for pixels: bundle the console with esbuild
   (`loader: {'.module.css': 'local-css'}`), `renderToStaticMarkup` one page per device, inline the
   emitted CSS, drop the file in `public/`, and open it through the `trainer-prod-static` launch
   config on :8099. Two gotchas — the generated entry file must sit **inside the repo** or
   `react-dom/server` will not resolve, and the bundle must run as a **CJS child process**
   (`new Function` dies on `Dynamic require of "util"`).
3. **Console CSS must use the `--screen-*` custom properties.** The palette flips per device — the
   Evita's screen is white — so any fixed dark value renders navy-on-navy there. This bit three
   separate elements in §1.4 and is the same class of defect as §1.3 item 8.

**A measurement artifact worth knowing:** `setInterval` is throttled in a backgrounded tab, so the
simulation clock looks frozen under browser automation even when it is running correctly. Check
`document.hidden` before concluding the clock is broken.
