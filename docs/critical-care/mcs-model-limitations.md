# MCS — model limitations and serialized follow-up found while building M0/M1

**Date:** 2026-08-04
**Branch:** `claude/mcs-m0-m1-common-model-2026-08-04`
**Scope:** `mcs-foundations-signals`, `mcs-foundations-mechanisms`, the standardized pathway cards

Everything below was established by running the engine, not by assumption. The command that produces
the numbers is:

```bash
npx tsx scripts/critical-care/dump-mcs-signals.ts
```

Add `MCS_DEVICE=iabp|impella|lvad` to narrow it to one device family. The harness fails closed on its
flow-topology invariants and currently reports **zero flags**; everything in this document is an
_observation_ it prints rather than a failure, which is exactly why the record has to live somewhere
a maintainer will find it.

**Nothing here was fixed in M0/M1.** The package is not authorized to change engine calculations, and
none of these limitations blocks what M0/M1 teaches. They bound what a _later_ package may claim.

---

## 1. PAPi barely responds to right-sided support, and only through right atrial pressure

### What the engine does

`papi` is computed at `engine/model.ts:910-913` as
`clamp((papSystolic − papDiastolic) / max(1, rap), 0.1, 8)`. Pulmonary systolic and diastolic
pressures are both derived from one mean and one pulse term:

```
papPulse     = clamp(5 + rightVentricularContractility * 14, 4, 24)
papSystolic  = papMean + papPulse * 0.58
papDiastolic = papMean − papPulse * 0.42
```

so the numerator reduces algebraically to `papPulse`, which is a function of right ventricular
contractility alone. It does not read pulmonary vascular resistance, wedge pressure, the pulmonary
throughput term computed two lines above it, or any device flow.

The only route by which right-sided support can move PAPi is therefore the denominator — right
atrial pressure.

### What that measures out to

From the harness, in a right-ventricle-limited patient (`rightVentricularContractility: 0.36`):

| State                   | PAPi | RAP (mm Hg) | Right-sided device flow |
| ----------------------- | ---- | ----------- | ----------------------- |
| No right-sided pump     | 0.50 | 20.0        | —                       |
| Right-sided pump at P-8 | 0.60 | 17.0        | 3.33 L/min              |

A 3.33 L/min right-sided delivery moves PAPi by 0.10. The entire movement is the falling right atrial
pressure; the pulmonary pulse pressure is unchanged because the pump does not touch contractility.

### The constraint this places on future content

> **Future learner content must not treat PAPi as a validated direct response signal for right-sided
> microaxial support without a separate, owner-approved engine and content package.**

Specifically, until such a package lands, no MCS lesson, case, transfer item, or teaching panel may:

- ask a learner to raise right-sided support and read PAPi as the response;
- describe a PAPi change as evidence that a right-sided pump is working;
- score, gate, or give feedback on a prediction whose answer depends on PAPi moving with device flow;
- imply that PAPi in this simulator carries the pulmonary-vascular-load information the clinical
  index carries.

PAPi remains fine for what M0/M1 uses it for: naming an RV-limited phenotype from a _patient_ state,
which is the one thing the modelled numerator does track. `MCS_MODEL_BOUNDARIES.rvLimitedPapiMax`
(1.5) is already declared an educational-model boundary rather than a clinical cutoff, with its own
`educational-model-boundary` reference, so no clinical authority is being claimed for it today.

### Related, same class, lower stakes

`impella-preload-limited` reports PAPi 6.80 because right atrial pressure falls to 2 mm Hg while the
pulmonary pulse term stays fixed — just under the ceiling of 8 the clamp imposes. The ratio is
arithmetically correct and clinically meaningless. No current content surfaces it, but a future panel
that renders PAPi across loading states will meet it.

---

## 2. The durable-pump high-power pattern moves power without moving flow

`lvad-thrombosis-pattern` raises `pumpPowerW` from 4.90 to 7.70 W while
`effectiveSystemicFlowLMin` stays at 6.26 — an exact zero change.

