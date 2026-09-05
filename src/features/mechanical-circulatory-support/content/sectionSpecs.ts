import type { McsDeviceKind } from '../engine/types'
import { MCS_CONTROL_PANEL, type McsControlId, type McsControlStripState } from './controlPanel'
import { MCS_DEVICE_INCREMENTS } from './deviceIncrements'
import { mcsLearnerCopyErrors, mcsSentenceCount } from './learnerCopy'
import { mcsLessons } from './lessons'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from './scenarios'
import { MCS_SUPPORT_GRAMMAR, type McsGrammarRowId } from './supportGrammar'
import { mcsSpineStopIds, type McsSpineStopId } from './supportSpine'

/**
 * The lesson spec of every section on the pathway: one new concept, the discrimination the section
 * enables, which earlier sections taught what it assumes, where on the loop it stands, which
 * controls its strip marks and how, which rows of the one table it highlights, and the case that
 * applies its mechanism.
 *
 * This is the ladder the module was rebuilt against, held as data so the things a ladder can
 * silently lose are checked at import: that every prerequisite is taught earlier, that the
 * integration section assumes exactly the application sections, that objectives name a
 * discrimination and not an action, that no learner-facing string carries a number or the
 * framework's vocabulary, and that every step title is safe to show before the prediction.
 */

export type McsStagePhaseKey = 'recognize' | 'predict' | 'act' | 'observe' | 'explain' | 'transfer'

export interface McsPracticePairing {
  readonly caseId: string
  /** `mechanism-match` applies this section's mechanism; `next-in-unit` is honest about not doing so. */
  readonly kind: 'mechanism-match' | 'next-in-unit'
}

export interface McsSectionSpec {
  readonly sectionId: string
  /** The device track the section belongs to; `shared` for the foundations and the integration. */
  readonly track: McsDeviceKind | 'shared'
  /** Exactly one. */
  readonly newConcept: string
  /** The discrimination this section enables. Never begins with the action the section ends in. */
  readonly objective: string
  readonly prerequisiteSectionIds: readonly string[]
  /** Where on the loop this section stands. */
  readonly stopIds: readonly McsSpineStopId[]
  /** Whether the Recognize phase opens with the walk along the loop. */
  readonly walksTheLoop: boolean
  /**
   * Whether the monitor's flow account is covered until the prediction is committed. A section
   * whose prediction is what the flow account will show cannot have it on screen while it asks.
   */
  readonly withholdsFlowAccountUntilCommit: boolean
  /** The state of each control on this section's strip. Only controls on the section's devices. */
  readonly controlStrip: Readonly<Partial<Record<McsControlId, McsControlStripState>>>
  readonly grammarRowIds: readonly McsGrammarRowId[]
  readonly practicePairing?: McsPracticePairing
  /** One title per step, shown only once the step is reached. */
  readonly stepTitles: Readonly<Record<McsStagePhaseKey, string>>
  /**
   * What no pre-commitment surface of this section may say: the mechanism, the best action or
   * its direction, and the identifying findings. The leak scans hold every pre-commit surface to
   * these.
   */
  readonly precommitDenyPatterns: readonly RegExp[]
}

