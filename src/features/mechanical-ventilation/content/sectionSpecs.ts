import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import type { BreathStopId } from './breathSpine'
import { breathGrammarRowsFor } from './breathGrammar'
import { ventilationCasePresentationTitle } from './casePresentation'
import { VENTILATION_CONTROL_PANEL, type VentilationKnobId } from './controlPanel'
import { ventilationLearningUnits, ventilationUnitById } from './learningCurriculum'

/**
 * One spec per section: the one new concept, the discrimination the learner will be able to
 * make, where the section stands on the breath, which grammar rows it highlights, how the
 * control-panel strip reads on its Explain step, and what may not appear before the prediction.
 *
 * The curriculum (`learningCurriculum.ts`) stays the ordering authority and the source of the
 * analogy, precise statement, checklist, worked example and boundary. This file adds what the stage
 * needs that the curriculum does not carry, and validates the two against each other at import.
 */

export type KnobState = 'this' | 'not-this' | 'no-knob'

export interface KnobStripEntry {
  readonly state: KnobState
  readonly note: string
}

export type KnobStrip = Readonly<Record<VentilationKnobId, KnobStripEntry>>

export interface VentilationSectionSpec {
  readonly unitId: string
  readonly newConcept: string
  /** A discrimination — the skill — never the answer. */
  readonly objective: string
  /** The Now card title of the first step, in presentation terms. */
  readonly recognizeTitle: string
  /** What the first step asks the learner to look at, before anything is predicted. */
  readonly recognizeInstruction: string
  /** The stops lit on the breath map through this section; empty for the whole breath. */
  readonly stops: readonly BreathStopId[]
  readonly knobStrip: KnobStrip
  /** A shaping setting the section reaches for, named for the strip's last row. */
  readonly shapingNote?: string
  /**
   * Text that must not appear on any surface before the prediction is committed: the keyed
   * answer's distinctive phrase, the case's diagnosis, the direction of the response.
   */
  readonly precommitDenyPatterns: readonly RegExp[]
  /** The Practice case offered when the section is worked through. */
  readonly practicePairing?: {
    readonly kind: 'mechanism-match' | 'next-in-unit'
    readonly caseId: string
  }
  /** Orientation copy, only on the first section: why this therapy exists and what it cannot do. */
  readonly orientation?: readonly string[]
}

const NOT_THIS = 'Leave it. It does not reach this finding.'

function strip(overrides: Partial<Record<VentilationKnobId, KnobStripEntry>> = {}): KnobStrip {
  const base: Record<VentilationKnobId, KnobStripEntry> = {
    mode: { state: 'not-this', note: NOT_THIS },
    'breath-size': { state: 'not-this', note: NOT_THIS },
    rate: { state: 'not-this', note: NOT_THIS },
    peep: { state: 'not-this', note: NOT_THIS },
    oxygen: { state: 'not-this', note: NOT_THIS },
  }
  return { ...base, ...overrides }
}

const noKnob = (note: string): KnobStripEntry => ({ state: 'no-knob', note })
const thisKnob = (note: string): KnobStripEntry => ({ state: 'this', note })

