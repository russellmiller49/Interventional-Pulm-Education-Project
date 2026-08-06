# The live pressure profile

## What changed

The pressures lesson used to teach from two fixed pictures.

One was a mock console — a `role="img"` block with four numbers written into the markup: access
−72, filter 146, return 64, TMP 77. It had no effluent pressure and no filter pressure drop, and it
gave all four channels the same visual treatment, so nothing on it distinguished a pressure measured
at a place in the circuit from arithmetic over several places. The other passed a second, different
set of literals into the universal circuit. Neither moved, and the two sets had no mechanism keeping
them consistent with each other or with the engine.

On the case-player machine surface, a static illustration of a CRRT machine opened the panel, sat
first in reading and tab order, and carried a badge that changed with the run — which is how a fixed
drawing comes to look like a display.

Both are replaced. The default device representation is now a live profile driven by the running
model, and the illustration is a clearly-labelled reference behind a disclosure.

## Where the numbers come from

```
engine state  ──►  selectPrismaxPilotCaseOperationsDisplay  ──►  CrrtLivePressureDevice
circuit.pressures        (device adapter)                        (formatting only)
circuit.trends
device / access / flows
```

The component performs no clinical arithmetic. It formats values, lays them out, and turns recorded
points into plot coordinates. Every pressure, every classification, every availability state and
every recorded sample is decided in the adapter and arrives ready to render.

This matters more than it looks. TMP and filter pressure drop are stored on engine state with the
device display offsets already applied (−18 mmHg and −25 mmHg). Recomputing `filter − return` in a
component drops the offset; re-applying the offset to the stored value doubles it. Two tests in
`CrrtLivePressureDevice.test.tsx` fail if either offset is restated outside the engine, and a third
fails if the surface imports `pressureModel`, `clinicalMath`, `fluidModel`, `circuitFluidLedger`, or
the calculation adapter.

### What the adapter added

`PrismaxPilotOperationsDisplay` gained two sibling fields. The existing `pressures` block is
unchanged, byte for byte — an adapter test pins it to all-null on the case-free path, and putting
the new metadata inside it would have broken that.

- `pressureSignals` — the six channels described: `kind`, `valueMmHg`, `availability` with a stated
  `unavailableReason`, the frozen circuit `nodeId` a direct site is read at, the
  `derivedFromNodeIds` and `contributingSiteLabels` a relationship is built from, the recorded
  `history`, and the circuit model's own `sourceIds` passed through unchanged.
- `treatmentContext` — delivery state, modality, the flow settings, elapsed time, and
  `bloodFlowContributesToPressures`.

That last flag exists because the engine keeps publishing plausible numbers when the pump is off.
`derivePressures` feeds blood flow into the model only while `bloodPumpRunning` and both lumens are
connected; otherwise it computes at zero flow, which in every shipped fixture gives access 5, return
5, filter 5, effluent −20, TMP +7, and a drop of −25 mmHg. Nothing about those numbers says "the
pump is not running". A surface cannot infer it and must be told.

## Snapshot or trend: partly both, and it says which

**The engine does keep real history.** `state.trends` is a ring buffer of `TrendSample`, written by
`appendTrendIfDue` every 300 s and capped at 288 samples (24 hours).

**It does not keep all six channels.** `TrendSample` carries access, filter, return, and
transmembrane pressure. It carries neither effluent pressure nor filter pressure drop.

So the profile draws a real series for four channels, from the points the engine actually recorded,
and reports the other two as current values with no series behind them. It does not reconstruct the
missing two. Filter pressure drop _could_ be derived at each recorded instant from the filter and
return samples, and effluent could not be derived at all — but deriving one and not the other would
present a computed line and an observed line as the same kind of thing. The honest answer is the one
the surface gives.

Nothing is interpolated between recorded points, and the caption says so.

**A future sampled-history observer** would add `effluentPressureMmHg` and `filterPressureDropMmHg`
to `TrendSample` and populate them in `appendTrendIfDue` from `state.circuit.pressures`. The
component API does not change: those two channels would simply start reporting `sampled` instead of
`not-recorded`. Do not lower `CRRT_TREND_INTERVAL_SECONDS` to get finer resolution —
`CRRT_MAX_TREND_SAMPLES` is sized as 24 hours at 300 s, and the numeric audit ceilings compare
against the charting window. A shorter buffer would need to be a separate one.

## Blood flow

The station offers two settings on one run of CRRT-10, which schedules nothing that touches a
pressure. Nothing is obstructed in either. Raising 120 → 180 mL/min:

| channel              | 120 mL/min | 180 mL/min |
| -------------------- | ---------- | ---------- |
| Access               | −19        | −31        |
| Filter               | 65         | 95         |
| Return               | 29         | 41         |
| Effluent             | −20        | **−20**    |
| TMP                  | 49         | 70         |
| Filter pressure drop | 11         | 29         |

Five channels move. Effluent pressure does not, because the engine treats it as an authored
observation rather than a flow-derived value — which is exactly what the teaching text beside that
channel already said would happen. The change is visible in the recorded history as a step, because
the raised setting continues the same run rather than starting a second one.

## Direct sites and calculated relationships

