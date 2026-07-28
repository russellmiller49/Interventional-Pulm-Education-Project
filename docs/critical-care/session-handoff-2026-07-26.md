# Critical Care — session handoff

**Date:** 2026-07-26 (revised same day, nine times — the last is §1.15)
**Branch of record:** `codex/ip-preference-card-builder-v0-1` (what the dev server runs)
**Work branch:** `claude/curricular-sequencing-updates-b351b1`
**Head at handoff:** `05bece6d`. Everything through §1.14 is committed; §1.15 is not.

> **A concurrent session shares this checkout.** While §1.11 was being written, another session
> committed an unrelated "IP literature explorer phase 1" merge into this same working tree and ran
> `lint-staged`, whose stash/restore cycle briefly reverted files mid-edit. Everything survived, but
> check `git status` before trusting a diff here, and prefer synchronous test runs over background
> ones.

---

## 1. What was done

In the order it landed:

| §          | Work                                                                              | State       |
| ---------- | --------------------------------------------------------------------------------- | ----------- |
| §1.1       | WP10 curricular sequencing across all modules                                     | committed   |
| §1.2, §1.3 | MV three-pane teaching workspace, and the defects that surfaced with it           | committed   |
| §1.4       | Per-device ventilator console fidelity, all four devices                          | committed   |
| §1.5       | Follow-up session clearing §3 items 1–4 and the housekeeping half of 8            | committed   |
| §1.6       | Waveform physiology — the hold, the expiratory limb, and what the console reports | committed   |
| §1.7       | The Learn pathway now opens by teaching how to read a breath                      | committed   |
| §1.8       | The wandering baseline between breaths                                            | committed   |
| §1.9       | The rest of the casebook's waveform signatures, swept the same way                | committed   |
| §1.10      | The numbers the console reports, measured off the trace rather than predicted     | committed   |
| §1.11      | The PB980 rebuilt against its operator's manual                                   | committed   |
| §1.12      | Evita and AVEA setting units re-sourced — every device now manual-verified        | committed   |
| §1.13      | Answering a question now tells the learner whether they were right, and why       | committed   |
| §1.14      | The inspiratory pause the four consoles advertise now does something              | committed   |
| §1.15      | The teaching sliders drive the real ventilator, and resistance joins compliance   | uncommitted |

Three threads run through this, and it is worth knowing which one a section belongs to.

**The trace.** §1.6–§1.8 came out of the owner reviewing the running module rather than from the
backlog, each beginning as "this does not look right" over a screenshot. Read §1.6 first: the other
two are consequences of looking closely at the same trace. §1.9 then took that method — dump the
buffer, do not judge from a rendering — and ran it over every remaining clinical sign in the
casebook. §1.10 finished the job by making every _reported number_ come off the trace too, which is
the same principle applied to the console instead of the waveform.

**The devices.** §1.4, §1.11 and §1.12 are display fidelity: what each vendor's console actually
shows and what it calls it. That thread is now **complete** — all four devices are verified against
their own operator's manual, which had been blocked on missing PDFs since §1.5.

**The curriculum.** §1.1–§1.3 and §1.7 are structure and teaching content. This is the thread with
the most left in it; see §3 item 4.

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
| MV      | waveforms moved ahead of modes (modes are device-facing) — §1.7 later put anatomy first | 1 — high-peak-pressure capstone                                           |
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
  _(Superseded by §1.5 and §1.7 — all ten sections now have a bespoke panel.)_

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
for all four devices**; committed as `ea7699d9`.

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

### 1.5 Follow-up session — §3 items 1–4 and 8 (complete)

Everything below landed after the handoff above was written, working down §3 in priority order.

**Housekeeping first (§3 item 8, partial).** `jest.config.cjs` now ignores `<rootDir>/.claude/worktrees/`
in both `testPathIgnorePatterns` and `modulePathIgnorePatterns`. `npm test` from the main checkout
collects **318 suites** instead of 624 and passes clean — the `npx jest src --testPathIgnorePatterns …`
workaround in "Known wrinkles" is no longer needed.

**Ventilator control units (§3 item 1, the doable half).** `VentilatorDisplayProfile.controlUnits`
maps the simulator's neutral unit spellings (`mL · L/min · /min · s · ms · % · mm`) onto each
vendor's own, resolved by `resolveControlUnit` in `content/deviceDisplay.ts` and applied in
`adaptControlDescriptor`. Pressure still comes from `pressureUnit` — a real unit difference rather
than a spelling one — and an unmapped unit passes through rather than blanking.

| Device | Setting units                              | Basis                                                                        |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| C6     | `ml` · `b/min` · `l/min`                   | **Operator's manual Table 16-5**, re-verified against the registered SHA-256 |
| PB980  | `1/min` (rate); `mL` / `L/min` unchanged   | Service manual Table 2-10 symbol names, as already registered                |
| AVEA   | `BPM` (rate); `mL` / `L/min` unchanged     | Modes guide alarm-limits window p. 6, as already registered                  |
| Evita  | none renamed — its own spelling is neutral | IFU §3.9 abbreviations, as already registered                                |

> **Only the C6 row is newly sourced.** The Hamilton PDF is the one still on disk; the other three
> manuals are gone from `~/Downloads`, so those rows reuse each device's own already-registered
> unit vocabulary rather than a fresh reading. Each `displayNote` says which it is.

**Hold interaction (§3 item 2 — decided).** The owner chose _keep the trace on the Tools screen_
over auto-returning to Monitoring. Tools is now a two-column screen: the pressure and flow traces on
the left, maneuvers on the right, plus a live maneuver-status line that names the occlusion
(`Occluding at end-inspiration · N s remaining · flow is zero, so the pressure on the trace is
Pplateau, the elastic load alone`). Volume stays on Monitoring — it adds nothing to a hold. This also
matches the devices: the C6's Tools ▸ Maneuvers, the Evita's Procedures drawer and the PB980's bezel
pause keys all leave the waveform up. The paused-only pressure component labels now also show while a
hold is active, since an occlusion holds the trace still and naming the plateau _during_ the hold is
the point of it.

**`Step one breath` (§3 item 3).** The pause is in the label: the button reads
`Pause + step one breath` while running and `Step one breath` once paused, with a hint line either
way and the clock readout in an `aria-live` region.

**Remaining six teaching panels (§3 item 4 — complete).** Every Learn section now has a bespoke
panel; `VentilationSectionOverview` is a safety net for a section added ahead of its panel rather
than the state six sections were in. The three original panels stayed in
`MechanicalVentilationTeachingPanel.tsx`; the six new ones are one-file-each under
`components/teaching/`, over shared primitives in `teaching/shared.tsx`. The dispatcher is now a
`Record` keyed by section id, so `ventilationTeachingPanelSectionIds` derives from it. (§1.7 later
added a seventh file there, for the new opening section.)

| Section                                 | Panel                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `modes-and-breath-delivery`             | Trigger / target / cycle / expiration marked on the live breath, with behavior beside the active console's label  |
| `triggering-and-cycling`                | Two timelines — machine inspiration against one contiguous neural inspiration — with delay, ineffective, autotrig |
| `dyssynchrony-mechanisms`               | Commit to a domain (drive · load · timing · support · whole patient); live signals shown for and against it       |
| `oxygenation-response`                  | Facing benefit and cost columns over the trend window, plus what each lever buys, costs, and is limited by        |
| `ventilation-and-co2`                   | Delivery tier over gas-exchange tier on one axis, with the arterial CO₂ spark and its direction                   |
| `safety-reassessment-and-human-factors` | The engine's own active alarms grouped by where the answer lives — patient, circuit, ventilator, person           |

Held throughout: computed from live state, computed `aria-label`, text equivalent, model boundary,
and **no numeric thresholds** — a test now asserts no panel prints a "should be below N" style claim.
The safety panel deliberately applies no urgency rule of its own; it groups whatever the engine has
already alarmed on.

**Defects found while building.**

1. **Annotation labels were unreadable on the Evita.** `.waveformAnnotation` fill and halo were fixed
   pale-on-dark, so on the white screen they read as smudges — the same `--screen-*` trap as §1.3
   item 8 and §4 trap 3. Now `--wave-annotation{,-line,-halo}`, inverted for the Evita. `.toolGrid`
   had the same fixed dark values and was fixed with it.
2. **Neural inspiration spanned every effort in the window.** The first-to-last qualifying sample was
   taken rather than one contiguous run, so a window holding several ineffective efforts reported
   ~5 s of "neural inspiration" — which is not a breath, in exactly the cases the section is about.
   Now the contiguous run containing the window's deepest deflection. Test asserts it never exceeds a
   breath cycle.
3. **Variable-marker labels collided** on both the modes and timing figures whenever the marked
   points fell close together. Staggered onto separate rows.