export const ventilationSectionSpecs: readonly VentilationSectionSpec[] = [
  {
    unitId: 'breathing-with-support',
    newConcept: 'A breath is a cycle, and the cycle includes the time it takes to empty.',
    objective:
      'Tell inspiration from expiration on the running traces, and say where one breath ends and the next begins.',
    recognizeTitle: 'Why a ventilator exists',
    recognizeInstruction:
      'Read the four short paragraphs on the right, then watch the console for a few breaths. The patient is passive and the machine is doing all the work.',
    stops: [],
    knobStrip: strip({
      mode: noKnob(
        'This section changes nothing. It reads the breath the machine is already giving.',
      ),
    }),
    precommitDenyPatterns: [/flow below zero/i, /falling volume/i, /arrives sooner/i],
    practicePairing: { kind: 'next-in-unit', caseId: 'MV-01' },
    orientation: [
      'A ventilator takes over one job the body normally does for itself: moving gas in and out of the lungs. It does this by pushing gas in under pressure and then letting the lungs empty.',
      'Moving gas is the whole of what the machine does. Whether oxygen crosses into the blood and carbon dioxide leaves it still depends on the patient’s lungs and circulation; the machine only sets the conditions.',
      'It cannot heal the lung. It buys time while something else does, and every push it gives is a pressure the lung and the circulation have to absorb — which is why the same machine can also injure.',
      'So everything on the screen belongs to a part of one breath: the start, the push, the switch to letting go, and the emptying. This module follows that breath from beginning to end before it changes anything.',
    ],
  },
  {
    unitId: 'waveform-anatomy',
    newConcept:
      'Pressure, flow and volume are three descriptions of the same event, read on one time axis.',
    objective: 'Given a change on one trace, say what the other two must show at the same moment.',
    recognizeTitle: 'Walk the breath',
    recognizeInstruction:
      'Stand at each of the four stops on the breath map in turn. At each one, find the moment on the live console and read what the three traces do there.',
    stops: ['trigger', 'inspiration', 'cycling', 'expiration'],
    knobStrip: strip(),
    shapingNote:
      'The inspiratory flow is the setting this section touches: how fast the push arrives, with the volume left alone.',
    precommitDenyPatterns: [
      /arrives sooner/i,
      /same volume arrives/i,
      /pressure rises; delivered volume/i,
    ],
    practicePairing: { kind: 'next-in-unit', caseId: 'MV-01' },
  },
  {
    unitId: 'controls-and-goals',
    newConcept: 'A setting is a request; a measurement is the result.',
    objective:
      'Pair each of the five things you can change with the reading that shows whether the patient received it.',
    recognizeTitle: 'The five things you can change',
    recognizeInstruction:
      'Find the five settings on the console — mode, breath size, rate, PEEP and oxygen. Then find the monitoring values beside them. The first group is what you ask for; the second is what happened.',
    stops: ['inspiration'],
    knobStrip: strip({
      'breath-size': thisKnob(
        'The setting this section changes. Check the exhaled volume and the pressure it cost.',
      ),
      oxygen: thisKnob(
        'Changed in the second setup. It moved the saturation and nothing on the breath.',
      ),
    }),
    precommitDenyPatterns: [/more elastic pressure/i, /gas mixture entering/i],
    practicePairing: { kind: 'next-in-unit', caseId: 'MV-01' },
  },
  {
    unitId: 'mechanics-load-and-pressure',
    newConcept:
      'Airway pressure carries two loads: the pressure spent moving gas and the pressure the filled lung holds.',
    objective:
      'Using a valid inspiratory hold, decide whether a rise in peak pressure came from moving gas or from a stiffer system.',
    recognizeTitle: 'Two loads in one pressure',
    recognizeInstruction:
      'Watch the pressure trace during the push. Notice the quick step at the start and the slower climb to the peak; they are not the same thing. The hold control is on the console.',
    stops: ['inspiration'],
    knobStrip: strip({
      mode: noKnob(
        'No control reaches this finding. The peak rose because the load changed; find the load.',
      ),
      'breath-size': {
        state: 'not-this',
        note: 'Shrinking the breath lowers every pressure and hides the question instead of answering it.',
      },
    }),
    precommitDenyPatterns: [/larger peak-to-plateau gap/i, /gap widens/i, /resistive/i],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-13' },
  },
  {
    unitId: 'modes-and-breath-delivery',
    newConcept:
      'Choosing what the breath holds constant decides what is free to change — and therefore what you watch.',
    objective:
      'For a stiffer system under volume control and under pressure control, name the reading that will move and the one that will not.',
    recognizeTitle: 'What this breath holds constant',
    recognizeInstruction:
      'Look at the mode on the console. Under volume control the machine promises a volume; the pressure is whatever that costs. Watch a few breaths with that promise in mind.',
    stops: ['inspiration'],
    knobStrip: strip({
      mode: thisKnob(
        'The setting this section changes. It swaps which reading is fixed and which one moves.',
      ),
    }),
    precommitDenyPatterns: [
      /pressure rises; delivered volume stays/i,
      /volume falls/i,
      /pressure stays similar while volume/i,
    ],
    practicePairing: { kind: 'next-in-unit', caseId: 'MV-01' },
  },
  {
    unitId: 'lung-protection',
    newConcept:
      'The size of a breath is judged against the size of the lung — predicted body weight — and against a valid pressure.',
    objective:
      'Decide whether a delivered breath is sized to this patient’s predicted body weight and whether the plateau you are reading is valid.',
    recognizeTitle: 'Is this breath sized to this lung?',
    recognizeInstruction:
      'This passive adult is receiving a larger breath than the earlier sections. Read the exhaled volume and think about what it should be compared against.',
    stops: ['inspiration'],
    knobStrip: strip({
      'breath-size': thisKnob(
        'The setting this section changes. Check the exhaled volume against predicted body weight and the plateau against a valid hold.',
      ),
    }),
    precommitDenyPatterns: [/smaller pressure requirement/i, /muscle effort lowering/i],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-01' },
  },
  {
    unitId: 'expiration-and-air-trapping',
    newConcept:
      'Expiration needs enough time for this respiratory system, and the next breath does not wait for it.',
    objective:
      'Decide from the expiratory flow trace whether a breath finished emptying before the next one began.',
    recognizeTitle: 'Watch the breath empty',
    recognizeInstruction:
      'This passive patient empties slowly. Watch the flow trace below zero and see where it is when the next breath starts.',
    stops: ['expiration'],
    knobStrip: strip({
      rate: thisKnob(
        'The setting this section changes, and the one that made emptying harder. Fewer breaths give each expiration more time.',
      ),
    }),
    shapingNote:
      'In the second setup the cycle-off ends a supported breath sooner, which also gives expiration time back.',
    precommitDenyPatterns: [
      /less time for passive emptying/i,
      /shorter machine inspiration/i,
      /trapp/i,
      /auto-?peep/i,
      /hyperinflation/i,
    ],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-05' },
  },
  {
    unitId: 'triggering-and-cycling',
    newConcept:
      'The patient has a clock too: their effort starts and ends, and the machine breath may start and end at different moments.',
    objective:
      'Localize a timing mismatch to the start of the breath or to the end of inspiration, from the effort trace and the flow trace.',
    recognizeTitle: 'Where does the mismatch live?',
    recognizeInstruction:
      'Watch this patient for several breaths with the dashed effort trace in view. Then choose the stop on the breath map where the patient and the machine disagree.',
    stops: ['trigger', 'cycling'],
    knobStrip: strip({
      mode: {
        state: 'not-this',
        note: 'Changing the mode does not make the two clocks agree; it changes what the breath promises.',
      },
    }),
    shapingNote:
      'The trigger sensitivity and the cycle-off are the settings this section reaches for: one for the start, one for the end.',
    precommitDenyPatterns: [
      /more efforts followed by/i,
      /longer machine inspiration/i,
      /premature cycling/i,
    ],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-07' },
  },
  {
    unitId: 'oxygenation-response',
    newConcept: 'An oxygenation gain is judged together with its cost in pressure and circulation.',
    objective:
      'After a change on the oxygenation axis, say which readings show the benefit and which show the cost.',
    recognizeTitle: 'More than the saturation',
    recognizeInstruction:
      'This patient’s saturation is low. Before changing anything, find the saturation, the peak pressure, the exhaled volume and the blood pressure on the screen — you will read all four.',
    stops: [],
    knobStrip: strip({
      peep: thisKnob(
        'The setting this section changes. Read the saturation, the pressures and the blood pressure together.',
      ),
      oxygen: thisKnob(
        'Changed in the second setup. It reaches the saturation and nothing on the breath.',
      ),
      rate: {
        state: 'not-this',
        note: 'The rate is on the other axis. It moves carbon dioxide, not oxygenation.',
      },
    }),
    precommitDenyPatterns: [
      /while map falls/i,
      /circulatory cost/i,
      /overdistension/i,
      /recruitment/i,
    ],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-01' },
  },
  {
    unitId: 'ventilation-and-co2',
    newConcept:
      'Gas moved each minute and gas that reaches exchanging lung are different quantities, and carbon dioxide follows the second.',
    objective:
      'Given a change in rate or breath size, say which readings move at once and which move over minutes — and which control does not move carbon dioxide at all.',
    recognizeTitle: 'Two clocks: the breath and the blood gas',
    recognizeInstruction:
      'Find the total rate, the minute ventilation and the modeled carbon dioxide on the screen. Two of them will move the moment a setting changes; one will not.',
    stops: ['expiration'],
    knobStrip: strip({
      rate: thisKnob(
        'The setting this section changes. It moves minute ventilation at once and carbon dioxide over minutes.',
      ),
      'breath-size': thisKnob(
        'The other half of minute ventilation. Under pressure control the delivered size can change without you touching it.',
      ),
      oxygen: {
        state: 'not-this',
        note: 'On the other axis. Raising it for a high carbon dioxide moves nothing that matters here.',
      },
    }),
    precommitDenyPatterns: [/toward a lower value/i, /co₂ rises as effective ventilation falls/i],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-05' },
  },
  {
    unitId: 'waveform-reading-sequence',
    newConcept: 'One repeatable read — start, push, switch, empty — before any mechanism is named.',
    objective:
      'Given a striking feature on one trace, follow the whole breath in order and name the discriminating observation.',
    recognizeTitle: 'Where do the extra breaths come from?',
    recognizeInstruction:
      'The displayed rate is higher than the set rate. Watch several breaths against the dashed effort trace, then choose the stop on the breath map where the extra breaths originate.',
    stops: ['trigger', 'inspiration'],
    knobStrip: strip({
      mode: noKnob(
        'No control answers this one. The extra breaths come from the circuit, and the circuit is checked at the bedside.',
      ),
    }),
    precommitDenyPatterns: [/fewer extra machine breaths/i, /circuit leak/i],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-08' },
  },
  {
    unitId: 'dyssynchrony-mechanisms',
    newConcept:
      'Localize the mismatch on the breath first; the change and its reassessment follow from the place.',
    objective:
      'Distinguish a delivery mismatch during the push from a trigger or cycling mismatch, and name the reassessment each one needs.',
    recognizeTitle: 'Where does this patient’s discomfort live?',
    recognizeInstruction:
      'This patient starts every supported breath but is uncomfortable. Watch the early part of each push against the effort trace, then choose the stop on the breath map.',
    stops: ['inspiration', 'cycling'],
    knobStrip: strip({
      mode: {
        state: 'not-this',
        note: 'A different mode would change the promise, not the place where this push and this effort part company.',
      },
    }),
    shapingNote:
      'The rise time and the cycle-off are the settings this section reaches for: one shapes the start of the push, the other decides its end.',
    precommitDenyPatterns: [
      /faster rise with less discomfort/i,
      /shorter machine inspiration/i,
      /rise-time mismatch/i,
      /delayed cycling/i,
      /too slow, then too fast/i,
    ],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-11' },
  },
  {
    unitId: 'safety-reassessment-and-human-factors',
    newConcept:
      'An action is followed by a reassessment of the patient, and neither an acknowledged alarm nor a written plan is one.',
    objective:
      'Decide which finding would show that an intervention helped this patient, and which findings only show that it was performed.',
    recognizeTitle: 'The person before the machine',
    recognizeInstruction:
      'This awake patient is distressed. Open the patient and circuit findings under the console and read them before touching any setting.',
    stops: [],
    knobStrip: strip({
      mode: noKnob('No control comes first here. The patient’s account and a reversible cause do.'),
    }),
    precommitDenyPatterns: [
      /ask what is making breathing difficult/i,
      /patient findings improving over time/i,
    ],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-15' },
  },
  {
    unitId: 'high-peak-pressure-integration',
    newConcept:
      'No new mechanism. The same alarm is taken apart with the readings the earlier sections built.',
    objective:
      'From a high peak pressure alone, decide which measurement discriminates the candidate mechanisms and what each result would mean.',
    recognizeTitle: 'One alarm, cause not supplied',
    recognizeInstruction:
      'A passive patient has a high peak pressure and the cause is not given. Decide which measurement you would take first, then take it.',
    stops: ['inspiration', 'expiration'],
    knobStrip: strip({
      mode: noKnob(
        'Measure before touching a control. The hold tells you which load rose; the control, if any, follows from that.',
      ),
    }),
    precommitDenyPatterns: [
      /pressure falls substantially when flow stops/i,
      /higher pressure persisting after flow stops/i,
      /resistance/i,
      /compliance/i,
      /stiff/i,
    ],
    practicePairing: { kind: 'mechanism-match', caseId: 'MV-13' },
  },
]

