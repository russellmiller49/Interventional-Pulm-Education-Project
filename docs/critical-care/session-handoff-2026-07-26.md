# Critical Care — session handoff

**Date:** 2026-07-26 (revised same day after the §1.5 follow-up session)
**Branch of record:** `codex/ip-preference-card-builder-v0-1` (what the dev server runs)
**Work branch:** `claude/curricular-sequencing-updates-b351b1`
**Head at handoff:** `ea7699d9`, plus an **uncommitted** working tree carrying §1.5

---

## 1. What was done

Five work packages, in the order they landed: WP10 curricular sequencing (§1.1), the mechanical
ventilation teaching workspace and the defects that surfaced with it (§1.2, §1.3), per-device
ventilator console fidelity (§1.4), a follow-up session that cleared §3 items 1–4 (§1.5), and the
waveform-physiology corrections the owner's review of the hold tracing prompted (§1.6). Everything
through §1.4 is committed; §1.5 and §1.6 are uncommitted.

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
  _(Superseded by §1.5 — all nine sections now have a bespoke panel.)_

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
`Record` keyed by section id, so `ventilationTeachingPanelSectionIds` derives from it.

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

**Offline render harness — now committed.** §4 trap 2 described the recipe but no script existed.
Two are now checked in and wired to npm:

```bash
npm run render:mv-console   # public/mv-console-preview/<device>.html  — 4 devices × 4 screens
npm run render:mv-teaching  # public/mv-console-preview/teaching-panels.html — all 9 panels
```

