/**
 * Offline numeric harness for the CARDIOHELP ECMO engine.
 *
 * Same reason as `dump-mv-waveforms.mts`: the module routes sit behind login, and the defect class
 * this guards against — a displayed number the simulated state does not support — is invisible in
 * a screenshot and obvious in a table.
 *
 * The columns deliberately separate three different things that used to be conflated:
 *   raw model value · what the console may display · why a number is absent.
 *
 *   npm run dump:ecmo-signals                                   # every scenario, plus references
 *   ECMO_SCENARIO=vv-recirculation npm run dump:ecmo-signals    # one scenario, sample by sample
 *
 * The flag list should stay at zero.
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

/** Confirmed from the IFU: the SvO2 tile reads the venous line, not the systemic estimate. */
const VENOUS_LINE_MAPPING_CONFIRMED = true

const PRESSURE_RANGE = { low: -500, high: 900 }
const SVO2_RANGE = { low: 40, high: 99.9 }

function run(state: EcmoSimulationState, actions: readonly SimulationAction[]): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, state)
}

function advance(state: EcmoSimulationState, steps: number): EcmoSimulationState[] {
  const frames: EcmoSimulationState[] = [state]
  let current = state
  for (let step = 0; step < steps; step += 1) {
    current = run(current, [{ type: 'STEP' }])
    frames.push(current)
  }
  return frames
}

function n(value: number, places = 1, width = 7): string {
  return value.toFixed(places).padStart(width)
}

/** Renders what the console may show: the number, or the unavailable marker. */
function shown(displayed: number | null, places = 0, width = 7): string {
  return displayed === null ? '--'.padStart(width) : displayed.toFixed(places).padStart(width)
}

function statusGlyph(status: string): string {
  if (status === 'valid') return 'ok      '
  if (status === 'device-unavailable') return 'dev-unav'
  return 'sim-unmd'
}

interface Flag {
  readonly scenarioId: string
  readonly reason: string
}

const flags: Flag[] = []