This is _usable_ as authored today: the durable-LVAD pathway card says the displayed flow is computed
from power and speed and is "least reliable in exactly the states that disturb that relationship,"
and a power signature that moves while the flow estimate does not is a faithful illustration of that
claim. A learner reading the two numbers together sees the display and the delivered support come
apart.

What a future package should not do is teach the _converse_ — that a suspected pump thrombosis
reduces delivered flow — because in this model it does not. If that becomes a teaching goal, it needs
engine work and an owner decision, not content.

---

## 3. Cardiac power rises while effective flow falls under high afterload

Reported by the harness for both the microaxial and durable pathways:

| Comparison                                 | Effective flow | Cardiac power | MAP             |
| ------------------------------------------ | -------------- | ------------- | --------------- |
| `impella-cp-p5` → `impella-high-afterload` | −0.40 L/min    | +0.49 W       | 96 → 145 mm Hg  |
| `lvad-baseline` → `lvad-high-afterload`    | −1.02 L/min    | +0.24 W       | 104 → 145 mm Hg |

Not a defect. Cardiac power is `MAP × effective systemic flow / 451`, so a large enough pressure rise
carries the product upward while forward flow falls. This is the common model's "pressure improvement
is not perfusion improvement" claim with numbers behind it, and it is available to a later package as
a worked case rather than an assertion.

---

## 4. Serialized integration follow-up — `docs/critical-care/heart-recovery-audit.md`

Left unchanged by this package, deliberately: it is a cross-module document that the CRRT,
hemodynamics, and ventilation sessions in this parallel round may also need to touch, and three
sessions editing one audit table concurrently is how a merge conflict becomes a wrong number.

Three claims in it are stale with respect to the code as of this branch. Each should be corrected in
a **single serialized integration pass after the parallel round merges**, not in a module PR:

| Location                        | Document says                                                      | Source of truth says                                                                                           |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `heart-recovery-audit.md:117`   | "eight MCS loading transfers"                                      | `content/lessonTransfers.ts` has **9**, and `__tests__/content.test.ts` asserts it equals `mcsLessons.length`. |
| `heart-recovery-audit.md:156`   | MCS loading-condition transfers: `8`, "one per lesson"             | **9**, still one per lesson.                                                                                   |
| `heart-recovery-audit.md:131`   | MCS has 20 activities                                              | **21** — 9 learn + 9 practice + 3 assess seeds in `critical-care/content/activities.ts`.                       |
| `heart-recovery-audit.md:54-56` | "MCS and CRRT still expose manual 'Mark lesson complete' controls" | MCS does not, and `__tests__/components.test.tsx` asserts its absence.                                         |

All four drifted for the same reason as the nav string and the progress denominator: the ninth
section (`mcs-device-selection-integration`, added by WP10) landed after the audit was written at the
2026-07-22 recovery gate. **Do not "fix" the code down to the document.** The code is right.

While that pass is open, it is also the moment to decide whether the audit table should carry derived
counts at all, or should point at the tests that assert them.

---

## 5. Not limitations, but worth a maintainer knowing

- **The flow-topology invariants hold.** Counterpulsation reports no device flow and an effective flow
  equal to native; a left-sided pump adds a parallel stream and loses what regurgitates across an
  incompetent aortic valve; a right-sided pump's delivery never enters the systemic total, and the
  backward-compatible `deviceFlowLMin` signal carries the left pump only. The harness asserts each of
  these on every state it builds.
- **`SupportComputation` is not exported** from `engine/model.ts`, so a harness cannot call
  `deriveMcsMetrics` directly. `dump-mcs-signals.ts` drives the reducer instead, which is more
  faithful anyway. Exporting the type would be a zero-risk convenience for a later package.
- **`refresh()` in the reducer advances simulated time by 20 ms** on every control change, because
  `advanceMcsSimulation(state, 0)` still runs one fixed step. Anything that assumes a control change
  is a pure recompute will be slightly wrong.
