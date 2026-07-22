# ICU Simulator engine contract

## Single source of truth

The host engine owns the canonical patient, simulation clock, scenario timeline, replay identity,
observations, alarms, trends, and outcome. Therapy adapters own device-local state only. They may
read the same immutable pre-step patient snapshot and emit typed effects; they may not write patient
vitals directly.

The runtime step is:

1. Apply due learner commands and authored scenario events.
2. Resolve disease, medication, fluid, blood-product, and definitive-pathway effects.
3. Evaluate each active therapy adapter against the same pre-step patient snapshot.
4. Aggregate volume-conserving transfers and bounded parameter, gas-exchange, fluid, and solute
   effects.
5. Advance the canonical cardiopulmonary and slow-organ models once.
6. Generate imperfect observations through monitor, PAC, laboratory, echo, and imaging observers.
7. Reconcile native alarms without inventing unsupported severity, append bounded trends, and
   evaluate checkpoint and outcome predicates.

## Cadence

- Cardiopulmonary mechanics and visible waveforms: 0.02-second canonical steps.
- ECMO, disease, medication, alarm, and authored event updates: 1-second boundaries.
- CRRT, solute, renal, and other slow-organ updates: up to 60-second boundaries.

Advancing time must split at every due command, event, trend, or subsystem boundary. Equivalent
elapsed time and the same replay identity must produce equivalent state regardless of how the caller
partitions the advance. Off-screen fast-forward keeps bounded trends and regenerates only the visible
waveform window.

## Public boundaries

- `IcuSimulationState`: canonical runtime state.
- `IcuCommand`: semantic learner actions; no arbitrary state patch command.
- `IcuTherapyAdapter`: device-local command and advance boundary.
- `IcuTherapyEffect`: typed physiologic contribution with source identity.
- `IcuScenarioDefinition`: strict content definition with evidence and review metadata.
- `IcuReplayRecord`: engine version, content version, seed, and timestamped semantic commands.
- `IcuOutcome`: fixed 100-point domain score, mastery, critical errors, and causal debrief.

The synchronous pure engine is authoritative for tests and replay. A browser worker may host it for
interactive use, but worker messages must contain the same commands and serializable state.

## Supported V1 combinations

Ventilation and CRRT may coexist with one reviewed ECMO or MCS configuration. A configuration may
be no support, IABP, one reviewed Impella pathway, VV ECMO, or VA ECMO. Combined VA ECMO plus
Impella, new durable-LVAD implantation, arbitrary device stacking, ECPR, and pediatric support are
outside V1 and must fail closed at scenario normalization or command validation.