The distinction is carried three ways so it never depends on colour: the words "Directly modelled
site" and "Calculated relationship" on every channel, a glyph (`◉` / `∑`), and a border that is
solid for a site and dashed for a relationship, thickening when selected.

Selecting a channel marks it on the universal circuit below. A direct site highlights its own frozen
node. A relationship highlights the sites it is computed from and takes no marker of its own — TMP
lights filter, return, and effluent; the pressure drop lights filter and return. The circuit's text
equivalent names the selected pressure and says which kind it is.

`CrrtPilotCircuit` gained one prop, `highlightedSignalId`. It is presentational: no control, no
accessible name, no second population of pressure widgets. The pressure-localization lab already
owns radios named after these six signals in the same lesson tree, and a second set would make
either one ambiguous. The highlight is a stroke, a halo, and a bolder label drawn at the node's own
coordinates — a test renders all six selections and asserts every node transform is identical.

## The static drawing

Retained, because where a pump deck, a syringe position, the sensor area, and four scales physically
sit is the one thing a functional schematic does not show. It is now behind a closed `<details>`
labelled "Static device reference", it states that it is not connected to the simulation and that
nothing on it updates, and the run-tracking badge is gone.

| region              | disposition                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `touchscreen`       | **Deleted.** Pointed at "the interactive screen below" — self-referential, and broken the moment the layout changes — and claimed a manufacturer-manual setup sequence that `DEV-PM-014` does not cover.                   |
| `solution-pumps`    | Retained as hardware orientation.                                                                                                                                                                                          |
| `syringe-pump`      | Retained; carries the scope boundary for medication workflows.                                                                                                                                                             |
| `safety-monitoring` | Retained, rewritten. It said where the pressure connections sit _and_ half-explained them. It now points at the live profile for what a pressure means, so there is one explanation of a pressure in this module, not two. |
| `fluid-management`  | Retained as hardware orientation.                                                                                                                                                                                          |

The console's own pressure list inside the device facsimile previously read from a hand-built tuple
that captioned all six channels "Simulated case value". It now reads the described channels, so it
states which is a site and which is a relationship, and it cannot disagree with the profile above it
because both read one view.

## What this model cannot produce

Reported in the harness output rather than simulated:

- **A single unavailable direct pressure.** `derivePressures` writes all six together, so
  unavailability is always whole-model. There is no per-transducer fault in this engine.
- **A withheld calculated relationship while its input sites still read.** TMP and the pressure drop
  are computed whenever filter, return, and effluent are present, and all six go null together
  otherwise. The withholding this module does have is the fluid ledger under an unresolved makeup
  attribution, which the universal circuit already renders.
- **Recorded history for effluent pressure or filter pressure drop**, as above.

A disconnection is not unavailability: the engine substitutes a flat disconnected reference pressure,
which is a number, not a null.

## Withheld quantities

`CRRT_MAKEUP_ATTRIBUTION_CONFLICT` withholds the calculated conservation results. The profile
publishes none of them. It does show the patient-fluid-removal **setting** as treatment context,
labelled "Patient fluid removal set to" and accompanied by a sentence saying these are the settings
in force rather than how much fluid has actually been removed — the entered setting must never stand
in for the withheld calculated result. The numeric harness fails if
`cumulativeMachinePatientFluidRemovalMl`, `cumulativeWholePatientBalanceMl`, or the ledger reaches
this surface.

Note for later work: `selectPrismaxPilotCaseOperationsDisplay` still republishes those two
cumulative fields on its own (pre-existing, and unused by this surface). Every shipped fixture holds
`makeupFlowMlHour: 0`, so it is latent rather than live, but any future surface rendering them must
route through `calculateCrrtMachineFluidLedger(...).resolution` first.

## Provenance

The profile makes **no new clinical or device-display claim**. Each channel's teaching prose is the
circuit model's own registered content, carried through with its `sourceIds` unchanged; everything
else the surface says is about the educational model or about where this module stops. No evidence
id reaches learner copy.

No claim topic was added, and no device record was promoted into supporting one. `DEV-PM-009`,
`DEV-PM-010`, `DEV-PM-003`, `DEV-PM-014`, `MATH-PM-002`, and `SYNTH-LAB-PRESSURE-001` all resolve
and support nothing — a test asserts that for every topic. The citrate gaps are untouched:
`citrate-pharmacology` remains unmapped and the two gap terms remain exactly two.

Exact screen layout, menu hierarchy, button behaviour, and alarm appearance are not claimed anywhere
and remain later fidelity work.

## Harnesses

Nothing is added to `package.json`. Run from the repo root:

```
npx tsx scripts/baxter-crrt/dump-crrt-numbers.ts
npx tsx scripts/baxter-crrt/render-crrt-live-pressure-device.ts
```

`dump-crrt-numbers.ts` prints engine and adapter side by side for all eight reachable states and
exits non-zero on a mismatch, a nonfinite value, a classification that differs from the pinned one,
an unavailable value with no stated reason, or a series on a channel the model never sampled. The
classification is pinned per signal id rather than checked against its own node: a defect drill
showed that a mislabelled signal usually arrives with a matching node, so comparing the two against
each other agrees with the defect.

`render-crrt-live-pressure-device.ts` renders the checked-in components at 1600, 1280, and 1024 px —
eight states × six selections — and fails the same way.