### 1.6 Waveform physiology — the hold, and the expiratory limb

Raised by the owner against a screenshot of a hold that showed no plateau, with a Dräger screen
photograph, an annotated plateau/pendelluft figure, Egan's _How a Breath Is Delivered_ (ch. 3), and
`40124_2020_Article_235.pdf` supplied as the reference for what the tracing should look like.

**The hold was occluding in the wrong limb.** Probing the engine directly: for the whole four
seconds of an "inspiratory hold", `paw` sat at **5.0 cmH₂O with volume 0** — end-expiration. The
plateau was not merely hard to see; it was never drawn.

§1.3 item 9 had already tried to fix this by advancing to the boundary using
`simulationTime % cycle`. That arithmetic runs on `deriveEffectiveVentilationRate`, while the
breath the waveform generator draws runs on `machineTiming`, which uses
`measurements.totalRatePerMin`. Two clocks, so the jump landed in the wrong limb.

The boundary is no longer computed twice. `MechanicalVentilatorState.pendingHold` parks the
request; `advanceSimulation` arms it at the phase transition it actually reaches, and recomputes
that one frame from the volume _before_ the step so an inspiratory hold occludes on the full
delivered breath rather than after a step of expiratory flow. `PERFORM_HOLD` still returns a state
with the hold running — it drives the model forward in 0.1 s steps until armed, capped at ~1.6
breaths — so the lesson requirements and the console readout keep their synchronous contract.
Authored `inspiratory-hold` / `expiratory-hold` interventions now go through the same path.

Two things fell out of it:

- **Phase is pinned while the valves are shut.** The free-running breath clock kept flipping
  `sample.phase` through the occlusion, inventing breath onsets on a trace where no gas was moving —
  which `latestBreath()` in the teaching panels then sliced on.
- **Stress relaxation.** `holdRelaxationFraction` decays the held pressure by a few percent with a
  ~1.4 s time constant, so the plateau drifts gently down the way the supplied annotated figure
  shows (pendelluft between units with different time constants). Modeled, and labelled as modeled.

