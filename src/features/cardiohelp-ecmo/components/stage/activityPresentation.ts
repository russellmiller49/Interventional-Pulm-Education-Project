import {
  defaultSurfacesFor,
  type StageLesson,
  type StageStep,
  type StageSurfaceId,
} from './stageModel'

/** Display only. No response, phase, action, clock, or progress authority lives here. */
export interface EcmoTaskPresentation {
  readonly kind: 'concept' | 'circuit-walk' | 'comparison-lab' | 'guided-device'
  readonly console: boolean
  readonly surfaces: readonly StageSurfaceId[]
  readonly operational?: boolean
  /**
   * One column at every width, the simulator surfaces first and the teaching under them at the
   * full width of the card. For the capstones, whose teaching is a wide comparison of competing
   * explanations that a side column cannot hold (S17-1, VA17-1). Display only.
   */
  readonly stacked?: boolean
}

const concept: EcmoTaskPresentation = { kind: 'concept', console: false, surfaces: [] }
const comparison: EcmoTaskPresentation = { kind: 'comparison-lab', console: false, surfaces: [] }
const circuit: EcmoTaskPresentation = {
  kind: 'circuit-walk',
  console: false,
  surfaces: ['circuit'],
}
const device: EcmoTaskPresentation = { kind: 'guided-device', console: true, surfaces: ['gas'] }

// Explicit task IDs, never text/keyword inference. The existing curriculum remains the registry.
const foundationTasks: Readonly<Record<string, Readonly<Record<string, EcmoTaskPresentation>>>> = {
  'blood-flow-versus-sweep': {
    recognize: device,
    pump: comparison,
    sweep: comparison,
    oxygen: comparison,
    predict: concept,
    'sweep-story': comparison,
    'speed-story': comparison,
    transfer: concept,
  },
  'why-extracorporeal-support': {
    recognize: concept,
    'worked-example': concept,
    predict: concept,
    act: concept,
    transfer: concept,
  },
  'circuit-flow-path': {
    recognize: circuit,
    'gas-path': circuit,
    'pressure-sites': circuit,
    // The comparison task reads the monitor against pArt, so the monitor leads the visual column
    // and sits beside the task rather than under the map (S2-4). Display order only.
    observe: { ...circuit, surfaces: ['monitor', 'circuit'] },
    predict: circuit,
    transfer: concept,
  },
  'pump-and-pressure-zones': {
    recognize: circuit,
    act: comparison,
    observe: comparison,
    loading: comparison,
    predict: concept,
    decrease: comparison,
    transfer: circuit,
  },
}

/** Fail closed for an unmapped task; coverage tests must accompany new authored tasks. */
export function ecmoTaskPresentation(
  lesson: StageLesson,
  step: StageStep,
): EcmoTaskPresentation | undefined {
  if (!step.foundationTask) {
    if (lesson.kind === 'foundation') {
      const phases = trackFoundationViews[lesson.sectionId]
      if (!phases) throw new Error(`Missing foundation presentation: ${lesson.sectionId}`)
      return phases[step.phase]
    }
    const view = drillViews[lesson.sectionId]
    if (!view) throw new Error(`Missing drill presentation: ${lesson.sectionId}`)
    const surfaces = [...new Set([...view.surfaces, ...defaultSurfacesFor(step.focusTarget)])]
    return { ...view, console: view.console || step.focusTarget === 'console', surfaces }
  }
  const presentation = foundationTasks[lesson.sectionId]?.[step.foundationTask.id]
  if (!presentation) throw new Error(`Missing ECMO presentation: ${step.id}`)
  return presentation
}

const patient: EcmoTaskPresentation = {
  kind: 'guided-device',
  console: false,
  surfaces: ['monitor'],
}
const capstonePatient: EcmoTaskPresentation = { ...patient, stacked: true }
const pressure: EcmoTaskPresentation = {
  kind: 'circuit-walk',
  console: false,
  surfaces: ['circuit', 'trends'],
}
const gas: EcmoTaskPresentation = {
  kind: 'guided-device',
  console: false,
  surfaces: ['gas', 'monitor', 'trends'],
}
const operational: EcmoTaskPresentation = {
  kind: 'guided-device',
  console: true,
  surfaces: ['circuit'],
  operational: true,
}

const trackFoundationViews: Readonly<
  Record<string, Readonly<Record<StageStep['phase'], EcmoTaskPresentation>>>
> = {
  'vv-normal-state': {
    recognize: concept,
    predict: concept,
    act: comparison,
    observe: comparison,
    explain: patient,
    transfer: concept,
  },
  'va-normal-state': {
    recognize: concept,
    predict: concept,
    act: comparison,
    observe: comparison,
    explain: patient,
    transfer: concept,
  },
  'vv-series-physiology': {
    recognize: concept,
    predict: concept,
    act: comparison,
    observe: comparison,
    explain: concept,
    transfer: comparison,
  },
  'va-parallel-physiology': {
    recognize: concept,
    predict: concept,
    act: comparison,
    observe: comparison,
    explain: concept,
    transfer: comparison,
  },
  'vv-integration-capstone': {
    recognize: capstonePatient,
    predict: capstonePatient,
    act: { ...capstonePatient, surfaces: ['circuit', 'gas', 'monitor'] },
    observe: { ...capstonePatient, surfaces: ['circuit', 'gas', 'monitor'] },
    explain: concept,
    transfer: capstonePatient,
  },
  'va-integration-capstone': {
    recognize: capstonePatient,
    predict: capstonePatient,
    act: { ...capstonePatient, surfaces: ['circuit', 'gas', 'monitor'] },
    observe: { ...capstonePatient, surfaces: ['circuit', 'gas', 'monitor'] },
    explain: concept,
    transfer: capstonePatient,
  },
}

// These choices stay neutral before the drill's existing commitment boundary. No diagnosis or
// correct intervention is used as a visible heading. Step targets add the genuine required control.
const drillViews: Readonly<Record<string, EcmoTaskPresentation>> = {
  'startup-sensor-orientation': { ...device, surfaces: ['circuit'] },
  'va-startup-sensor-orientation': { ...device, surfaces: ['circuit'] },
  'preload-drainage-collapse': pressure,
  'va-preload-drainage-collapse': pressure,
  'afterload-return-obstruction': pressure,
  'va-afterload-arterial-return-obstruction': pressure,
  'afterload-oxygenator-resistance': pressure,
  'va-afterload-oxygenator-resistance': pressure,
  'vv-recirculation': { ...patient, surfaces: ['circuit', 'monitor'] },
  'acute-hypercapnia': gas,
  'compensated-hypercapnia': gas,
  'va-acute-hypercapnia': gas,
  'gas-source-interruption': gas,
  'va-gas-source-interruption': gas,
  'va-differential-hypoxemia': { ...patient, console: true, surfaces: ['circuit', 'monitor'] },
  'va-lv-loading': { ...patient, console: true, surfaces: ['circuit', 'monitor'] },
  'arterial-bubble-stop': operational,
  'va-arterial-bubble-stop': operational,
  'transport-power-loss': operational,
  'va-transport-power-loss': operational,
}