function inspect(scenarioId: string, frames: readonly EcmoSimulationState[]): void {
  const first = frames[0]
  const last = frames.at(-1)!

  // 8 — a frozen estimate while its determining inputs move.
  const estimateMoved = frames.some(
    (frame) =>
      Math.abs(
        frame.patient.systemicVenousSaturationEstimate -
          first.patient.systemicVenousSaturationEstimate,
      ) > 0.05,
  )
  const inputsMoved = frames.some(
    (frame) =>
      Math.abs(frame.circuit.bloodFlow - first.circuit.bloodFlow) > 0.05 ||
      Math.abs(frame.patient.spo2 - first.patient.spo2) > 0.05 ||
      Math.abs(frame.circuit.hemoglobin - first.circuit.hemoglobin) > 0.05,
  )
  if (inputsMoved && !estimateMoved) {
    flags.push({
      scenarioId,
      reason: 'systemic venous estimate never moved while its inputs did',
    })
  }

  for (const frame of frames) {
    const { circuit, patient } = frame
    const { readouts } = circuit

    // 1 — a number displayed for a channel the simulation does not model.
    for (const [name, readout] of Object.entries(readouts)) {
      if (readout.status === 'simulation-unmodeled' && readout.displayed !== null) {
        flags.push({ scenarioId, reason: `${name} displays a number while simulation-unmodeled` })
      }
      // 3 — a raw value silently presented at a display boundary.
      if (readout.displayed !== null && readout.displayed !== readout.raw) {
        flags.push({ scenarioId, reason: `${name} displayed value differs from its raw value` })
      }
    }

    // 2 — a displayed number outside its sourced range.
    for (const key of ['pVen', 'pInt', 'pArt', 'deltaP'] as const) {
      const readout = readouts[key]
      if (
        readout.displayed !== null &&
        (readout.displayed < PRESSURE_RANGE.low || readout.displayed > PRESSURE_RANGE.high)
      ) {
        flags.push({ scenarioId, reason: `${key} displayed outside the sourced pressure range` })
      }
    }
    const svo2Readout = readouts.venousLineSaturation
    if (
      svo2Readout.displayed !== null &&
      (svo2Readout.displayed < SVO2_RANGE.low || svo2Readout.displayed > SVO2_RANGE.high)
    ) {
      flags.push({ scenarioId, reason: 'venous-line saturation displayed outside its sourced range' })
    }

    // 4 — a pressure alarm consuming an unavailable channel.
    if (readouts.pVen.status !== 'valid') {
      const pressureAlarm = frame.alarms.find((alarm) =>
        ['pVen', 'pInt', 'pArt'].includes(alarm.parameter ?? ''),
      )
      if (pressureAlarm) {
        flags.push({
          scenarioId,
          reason: `pressure alarm ${pressureAlarm.code} raised on an unavailable channel`,
        })
      }
    }

    // 5 — the console tile must read the venous line, not the latent systemic estimate.
    if (
      VENOUS_LINE_MAPPING_CONFIRMED &&
      Math.abs(svo2Readout.raw - circuit.preOxygenatorSaturation) > 0.05
    ) {
      flags.push({ scenarioId, reason: 'SvO2 tile is not fed from the venous-line saturation' })
    }

    // 6 — recirculation-adjusted flow above displayed circuit flow.
    if (circuit.recirculationAdjustedCircuitFlowLpm > circuit.bloodFlow + 0.01) {
      flags.push({ scenarioId, reason: 'recirculation-adjusted flow exceeds displayed flow' })
    }

    // 7 — VA must carry no VV recirculation term.
    if (frame.supportMode === 'va' && circuit.recirculationFraction !== 0) {
      flags.push({ scenarioId, reason: 'VA circuit carries a nonzero VV recirculation fraction' })
    }

    // The drainage limb is a mixture, so it must sit between its two constituents.
    const low = Math.min(patient.systemicVenousSaturationEstimate, circuit.postOxygenatorSaturation)
    const high = Math.max(patient.systemicVenousSaturationEstimate, circuit.postOxygenatorSaturation)
    if (
      circuit.preOxygenatorSaturation < low - 0.2 ||
      circuit.preOxygenatorSaturation > high + 0.2
    ) {
      flags.push({ scenarioId, reason: 'venous-line saturation outside the mixture it is made of' })
    }
  }

  // 9 — recirculation must remain recoverable from the saturation relationship.
  const denominator =
    last.circuit.postOxygenatorSaturation - last.patient.systemicVenousSaturationEstimate
  if (Math.abs(denominator) > 1) {
    const inferred =
      (last.circuit.preOxygenatorSaturation - last.patient.systemicVenousSaturationEstimate) /
      denominator
    if (Math.abs(inferred - last.circuit.recirculationFraction) > 0.02) {
      flags.push({
        scenarioId,
        reason: `recirculation not recoverable from saturations (inferred ${inferred.toFixed(3)} vs engine ${last.circuit.recirculationFraction.toFixed(3)})`,
      })
    }
  }
}

const DETAIL_HEADER =
  '   t     flow  adjFlo      Rf   status    rawVen  rawInt  rawArt   rawdP | dspVen  dspInt  dspArt   dspdP |  SvEst  rawPre  dspSvO2  postOx    VO2'

function detailRow(frame: EcmoSimulationState): string {
  const c = frame.circuit
  const r = c.readouts
  return [
    n(frame.simulationTime, 0),
    n(c.bloodFlow, 2),
    n(c.recirculationAdjustedCircuitFlowLpm, 2),
    n(c.recirculationFraction, 3),
    statusGlyph(r.pVen.status),
    n(r.pVen.raw, 0),
    n(r.pInt.raw, 0),
    n(r.pArt.raw, 0),
    n(r.deltaP.raw, 0),
    '|',
    shown(r.pVen.displayed),
    shown(r.pInt.displayed),
    shown(r.pArt.displayed),
    shown(r.deltaP.displayed),
    '|',
    n(frame.patient.systemicVenousSaturationEstimate),
    n(c.preOxygenatorSaturation),
    shown(r.venousLineSaturation.displayed, 1),
    n(c.postOxygenatorSaturation),
    n(frame.modelInputs.oxygenConsumptionMlMin, 0),
  ].join(' ')
}

const scenarios = ONLY
  ? cardiohelpScenarios.filter((scenario) => scenario.id === ONLY)
  : cardiohelpScenarios

if (scenarios.length === 0) {
  console.error(`No scenario matched ECMO_SCENARIO=${ONLY}`)
  process.exit(1)
}

