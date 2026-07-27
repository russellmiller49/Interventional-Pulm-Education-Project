/**
 * Offline waveform-buffer dump for the mechanical-ventilation engine.
 *
 * A rendered console is not a verified one. Both the occlusion defect (§1.6) and the
 * retained-secretions defect (§1.8) were invisible in a screenshot and obvious the moment the
 * waveform buffer was printed as a table of `paw / flow / volume / phase`. Each was diagnosed in a
 * throwaway script; this is that script, kept, because every remaining casebook signature has to be
 * checked the same way.
 *
 * Run from the repo root:
 *
 *   npm run dump:mv-waveforms                        # one-line summary for every case
 *   npm run dump:mv-waveforms -- --case=MV-03        # sample table for one case
 *   npm run dump:mv-waveforms -- --case=MV-13 --branch=secretions
 *   npm run dump:mv-waveforms -- --case=MV-08 --hold=expiratory
 *
 * Options:
 *   --case=<id>       case to dump in full (omit for the all-case summary)
 *   --branch=<name>   force a branch by searching attempts for one that selects it
 *   --seconds=<n>     warm-up before sampling (default 30)
 *   --breaths=<n>     inspiration onsets to show (default 2)
 *   --hold=<type>     run an inspiratory/expiratory hold and dump the occlusion
 *   --every=<n>       print every nth sample (default 1; the buffer is 50 Hz)
 *   --set=<key:value> apply a SET_CONTROL before warming, e.g. `--set=ratePerMin:14`
 */
import {
  createInitialSimulationState,
  ventilationSimulationReducer,
} from '../../src/features/mechanical-ventilation/engine/index.ts'
import { mechanicalVentilationCases } from '../../src/features/mechanical-ventilation/content/runtimeCases.ts'
import type {
  VentilationSimulationState,
  WaveformSample,
} from '../../src/features/mechanical-ventilation/engine/types.ts'

interface Options {
  caseId?: string
  branch?: string
  seconds: number
  breaths: number
  hold?: 'inspiratory' | 'expiratory'
  every: number
  set: { control: string; value: number | string }[]
}

function parseOptions(argv: readonly string[]): Options {
  const options: Options = { seconds: 30, breaths: 2, every: 1, set: [] }
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, '').split('=')
    if (key === 'case') options.caseId = value
    if (key === 'set') {
      const [control, raw] = value.split(':')
      options.set.push({ control, value: Number.isNaN(Number(raw)) ? raw : Number(raw) })
    }
    if (key === 'branch') options.branch = value
    if (key === 'seconds') options.seconds = Number(value)
    if (key === 'breaths') options.breaths = Number(value)
    if (key === 'every') options.every = Math.max(1, Number(value))
    if (key === 'hold') options.hold = value === 'expiratory' ? 'expiratory' : 'inspiratory'
  }
  return options
}

function tick(state: VentilationSimulationState, seconds: number): VentilationSimulationState {
  let next = state
  for (let step = 0; step < Math.round(seconds * 10); step += 1) {
    next = ventilationSimulationReducer(next, { type: 'TICK', seconds: 0.1 })
  }
  return next
}

/**
 * The branch is picked from a hash of `(caseId, experience, attempt)` rather than set by an action,
 * so forcing one means searching attempts until the wanted branch comes up.
 */
function warmed(caseId: string, options: Options): VentilationSimulationState {
  let attempt = 1
  let state = createInitialSimulationState(caseId, 'learn', attempt, 'hamilton-c6')
  while (options.branch && state.branch !== options.branch && attempt < 64) {
    attempt += 1
    state = createInitialSimulationState(caseId, 'learn', attempt, 'hamilton-c6')
  }
  if (options.branch && state.branch !== options.branch) {
    throw new Error(`${caseId} never selects branch "${options.branch}" in 64 attempts`)
  }
  state = { ...state, paused: false }
  for (const { control, value } of options.set) {
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: control as never,
      value,
    })
  }
  state = tick(state, options.seconds)
  if (options.hold) {
    state = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: options.hold })
    // `PERFORM_HOLD` returns as soon as the valves shut; run on so the occlusion itself is visible.
    state = tick(state, 2)
  }
  return state
}

/** Indices where inspiration begins, so the dump can be sliced into whole breaths. */
function inspirationOnsets(waveforms: readonly WaveformSample[]): number[] {
  const onsets: number[] = []
  for (let index = 1; index < waveforms.length; index += 1) {
    if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration') {
      onsets.push(index)
    }
  }
  return onsets
}

