/**
 * Offline numeric harness for the CARDIOHELP ECMO engine.
 *
 * Same reason as `dump-mv-waveforms.mts`: the module routes sit behind login, and the defect class
 * this guards against — a displayed number the simulated state does not support — is invisible in
 * a screenshot and obvious in a table. Every MV engine defect from handoff §1.6 onward was found
 * this way.
 *
 * Run from the repo root:
 *
 *   npm run dump:ecmo-signals                 # every scenario, summary table
 *   ECMO_SCENARIO=vv-recirculation npm run dump:ecmo-signals   # one scenario, sample by sample
 *
 * The summary line screens for numbers the run cannot support. It should stay at zero flags.
 */
import { cardiohelpScenarios } from '../../src/features/cardiohelp-ecmo/content/scenarios.ts'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
} from '../../src/features/cardiohelp-ecmo/engine/index.ts'
import type {
  EcmoSimulationState,
  SimulationAction,
} from '../../src/features/cardiohelp-ecmo/engine/types.ts'

const ONLY = process.env.ECMO_SCENARIO ?? null
const STEPS = Number(process.env.ECMO_STEPS ?? 12)

function run(state: EcmoSimulationState, actions: readonly SimulationAction[]): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, state)
}

function advanced(scenarioId: string, steps: number): EcmoSimulationState[] {
  let state = createInitialSimulationState(scenarioId)
  const frames: EcmoSimulationState[] = [state]
  for (let step = 0; step < steps; step += 1) {
    state = run(state, [{ type: 'STEP' }])
    frames.push(state)
  }
  return frames
}

function n(value: number, places = 1): string {
  return value.toFixed(places).padStart(7)
}

interface Flag {
  readonly scenarioId: string
  readonly reason: string
}

const flags: Flag[] = []

/**
 * The checks are deliberately about internal consistency, not about clinical plausibility — an
 * assertion that a number is *clinically* right belongs in a reviewed test, not in a sweep.
 */
function inspect(scenarioId: string, frames: readonly EcmoSimulationState[]): void {
  const last = frames.at(-1)!
  const first = frames[0]

  // The defect this harness was built for: a constant presented as a live measurement.
  const svo2Moved = frames.some((frame) => Math.abs(frame.circuit.svo2 - first.circuit.svo2) > 0.05)
  const anythingMoved = frames.some(
    (frame) =>
      Math.abs(frame.circuit.bloodFlow - first.circuit.bloodFlow) > 0.05 ||
      Math.abs(frame.patient.spo2 - first.patient.spo2) > 0.05,
  )
  if (anythingMoved && !svo2Moved) {
    flags.push({ scenarioId, reason: 'SvO2 never moved while flow or saturation did' })
  }

  for (const frame of frames) {
    const { circuit } = frame
    if (circuit.effectiveFlow > circuit.bloodFlow + 0.01) {
      flags.push({ scenarioId, reason: 'effective flow exceeds displayed flow' })
      break
    }
    if (circuit.recirculationFraction < 0 || circuit.recirculationFraction > 1) {
      flags.push({ scenarioId, reason: 'recirculation fraction outside 0-1' })
      break
    }
    // Drainage blood is venous return mixed with returned circuit blood, so it cannot be cleaner
    // than the circuit blood it is being diluted by, nor dirtier than pure venous return.
    const low = Math.min(circuit.svo2, circuit.postOxygenatorSaturation)
    const high = Math.max(circuit.svo2, circuit.postOxygenatorSaturation)
    if (circuit.preOxygenatorSaturation < low - 0.2 || circuit.preOxygenatorSaturation > high + 0.2) {
      flags.push({
        scenarioId,
        reason: 'drainage saturation outside the mixture it is made of',
      })
      break
    }
  }

  // Recirculation must be recoverable from the two saturations a bedside clinician can sample.
  // This is the arithmetic the teaching panels will show, so it has to close against the engine.
  const { circuit } = last
  const denominator = circuit.postOxygenatorSaturation - circuit.svo2
  if (Math.abs(denominator) > 1) {
    const inferred = (circuit.preOxygenatorSaturation - circuit.svo2) / denominator
    if (Math.abs(inferred - circuit.recirculationFraction) > 0.02) {
      flags.push({
        scenarioId,
        reason: `recirculation not recoverable from saturations (inferred ${inferred.toFixed(3)} vs engine ${circuit.recirculationFraction.toFixed(3)})`,
      })
    }
  }
}

const scenarios = ONLY
  ? cardiohelpScenarios.filter((scenario) => scenario.id === ONLY)
  : cardiohelpScenarios

if (scenarios.length === 0) {
  console.error(`No scenario matched ECMO_SCENARIO=${ONLY}`)
  process.exit(1)
}

if (ONLY) {
  const frames = advanced(ONLY, STEPS)
  const scenario = scenarios[0]
  console.log(`\n${scenario.id} — ${scenario.title} [${scenario.supportMode.toUpperCase()}]\n`)
  console.log('   t     flow    eff     Rf     pVen    pInt    pArt      dP   preOx  postOx    SvO2    SpO2   PaCO2')
  for (const frame of frames) {
    const c = frame.circuit
    console.log(
      [
        n(frame.simulationTime, 0),
        n(c.bloodFlow, 2),
        n(c.effectiveFlow, 2),
        n(c.recirculationFraction, 3),
        n(c.pVen, 0),
        n(c.pInt, 0),
        n(c.pArt, 0),
        n(c.deltaP, 0),
        n(c.preOxygenatorSaturation),
        n(c.postOxygenatorSaturation),
        n(c.svo2),
        n(frame.patient.spo2),
        n(frame.patient.paCO2),
      ].join(' '),
    )
  }
  inspect(scenario.id, frames)
} else {
  console.log('\nEnd state after', STEPS, 'steps — every authored scenario\n')
  console.log(
    'scenario                                    mode     flow     eff      Rf   preOx  postOx    SvO2    SpO2',
  )
  for (const scenario of scenarios) {
    const frames = advanced(scenario.id, STEPS)
    const c = frames.at(-1)!.circuit
    console.log(
      [
        scenario.id.padEnd(42),
        scenario.supportMode.toUpperCase().padEnd(4),
        n(c.bloodFlow, 2),
        n(c.effectiveFlow, 2),
        n(c.recirculationFraction, 3),
        n(c.preOxygenatorSaturation),
        n(c.postOxygenatorSaturation),
        n(c.svo2),
        n(frames.at(-1)!.patient.spo2),
      ].join(' '),
    )
    inspect(scenario.id, frames)
  }
}

console.log(`\n${flags.length} flag(s)`)
for (const flag of flags) {
  console.log(`  ${flag.scenarioId}: ${flag.reason}`)
}