if (ONLY) {
  const scenario = scenarios[0]
  const frames = advance(createInitialSimulationState(scenario.id), STEPS)
  console.log(`\n${scenario.id} — ${scenario.title} [${scenario.supportMode.toUpperCase()}]\n`)
  console.log(DETAIL_HEADER)
  for (const frame of frames) console.log(detailRow(frame))
  inspect(scenario.id, frames)
} else {
  console.log('\nEnd state after', STEPS, 'steps — every authored scenario\n')
  console.log(
    'scenario                                   mode    flow  adjFlo      Rf   status    dspVen  dspInt  dspArt   dspdP   SvEst  rawPre dspSvO2',
  )
  for (const scenario of cardiohelpScenarios) {
    const frames = advance(createInitialSimulationState(scenario.id), STEPS)
    const last = frames.at(-1)!
    const c = last.circuit
    const r = c.readouts
    console.log(
      [
        scenario.id.padEnd(41),
        scenario.supportMode.toUpperCase().padEnd(4),
        n(c.bloodFlow, 2),
        n(c.recirculationAdjustedCircuitFlowLpm, 2),
        n(c.recirculationFraction, 3),
        statusGlyph(r.pVen.status),
        shown(r.pVen.displayed),
        shown(r.pInt.displayed),
        shown(r.pArt.displayed),
        shown(r.deltaP.displayed),
        n(last.patient.systemicVenousSaturationEstimate),
        n(c.preOxygenatorSaturation),
        shown(r.venousLineSaturation.displayed, 1),
      ].join(' '),
    )
    inspect(scenario.id, frames)
  }
  checkReferenceProfiles()
}

interface EcmoRange {
  readonly low: number
  readonly high: number
}

/**
 * The reference profiles author only inputs; flow and the pressures are derived. This is where that
 * promise is kept — if the physics stops producing what a profile says to expect, it fails here.
 */
function checkReferenceProfiles(): void {
  console.log('\nReference circuits — derived state against authored bounds\n')
  console.log(
    'profile          mode    flow  adjFlo      Rf    pVen    pArt    pInt      dP   SvEst  rawPre dspSvO2     VO2',
  )
  for (const profile of ecmoReferenceProfileList) {
    const frames = advance(createReferenceSimulationState(profile.id), 12)
    const state = frames.at(-1)!
    const c = state.circuit
    console.log(
      [
        profile.id.padEnd(16),
        profile.supportMode.toUpperCase().padEnd(4),
        n(c.bloodFlow, 2),
        n(c.recirculationAdjustedCircuitFlowLpm, 2),
        n(c.recirculationFraction, 3),
        shown(c.readouts.pVen.displayed),
        shown(c.readouts.pArt.displayed),
        shown(c.readouts.pInt.displayed),
        shown(c.readouts.deltaP.displayed),
        n(state.patient.systemicVenousSaturationEstimate),
        n(c.preOxygenatorSaturation),
        shown(c.readouts.venousLineSaturation.displayed, 1),
        n(state.modelInputs.oxygenConsumptionMlMin, 0),
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
    within(
      'recirculationAdjustedCircuitFlowLpm',
      c.recirculationAdjustedCircuitFlowLpm,
      e.recirculationAdjustedCircuitFlowLpm,
    )
    within('pulsePressure', state.patient.pulsePressure, e.pulsePressure)
    within('rightRadialSpo2', state.patient.rightRadialSpo2, e.rightRadialSpo2)
    within('femoralArterialSpo2', state.patient.femoralArterialSpo2, e.femoralArterialSpo2)
    if (Math.abs(c.recirculationFraction - e.recirculationFraction) > 0.001) {
      flags.push({
        scenarioId: profile.id,
        reason: `recirculationFraction ${c.recirculationFraction} != authored ${e.recirculationFraction}`,
      })
    }
    if (
      state.modelInputs.oxygenConsumptionMlMin !== profile.inputs.modelInputs.oxygenConsumptionMlMin
    ) {
      flags.push({ scenarioId: profile.id, reason: 'oxygen consumption not carried from profile' })
    }
    if (state.scenario.activeFaults.length > 0) {
      flags.push({ scenarioId: profile.id, reason: 'reference circuit carries an active fault' })
    }
    if (state.paused) {
      flags.push({ scenarioId: profile.id, reason: 'reference circuit is paused' })
    }
    inspect(profile.id, frames)
  }
}

console.log(`\n${flags.length} flag(s)`)
for (const flag of flags) {
  console.log(`  ${flag.scenarioId}: ${flag.reason}`)
}