function pad(value: string | number, width: number): string {
  return String(value).padStart(width)
}

function fixed(value: number, places: number, width: number): string {
  return pad(value.toFixed(places), width)
}

function dumpSamples(state: VentilationSimulationState, options: Options): void {
  const waveforms = state.waveforms
  const onsets = inspirationOnsets(waveforms)
  const start = onsets.length > options.breaths ? onsets[onsets.length - 1 - options.breaths] : 0
  const window = waveforms.slice(start)

  console.log(`\n${'time'.padStart(7)} ${'phase'.padStart(5)} ${'paw'.padStart(7)} ${'flow'.padStart(8)} ${'vol'.padStart(7)} ${'pmus'.padStart(7)}  flags`)
  console.log('-'.repeat(60))
  let previousPhase = window[0]?.phase
  window.forEach((sample, index) => {
    const boundary = sample.phase !== previousPhase
    previousPhase = sample.phase
    if (index % options.every !== 0 && !boundary) return
    const flags = [
      sample.triggered ? 'trig' : '',
      sample.spontaneous ? 'spont' : '',
      boundary ? `<- ${sample.phase === 'inspiration' ? 'INSP' : 'EXP'}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    console.log(
      `${fixed(sample.time, 2, 7)} ${pad(sample.phase === 'inspiration' ? 'insp' : 'exp', 5)} ${fixed(sample.pawCmH2O, 2, 7)} ${fixed(sample.flowLMin, 2, 8)} ${fixed(sample.volumeMl, 1, 7)} ${fixed(sample.pmusCmH2O, 2, 7)}  ${flags}`,
    )
  })
}

interface Summary {
  caseId: string
  phenotype: string
  branch: string
  peakPaw: number
  minPaw: number
  peakInspFlow: number
  peakExpFlow: number
  peakVolume: number
  /** Largest sample-to-sample flow change while gas is essentially still — a ripple detector. */
  maxStillFlowStep: number
  /** Largest sample-to-sample flow change anywhere in the buffer. */
  maxFlowStep: number
  inspirationsPerWindow: number
  effortPeak: number
  /** Lung volume just before the last inspiration began — the gas that did not get out. */
  endExpiratoryVolumeMl: number
  /** That volume's elastic recoil: auto-PEEP as the trace itself represents it. */
  tracePeepiCmH2O: number
}

function summarize(state: VentilationSimulationState): Summary {
  const waveforms = state.waveforms
  const definition = mechanicalVentilationCases.find((entry) => entry.id === state.caseId)
  let peakPaw = Number.NEGATIVE_INFINITY
  let minPaw = Number.POSITIVE_INFINITY
  let peakInspFlow = 0
  let peakExpFlow = 0
  let peakVolume = 0
  let maxStillFlowStep = 0
  let maxFlowStep = 0
  let effortPeak = 0
  waveforms.forEach((sample, index) => {
    peakPaw = Math.max(peakPaw, sample.pawCmH2O)
    minPaw = Math.min(minPaw, sample.pawCmH2O)
    peakInspFlow = Math.max(peakInspFlow, sample.flowLMin)
    peakExpFlow = Math.min(peakExpFlow, sample.flowLMin)
    peakVolume = Math.max(peakVolume, sample.volumeMl)
    effortPeak = Math.max(effortPeak, -sample.pmusCmH2O)
    if (index === 0) return
    const step = Math.abs(sample.flowLMin - waveforms[index - 1].flowLMin)
    maxFlowStep = Math.max(maxFlowStep, step)
    if (Math.abs(sample.flowLMin) < 3 && Math.abs(waveforms[index - 1].flowLMin) < 3) {
      maxStillFlowStep = Math.max(maxStillFlowStep, step)
    }
  })
  const onsets = inspirationOnsets(waveforms)
  const lastOnset = onsets[onsets.length - 1]
  const endExpiratoryVolumeMl = lastOnset > 0 ? waveforms[lastOnset - 1].volumeMl : 0
  const complianceMlPerCmH2O = state.patient.mechanics.complianceLPerCmH2O * 1000
  return {
    endExpiratoryVolumeMl,
    tracePeepiCmH2O: endExpiratoryVolumeMl / Math.max(1, complianceMlPerCmH2O),
    caseId: state.caseId,
    phenotype: definition?.phenotype ?? '?',
    branch: state.branch,
    peakPaw,
    minPaw,
    peakInspFlow,
    peakExpFlow,
    peakVolume,
    maxStillFlowStep,
    maxFlowStep,
    inspirationsPerWindow: inspirationOnsets(waveforms).length,
    effortPeak,
  }
}

function printSummary(summary: Summary, state: VentilationSimulationState): void {
  const m = state.measurements
  console.log(
    [
      summary.caseId.padEnd(6),
      summary.phenotype.padEnd(24),
      summary.branch.padEnd(22),
      `paw ${fixed(summary.minPaw, 1, 6)}..${fixed(summary.peakPaw, 1, 6)}`,
      `flow ${fixed(summary.peakExpFlow, 1, 7)}..${fixed(summary.peakInspFlow, 1, 6)}`,
      `vt ${fixed(summary.peakVolume, 0, 4)}`,
      `insp/12s ${pad(summary.inspirationsPerWindow, 2)}`,
      `pmus ${fixed(summary.effortPeak, 1, 5)}`,
      `still-step ${fixed(summary.maxStillFlowStep, 2, 6)}`,
      `Ppeak ${fixed(m.peakPressureCmH2O, 1, 5)}`,
      `Pplat ${fixed(m.plateauPressureCmH2O, 1, 5)}`,
      `VTe ${fixed(m.exhaledVtMl, 0, 4)}`,
      // Auto-PEEP has two representations: the analytic `intrinsicPeepCmH2O`, and the recoil of
      // whatever gas the trace still has in the lung at end-expiration. Print both.
      `EEV ${fixed(summary.endExpiratoryVolumeMl, 0, 4)}`,
      `PEEPi ${fixed(m.intrinsicPeepCmH2O, 1, 5)} vs trace ${fixed(summary.tracePeepiCmH2O, 1, 5)}`,
      // A derived number the trace does not support is the defect class §1.6 was about; flag both
      // ways it shows up rather than leaving it to be spotted by eye.
      m.plateauPressureCmH2O > m.peakPressureCmH2O ? '  ** Pplat > Ppeak' : '',
      m.exhaledVtMl > summary.peakVolume * 1.15 ? '  ** VTe over trace' : '',
    ]
      .filter(Boolean)
      .join('  '),
  )
}

const options = parseOptions(process.argv.slice(2))

if (options.caseId) {
  const state = warmed(options.caseId, options)
  const definition = mechanicalVentilationCases.find((entry) => entry.id === options.caseId)
  console.log(
    `${options.caseId} · ${definition?.phenotype} · branch "${state.branch}" · mode ${state.ventilator.settings.mode} / ${state.ventilator.settings.deviceMode}` +
      (options.hold ? ` · ${options.hold} hold` : ''),
  )
  console.log(
    `settings: rate ${state.ventilator.settings.ratePerMin}/min · VT ${state.ventilator.settings.vtMl} mL · PEEP ${state.ventilator.settings.peepCmH2O} · flow ${state.ventilator.settings.peakFlowLMin} L/min (${state.ventilator.settings.flowPattern}) · trigger ${state.ventilator.settings.trigger.type} ${state.ventilator.settings.trigger.thresholdLMin}`,
  )
  console.log(
    `patient: C ${(state.patient.mechanics.complianceLPerCmH2O * 1000).toFixed(0)} mL/cmH2O · R ${state.patient.mechanics.resistanceCmH2OPerLps} (+${state.patient.mechanics.tubeResistanceCmH2OPerLps} tube) · neural ${state.patient.drive.neuralRatePerMin}/min · Ti_n ${state.patient.drive.neuralInspiratoryTimeSeconds} s · effort ${state.patient.drive.effortAmplitudeCmH2O} cmH2O`,
  )
  console.log(
    `measured: Ti_mech ${state.measurements.mechanicalInspiratoryTimeSeconds} s · total rate ${state.measurements.totalRatePerMin}/min · VTe ${state.measurements.exhaledVtMl} mL · stacked ${state.measurements.stackedVolumeMl} mL · PEEPi ${state.measurements.intrinsicPeepCmH2O} · ineffective ${state.measurements.ineffectiveEffortFraction} · autotrigger ${state.measurements.autotriggerFraction}`,
  )
  dumpSamples(state, options)
  console.log('')
  printSummary(summarize(state), state)
} else {
  console.log(`Waveform summary after ${options.seconds}s, 12 s buffer, first branch of each case\n`)
  for (const definition of mechanicalVentilationCases) {
    const state = warmed(definition.id, options)
    printSummary(summarize(state), state)
  }
}
