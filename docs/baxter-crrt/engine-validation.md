# Baxter CRRT Phase 2 engine validation record

Status: implemented draft; clinical and device validation pending  
Engine version: `0.2.0-draft`  
Schema version: `1.0.0-draft`  
Content version: `0.0.0-phase2-no-cases`

## Purpose and boundary

This record describes the deterministic Phase 2 CRRT engine beneath the authenticated, unlisted
draft route. It is an educational causal model, not a validated digital twin, clinical calculator,
device emulator, or source of patient-specific recommendations.

The React scaffold does not import, execute, or display engine values. Phase 2 contains no clinical
case registry, functional PrisMax controls, Prismaflex runtime, setup workflow, device alarm
mapping, scoring, analytics events, or citrate-calcium algorithm.

## Implemented contracts

- Strict serializable domain types for patient, access, circuit, prescription, device, delivered
  therapy, scenario, alarms, interventions, and trends.
- A strict Zod content boundary and explicit normalized fixture boundary before engine state is
  created.
- An unconfigured, idle default state with null protocol version and no clinical values.
- One pure exhaustive reducer and a shared fail-closed readiness check for direct and scheduled
  transitions to running.
- A 60-second canonical integration substep, 300-second trend interval, and 288-sample trend cap.
- A deterministic device-independent clinical seed derived from fixture ID, pathway, and attempt;
  all bounded event jitter uses the seeded generator and never `Math.random()`.
- Current-version-only, local progress under `baxter-crrt-progress-v1` with no seed, protocol,
  patient state, circuit state, trends, action history, timestamp, screenshot, or free text.

## Source-backed device math

The following draft calculations are implemented as pure functions and remain review-pending:

| Record          | Implemented behavior                                                      | Boundary                                                            |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| MATH-PM-001     | `Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup`                      | PrisMax effluent-pump target only; no clinical target               |
| DOSE-PM-001     | Effluent rate divided by simulated body weight                            | Device display concept; delivered dose is separately integrated     |
| FLUID-PM-002    | `Vpfr = Veff - Vpbp - Vdial - Vrep - Vsyr`                                | Machine patient-fluid removal only                                  |
| MATH-PM-002     | `TMP = ((Pfil + Pret) / 2) - Peff - 18`                                   | PrisMax raw-sensor display calculation only                         |
| DEV-PM-010      | Raw filter drop `Pfil - Pret`; PrisMax displayed value subtracts 25 mmHg  | Raw and displayed values remain separate                            |
| MATH-PM-003/005 | Plasma flow, total predilution, and filtration-fraction display functions | Require explicit units, hematocrit, Qpre, and plasma-water fraction |

`CONFLICT-001` / MATH-PM-004 and `CONFLICT-002` / MATH-PM-006 are explicit disabled gates. The
engine neither repairs nor executes either disputed printed expression. The 0.95 plasma-water
factor is an explicit pending input, never an engine default.

## Educational model parameters

Pressure resistance, filter-progression, hemodynamic-tolerance, solute-production, distribution,
and permeability coefficients are not derived from the device manuals. The engine contains no
clinical target ranges, alarm thresholds, default bag sizes, local flow ranges, anticoagulation
rules, or outcome targets.

Every nontrivial coefficient used by tests is supplied through a synthetic fixture, carries a test
source ID, and remains `pending`. The engine fails closed when required pressure/filter calibration,
access continuity, bag topology, prescription, patient state, or supported device runtime is
missing. Nested configuration is cloned at load so caller mutation cannot change a running state.

## Conservation and causal ordering

- One coupled feasible fraction constrains every active source pump and the single effluent
  collector. Missing, duplicate, disconnected, open-scale, empty, or full topology cannot create
  fluid or multiply delivery.
- Machine patient-fluid removal and whole-patient fluid balance use separate ledgers. External
  input/output continues through machine downtime.
- Prescribed dose remains distinct from delivered dose; only integrated actual effluent drives
  delivered dose and solute removal.
- Immediate actions change connection, flow, raw pressure, and cause-derived alarm state before
  delayed patient, solute, filter, and cumulative-volume effects.
- Acknowledging an alarm records the acknowledgement but does not alter the cause. Generic engine
  alarms have no priority or pump/clamp consequence until a reviewed device adapter supplies one.
- Physical access disconnection and bag feasibility affect delivery as model constraints; an alarm
  label by itself does not.

## Determinism and equivalence

The engine decomposes all requested time advances into the same 60-second substeps and also splits
at deterministic event and trend boundaries. Scheduled events use the same start guard as direct
actions, followed by immediate derived-state recomputation.

Declared comparison tolerances:

- Integrated volume: `0.000001 mL`.
- Other continuous model values/fractions: `0.000000001` in the documented unit.

Tests compare sixty one-minute advances, four 15-minute advances, and one one-hour advance for
patient state, delivered therapy, fluid balance, filter burden, pressures, alarms, events, and
bounded trends.

## Test coverage

Focused tests cover:

- Reversible unit conversion and invalid numeric inputs.
- PrisMax source formulas and disabled conflict gates.
- Bag/effluent conservation, partial depletion, downtime, and topology rejection.
- Machine PFR versus whole-patient balance and external input during downtime.
- Pressure directionality, zero-flow paused pressure, access/return distinction, TMP, and filter
  pressure drop.
- Filter, solute, and hemodynamic directionality with nonnegative bounded integration.
- Direct and scheduled reducer transitions, clean reload, citrate rejection, event recomputation,
  acknowledgement/correction separation, unique alarm occurrences, and bounded history.
- Seed repeatability, bounded jitter, stable ordering, and device-independent seed derivation.
- Authored/runtime schema strictness, cross-reference checks, protocol fail-closed behavior, and
  pilot-case ID gating without committing any cases.
- Progress allowlist, current-version reset, composite-key bounds, record caps, corrupt/denied
  storage, and unknown-field removal.
- Phase 1 route/scaffold content boundaries and confirmation that React remains calculation-free.

## Known limitations and next gate

- All clinical and device review states remain pending.
- The local market, installed software, set/accessory inventory, pump/scale inventory, solution
  inventory, and flow increments are unknown.
- No active modality, prescription, alarm mapping, or learner workflow is approved.
- Regional citrate-calcium is disabled until a versioned approved local protocol and sources exist.
- Prismaflex has only a deferred profile/source boundary and cannot load or run a fixture.
- Alarm priority, automatic pump/clamp response, setup sequence, and device navigation belong to
  later reviewed adapters.
- Synthetic test fixtures are not authored learner cases and are kept outside Jest's test-suite
  discovery path.

Phase 3 requires separate approval. It may build only the PrisMax pilot interface surfaces needed
for the later three-case slice and must not interpret this Phase 2 test record as clinical or device
validation.

## Verification log

| Check                          | Result                                                                  |
| ------------------------------ | ----------------------------------------------------------------------- |
| Focused CRRT/route validation  | 22 suites and 138 tests passed                                          |
| TypeScript                     | `npm run type-check` passed                                             |
| ESLint                         | Passed with 13 pre-existing non-CRRT warnings and no errors             |
| Full Jest suite                | 192 suites and 1,308 tests passed                                       |
| Production build               | Passed; route emitted; only existing Mermaid and metadata-base warnings |
| Formatting/worktree whitespace | Scoped Prettier and `git diff --check` passed                           |

The main `README.md` records route-level HTTP verification and the exact Phase 3 approval gate.