export const ventilationSectionSpecById: ReadonlyMap<string, VentilationSectionSpec> = new Map(
  ventilationSectionSpecs.map((spec) => [spec.unitId, spec]),
)

export function ventilationSectionSpec(unitId: string): VentilationSectionSpec {
  const spec = ventilationSectionSpecById.get(unitId)
  if (!spec) throw new Error(`No section spec for ${unitId}`)
  return spec
}

/** The pairing with its presentation title, for the completion card and the accordion. */
export function ventilationPracticePairing(unitId: string): {
  readonly kind: 'mechanism-match' | 'next-in-unit'
  readonly caseId: string
  readonly title: string
} | null {
  const pairing = ventilationSectionSpec(unitId).practicePairing
  if (!pairing) return null
  return { ...pairing, title: ventilationCasePresentationTitle(pairing.caseId) }
}

export function ventilationSectionSpecErrors(
  specs: readonly VentilationSectionSpec[],
): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const spec of specs) {
    if (seen.has(spec.unitId)) errors.push(`Duplicate spec ${spec.unitId}`)
    seen.add(spec.unitId)
    const unit = ventilationUnitById.get(spec.unitId)
    if (!unit) {
      errors.push(`Spec for unknown unit ${spec.unitId}`)
      continue
    }
    if (spec.practicePairing && !unit.caseIds.includes(spec.practicePairing.caseId)) {
      errors.push(
        `${spec.unitId} pairs a case (${spec.practicePairing.caseId}) its unit does not list`,
      )
    }
    if (
      breathGrammarRowsFor(spec.unitId).length === 0 &&
      unit.stage !== 'orientation' &&
      unit.stage !== 'foundation'
    ) {
      errors.push(`${spec.unitId} highlights no grammar row`)
    }
    const knobIds = new Set(Object.keys(spec.knobStrip))
    for (const knob of VENTILATION_CONTROL_PANEL.knobs) {
      if (!knobIds.has(knob.id)) errors.push(`${spec.unitId} strip is missing ${knob.id}`)
    }
    const copy = [
      spec.newConcept,
      spec.objective,
      spec.recognizeTitle,
      spec.recognizeInstruction,
      ...(spec.orientation ?? []),
      ...Object.values(spec.knobStrip).map((entry) => entry.note),
      spec.shapingNote ?? '',
    ]
    for (const line of copy) {
      const flagged = flaggedLearnerCopyTerms(line)
      if (flagged.length > 0)
        errors.push(`${spec.unitId}: banned term ${flagged.join(', ')} in "${line}"`)
    }
    // The section's own pre-commit surfaces must pass its own deny list.
    for (const line of [
      spec.recognizeTitle,
      spec.recognizeInstruction,
      spec.objective,
      spec.newConcept,
      unit.title,
      unit.increment,
    ]) {
      for (const pattern of spec.precommitDenyPatterns) {
        if (pattern.test(line))
          errors.push(`${spec.unitId}: "${line}" matches its own deny pattern ${pattern}`)
      }
    }
  }
  for (const unit of ventilationLearningUnits) {
    if (!seen.has(unit.id)) errors.push(`Unit ${unit.id} has no section spec`)
  }
  return errors
}

{
  const errors = ventilationSectionSpecErrors(ventilationSectionSpecs)
  if (errors.length > 0)
    throw new Error(`Ventilation section specs are not valid:\n${errors.join('\n')}`)
}
