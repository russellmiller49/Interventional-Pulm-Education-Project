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
import { ecmoReferenceProfileList } from '../../src/features/cardiohelp-ecmo/content/referenceProfiles.ts'
import { cardiohelpScenarios } from '../../src/features/cardiohelp-ecmo/content/scenarios.ts'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
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

/** Renders a pressure the way the console must: dashes when the channel means nothing. */
function p(value: number, valid: boolean): string {
  return valid ? value.toFixed(0).padStart(7) : '--'.padStart(7)
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
    // A pressure channel the model does not support must not read as live data, and must not
    // alarm. The IFU's convention is dashes for an unavailable value (Rev 2.3 p47).
    if (!circuit.pressureSignalsValid) {
      const pressureAlarm = frame.alarms.find((alarm) =>
        ['pVen', 'pInt', 'pArt'].includes(alarm.parameter ?? ''),
      )
      if (pressureAlarm) {
        flags.push({
          scenarioId,
          reason: `pressure alarm ${pressureAlarm.code} raised while the channels are invalid`,
        })
        break
      }
    }
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

/**
 * The reference profiles author only inputs; flow and the pressures are derived. This is where
 * that promise is kept — if the physics stops producing what a profile says to expect, it fails
 * here rather than silently teaching a number the model does not make.
 */
function checkReferenceProfiles(): void {
  console.log('\nReference circuits — derived state against authored bounds\n')
  console.log(
    'profile          mode     flow      Rf     pVen    pArt    pInt      dP     eff    SvO2',
  )
  for (const profile of ecmoReferenceProfileList) {
    let state = createReferenceSimulationState(profile.id)
    for (let step = 0; step < 12; step += 1) state = run(state, [{ type: 'STEP' }])
    const c = state.circuit
    console.log(
      [
        profile.id.padEnd(16),
        profile.supportMode.toUpperCase().padEnd(4),
        n(c.bloodFlow, 2),
        n(c.recirculationFraction, 3),
        n(c.pVen, 0),
        n(c.pArt, 0),
        n(c.pInt, 0),
        n(c.deltaP, 0),
        n(c.effectiveFlow, 2),
        n(c.svo2),
      ].join(' '),
    )

    const e = profile.expected
    const within = (label: string, value: number, range?: EcmoRange) => {
      if (!range) return
      if (value < range.low || value > range.high) {
        flags.push({
          scenarioId: profile.id,
          reason: `${label} ${value} outside authored ${range.low}..${range.high}`,
        })
      }
    }
    within('bloodFlow', c.bloodFlow, e.bloodFlow)
    within('pVen', c.pVen, e.pVen)
    within('pArt', c.pArt, e.pArt)
    within('pInt', c.pInt, e.pInt)
    within('deltaP', c.deltaP, e.deltaP)
    within('effectiveFlow', c.effectiveFlow, e.effectiveFlow)
    within('pulsePressure', state.patient.pulsePressure, e.pulsePressure)
    within('rightRadialSpo2', state.patient.rightRadialSpo2, e.rightRadialSpo2)
    within('femoralArterialSpo2', state.patient.femoralArterialSpo2, e.femoralArterialSpo2)
    if (Math.abs(c.recirculationFraction - e.recirculationFraction) > 0.001) {
      flags.push({
        scenarioId: profile.id,
        reason: `recirculationFraction ${c.recirculationFraction} != authored ${e.recirculationFraction}`,
      })
    }
    if (state.scenario.activeFaults.length > 0) {
      flags.push({ scenarioId: profile.id, reason: 'reference circuit carries an active fault' })
    }
    if (state.paused) {
      flags.push({ scenarioId: profile.id, reason: 'reference circuit is paused' })
    }
  }
}

interface EcmoRange {
  readonly low: number
  readonly high: number
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
        p(c.pVen, c.pressureSignalsValid),
        p(c.pInt, c.pressureSignalsValid),
        p(c.pArt, c.pressureSignalsValid),
        p(c.deltaP, c.pressureSignalsValid),
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
  checkReferenceProfiles()
}

console.log(`\n${flags.length} flag(s)`)
for (const flag of flags) {
  console.log(`  ${flag.scenarioId}: ${flag.reason}`)
}