**Expiratory airway pressure was going below baseline.** The equation of motion describes the
_alveolus_; applying it at the airway during expiration subtracted the full resistive drop from the
elastic term and drove the trace to **−4.1 cmH₂O on a PEEP of 5** — the downward spike visible under
every breath on the old monitoring screen. No ventilator shows that: the expiratory valve regulates
the circuit to baseline (Egan's Fig. 3.3; both supplied screen photographs).

`expiratoryAirwayPressure` now models the limb the valve actually controls — baseline plus the drop
across the expiratory limb, decaying to PEEP — and patient effort is still subtracted, so trigger
deflections survive. Alveolar pressure is only visible at the airway when the valves are shut, which
is exactly what makes the two hold maneuvers worth performing: an inspiratory hold reveals the
plateau, an expiratory hold reveals total PEEP. Neither was legible before.

**Shapes checked against Egan's Fig. 3.3.** Volume control: square flow, linear volume ramp, rising
pressure ramp, exponential expiratory decay. Pressure control: rectangular pressure, decelerating
exponential flow, exponential volume, zero end-inspiratory flow when TI outruns the time constant.
Both confirmed by direct sample dumps and by eye on all four consoles.

**The console was printing pressures its own trace never reached.** `Ppeak` and `Pplateau` were
computed for a **passive** patient while the trace was drawn with the patient's effort in it, so
MV-01 read `Ppeak 33` over a trace peaking at 25 — an 8 cmH₂O gap, the effort amplitude — and the
paused component-label lines sat above the trace they annotate. The owner's call was to report what
the ventilator actually measures.

`VentilatorMeasurements` now carries both, and they are used for different things:

| Field                                                    | Is                                                                                                 | Used by                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `peakPressureCmH2O`                                      | the highest pressure **on the trace**                                                              | the display, and the high-pressure alarm                                           |
| `plateauPressureCmH2O`                                   | read off the occluded trace during a hold; otherwise the relaxed value less end-inspiratory effort | the display                                                                        |
| `relaxedPeakPressureCmH2O` `relaxedPlateauPressureCmH2O` | the same pressures with effort taken out — the mechanics                                           | `isCaseResolved`, the authored case criteria, and the lung-injury risk accumulator |
| `endInspiratoryEffortCmH2O` `plateauIsInterpretable`     | how hard the patient was pulling when a plateau would be read                                      | the teaching content below                                                         |

Peak comes straight off the waveform buffer, so the number and the drawing cannot disagree by
construction. Case criteria and `risk.highPlateau` moved to the relaxed value deliberately: they are
claims about the lung, and a patient working hard pulls the _displayed_ plateau down without
lowering what the alveoli are being distended to. Nothing in the casebook changed behavior.

> **One consequence worth knowing:** the displayed peak now lags a setting change until a breath has
> been delivered at the new setting, exactly as a real ventilator does. Anything asserting on
> `peakPressureCmH2O` immediately after `SET_CONTROL` needs either a tick or
> `relaxedPeakPressureCmH2O`.

**Educational content — the plateau you cannot trust.** Added at the owner's request, because this
is the measurement most reliably misread and the error runs in the dangerous direction.

- **`PlateauValidity`** in the mechanics panel states, from live state, whether the conditions for
  the decomposition above are met. When they are not it names both numbers (`13.9 rather than the
21.8 the same lung would show relaxed`), says **why it matters** — effort makes a plateau read
  _low_, so a stiff lung can look safe, and it is invisible in the number itself — and **what to
  do**: establish passivity first, repeat the occlusion and watch whether the value settles, and
  treat relaxing the patient as a clinical decision made for the patient rather than for the
  measurement. The figure's text equivalent carries the same caveat.
- **The console** prints `Pplateau 14?` in amber when it is not interpretable, with the reason in
  the trace's text alternative. The device would show the number either way; the learner is the one
  who has to know it is not usable.
- **The hold status on Tools** adds the caveat while the occlusion runs — that what the trace
  settles on is alveolar pressure minus the patient's effort, and will move as that effort does.

This sits alongside the `invalidates` verdicts the high-pressure discriminator already had (§1.3
item 4), so the module now says the same thing in all three places a plateau is read.

### 1.7 The pathway now opens by teaching how to read a breath

Owner's reading of the module: the waveform components and the difference between volume- and
pressure-targeted breaths were under-explained, and the pathway should start there. It previously
opened on **Mechanics**, which decomposes peak pressure without ever having said what the three
traces are.

**New first section — `waveform-anatomy`, "Waveform anatomy: three traces, one breath".** Authored
end to end: catalog seed (`orientation`, `stageOrder` 1, with `modes-and-breath-delivery` moved to
2), pathway section, lesson with its six phases and prediction/transfer, learning items, guided
runtime, and a teaching panel. It is also now the first prerequisite on the capstone.

The panel has two halves:

- **The three traces**, off the live breath. Selecting one gives what it plots, what it is read
  against, and what sets its shape — including that pressure is airway pressure and equals alveolar
  pressure only when nothing is moving, that flow is the one signed trace and the only one read
  against zero, and that volume is the integral of flow and carries no information flow does not.
- **Volume-targeted against pressure-targeted**, side by side on the same lung. The stated rule is
  that a ventilator sets _one_ of pressure or volume and the lung decides the rest, so whichever is
  set keeps its shape and the other one is the one worth watching. The figure makes the rectangle
  move from flow to pressure between the columns, with the consequence spelled out both ways: a
  stiffer lung raises the pressure trace and leaves the breath size alone under volume targeting,
  and shrinks the breath while leaving the pressure trace alone under pressure targeting. Expiration
  is passive in both, so that limb is identical — which is why it reports the lung, not the machine.

The comparison breaths are drawn closed-form from **this patient's** compliance, resistance, PEEP,
tidal volume and inspiratory time rather than simulated — two live engine runs inside a render is
not affordable, and the claim being made is about shape. They move with the case; they are not stock
art. Both limbs share one time axis, which matters: drawing them on separate axes squashed the
inspiratory flow rectangle next to the expiratory spike and made the two columns look alike.

**A latent test coupling fell out.** `lesson-v2.test.tsx` took `mechanicalVentilationLessons[0]` and
paired it with `mechanicalVentilationLessonItems['mechanics-load-and-pressure']`, so it broke the
moment anything else became first. Now pinned by id.

### 1.8 The wandering baseline between breaths

Also owner-raised, from a high-resistance screenshot. The retained-secretions sign was modeled as
`paw += Math.sin(time * 40) * 1.8` — applied to **pressure only**, on **every** sample.

Two things wrong with it. Clinically the sign is a saw-tooth on the **flow** trace; pressure inherits
it through the resistive term, which is why it is more obvious the higher the resistance. This drew
it on the one waveform that does not carry it and left flow perfectly flat at 60.0 L/min. And it ran
at zero flow: the end-inspiratory pause wobbled between 10.10 and 10.28 with no gas moving, and it
would have wobbled straight through the occlusion plateau §1.6 had just fixed.

`secretionFlowDisturbanceLps` now perturbs flow, scaled by how much gas is actually moving, so it
vanishes wherever flow does. Pressure picks it up through the equation of motion at the right
amplitude for the resistance. The pause is now flat at 8.49.

> A test asserts the occluded plateau carries no ripple **between consecutive samples** rather than
> no movement at all — the held pressure may still drift, because this patient is not relaxed and an
> effort during an occlusion moves the plateau. That is §1.6's teaching point, not a defect.

### 1.9 The rest of the casebook's waveform signatures

§3 item 9, worked through in full: every remaining clinical sign the casebook draws, checked by
dumping the buffer rather than by looking at a rendering. Four were wrong in the same way §1.8's
secretions sign was wrong — the finding was drawn on a waveform that does not carry it, or the
console asserted something the trace never showed.

The dump script is now committed as well, since this had been rebuilt from scratch three times:

```bash
npm run dump:mv-waveforms                      # one-line summary for all 15 cases
npm run dump:mv-waveforms -- --case=MV-03      # sample table for one case
npm run dump:mv-waveforms -- --case=MV-13 --branch=secretions --hold=inspiratory
npm run dump:mv-waveforms -- --case=MV-04 --set=ratePerMin:14
```

The summary line flags the two ways a derived number can outrun its own trace (`Pplat > Ppeak`,
`VTe over trace`), so this class of defect is screened rather than spotted by eye. The console
harness now also takes `MV_CASE=MV-08 npm run render:mv-console`.

**Patient effort was invisible on the expiratory flow limb.** `passiveExpiratoryFlowLps` took only
volume, resistance and compliance, so an effort during expiration moved the _pressure_ trace by up
to 8 cmH₂O and left flow a perfectly smooth exponential. That is backwards for the sign it matters
most for: **an ineffective effort is a flow finding** — a notch back toward zero on the expiratory
limb — and MV-05, the case built to teach it, drew nothing at all on flow.

Expiration is driven by the recoil still stored in the lung, so an inspiratory effort works against
it: driving pressure falls, flow slows, and if the effort exceeds the recoil the limb crosses zero,
bounded by `CLOSED_VALVE_BIAS_FLOW_LPS` — what a shut demand valve can supply. The same term now
explains _why_ trapping makes efforts ineffective: the more recoil is still stored, the larger the
effort has to be before anything moves.

`expiratoryAirwayPressure` changed with it, and this is the part worth a second look. It used to
subtract the whole effort, so the pressure trace carried the entire sign at full muscle amplitude.
It now subtracts only the surplus over the recoil still in the lung: while gas is leaving, the
expiratory valve holds the circuit at baseline and the effort is spent inside the chest. A trigger
deflection is preserved — §1.6's reason for having the term at all — because that is exactly the
case where the effort exceeds the recoil.

> **Consequence across the casebook.** Six cases used to drive airway pressure below zero on every
> breath; now only MV-02 and MV-09 dip under their own PEEP, both with a large effort still near
> peak when the ventilator cycles. That is the genuine premature-cycling picture §3 item 10 asks
> about, and it is now the only thing producing it.

**Cardiogenic oscillations were invisible and off-clock.** `Math.sin(time * Math.PI * 3) * 0.012`
— ±0.7 L/min at a hard-coded 1.5 Hz, on a trace scaled ±100. MV-08 asks the learner why the
ventilator is cycling at 28/min against a neural rate of 8, and the trace gave no reason.
`cardiogenicFlowOscillationLps` now runs at the patient's own heart rate and draws at
`CARDIOGENIC_OSCILLATION_AMPLITUDE_LMIN`, which is **the same constant the autotrigger rule keys
on** — so the flow limb, the trigger setting, and the machine's behavior come from one number. It
is also zero-mean and skipped under an occlusion; it was previously integrating into lung volume
through a hold, the §1.8 defect exactly.

> Sized honestly rather than for visibility: 1.5 L/min on a ±100 L/min band is about 3 px of
> peak-to-peak on the rendered console. Real cardiogenic oscillations are that subtle, which is why
> autotriggering gets missed. If it should be more prominent for teaching, the amplitude and the
> rule move together — one constant — or the autotriggering panel draws a zoomed end-expiratory
> window.

**A "double trigger" never stacked.** The volume target was measured against **absolute** lung
volume, so the second inflation only topped the lung back up to one tidal volume: MV-03 peaked at
354 mL against a set VT of 350 while the console reported `stacked 648 mL`. Two inflations, no
consequence — with breath stacking being the entire danger of the phenotype. The flow profile had
the same origin problem: it ran on the breath-cycle phase, so a stacked inflation evaluated past
the end of its own profile, where a decelerating pattern is zero flow.

Both now run from the breath's own onset, read back off the waveform buffer by `inspirationAnchor`
rather than held as extra state. MV-03 now peaks at **726 mL and 39.4 cmH₂O** against 350 mL and
21.9 for a single breath.

> This also fixed a quieter bug: any breath into a lung that had not finished emptying was
> **under-delivered** by whatever was still in it, and idled at zero flow for the rest of its
> inspiratory time. That fake pause is what §1.8's "goes quiet wherever gas is not moving" test was
> asserting on; the test now asserts the property on the disturbance function, and a new test
> asserts the full tidal volume reaches a lung that has not emptied. **The engine models no
> inspiratory pause at all** — `pausePercent` is display-only (§1.4 split `deriveVolumeFlowTimeSeconds`
> out for exactly that). Whether to implement one is open.

**Reverse triggering re-derived the breath clock — trap 5, third instance.** `effortAt` built its
machine period from `settings.ratePerMin` while `machineTiming` built the breath from
`measurements.totalRatePerMin`. They agree at baseline, so entrainment looked right; they diverge
the moment the learner **lowers the set rate**, which is the one action the case asks for, because
the patient's own rate then keeps the machine running faster than the setting. The effort would
have walked through the breath instead of staying locked to it. Now both read the same rate, and a
test asserts the effort-to-onset delay stays within 0.25 s across a rate change.

**Checked and left alone.** MV-02's flow-starvation scoop is emergent from the equation of motion
and is textbook (pressure falls 16.5 → 8.2 → 12.9 across a square-flow breath). MV-11's rise-time
ramp is a smooth ramp, not a step. MV-14's −170 L/min expiratory spike is arithmetically right for
a compliance of 10 mL/cmH₂O and will simply clip off the vendor scale, as it would on the device.

**Offline render harness — now committed.** §4 trap 2 described the recipe but no script existed.
Two are now checked in and wired to npm:

```bash
npm run render:mv-console   # public/mv-console-preview/<device>.html  — 4 devices × 4 screens
npm run render:mv-teaching  # public/mv-console-preview/teaching-panels.html — all 10 panels
```

Serve through the `trainer-prod-static` launch config on :8099. Output is gitignored. Two gotchas
beyond the ones already in §4: the harness must use `createElement` rather than calling the component
(`.mts` is parsed without JSX, and a direct call bypasses React's hook dispatcher), and it reads the
CSS esbuild emits as a **sibling of the JS bundle**.

### 1.10 The numbers the console reports

§3 items 11 and 12, both cleared. §1.9's sweep found seven cases reporting a tidal volume the trace
never delivered and four printing a plateau above their own peak; the expiratory hold was throwing
away the trapped gas it exists to measure. All of it turned out to be one disease with four
symptoms: **a quantity modeled twice, once analytically and once by the trace.** §1.6 fixed the
first instance of it — peak pressure — by deleting the analytic copy. This does the same for the
rest.

| Quantity        | Was                                               | Now                                                                         |
| --------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Tidal volume    | driving pressure × compliance, at **equilibrium** | `observedTidalVolumeMl` — peak volume of the last inflation, less its onset |
| Plateau         | analytic tidal volume ÷ compliance, less effort   | `observedPlateauPressureCmH2O` — end-inspiratory `paw − R·V̇`                |
| Auto-PEEP       | analytic only, added on top of retained volume    | the larger of the case's value and the trace's own retained recoil          |
| Expiratory time | `60/rate − Ti` on the **neural** rate             | `observedExpiratoryTimeSeconds`, then the machine's own rate                |
| Occluded volume | clamped to ~0 on an expiratory hold               | frozen — no gas moves in either direction                                   |

Each keeps its analytic value as the cold-start fallback, the `observedPeak ?? relaxedPeak` pattern
§1.6 established. **A consequence to know:** tidal volume is now a measurement, so like the peak
pressure it lags a setting change until a breath has been delivered at the new setting. Four
existing tests asserted on it immediately after `SET_CONTROL` and have been advanced a breath.

**No pressure-targeted breath was ever allowed to reach equilibrium.** They are cycled at Ti — a
flow-cycled breath loses the ETS fraction by definition, and one clamped by `tiMaxSeconds` loses far
more. MV-05 has a 1.92 s time constant and 1.5 s to fill in, so it reached 54% of the predicted
volume and the console reported 1400 mL over a trace delivering 877.

**Auto-PEEP was counted twice.** `volumeL` in the equation of motion is absolute lung volume, so
wherever the trace fails to empty it is already producing the trapped gas's recoil — and the case's
full analytic `intrinsicPeepCmH2O` was added on top of that. Worst on the two air-trapping cases,
which are the ones the term exists for: MV-06's peak was 6.9 cmH₂O too high. `unmodeledIntrinsicPeepCmH2O`
now adds only the shortfall, so the authored total is preserved and the trace supplies as much of it
as it actually can. It also runs the other way — MV-03's double trigger stacks onto a lung that has
not emptied, which is auto-PEEP by any definition and the analytic model never predicted it. It now
reports 13.1 cmH₂O, entirely from the trace.

**A fourth two-clocks defect, in the trapping model itself.** Expiratory time came from
`60/rate − Ti` where `rate` is `deriveEffectiveVentilationRate` — the **neural** rate in pressure
support. MV-05's patient breathes at 28 against a machine cycling at 8, so it was credited with
0.64 s to empty where the trace gives it six full seconds, inventing 7.8 cmH₂O of auto-PEEP on top
of an authored 10. Read off the trace now, which also sidesteps the circularity: auto-PEEP drives
the ineffective-effort fraction, which drives the machine rate, which would otherwise drive
auto-PEEP.

**Two defects the freeze uncovered.**

1. **`deriveEffectivePatient` rebuilt the running lung volume from the case definition.** It rebuilds
   mechanics each call, and `endExpiratoryVolumeL` was going with them — but that field is not a
   property of the case, it is how much gas is in the lung right now. So performing _any_
   intervention emptied the lung, and an expiratory hold armed through an authored `expiratory-hold`
   intervention — MV-05 and MV-10 both require one — occluded nothing. The clamp to ~0 had hidden
   this completely.
2. **Entrainment could no longer be broken.** §1.9 locked the reverse-trigger effort to the rate
   `machineTiming` runs on, which was the right fix for the two-clocks defect and accidentally
   removed the therapy: the old divergence between the two clocks was what made the effort drift
   apart when the learner changed the rate. Entrainment is now explicitly conditional on the case
   being unresolved, so changing the rate breaks it the way it does at the bedside. Without this
   MV-04 kept stacking volume after the correct fix and tripped a sustained-high-plateau critical
   error on all four devices.

**Where this lands.** MV-06's peak 77.4 → 70.5, MV-10's VTe 1400 → 426, MV-05's auto-PEEP 22.4 →
13.5. Every case now reports a tidal volume its trace delivered and a plateau at or below its own
peak, asserted per case by two `it.each` sweeps. An expiratory hold on MV-10 freezes the volume
trace at the 553 mL still in the lung and reads total PEEP 13.6 off it.

> **Worth the owner's eye.** These are large moves on the two air-trapping cases, and they change
> what the console shows a fellow. Nothing in the casebook's authored criteria was touched, and all
> fifteen cases still solve on all four devices — but the numbers a learner reads are different now,
> and MV-05's tidal volume in particular is small (237 mL) because its auto-PEEP is a genuine
> threshold load against PS 18. That is the case's own teaching point rather than a defect, but it
> is a judgement call whether the parameters land where you want them.

### 1.11 The PB980, rebuilt against its operator's manual

The owner supplied `PB980_OperatorsManual_US_EN_PT00128079A00.pdf` (442 pp, SHA-256
`a8fd1043…d79c1fd948`) plus five option addenda — NIV PLUS, capnography, nebulizer, high-flow O2,
and IE Sync. The operator's manual is the document §3 item 1 had been blocked on twice; it is now
registered as `pb980-operators-manual` and is the PB980's primary source. **The five addenda cover
options this simulator does not model and are deliberately not registered**, but they are on disk
if NIV or capnography is ever built.

**The settings layout, which no previous source published.** Figure 4-1 item 9 names the _current
settings area_, and Figures 4-1, 4-4, 4-5 and 4-8 draw it. For A/C + VC it reads

```
f · VT · V̇MAX · [V̇SENS | PSENS] · O₂%
TPL · flow pattern · PEEP
```

and Figure 4-8 shows the same shape for SIMV + PC + PS, with `PI` and `TI` where `VT` and `V̇MAX`
sit. So: rate, then what sizes the mandatory breath, then what times it, then the trigger, then O₂,
then the breath-shaping settings, and **PEEP last** in every figure. That is now `controlOrder`.
No `controlGroups` — unlike the C6, the PB980 prints no group labels, only a visual divider.

**Setting units, re-sourced.** Table 11-9 (Ventilator Settings Range and Resolution) and Table 2-7
(Symbols and Abbreviations) confirm rate in `1/min`, volume in `mL`, flows in `L/min`, and plateau
time `TPL` in seconds. That row had been reusing the service manual's already-registered
vocabulary; it is now read from the operator's manual, so the PB980 joins the C6 as
manual-verified.

**Three corrections the manual forced.**

1. **The banner led with the wrong parameter.** It opened on `fTOT`, which no figure shows. The
   documented default across Figures 4-1, 4-4 and 4-8 leads with peak pressure:
   `PPEAK · VTE · fTOT · I:E · PEEP · PMEAN · V̇E TOT`. The real banner is operator-configurable
   (§3.7 Vital Patient Data), so this is the default rather than the only arrangement.
2. **Elevate O₂ was not a bezel key.** Figure 4-1 item 7 puts it in the _constant-access icons_ at
   the lower right of the screen, with home, configure, logs and help. Removed from the bezel; it
   stays reachable from Tools where the other maneuvers live. `Alarm silence` is also renamed to
   the manual's own `Audio paused`, and the remaining six keys match Table 2-5's printed order once
   brightness and alarm volume — neither of which this simulator models — are dropped.
3. **The PB980 offers two flow patterns, not four.** Table 11-9: "Range: square, descending ramp".
   §10.15.9 pins which one the ramp is — holding `VT` and `V̇MAX` constant, `TI` "approximately
   halves" going from descending ramp to square, so the ramp's mean flow is half its peak, which is
   what this simulator calls 100% decelerating. `VentilatorDisplayProfile.flowPatterns` is new and
   optional: **omitted means the simulator's full four**, which is the honest default for a device
   whose manual does not publish a list, rather than a claim that it offers all of them. The
   console reads it instead of hard-coding the options, so §4's "do not branch on `deviceId` here"
   still holds.

---

### 1.12 The last two devices' setting units

The owner supplied the Evita V800/V600 software-3.n IFU (386 pp), a software-1.n IFU excerpt, the
**AVEA operator's manual** (L2786 Rev. M, 262 pp), and the AVEA user guide. That closes §3 item 1:
all four devices' setting units are now read from that device's own manual rather than from its
already-registered vocabulary.

**AVEA — operator's manual Table 3-3, "Primary Breath Controls".** This is a better source than the
modes guide for units, because it prints the unit _directly above each control name_ — these are
the settings tiles themselves, not an alarm window. It disagreed with the registered row on three
of them:

| Unit   | Was   | Table 3-3 |
| ------ | ----- | --------- |
| rate   | `BPM` | `bpm`     |
| volume | `mL`  | `ml`      |
| time   | `s`   | `sec`     |

Flow stays `L/min` and O₂ stays `%`. The control _names_ already matched Table 3-3 exactly, so only
the units moved.

**Evita — IFU §16.2 "Set values".** Prints every setting with its own symbol, range and unit: `RR`
in /min, `Ti` and `Timax` in s, `VT` in mL, `Flow` and the flow-trigger threshold in L/min. All of
those are the simulator's neutral spelling, so §1.5's claim that "its own spelling is neutral" was
right — but it was an assumption from the monitored column, and it is now a reading.

**One exception, and a small new mechanism for it.** §16.2 prints "O2 concentration — FiO2 — 21 to
100 **Vol%**" while the inspiration-termination criterion on the same page is "5 to 70 **%**
Flowipeak". One unit string, two spellings on one device, which `controlUnits` cannot express
because it is keyed by the unit rather than by the setting. `VentilatorDisplayProfile.controlUnitOverrides`
is a per-setting map that takes precedence; the Evita uses it for `oxygenPercent` alone. The Evita's
therapy bar now reads `FiO₂ 60 Vol%` beside `VT 420 mL` and `RR 24 /min`.

> §7.2 of the same IFU lists which settings each mode exposes, in an order that differs from the
> therapy bar. It is a **capability matrix, not a screen layout**, so the therapy-bar order still
> comes from the pocket guide. Worth knowing before someone reads §7.2 and "fixes" the order.

---

### 1.13 Answering a question, and changing the lung to see why

Both from the owner looking at the `waveform-anatomy` prediction checkpoint in the running module.

**A committed answer said nothing back.** `commitPrediction` marked the answer and immediately
called `advance('act')`, so the question was replaced by the next phase's controls before any
verdict appeared — the reasoning feedback existed, but it rendered in the task panel _after_ the
phase had already moved, which is not where the learner was looking. Committing now stays on the
predict phase and shows an `AnswerVerdict` in the same pane the question was answered in:

- a plain verdict — **Correct**, **Partly right**, **Not quite**, or **Unsafe** — keyed on the
  choice's own `plausibility`, rather than the shared component's softer "The cues support this
  read";
- the chosen answer's `rationale`;
- **why each of the others does not fit**, in a disclosure, since that is where most of the teaching
  is and all of it was already authored;
- the item's `explanation` as "how to tell them apart";
- then a **Continue** button, which is what advances.

The transfer question gets the same verdict as soon as an interpretation is chosen. Styled for the
light "Your turn" pane rather than reusing the shared `ChoiceReasoningFeedback`, which is written
for the dark workbench (§1.3 item 8).

> **Practice cases deliberately still withhold this.** `CaseWorkflow`'s prediction commits to
> "Initial frame recorded" and the learner finds out by acting and reassessing, with the reveal at
> the debrief. That is an assessment-flavoured surface rather than a teaching one, so it was left
> alone — but it is the same complaint waiting to be made, and whether Practice should also give an
> immediate verdict is a call worth making deliberately.

**A compliance slider on the comparison figure.** The section's own prediction asks what happens to
each trace when compliance falls; the figure beneath it draws both delivery strategies on this
patient's lung. It now has a slider — 0.4× to 2× this patient's own compliance — so the learner can
answer the question by moving it.

The subtlety that makes it work: **each column holds its own set variable.** Volume targeting keeps
the tidal volume, so the peak pressure moves. Pressure targeting keeps the driving pressure it was
set to at the patient's own compliance, so the breath size moves. The driving pressure had been
derived from the _current_ compliance, which would have made the pressure-targeted column quietly
hold volume too and both columns would have moved together, showing nothing.

The readout names what each column holds and what consequently moves, with the moving quantity
coloured. It first printed both as "N mL at N cmH₂O", which put a peak pressure beside a set
pressure — different quantities, and side by side they read as a cost difference between the two
strategies that is neither the point nor true.

---

### 1.14 The inspiratory pause, and what §3 item 5 actually is

**The pause (§3 item 14).** All four consoles present an end-inspiratory pause — `TPL`, `Tplat`,
`Insp Pause`, `Pause` — and none of them did anything. `deriveMechanicalInspiratoryTime` returned
the flow-delivery time alone for a volume-controlled breath, so inspiration ended the moment the
tidal volume was delivered and there was nothing left of it to hold. §1.4 had split
`deriveVolumeFlowTimeSeconds` out on the assumption the pause would stay a display value; §1.9
removed the accidental pause that used to appear when gas was trapped, which left none anywhere.

`derivePauseSeconds` is now part of the inspiratory time, so the valves stay shut for it and it
counts toward I:E and mean airway pressure as it does on the device. The plateau then falls out of
machinery that already existed: the volume target stops flow once the breath is delivered, and
`observedPlateauPressureCmH2O` reads the resulting zero-flow segment.

One thing had to move with it. `flowProfile` normalizes over the **flow** time, not the
pause-extended inspiratory time — spreading the profile across the pause would deliver the breath
more slowly instead of holding it, so a decelerating ramp would simply take longer rather than
plateau.

> **Every case defaults to a pause of 0**, so this is a pure addition: the all-case dump is
> byte-identical to before it, and no authored criterion can have moved. It only bites when a
> learner sets it, which is the point.

On MV-01 at 70% (the control's own maximum), inspiratory time goes 0.46 s → 0.78 s, flow holds at
zero for the tail with the volume steady at 422.8 mL, and the reported plateau goes **14.0 → 19.9**
— estimated by subtracting a resistive drop before, measured off a real zero-flow segment now. A
four-second manual hold on the same patient reads 21.5, and the gap is the patient still relaxing:
a short pause catches them mid-relaxation, a long occlusion does not. That is §1.6's teaching point
appearing on its own.

**§3 item 5 is not a port (§3 item 5, re-scoped).** The item says `ResizableTeachingWorkspace` is
"already shared and unused by" CRRT, MCS and ECMO, which is true and badly understates the work.
The three-pane arrangement earns its keep in MV because of the ten bespoke teaching panels authored
across §1.2, §1.5 and §1.7 — the middle pane. None of the three has that, and two do not have a
live device for the first pane either:

| Module | Today                                                                     | What a port would actually mean                            |
| ------ | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| CRRT   | Document-flow lesson; the console is a static `ReadOnlyConsoleFigure`     | Build a live CRRT console **and** author teaching panels   |
| MCS    | Task workbench with device _tabs_, no live console                        | Same, plus deciding what the primary pane even is          |
| ECMO   | Already two-column: `LearnLessonPlayer` beside a live console and circuit | Genuine — separate teaching from actions inside the player |

ECMO is the one real candidate, and it is a restructure of a 725-line component rather than a
layout swap. The other two are module rebuilds. Item 5 is rewritten below to say so.

---

### 1.15 The sliders drive the real ventilator

Owner-raised against §1.13's compliance slider: add airway resistance, and make the sliders move
the **live console** rather than only the panel's own drawing.

**They now change the patient, not a local copy.** `SET_TEACHING_MECHANICS` puts two multipliers on
`VentilationSimulationState`, and `deriveEffectivePatient` applies them **last**, after every
intervention effect. That placement is the whole trick: `deriveEffectivePatient` rebuilds mechanics
from the case definition on every sample, so anything written straight onto `patient` is gone by the
next one — the same trap that ate the running lung volume in §1.10. The teaching panel takes a
`dispatch`, and because it re-renders off the engine's own scaled patient, the comparison figure
follows for free.

**Learn only.** The reducer refuses the action outside `experience === 'learn'`: in Practice the
case's mechanics are the thing being assessed, and softening the lung would resolve a case by
editing it rather than by treating it. Where there is no dispatch at all — the offline render
harness — the sliders render disabled rather than pretending to be interactive.

**Resistance, with the bedside names on it.** The anchors read _wide open · this patient ·
secretions · bronchospasm · biting or kinking the tube_, because "4× this patient" means nothing on
a ward round. Descriptive labels for a slider, not thresholds; the no-numeric-thresholds rule still
holds.

**The two sliders produce the two signatures the module later asks fellows to tell apart**, which
was the unlooked-for payoff. On MV-01:

| Lung            | Ppeak    | Pplat    | VTe    |
| --------------- | -------- | -------- | ------ |
| This patient    | 25       | 14       | 422 mL |
| Compliance ×0.5 | **41.8** | **30.8** | 422 mL |
| Resistance ×4   | **55.5** | 17       | 422 mL |

Compliance moves peak _and_ plateau together; resistance moves peak alone and widens the gap between
them. That is exactly the discrimination the high-peak-pressure section teaches, arrived at by
dragging a slider.

> **Both sliders run on a log exponent from −1 to +1**, converted with a per-slider base — 2× for
> compliance, 4× for resistance. A linear multiplier range does not put 1.0 under the middle label:
> on the 0.5–5 range the resistance slider's first draft used, "this patient" sat about a tenth of
> the way along while the label claimed the centre.

---

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

Later commits sit directly on the branch of record, the first three all named "updates":

| Commit     | Contents                                                           |
| ---------- | ------------------------------------------------------------------ |
| `ea7699d9` | §1.4 device fidelity, and the first version of this handoff        |
| `3a1c05a2` | §1.5 follow-up and §1.6 waveform physiology, 29 files              |
| `3a35ce86` | §1.7 through §1.10 — everything from the opening lesson to the     |
|            | measured-off-the-trace work                                        |
| `0d72608f` | _(merge)_ "IP literature explorer phase 1" — \*\*another session's |
|            | work\*\*, unrelated to critical care. See the warning at the top.  |

### What `ea7699d9` contained (§1.4)

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

### What landed in `3a35ce86` (§1.7–§1.10) and `05bece6d` (§1.11–§1.14)

Paths are relative to `src/features/mechanical-ventilation/` unless shown otherwise. §1.5 and §1.6
are in `3a1c05a2`; §1.11 and §1.12 are still uncommitted and listed after these.

**§1.7 — the `waveform-anatomy` section.** A new pathway section touches every layer, so this is
the list to copy when adding the next one.

| Path                                                    | Change                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `critical-care/content/activities.ts`                   | the seed; `modes-and-breath-delivery` renumbered to orientation 2; capstone prerequisite |
| `critical-care/content/learningPathways.ts`             | the new first section, and a rewritten arc sentence                                      |
| `content/lessons.ts`                                    | the lesson — six phases, prediction, transfer, references                                |
| `content/lessonLearningItems.ts`                        | its prediction and transfer items                                                        |
| `content/lessonRuntime.ts`                              | its guided actions and required evidence                                                 |
| `components/teaching/waveform-anatomy.tsx`              | **new** — the three traces, and the volume/pressure comparison                           |
| `components/MechanicalVentilationTeachingPanel.tsx`     | registers it as the first entry in the panel `Record`                                    |
| `components/mechanical-ventilation-teaching.module.css` | `.comparisonColumns`, `.comparisonColumn`, `.comparisonRule`, `.comparisonAxis`          |
| `__tests__/teaching-panel.test.tsx`                     | +5 over the new panel                                                                    |
| `__tests__/lesson-v2.test.tsx`                          | pinned to the mechanics lesson by id instead of by list position                         |

**§1.8 — the secretions sign.**

| Path                                  | Change                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `engine/physics.ts`                   | `secretionFlowDisturbanceLps`                                           |
| `engine/simulation.ts`                | the disturbance moved from pressure onto flow, and skipped under a hold |
| `__tests__/physics-waveforms.test.ts` | +3 over where the sign appears and where it must not                    |

**§1.9 — the casebook signature sweep.**

| Path                                          | Change                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `engine/physics.ts`                           | effort term + `CLOSED_VALVE_BIAS_FLOW_LPS` on `passiveExpiratoryFlowLps`; surplus-over-recoil on    |
|                                               | `expiratoryAirwayPressure`; `cardiogenicFlowOscillationLps` + its amplitude constant, which the     |
|                                               | autotrigger rule now keys on                                                                        |
| `engine/simulation.ts`                        | `inspirationAnchor`; per-breath flow profile and volume target; effort into expiratory flow and     |
|                                               | pressure; cardiogenic term rebuilt and gated on the hold; `effortAt` takes `measurements`           |
| `__tests__/physics-waveforms.test.ts`         | +12 — a `casebook waveform signatures` block over all four, plus the reworked secretions assertions |
| `scripts/critical-care/dump-mv-waveforms.mts` | **new** — the buffer dump, wired to `npm run dump:mv-waveforms`                                     |
| `scripts/critical-care/render-mv-console.mts` | `MV_CASE` override so the console harness can render any case                                       |
| `package.json`                                | the `dump:mv-waveforms` script                                                                      |

**§1.10 — reported numbers measured off the trace.**

| Path                                          | Change                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `engine/physics.ts`                           | `observedTidalVolumeMl`, `observedPlateauPressureCmH2O`, `observedEndExpiratoryVolumeMl`,        |
|                                               | `observedExpiratoryTimeSeconds`, `unmodeledIntrinsicPeepCmH2O`; all five wired into              |
|                                               | `deriveMeasurements`; `deriveEffectivePatient` keeps the running lung volume                     |
| `engine/simulation.ts`                        | occlusion freezes the volume; residual auto-PEEP into both the flow equation and the equation of |
|                                               | motion; entrainment conditional on the case being unresolved                                     |
| `__tests__/physics-waveforms.test.ts`         | +36 — two per-case `it.each` invariant sweeps, the occlusion block, and four tests advanced a    |
|                                               | breath before reading a now-measured value                                                       |
| `scripts/critical-care/dump-mv-waveforms.mts` | `EEV` and analytic-vs-trace auto-PEEP columns; `--hold` runs on into the occlusion               |

### Uncommitted — §1.15

The files below plus this handoff. Everything else in §1 is committed.

**§1.11 — the PB980 against its operator's manual.**

| Path                                         | Change                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `content/deviceProfiles.ts`                  | `pb980-operators-manual` source; PB980 `controlOrder`, banner order, `flowPatterns`, bezel |
|                                              | keys, `VT` label, and a rewritten `displayNote`                                            |
| `engine/types.ts`                            | optional `flowPatterns` on `VentilatorDisplayProfile`                                      |
| `components/MechanicalVentilatorConsole.tsx` | flow-pattern options read from the profile instead of being hard-coded                     |
| `__tests__/device-display.test.tsx`          | banner and bezel expectations re-pinned to the manual, +1 over the settings order          |

**§1.15 — sliders that drive the engine.**

| Path                                                | Change                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| `engine/types.ts`                                   | `teachingMechanics` on the state, `TeachingMechanicsOverride`, the action         |
| `engine/physics.ts`                                 | `deriveEffectivePatient` applies the scales last                                  |
| `engine/reducer.ts`                                 | `SET_TEACHING_MECHANICS`, Learn-only, with `TEACHING_MECHANICS_SCALE_RANGE`       |
| `engine/simulation.ts`                              | the default of 1/1 on a new state                                                 |
| `components/MechanicalVentilationTeachingPanel.tsx` | panels take an optional `dispatch`                                                |
| `components/teaching/waveform-anatomy.tsx`          | both sliders on a log exponent, resistance anchors, reset, live prose             |
| `__tests__/teaching-panel.test.tsx`                 | +3 and a `LivePanel` reducer harness — the sliders need a real engine to exercise |

**§1.14 — the inspiratory pause.**

| Path                                  | Change                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `engine/physics.ts`                   | `derivePauseSeconds`; the pause added to `deriveMechanicalInspiratoryTime`  |
| `engine/simulation.ts`                | `flowProfile` normalized over the flow time rather than inspiratory time    |
| `__tests__/physics-waveforms.test.ts` | +4 over the default being inert, the held breath, the plateau, and the ramp |

**§1.13 — answer feedback and the compliance slider.**

| Path                                                    | Change                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `components/MechanicalVentilationLessonActivity.tsx`    | `AnswerVerdict`; `commitPrediction` no longer advances; `continueFromPrediction` |
| `components/teaching/waveform-anatomy.tsx`              | compliance slider, per-column held/moved readout, live prose                     |
| `components/mechanical-ventilation-teaching.module.css` | `.complianceSlider`, `.sliderScale`, `.comparisonReadout`                        |
| `__tests__/teaching-panel.test.tsx`                     | +1 — the two columns diverge and each holds its own set variable                 |
| `__tests__/lesson-v2.test.tsx`                          | the walkthrough now reads the verdict and clicks Continue                        |

**§1.12 — Evita and AVEA setting units.**

| Path                                | Change                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `content/deviceProfiles.ts`         | `evita-v800-v600-ifu-3n` and `avea-operators-manual-rev-m` sources; AVEA `controlUnits`  |
|                                     | (`bpm`/`ml`/`sec`); Evita `controlUnitOverrides` for FiO₂; both `displayNote`s rewritten |
| `engine/types.ts`                   | optional `controlUnitOverrides` on `VentilatorDisplayProfile`                            |
| `content/deviceDisplay.ts`          | `resolveControlUnit` takes an optional control key and checks the override first         |
| `__tests__/device-display.test.tsx` | +2 over the AVEA units and the Evita's two spellings of `%`                              |

[PR #26](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/26) targets
`main` from the work branch and contains the WP10 commit only. It has **not** been updated with the MV
work — decide whether to retarget, extend, or close it.

### Verification status

Re-run at the end of §1.12, on the working tree.

| Check                                   | Result                                                         |
| --------------------------------------- | -------------------------------------------------------------- |
| `npm run type-check`                    | clean                                                          |
| `npm test`                              | **2507 passed / 326 suites**, direct from the main checkout    |
| `npm run lint`                          | 0 errors (18 pre-existing warnings, none in mechanical-vent.)  |
| `npm run test:a11y`                     | 4 passed                                                       |
| `npm run validate:critical-care-assets` | passed (19 assets)                                             |
| Offline render harness                  | 4 consoles × 4 screens and all 10 panels inspected visually    |
| `npm run dump:mv-waveforms`             | all 15 cases read as sample tables; **zero flags** (§1.9–1.10) |
| `npm run build`                         | **STILL NOT VERIFIED**                                         |
| `npm run test:e2e`                      | **STILL NOT RUN**                                              |

Every engine change from §1.6 onward was verified by dumping the waveform buffer as a table of
`paw / flow / volume / phase` and reading the numbers, not by looking at the rendered trace. Those
defects were invisible in a screenshot and obvious in the dump — see trap 7. The display work in
§1.4, §1.11 and §1.12 was checked the other way round, in the offline render harness against the
figure in the manual.

**`npm run build` was never completed.** Its first step, `contentlayer2 build`, ran 42 minutes on the
MDX corpus in a fresh worktree without finishing; `next build --webpack` against reused contentlayer
output was still compiling after 80 minutes. This is a machine/throughput issue, not a known failure —
but it means **CI is the gate on the production build.**

**`test:e2e` was skipped deliberately.** Playwright hardcodes `baseURL: 127.0.0.1:3001` with
`reuseExistingServer`, and port 3001 was serving a different checkout. A run would have passed against
the wrong tree. Needs that server stopped or a port override.

### Known wrinkles

- ~~**`npm test` from the main checkout double-collects.**~~ Fixed in §1.5 — `jest.config.cjs` now
  ignores `.claude/worktrees/`. `npm test` runs clean from the main checkout; no workaround needed.
- **Git identity** — commits are authored as `Russell Miller <russellmiller@MacBook-Pro.local>`
  because no `user.email` is configured. Amend before any push you care about.
- **`.claude/launch.json`** gained an `mv-teaching` entry (worktree dev server on port 3010). Harmless;
  drop if unwanted. The `trainer-prod-static` entry (`public/` over :8099) is what the offline render
  harness in §4 serves through — keep that one.
- **One flaky suite** — `cardiohelp-ecmo/learn-walkthrough` timed out once at 28 s during a full run,
  then passed three times in isolation. Watch it; may need a timeout bump.
- **Another session shares this checkout.** It committed `0d72608f` mid-way through §1.11 and ran
  `lint-staged`, whose stash/restore cycle briefly reverted files being edited. Nothing was lost,
  but: re-read a file before trusting a `grep` that came back empty, prefer synchronous test runs
  to backgrounded ones, and check `git status` before concluding anything about the working tree.
- **Suite counts moved for a reason unrelated to this work.** `npm test` collects 326 suites now
  rather than 318, because that other session added the literature-explorer tests.

---

## 3. Future sessions

Numbers are stable and referenced from §1, so completed items stay in place struck through rather
than being renumbered. **Items 1, 2, 3, 9, 11, 12 and 14 are done.** What is actually open:

| Open | Item                                                         | Needs                         |
| ---- | ------------------------------------------------------------ | ----------------------------- |
| 4    | Clinical read-through of eight teaching panels               | **the owner** — highest value |
| 13   | MV-05 and MV-06's numbers after §1.10                        | **the owner**                 |
| 10   | Two cases that pull the expiratory limb under PEEP           | **the owner** — narrowed to 2 |
| 6    | MV clinical reconciliation                                   | blocked on the synthesis      |
| 5    | Three-pane workspace — ECMO only; the other two are rebuilds | buildable (ECMO)              |
| 16   | Closed loop for the adaptive modes                           | buildable now                 |
| 15   | Whether Practice cases give an immediate verdict             | **the owner**                 |
| 7    | Per-module content passes                                    | large                         |
| 8    | CI build, `test:e2e`, PR #26                                 | housekeeping                  |

The three owner items are all reading and judgement rather than building, and item 4 is the one that
gates this reaching fellows.

1. ~~**Ventilator device fidelity.**~~ **Done.** Control units (§1.5), the PB980 rebuilt against
   its operator's manual including the settings layout that had blocked this twice (§1.11), and the
   Evita and AVEA units re-sourced against their own manuals (§1.12). All four devices' setting
   names, units, and layouts are now manual-verified against a registered source with a recorded
   SHA-256.
2. ~~**Hold interaction wrinkle.**~~ Decided and built (§1.5) — the trace stays on Tools.
3. ~~**`Step one breath` pauses the run.**~~ Labelled (§1.5).
4. ~~**Remaining six MV teaching panels.**~~ All authored (§1.5), and a tenth added in §1.7. Each is
   a first pass: the copy is written against the section's own authored objectives and holds the
   no-thresholds rule, but only the plateau-validity and waveform-anatomy content has been through
   the owner. **A clinical read-through of the other eight is the highest-value thing left**, and
   should happen before this reaches fellows. `npm run render:mv-teaching` puts all ten on one page
   for exactly that.
5. **Extend the three-pane workspace — but it is not a port.** Re-scoped in §1.14 after looking
   at all three. `ResizableTeachingWorkspace` is shared and unused by them, but the arrangement is
   only worth having because of MV's ten bespoke teaching panels, and none of the three has
   equivalents. **ECMO** is the one genuine candidate: it is already two-column with a live console,
   so the work is separating teaching content from guided actions inside its 725-line
   `LearnLessonPlayer`. **CRRT** is a document-flow lesson whose console is a static figure, and
   **MCS** has device tabs rather than a live console — for those two this is a module rebuild
   (build a device surface, author teaching panels), not a layout change. Split them into separate
   items before starting.
6. **MV clinical reconciliation** — still blocked on the ventilation synthesis and the owner's
   reconciliation rule (implementation report, decision 2). WP10 deliberately did structure only; the
   MV landing says so. Numeric thresholds stay out until this lands. (Airway pressures now report
   the way a real ventilator does — see §1.6 — so that part is settled.)
7. **Per-module content passes** (v5.1 §11) — unchanged by this work, still outstanding for every
   module except hemodynamics.
8. **Housekeeping** — ~~`testPathIgnorePatterns` fix~~ (done, §1.5); confirm the production build in
   CI; run `test:e2e` against the right tree; resolve PR #26.
9. ~~**Sweep the rest of the casebook's waveform signatures.**~~ Done in §1.9 — all four named
   signatures plus the flow-starvation and rise-time shapes, which were already right. The buffer
   dump is committed as `npm run dump:mv-waveforms` so the next sweep does not start from scratch.
10. **Patient effort ends where the neural breath ends, not where the machine breath does.** Several
    cases run a neural rate well above the set rate, so effort is often still near peak when the
    ventilator cycles — which is genuine premature cycling and correctly drives airway pressure
    below baseline. It is worth a deliberate look at whether every case that does this means to.
    **Narrowed by §1.9:** the effort now reaches the airway only once it exceeds the recoil left in
    the lung, so the six cases that used to dip below zero on every breath no longer do. Only MV-02
    and MV-09 still pull under their own PEEP, and both mean to. This is now a two-case review.
11. ~~**Derived measurements outrun the trace on every pressure-targeted case.**~~ Done in §1.10.
    Every case now reports a tidal volume its own trace delivered and a plateau at or below its own
    peak, both asserted per case. The root was one formula: `targetTidalVolumeMl` returned the
    equilibrium volume of a pressure-targeted breath, and no such breath is allowed to reach
    equilibrium.
12. ~~**The expiratory hold discards the trace's own trapped volume.**~~ Done in §1.10. The occlusion
    freezes the volume trace and reads total PEEP off the gas actually in the lung. Two further
    defects fell out of it — `deriveEffectivePatient` was rebuilding the running lung volume from the
    case definition on every intervention, and §1.9's entrainment fix had made reverse triggering
    unbreakable. Both fixed.
13. **MV-05 and MV-06 are worth a clinical read now.** §1.10 moved them more than any other case:
    MV-06's peak 77.4 → 70.5 and MV-05's auto-PEEP 22.4 → 13.5 with a tidal volume of 237 mL,
    because its auto-PEEP is now a real threshold load against PS 18. Every authored criterion still
    solves on all four devices, so this is a question of whether the numbers teach what you want,
    not whether anything is broken.
14. ~~**`pausePercent` is display-only.**~~ Implemented in §1.14. The pause is part of the
    inspiratory time now, so the four consoles' pause control holds the delivered breath and draws
    a plateau the console can measure. Every case defaults to 0, so nothing else moved.
15. **Should Practice cases also give an immediate verdict?** §1.13 gave the Learn questions a
    right/wrong-and-why panel at the point of answering. `CaseWorkflow`'s practice prediction still
    commits to "Initial frame recorded" and defers the reveal to the debrief, which is defensible
    for an assessment-flavoured surface — but it is now the only place in the module where
    answering a question says nothing back. Worth a deliberate decision either way.
16. **Adaptive modes do not close their loop.** PRVC/VC+/ASV set the pressure open-loop from
    target ÷ compliance; an active patient's effort then adds volume on top and the controller never
    backs the pressure off. Visible now that tidal volume is measured — a 300 mL target delivers
    ~405 mL on MV-01. Real controllers converge over a few breaths.

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
- `src/features/mechanical-ventilation/content/lessons.ts` — the ten Learn sections in pathway
  order. A section exists in five places at once (catalog seed, pathway, lesson, learning items,
  runtime); §1.7's file table is the checklist for adding an eleventh.
- `src/features/mechanical-ventilation/components/MechanicalVentilationTeachingPanel.tsx` — the
  section-id → panel `Record`, the three original panels, the run control, `PlateauValidity`, and
  the overview fallback. Registering a new section's panel means adding one entry to that `Record`.
- `src/features/mechanical-ventilation/components/teaching/` — the seven later panels, one per file,
  over the primitives in `teaching/shared.tsx` (`latestBreath`, `tracePath`, `TextEquivalent`,
  `ModelBoundary`, direction helpers). New panels go here.
- `src/features/mechanical-ventilation/engine/physics.ts` — the pure physics, and since §1.6 also
  the **observers**: `observedPeakAirwayPressureCmH2O`, `observedTidalVolumeMl`,
  `observedPlateauPressureCmH2O`, `observedEndExpiratoryVolumeMl`, `observedExpiratoryTimeSeconds`.
  Each reads a quantity off the waveform buffer, with the analytic value kept only as the cold-start
  fallback. If you are adding a reported number, add it here in that shape — see trap 10.
- `src/features/mechanical-ventilation/engine/simulation.ts` — the per-sample waveform generator and
  `advanceSimulation`. `nextWaveformSample` is where every clinical sign is drawn; `inspirationAnchor`
  is how anything measured from the start of a breath finds that start.
- `src/features/mechanical-ventilation/content/deviceProfiles.ts` — the four device profiles and the
  source registry. Everything a console shows about a device is authored here; each `display` block
  carries a `displayNote` naming the pages it came from, and every source carries a SHA-256. As of
  §1.12 **all four devices are verified against their own operator's manual**, so a new claim about
  any of them should cite one.
- `src/features/mechanical-ventilation/content/deviceDisplay.ts` — the pure resolvers behind those
  profiles: metric lookup, unit spelling (`controlUnits`, then the per-setting `controlUnitOverrides`),
  control ordering and grouping, the PB980 breath-phase letter.
- `src/features/mechanical-ventilation/components/MechanicalVentilatorConsole.tsx` — reads both.
  **Do not branch on `deviceId` here.** Adding a device means authoring a profile, not editing the
  component. The only three `deviceId` checks left are AVEA's Touch-Turn-Touch idiom — the
  15-second pending timeout and the `MODE ACCEPT` / `ACCEPT` legends — which is behavior, not
  display. Anything that varies by vendor gets a profile field: `controlOrder`, `controlGroups`,
  `flowPatterns`, `bezelKeys`, `controlUnitOverrides` were all added that way.

**The two harnesses**

Both routes are behind login, so neither the app nor `curl` can check this work. Use these instead —
they are committed, and rebuilding them from scratch has already cost three sessions.

```bash
npm run dump:mv-waveforms                  # the numbers: all 15 cases, or one in full
npm run render:mv-console                  # the pixels: 4 devices × 4 screens
npm run render:mv-teaching                 # all 10 teaching panels on one page
MV_CASE=MV-08 npm run render:mv-console    # any case on all four consoles
```

Serve the render output through the `trainer-prod-static` launch config on :8099. The dump's summary
line screens for the defect class §1.10 was about — a derived number the trace does not support —
and should stay at zero flags.

**Traps that cost time**

1. **Barrel imports drag components into data modules.** `learning-module/curriculum/index.ts`
   re-exports React components that reach `next-intl` navigation. Content modules must import from
   `curriculum/types` directly, or Jest fails to parse ESM. Same applies to the activity barrel: import
   `learning-module/activity/types`, not the barrel, from anything reachable by a public client
   component — the barrel pulls the analytics/progress-sync graph with it.
2. **`curl` cannot verify these routes, and neither can the browser without a login.** The MV lesson
   sits behind a viewport-measuring launch gate, so the workspace only mounts client-side; pages
   return 200 with the lesson title and none of the panel content. `src/proxy.ts` then gates the
   route itself. **Use the committed harnesses** — `npm run render:mv-console` and
   `npm run render:mv-teaching` — rather than rebuilding the recipe. If you do need to write a new
   one: the entry file must sit **inside the repo** or `react-dom/server` will not resolve; the
   bundle must run as a **CJS child process** (`new Function` dies on `Dynamic require of "util"`);
   render with `createElement`, not by calling the component (a direct call bypasses React's hook
   dispatcher, and `.mts` is parsed without JSX anyway); and read the CSS esbuild emits as a
   **sibling of the JS bundle**.
3. **Console CSS must use the `--screen-*` custom properties.** The palette flips per device — the
   Evita's screen is white — so any fixed dark value renders navy-on-navy there. This bit three
   separate elements in §1.4, two more in §1.5, and is the same class of defect as §1.3 item 8.
   The SVG waveform annotations count too: their halo has to flip with their fill.
4. **Screenshotting the harness output.** Scrolling with JS blanks the capture. Isolate instead —
   `document.querySelectorAll('body > section')`, hide all but the one you want, `scrollTo(0, 0)`.
5. **Do not re-derive breath timing outside `machineTiming`.** Two separate attempts to place a
   hold computed the boundary from `simulationTime % cycle` on a rate that `machineTiming` does not
   use, and both put the occlusion in the wrong limb (§1.3 item 9, §1.6). Anything that needs to act
   at a breath boundary should watch `sample.phase` change, not recompute when it should have.
6. **The equation of motion is alveolar.** It only describes what the airway manometer reads while
   gas is moving _into_ the patient, or while the valves are shut. Using it through expiration put
   the trace below zero (§1.6).
7. **A rendered console is not a verified one — dump the samples.** The hold defect was invisible in
   a screenshot (the flat segment looked like an ordinary baseline) and obvious the moment
   `waveforms` was printed as a table of `paw / flow / volume / phase`. §1.6, §1.8 and all four of
   §1.9's defects were diagnosed that way. **The script is committed now** — `npm run
dump:mv-waveforms` — so stop rebuilding it. Its summary line also screens for a derived number
   the trace does not support, which is how §3 item 11 surfaced.
8. **Put a clinical sign on the trace that actually carries it, and gate it on flow.** The
   retained-secretions saw-tooth was added to pressure with flow left smooth, which is backwards,
   and it ran at zero flow so it wobbled through pauses and would have wobbled through an occlusion
   (§1.8). Perturb the physical quantity the sign belongs to and let the equation of motion carry
   it into the others — the amplitude relationship then comes out right for free. **Three more of
   these in §1.9**: the ineffective effort was on pressure with flow smooth, the cardiogenic
   oscillation was too small to see and integrated into volume through an occlusion, and the double
   trigger delivered no stacked volume at all. When a sign has an amplitude the model already
   reasons about elsewhere — a trigger threshold, a tidal volume — draw it from that same number so
   the trace and the rule cannot part company.
9. **Anything measured from the start of a breath needs the breath's own onset.** Both the volume
   target and the flow profile ran off absolute lung volume and the breath-cycle phase, which is
   the same thing only when the lung empties completely between breaths. `inspirationAnchor` reads
   the onset back off the waveform buffer; use it rather than adding state that can drift out of
   step with the trace.
10. **If the trace can produce a quantity, do not also model it.** Peak pressure (§1.6), tidal
    volume, plateau, auto-PEEP and expiratory time (§1.10) were each modeled twice — once from the
    settings and once by the trace — and every one of them eventually disagreed with itself on
    screen. The pattern that works is `observed… ?? predicted`: measure it, and keep the analytic
    value only as the cold-start fallback. Watch for the additive form of the same mistake, where
    both copies are summed: absolute lung volume already carries trapped gas, so adding
    `intrinsicPeepCmH2O` on top of `volumeL / C` counted it twice.
11. **Anything a learner can fix has to be able to stop happening.** §1.9 locked the reverse-trigger
    effort to the machine breath, correcting a genuine two-clocks defect and silently removing the
    treatment with it — entrainment had been breaking _because_ the two clocks disagreed. If a case
    is resolved by an action, check that the trace actually changes when the action is taken.
12. **Displayed pressures are measured, so they lag.** Since §1.6, `peakPressureCmH2O` comes off the
    waveform buffer. Anything asserting on it immediately after `SET_CONTROL` needs a tick first, or
    should read `relaxedPeakPressureCmH2O` instead. One existing test was written against the old
    instantaneous behavior.
13. **A pathway section lives in five files.** Catalog seed, pathway, lesson, learning items, and
    runtime — miss one and the catalog validators throw at import, which at least fails loudly.
    §1.7's file table is the checklist. Watch the `stageOrder` renumbering: it must stay unique per
    `(module, stage)` and ascend in the order the pathway lists its sections.

**Two measurement artifacts worth knowing.** `setInterval` is throttled in a backgrounded tab, so
the simulation clock looks frozen under browser automation even when it is running correctly —
check `document.hidden` before concluding the clock is broken. And `latestBreath()` slices between
inspiration onsets, so the first sample of the window is the start of inspiration: a volume-control
pressure trace legitimately begins part-way up the axis, because the resistive step is instant.
That is not a truncated breath.