Serve through the `trainer-prod-static` launch config on :8099. Output is gitignored. Two gotchas
beyond the ones already in §4: the harness must use `createElement` rather than calling the component
(`.mts` is parsed without JSX, and a direct call bypasses React's hook dispatcher), and it reads the
CSS esbuild emits as a **sibling of the JS bundle**.

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

### §1.4 is committed

§1.4 landed on `codex/ip-preference-card-builder-v0-1` as `ea7699d9` ("updates"), together with the
first version of this handoff. The table below is what it contained.

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

### Uncommitted — §1.5

Nothing in §1.5 is committed. `git status` on the branch of record:

| Path                                                    | Change                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `jest.config.cjs`                                       | ignore `.claude/worktrees/` in both path-ignore lists                             |
| `package.json`                                          | `render:mv-console` and `render:mv-teaching`                                      |
| `.gitignore`                                            | `/public/mv-console-preview/`                                                     |
| `engine/types.ts`                                       | control-unit types; `pendingHold`; relaxed-vs-displayed pressures on measurements |
| `engine/physics.ts`                                     | `expiratoryAirwayPressure`, `holdRelaxationFraction`, trace-derived pressures     |
| `engine/simulation.ts`                                  | hold armed at the real boundary; phase pinned under occlusion; `HOLD_SECONDS`     |
| `engine/reducer.ts`                                     | `performConsoleHold` parks the request and runs the model to the boundary         |
| `content/runtimeCases.ts`                               | four case criteria repointed at `relaxedPlateauPressureCmH2O`                     |
| `components/WaveformStrip.tsx`                          | `unreliable` / `caveat` on a readout                                              |
| `__tests__/physics-waveforms.test.ts`                   | +12 tests over the occlusion maneuvers, the expiratory limb, and the readouts     |
| `content/deviceDisplay.ts`                              | `resolveControlUnit`                                                              |
| `content/deviceProfiles.ts`                             | four `controlUnits` blocks, unit-aware `adaptControlDescriptor`, display notes    |
| `components/MechanicalVentilatorConsole.tsx`            | Tools two-column screen, maneuver status, extracted channel renderer              |
| `components/mechanical-ventilation.module.css`          | `.toolsScreen` / `.toolsPanel` / `.maneuverStatus`, annotation + toolGrid tokens  |
| `components/MechanicalVentilationTeachingPanel.tsx`     | `Record`-based dispatcher, run-control labelling, shared-primitive imports        |
| `components/teaching/`                                  | **new** — `shared` plus six panels, one file each                                 |
| `components/mechanical-ventilation-teaching.module.css` | markers, lanes, trade-off columns, tiers, locus grid, `.runHint`                  |
| `scripts/critical-care/render-mv-console.mts`           | **new** — offline console render harness                                          |
| `scripts/critical-care/render-mv-teaching-panels.mts`   | **new** — offline teaching-panel render harness                                   |
| `__tests__/teaching-panel.test.tsx`                     | +9 tests: every-panel-every-case, no-thresholds, per-panel interaction            |
| `__tests__/device-display.test.tsx`                     | +6 tests over per-device control units                                            |
| `__tests__/components.test.tsx`                         | +3 tests over the Tools trace and maneuver status                                 |

[PR #26](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/26) targets
`main` from the work branch and contains the WP10 commit only. It has **not** been updated with the MV
work — decide whether to retarget, extend, or close it.

### Verification status

Re-run at the end of §1.5, on the working tree.

| Check                                   | Result                                                        |
| --------------------------------------- | ------------------------------------------------------------- |
| `npm run type-check`                    | clean                                                         |
| `npm test`                              | **2411 passed / 318 suites**, direct from the main checkout   |
| `npm run lint`                          | 0 errors (18 pre-existing warnings, none in mechanical-vent.) |
| `npm run test:a11y`                     | 4 passed                                                      |
| `npm run validate:critical-care-assets` | passed (19 assets)                                            |
| Offline render harness                  | 4 consoles × 4 screens and all 9 panels inspected visually    |
| `npm run build`                         | **STILL NOT VERIFIED**                                        |
| `npm run test:e2e`                      | **STILL NOT RUN**                                             |

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

---

## 3. Future sessions

Roughly in priority order. Items 1–4 and half of 8 are done — see §1.5.

1. ~~**Ventilator device fidelity.**~~ Control units done (§1.5). What remains is:
   - a **sourced PB980 settings layout** — still blocked, and now more so: the service manual PDF is
     no longer on disk, and it does not publish a Vent Setup layout in any case. Needs the PB980
     _operator_ manual, which the project does not have.
   - **re-sourcing the Evita, PB980 and AVEA setting units** against their manuals rather than
     against each device's already-registered vocabulary. Only the C6 row is manual-verified.
2. ~~**Hold interaction wrinkle.**~~ Decided and built (§1.5) — the trace stays on Tools.
3. ~~**`Step one breath` pauses the run.**~~ Labelled (§1.5).
4. ~~**Remaining six MV teaching panels.**~~ All authored (§1.5). Each is a first pass: the copy is
   written against the section's own authored objectives and holds the no-thresholds rule, but none
   has had a clinical read-through by the owner. Worth one before this ships to fellows.
5. **Extend the three-pane workspace to CRRT, MCS and ECMO.** `ResizableTeachingWorkspace` is already
   shared and unused by them.
6. **MV clinical reconciliation** — still blocked on the ventilation synthesis and the owner's
   reconciliation rule (implementation report, decision 2). WP10 deliberately did structure only; the
   MV landing says so. Numeric thresholds stay out until this lands. (Airway pressures now report
   the way a real ventilator does — see §1.6 — so that part is settled.)
7. **Per-module content passes** (v5.1 §11) — unchanged by this work, still outstanding for every
   module except hemodynamics.
8. **Housekeeping** — ~~`testPathIgnorePatterns` fix~~ (done, §1.5); confirm the production build in
   CI; run `test:e2e` against the right tree; resolve PR #26.

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
- `src/features/mechanical-ventilation/components/MechanicalVentilationTeachingPanel.tsx` — the
  section-id → panel `Record`, the first three panels, the run control, and the overview fallback.
  Registering a new section's panel means adding one entry to that `Record`.
- `src/features/mechanical-ventilation/components/teaching/` — the six later panels, one per file,
  over the primitives in `teaching/shared.tsx` (`latestBreath`, `tracePath`, `TextEquivalent`,
  `ModelBoundary`, direction helpers). New panels go here.
- `src/features/mechanical-ventilation/content/deviceProfiles.ts` — the four device profiles and the
  source registry. Everything a console shows about a device is authored here; each `display` block
  carries a `displayNote` naming the pages it came from.
- `src/features/mechanical-ventilation/content/deviceDisplay.ts` — the pure resolvers behind those
  profiles: metric lookup, unit spelling, control ordering and grouping, the PB980 breath-phase
  letter.
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
   `waveforms` was printed as a table of `paw / flow / volume / phase`.

**A measurement artifact worth knowing:** `setInterval` is throttled in a backgrounded tab, so the
simulation clock looks frozen under browser automation even when it is running correctly. Check
`document.hidden` before concluding the clock is broken.