export const mcsSectionSpecs: readonly McsSectionSpec[] = Object.freeze([
  {
    sectionId: 'mcs-foundations-signals',
    track: 'shared',
    newConcept:
      'pressure, flow, oxygen delivery and organ response each answer only their own question',
    objective:
      'Tell a pressure that answers its own question from one being read as a flow, and keep native, displayed and effective flow as three separate lines.',
    prerequisiteSectionIds: [],
    stopIds: ['aorta-and-body', 'venous-return'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: true,
    controlStrip: { 'iabp-ratio': 'no-setting', 'iabp-timing': 'no-setting' },
    grammarRowIds: [],
    stepTitles: {
      recognize: 'Read the pressure first',
      predict: 'Say what the flow account will show',
      act: 'Open the three readings in turn',
      observe: 'Compare the readings you opened',
      explain: 'Four questions, four separate answers',
      transfer: 'The same patient, back from imaging',
    },
    precommitDenyPatterns: [
      /device (contribution|line|flow)[^.]*\b(zero|empty|none|nothing)\b/i,
      /\bno device (contribution|flow)\b/i,
      /balloon[^.]*\bmoves no\b/i,
      /leaves at zero/i,
    ],
  },
  {
    sectionId: 'mcs-foundations-mechanisms',
    track: 'shared',
    newConcept:
      'a pathway is a source, an active component and a destination — and only some pathways move blood',
    objective:
      'Distinguish a device that changes timing from one that moves a stream, from where blood enters and where it returns — and say which displayed flows may never be added.',
    prerequisiteSectionIds: ['mcs-foundations-signals'],
    stopIds: ['venous-return', 'right-heart', 'left-ventricle', 'aortic-valve', 'aorta-and-body'],
    walksTheLoop: true,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: {
      'iabp-ratio': 'no-setting',
      'iabp-timing': 'no-setting',
      'impella-level': 'no-setting',
      'lvad-speed': 'no-setting',
    },
    grammarRowIds: ['serial-not-a-sum'],
    stepTitles: {
      recognize: 'Trace the pathway on the screen',
      predict: 'Say what changes across the three mechanisms',
      act: 'Select each mechanism in turn',
      observe: 'Compare the three mechanisms',
      explain: 'What can be set, and what is monitoring',
      transfer: 'A congested patient on a well-timed balloon',
    },
    // The balloon's emptiness is the first section's answer, taught before this one, so the walk
    // may say it; what this section withholds is the comparison across the three.
    precommitDenyPatterns: [
      /\bnothing enters\b/i,
      /\bnothing returns\b/i,
      /\bonly (two|one) of (the three|them)\b/i,
      /pulsatility (falls|drops)/i,
      /device line stays empty/i,
      /appears for both pumps/i,
    ],
  },
  {
    sectionId: 'iabp-timing-triggering',
    track: 'iabp',
    newConcept: 'timing decides how much of a mechanism is available',
    objective:
      'Tell early inflation from late, and early deflation from late, on the arterial trace; tell what corrected timing recovers from what it cannot add.',
    prerequisiteSectionIds: ['mcs-foundations-mechanisms'],
    stopIds: ['aortic-valve'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: { 'iabp-timing': 'this-setting', 'iabp-ratio': 'not-this-setting' },
    grammarRowIds: ['timing'],
    practicePairing: { caseId: 'IABP-01', kind: 'mechanism-match' },
    stepTitles: {
      recognize: 'Read the assisted beat',
      predict: 'Say what moving inflation will change',
      act: 'Move inflation to the notch',
      observe: 'Compare the trace before and after',
      explain: 'Timing decides how much is available',
      transfer: 'The same balloon in atrial fibrillation',
    },
    precommitDenyPatterns: [
      /raises? the pressure the ventricle/i,
      /before the (aortic )?valve has closed/i,
      /synchrony returns/i,
      /mean pressure rises/i,
      /impedance/i,
    ],
  },
  {
    sectionId: 'iabp-efficacy-limits',
    track: 'iabp',
    newConcept:
      'a device can be doing what it was asked and still be insufficient, and its display will not say which',
    objective:
      'Decide from the right atrial pressure and the pulmonary pulsatility whether a well-timed balloon is being outrun by the ventricle it inherits.',
    prerequisiteSectionIds: ['iabp-timing-triggering'],
    stopIds: ['right-heart'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: { 'iabp-timing': 'no-setting', 'iabp-ratio': 'no-setting' },
    grammarRowIds: ['inherited-ventricle'],
    practicePairing: { caseId: 'IABP-03', kind: 'mechanism-match' },
    stepTitles: {
      recognize: 'Find the reading that moves first',
      predict: 'Say what a weaker right ventricle will change',
      act: 'Weaken the right ventricle',
      observe: "Compare the device's account with the circulation's",
      explain: 'Right, and insufficient',
      transfer: 'High right atrial pressure, limited left-heart filling',
    },
    precommitDenyPatterns: [
      /right atrial pressure[^.]*\b(rises|rising|climbs)\b/i,
      /synchrony holds/i,
      /inherits the right ventricle/i,
      /pulsatility (ratio|index)?[^.]*\bfall(s|ing)?\b/i,
    ],
  },
  {
    sectionId: 'impella-unloading-placement',
    track: 'impella',
    newConcept: 'a transvalvular pump works by sitting in two chambers at once',
    objective:
      'Decide from the wedge pressure and the ventricular size whether a falling displayed flow is a placement problem, before any setting is touched.',
    prerequisiteSectionIds: ['mcs-foundations-mechanisms'],
    stopIds: ['left-ventricle', 'aortic-valve'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: { 'impella-level': 'no-setting' },
    grammarRowIds: ['pathway-position', 'upstream-inflow', 'downstream-afterload'],
    practicePairing: { caseId: 'IMP-02', kind: 'mechanism-match' },
    stepTitles: {
      recognize: 'Read where the inlet and the outlet sit',
      predict: 'Say what moving the inlet will change',
      act: 'Move the inlet out of position',
      observe: "Compare the pump's account with the ventricle's",
      explain: 'A pump in two chambers',
      transfer: 'Position acceptable, pressures high, flow falling',
    },
    precommitDenyPatterns: [
      /flow falls by (about )?half/i,
      /wedge (pressure )?rises/i,
      /placement alarm/i,
      /blood-trauma/i,
      /ventricle refills/i,
    ],
  },
  {
    sectionId: 'impella-suction-purge-rv',
    track: 'impella',
    newConcept: 'what two pump numbers on one screen do and do not add up to',
    objective:
      'Decide whether a suction alarm is asking for more support or for more delivery to the inlet, and say what two displayed pump flows do and do not tell you together.',
    prerequisiteSectionIds: ['impella-unloading-placement'],
    stopIds: ['venous-return', 'right-heart'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: { 'impella-level': 'no-setting' },
    grammarRowIds: ['upstream-inflow', 'serial-not-a-sum'],
    practicePairing: { caseId: 'IMP-01', kind: 'mechanism-match' },
    stepTitles: {
      recognize: 'Find where the right-sided pump returns blood',
      predict: 'Say what starting the right-sided pump will change',
      act: 'Start the right-sided pump',
      observe: 'Compare the two pump lines with delivery',
      explain: 'One stream, measured twice',
      transfer: 'A sudden fall in preload, the same alarm',
    },
    precommitDenyPatterns: [
      /suction clears/i,
      /\bin series\b/i,
      /counts? (that )?(blood|stream)? ?twice/i,
      /never (be )?(added|summed)/i,
      /less than the (two )?(pump )?numbers added/i,
      /bypassing the right ventricle/i,
    ],
  },
  {
    sectionId: 'lvad-parameters-assessment',
    track: 'lvad',
    newConcept:
      'the durable pump’s flow number answers a different question from the one it seems to',
    objective:
      'Tell a pressure improvement from a perfusion improvement on a durable pump, and say what the displayed flow is made from.',
    prerequisiteSectionIds: ['mcs-foundations-mechanisms', 'impella-unloading-placement'],
    stopIds: ['aorta-and-body'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: { 'lvad-speed': 'no-setting' },
    grammarRowIds: ['downstream-afterload'],
    practicePairing: { caseId: 'LVAD-01', kind: 'mechanism-match' },
    stepTitles: {
      recognize: 'Read what the displayed flow is made from',
      predict: 'Say what a stiffer circulation will change',
      act: 'Raise the systemic resistance',
      observe: 'Compare pressure with delivery',
      explain: 'A pressure improvement that is not a perfusion improvement',
      transfer: 'The same rise in resistance, overnight',
    },
    precommitDenyPatterns: [
      /computed from (pump )?power/i,
      /derived from (pump )?power/i,
      /displayed flow[^.]*\b(falls|fell|drops)\b/i,
      /cardiac power rises/i,
      /pressure rises sharply/i,
    ],
  },
  {
    sectionId: 'lvad-alarms-emergencies',
    track: 'lvad',
    newConcept: 'a power signature can carry what the flow display does not',
    objective:
      'Tell a power signature that carries information from a flow display that does not, without disconnecting anything to find out.',
    prerequisiteSectionIds: ['lvad-parameters-assessment'],
    stopIds: ['left-ventricle'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: { 'lvad-speed': 'no-setting' },
    grammarRowIds: ['active-component-power'],
    practicePairing: { caseId: 'LVAD-03', kind: 'next-in-unit' },
    stepTitles: {
      recognize: 'Read what an alarm on this pathway reports',
      predict: 'Say what the controller will show',
      act: 'Switch on the high-power pattern',
      observe: 'Compare power with the flow display',
      explain: 'The signal the flow display does not carry',
      transfer: 'Power rising while perfusion worsens',
    },
    // The prediction's own stem names the pattern it switches on; what is withheld is what the
    // pattern does to power and to the flow display.
    precommitDenyPatterns: [
      /power (rises|climbs|climbed) (substantially|while|and)/i,
      /raises power/i,
      /flow[^.]*\b(barely|did not|does not|hardly) move/i,
      /leaves (the )?delivered flow where it was/i,
      /flow display (does not|will not) (carry|move)/i,
    ],
  },
  {
    sectionId: 'mcs-device-selection-integration',
    track: 'shared',
    newConcept: 'no new mechanism — the limiting problem selects among the three',
    objective:
      'Name the limiting side from the filling pressures before any device is named, and predict what a higher level can and cannot gain.',
    prerequisiteSectionIds: [
      'iabp-efficacy-limits',
      'impella-suction-purge-rv',
      'lvad-alarms-emergencies',
    ],
    stopIds: ['venous-return', 'right-heart'],
    walksTheLoop: false,
    withholdsFlowAccountUntilCommit: false,
    controlStrip: { 'impella-level': 'no-setting' },
    grammarRowIds: ['inherited-ventricle', 'upstream-inflow'],
    practicePairing: { caseId: 'LVAD-02', kind: 'mechanism-match' },
    stepTitles: {
      recognize: 'Find which side is limiting delivery',
      predict: 'Say what raising the level will change',
      act: 'Raise the level',
      observe: 'Compare the gain with the levels added',
      explain: 'The limiting problem selects',
      transfer: 'The same low output, right atrial pressure rising',
    },
    precommitDenyPatterns: [
      /\bright side\b/i,
      /small gain/i,
      /few tenths/i,
      /suction (alarm )?(still|remains|persists)/i,
      /right atrial pressure unchanged/i,
    ],
  },
])

export const mcsSectionSpecById: ReadonlyMap<string, McsSectionSpec> = new Map(
  mcsSectionSpecs.map((spec) => [spec.sectionId, spec]),
)

export function mcsSectionSpec(sectionId: string): McsSectionSpec {
  const spec = mcsSectionSpecById.get(sectionId)
  if (!spec) throw new Error(`No MCS section spec for ${sectionId}`)
  return spec
}

/** The application sections, in pathway order. */
export function mcsApplicationSectionIds(): readonly string[] {
  return mcsLessons
    .filter((lesson) => lesson.curriculumStage === 'application')
    .map((lesson) => lesson.id)
}

/** Objectives name a discrimination, not the action a section ends in. */
export const mcsObjectiveActionVerbPattern =
  /^(reduce|increase|restore|use|escalate|isolate|give|raise|lower|start|stop|switch|move)\b/i

export function validateMcsSectionSpecs(
  specs: readonly McsSectionSpec[] = mcsSectionSpecs,
): string[] {
  const errors: string[] = []
  const order = mcsLessons.map((lesson) => lesson.id)
  const indexOf = (id: string) => order.indexOf(id)
  const byId = new Map(specs.map((spec) => [spec.sectionId, spec]))

  const ids = specs.map((spec) => spec.sectionId)
  if (new Set(ids).size !== ids.length) errors.push('two specs share a section id')
  for (const id of order) {
    if (!byId.has(id)) errors.push(`section ${id} has no spec`)
  }
  for (const spec of specs) {
    if (indexOf(spec.sectionId) < 0) errors.push(`${spec.sectionId}: a spec for no section`)
  }

  const controlDevices = new Map(
    MCS_CONTROL_PANEL.controls.map((control) => [control.id, control.deviceKind]),
  )
  const scenarioIds = new Set(
    [...mcsPracticeScenarios, ...mcsCapstoneScenarios].map((scenario) => scenario.id),
  )
  const grammarRowIds = new Set(MCS_SUPPORT_GRAMMAR.rows.map((row) => row.id))

  for (const spec of specs) {
    const where = spec.sectionId
    const lesson = mcsLessons.find((candidate) => candidate.id === spec.sectionId)
    if (!lesson) continue

    errors.push(...mcsLearnerCopyErrors(`${where}.newConcept`, spec.newConcept))
    errors.push(...mcsLearnerCopyErrors(`${where}.objective`, spec.objective))
    if (mcsSentenceCount(spec.objective) > 2) {
      errors.push(`${where}: the objective runs past two sentences`)
    }
    if (mcsObjectiveActionVerbPattern.test(spec.objective)) {
      errors.push(`${where}: the objective opens with the action the section ends in`)
    }
    for (const [phase, title] of Object.entries(spec.stepTitles)) {
      errors.push(...mcsLearnerCopyErrors(`${where}.stepTitles.${phase}`, title))
      if (phase === 'recognize' || phase === 'predict') {
        for (const pattern of spec.precommitDenyPatterns) {
          if (pattern.test(title)) {
            errors.push(`${where}: the ${phase} step title matches its own deny pattern ${pattern}`)
          }
        }
      }
    }
    if (spec.precommitDenyPatterns.length === 0) {
      errors.push(`${where}: no deny patterns, so nothing is withheld`)
    }

    // Prerequisites: distinct, not self, spec'd, and taught earlier on the one pathway.
    const seen = new Set<string>()
    for (const prerequisite of spec.prerequisiteSectionIds) {
      if (seen.has(prerequisite)) errors.push(`${where}: prerequisite ${prerequisite} listed twice`)
      seen.add(prerequisite)
      if (prerequisite === spec.sectionId) errors.push(`${where}: lists itself as a prerequisite`)
      if (!byId.has(prerequisite)) errors.push(`${where}: prerequisite ${prerequisite} has no spec`)
      if (indexOf(prerequisite) >= indexOf(spec.sectionId)) {
        errors.push(`${where}: prerequisite ${prerequisite} is not taught earlier`)
      }
    }
    if (spec.prerequisiteSectionIds.length === 0 && indexOf(spec.sectionId) !== 0) {
      errors.push(`${where}: no prerequisites, but it is not the first section`)
    }
    if (spec.prerequisiteSectionIds.length > 0 && indexOf(spec.sectionId) === 0) {
      errors.push(`${where}: the first section cannot assume an earlier one`)
    }

    // Track: a device section belongs to its lesson's device; shared sections to none.
    const expectedTrack = lesson.device === 'shared' ? 'shared' : lesson.device
    if (spec.track !== expectedTrack) {
      errors.push(`${where}: track ${spec.track} does not match the lesson's ${expectedTrack}`)
    }

    // Stops exist and are distinct.
    const stopSeen = new Set<string>()
    for (const stop of spec.stopIds) {
      if (!(mcsSpineStopIds as readonly string[]).includes(stop)) {
        errors.push(`${where}: unknown stop ${stop}`)
      }
      if (stopSeen.has(stop)) errors.push(`${where}: stop ${stop} listed twice`)
      stopSeen.add(stop)
    }
    if (spec.stopIds.length === 0) errors.push(`${where}: stands nowhere on the loop`)
    if (spec.walksTheLoop && spec.stopIds.length !== mcsSpineStopIds.length) {
      errors.push(`${where}: walks the loop but does not stand at every stop`)
    }

    // The strip only marks controls on the section's devices.
    const stripEntries = Object.entries(spec.controlStrip) as [McsControlId, McsControlStripState][]
    if (stripEntries.length === 0) errors.push(`${where}: an empty control strip`)
    for (const [controlId] of stripEntries) {
      const device = controlDevices.get(controlId)
      if (!device) {
        errors.push(`${where}: strip names unknown control ${controlId}`)
        continue
      }
      if (spec.track !== 'shared' && device !== spec.track) {
        errors.push(`${where}: strip marks ${controlId}, a control on another device`)
      }
    }
    const thisSettings = stripEntries.filter(([, state]) => state === 'this-setting')
    if (thisSettings.length > 1) errors.push(`${where}: more than one control is the setting`)

    for (const rowId of spec.grammarRowIds) {
      if (!grammarRowIds.has(rowId)) errors.push(`${where}: unknown grammar row ${rowId}`)
    }
    for (const row of MCS_SUPPORT_GRAMMAR.rows) {
      const claims = row.taughtIn.includes(spec.sectionId)
      const highlights = spec.grammarRowIds.includes(row.id)
      if (claims !== highlights) {
        errors.push(`${where}: the table says row ${row.id} is taught here, the spec disagrees`)
      }
    }

    if (spec.practicePairing) {
      if (!scenarioIds.has(spec.practicePairing.caseId)) {
        errors.push(`${where}: pairs with unknown case ${spec.practicePairing.caseId}`)
      }
      const scenario = mcsPracticeScenarios.find(
        (candidate) => candidate.id === spec.practicePairing?.caseId,
      )
      if (scenario && spec.track !== 'shared' && scenario.device !== spec.track) {
        errors.push(`${where}: pairs with a case on another device`)
      }
    }
  }

  // The integration section assumes exactly the application sections, and every increment has
  // a carrier that opens its track.
  const integration = specs.find(
    (spec) =>
      mcsLessons.find((lesson) => lesson.id === spec.sectionId)?.curriculumStage === 'integration',
  )
  if (integration) {
    const expected = [...mcsApplicationSectionIds()].sort()
    const actual = [...integration.prerequisiteSectionIds].sort()
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      errors.push(
        `${integration.sectionId}: must assume exactly the application sections (${expected.join(', ')})`,
      )
    }
  }
  for (const increment of MCS_DEVICE_INCREMENTS) {
    const carrier = byId.get(increment.carrierSectionId)
    if (!carrier) {
      errors.push(`increment ${increment.track}: carrier ${increment.carrierSectionId} has no spec`)
      continue
    }
    if (increment.track !== 'integration') {
      if (carrier.track !== increment.track) {
        errors.push(`increment ${increment.track}: its carrier is on track ${carrier.track}`)
      }
      const firstOnTrack = order.find(
        (id) => mcsLessons.find((lesson) => lesson.id === id)?.device === increment.track,
      )
      if (firstOnTrack !== increment.carrierSectionId) {
        errors.push(`increment ${increment.track}: its carrier does not open the track`)
      }
    }
  }

  return errors
}

const specErrors = validateMcsSectionSpecs()
if (specErrors.length > 0) {
  throw new Error(`Invalid MCS section specs:\n- ${specErrors.join('\n- ')}`)
}
