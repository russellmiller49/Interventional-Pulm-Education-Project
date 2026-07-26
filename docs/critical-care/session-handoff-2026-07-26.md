# Critical Care — session handoff

**Date:** 2026-07-26
**Branch of record:** `codex/ip-preference-card-builder-v0-1` (what the dev server runs)
**Work branch:** `claude/curricular-sequencing-updates-b351b1`
**Head at handoff:** `8aaffc1`

---

## 1. What was done this session

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

[PR #26](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/26) targets
`main` from the work branch and contains the WP10 commit only. It has **not** been updated with the MV
work — decide whether to retarget, extend, or close it.

### Verification status

| Check                                   | Result                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| `npm run type-check`                    | clean                                                           |
| `npm test`                              | **2340 passed / 315 suites** on the merged tree                 |
| `npm run lint`                          | 0 errors, 18 warnings (all pre-existing, none in touched files) |
| `npm run test:a11y`                     | 4 passed                                                        |
| `npm run validate:critical-care-assets` | passed (19 assets)                                              |
| `npm run build`                         | **NOT VERIFIED**                                                |
| `npm run test:e2e`                      | **NOT RUN**                                                     |

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
  drop if unwanted.
- **One flaky suite** — `cardiohelp-ecmo/learn-walkthrough` timed out once at 28 s during a full run,
  then passed three times in isolation. Watch it; may need a timeout bump.

---

## 3. What we are working on now

**Making each ventilator console display information the way that device actually does.**

Scope established but **not started**. Six manuals supplied:

- `9513888_1_enUS.pdf` (384 pp) — Hamilton C6 operator's manual
- `662436517-PB980-Service-Manual.pdf` (378 pp)
- `puritan-bennett-980-...-interactive-brochure.pdf` (12 pp)
- `evita-v800-sw2n-pi-dmc-106133-en-master.pdf` (12 pp)
- `Quick-Guide-Evita-V800-V600-...-V3.pdf` (24 pp)
- `RC_AVEA-Modes-Guide_UG_EN.pdf` (52 pp)

**What already exists.** Four device profiles — `hamilton-c6`, `drager-evita-v800-v600`,
`puritan-bennett-980`, `carefusion-avea` — and a source registry in `content/deviceProfiles.ts`
already citing all six manuals.

**The actual gap.** `MechanicalVentilatorConsole` branches on `deviceId` in exactly **three places**,
all cosmetic string swaps for AVEA ("MODE ACCEPT" vs "Confirm", "ACCEPT" vs "Press knob to confirm").
Everything else is shared, so a Dräger and a PB980 currently render as a Hamilton with a different
title bar.

**Decomposes into four things per device:**

1. **Numeric panel** — which values, in what order, with that vendor's abbreviations.
2. **Waveform stack** — which traces, order, default scales, whether loops show by default.
3. **Terminology** — mode and parameter names differ substantially (Dräger `VC-AC` / `PC-BIPAP` /
   AutoFlow; PB `A/C VC+`; Hamilton `(S)CMV` / ASV; AVEA's own set).
4. **Interaction idiom** — the confirm/accept model, the only part currently modelled.

**Recommended approach.** Do one device end-to-end first and factor the presentation layer out of the
shared console; the other three are then mechanical. Start with **Dräger Evita V800** — its two short
documents (12 pp product info, 24 pp quick guide) carry screen layout and terminology without wading
through a 384-page operator's manual.

---

## 4. Future sessions

Roughly in priority order.

1. **Ventilator device fidelity** (above). Largest and highest-value.
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

## 5. Orientation for whoever picks this up

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

**Two traps that cost time this session**

1. **Barrel imports drag components into data modules.** `learning-module/curriculum/index.ts`
   re-exports React components that reach `next-intl` navigation. Content modules must import from
   `curriculum/types` directly, or Jest fails to parse ESM. Same applies to the activity barrel: import
   `learning-module/activity/types`, not the barrel, from anything reachable by a public client
   component — the barrel pulls the analytics/progress-sync graph with it.
2. **`curl` cannot verify these routes.** The MV lesson sits behind a viewport-measuring launch gate,
   so the workspace only mounts client-side. Pages return 200 with the lesson title and none of the
   panel content. Browser check is the only meaningful one.

**A measurement artifact worth knowing:** `setInterval` is throttled in a backgrounded tab, so the
simulation clock looks frozen under browser automation even when it is running correctly. Check
`document.hidden` before concluding the clock is broken.
