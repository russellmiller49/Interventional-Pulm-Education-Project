import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import {
  hemodynamicsControlIds,
  hemodynamicsLearnerCopyErrors,
  type HemodynamicsControlId,
} from './controlPanel'
import { hemodynamicCaseById } from './cases'
import { routeStopIds, type RouteStopId } from './routeSpine'
import { signalGrammarRows } from './signalGrammar'
import { hemodynamicsSourceById } from './sources'

/**
 * The ladder: one record per pathway section, in the pathway's order.
 *
 * A section spec carries what the pathway row cannot — the one new concept, the discrimination
 * the section enables, which stops on the spine it lights, which rows of the one table it
 * highlights, the control strip its Explain step shows, the phrases no pre-commit surface may
 * carry, and the case, matched by mechanism, that is its last task. The pathway
 * (`learningPathways.ts`) stays the order; this is what a section *is*.
 */
export const hemodynamicsSectionIds = [
  'why-measure',
  'pressure-system',
  'waveform-interpretation',
  'waveform-components',
  'catheter-advancement',
  'pawp-capture',
  'thermodilution-series',
  'derived-hemodynamics',
  'pac-signal-validation',
] as const

export type HemodynamicsSectionId = (typeof hemodynamicsSectionIds)[number]

export function isHemodynamicsSectionId(value: unknown): value is HemodynamicsSectionId {
  return typeof value === 'string' && (hemodynamicsSectionIds as readonly string[]).includes(value)
}

export type ControlStripState = 'this-one' | 'not-this-one' | 'harmful-reflex' | 'monitoring'

export type ControlStripVerdict =
  | 'this-control'
  | 'no-control-find-the-cause'
  | 'no-control-stop-first'

export interface ControlStrip {
  readonly verdict: ControlStripVerdict
  readonly states: Readonly<Record<HemodynamicsControlId, ControlStripState>>
  /** The strip in one sentence, in the grammar every section uses. */
  readonly sentence: string
}

/**
 * The case that is a section's last task, matched to the section by mechanism.
 *
 * The case runs inside the section, embedded on its own engine, after the transfer: the owner found
 * the cases good but stranded outside the sections they apply (2026-10-14), so a section now ends
 * by applying itself to a fresh patient rather than sending the learner to Practice. Each case is
 * the last task of at most one section; Practice keeps every case as a list.
 */
export interface PracticePairing {
  readonly kind: 'mechanism-match'
  readonly caseId: string
  /**
   * A further case on the same mechanism, offered on the completion card once the section is
   * finished. It is never a task of its own and adds nothing to the section's minutes.
   */
  readonly secondCaseId?: string
}

export interface HemodynamicsSectionSpec {
  readonly id: HemodynamicsSectionId
  /** Exactly one. */
  readonly newConcept: string
  /** The discrimination this section enables. Never opens with the action the section ends in. */
  readonly objective: string
  /** "Section 3 adds one idea to section 2: …" — counted out loud. */
  readonly incrementSentence: string
  readonly prerequisiteSectionIds: readonly HemodynamicsSectionId[]
  /** The stops the catheter map lights while this section runs. */
  readonly spineStops: readonly RouteStopId[]
  /** The rows of the one table this section highlights. */
  readonly grammarRowIds: readonly string[]
  readonly controlStrip: ControlStrip
  /** Phrases that name this section's keyed prediction answer. No pre-commit surface may carry one. */
  readonly precommitDenyPatterns: readonly RegExp[]
  /**
   * A limit of the simulation, in one sentence, only where a learner could take a simulated value
   * or behaviour for a real one. Empty otherwise, and then nothing renders.
   */
  readonly modelBoundary: string
  /**
   * The case that ends this section, or none: the orientation has no mechanism to apply, and the
   * capstone already runs a case patient inside the lesson.
   */
  readonly practicePairing?: PracticePairing
  readonly sourceIds: readonly string[]
}

const stripSentence = {
  reference:
    'This control: level and zero. Not this control: the scale, the tip, the balloon. The response has no control — find the cause in the line.',
  none: 'No control answers this. Find the cause before touching anything.',
} as const

export const hemodynamicsSectionSpecs: readonly HemodynamicsSectionSpec[] = Object.freeze([
  {
    id: 'why-measure',
    newConcept:
      'A pressure measured inside the circulation answers some bedside questions and not others.',
    objective:
      'Distinguish the questions a trustworthy pressure answers on its own from the ones it can only support.',
    incrementSentence:
      'This module asks one question first: why put a line in at all? Everything after it is about making the answer trustworthy.',
    prerequisiteSectionIds: [],
    spineStops: ['line', 'ra', 'rv', 'pa', 'wedge'],
    grammarRowIds: [],
    controlStrip: {
      verdict: 'no-control-find-the-cause',
      states: {
        level: 'monitoring',
        zero: 'monitoring',
        scale: 'monitoring',
        tip: 'monitoring',
        balloon: 'monitoring',
      },
      sentence:
        'No control here. This section is about what the numbers can say, before any of them is changed.',
    },
    precommitDenyPatterns: [
      /driving (force|pressure)/i,
      /says nothing about (why|flow|the cause)/i,
    ],
    modelBoundary: '',
    sourceIds: ['pac-review-2014', 'esicm-shock-2025', 'icu-hemodynamics-model-v1'],
  },
  {
    id: 'pressure-system',
    newConcept: 'The line has a reference and a response, and each can be disturbed on its own.',
    objective:
      'Decide whether a displayed pressure is carrying an offset, a distorted shape, both, or neither — and which check settles each.',
    incrementSentence:
      'This section adds one idea to the last: before a number can mean anything, the line that carries it has to be checked, and it can be disturbed in two separate ways.',
    prerequisiteSectionIds: ['why-measure'],
    spineStops: ['line'],
    grammarRowIds: ['reference-offset', 'display-scale', 'overdamped', 'underdamped'],
    controlStrip: {
      verdict: 'this-control',
      states: {
        level: 'this-one',
        zero: 'this-one',
        scale: 'not-this-one',
        tip: 'not-this-one',
        balloon: 'not-this-one',
      },
      sentence: stripSentence.reference,
    },
    precommitDenyPatterns: [
      /underdamp/i,
      /\bresonan/i,
      /\bringing\b/i,
      /each problem separately/i,
      /three (separate )?(problems|checks|repairs)/i,
    ],
    modelBoundary: '',
    practicePairing: { kind: 'mechanism-match', caseId: 'HD-08' },
    sourceIds: [
      'arterial-pressure-five-step-2020',
      'monitor-workflow-supplied',
      'clinical-hemodynamics-waveforms',
    ],
  },
  {
    id: 'waveform-interpretation',
    newConcept: 'Each place the tip can sit writes its own shape, and the shape names the place.',
    objective:
      'Name the place a tracing comes from by its shape alone — or say that a fault on the display has made it unnameable.',
    incrementSentence:
      'This section adds one idea: with a trustworthy line, the shape of the tracing tells you which chamber you are listening to.',
    prerequisiteSectionIds: ['pressure-system'],
    spineStops: ['ra', 'rv', 'pa', 'wedge'],
    grammarRowIds: ['atrial-shape', 'ventricular-shape', 'arterial-shape'],
    controlStrip: {
      verdict: 'no-control-find-the-cause',
      states: {
        level: 'not-this-one',
        zero: 'not-this-one',
        scale: 'not-this-one',
        tip: 'monitoring',
        balloon: 'monitoring',
      },
      sentence:
        'No control names a place. The shape does; the tip and the balloon only decide which shape you will see.',
    },
    /*
     * The walk names all four places before the prediction, on purpose: the prediction tests
     * whether the learner can apply the four shapes to a tracing whose chamber the monitor is not
     * naming. What must not appear is anything that names the place of the tracing on the screen —
     * the monitor's own labels, or a sentence that says where the tip is.
     */
    precommitDenyPatterns: [
      /PAC · RV/i,
      /\bRVEDP\b/i,
      /\bRVSP\b/i,
      /(tip|catheter) (is|sits) in the (right )?ventric/i,
      /this (tracing|trace) is (the |a )?(right )?ventric/i,
    ],
    modelBoundary: '',
    practicePairing: { kind: 'mechanism-match', caseId: 'HD-04' },
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021', 'pac-review-2014'],
  },
  {
    id: 'waveform-components',
    newConcept:
      'Within a confirmed chamber, individual waves and descents reflect phases of the cardiac cycle; a changed component can support a mechanism in clinical context.',
    objective:
      'Identify normal atrial waves and descents against the ECG, then interpret contrasting abnormal components in context.',
    incrementSentence:
      'This section adds one idea to the last: once the place is certain, the waves inside it can be read — and the same letter does not mean the same thing in every chamber.',
    prerequisiteSectionIds: ['waveform-interpretation'],
    spineStops: ['ra', 'wedge'],
    grammarRowIds: ['atrial-shape'],
    controlStrip: {
      verdict: 'no-control-find-the-cause',
      states: {
        level: 'not-this-one',
        zero: 'not-this-one',
        scale: 'not-this-one',
        tip: 'not-this-one',
        balloon: 'not-this-one',
      },
      sentence:
        'No control reads a wave. Confirm the line and the place, then read the component against the ECG.',
    },
    precommitDenyPatterns: [
      /tricuspid regurg/i,
      /\bregurgitant\b/i,
      /systolic (right-)?atrial filling/i,
    ],
    modelBoundary: '',
    practicePairing: { kind: 'mechanism-match', caseId: 'HD-07' },
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'catheter-advancement',
    newConcept:
      'The tracing names the position; everything else on the list decides whether you may go on.',
    objective:
      'Decide, at each stop, whether the tracing has confirmed the position and whether the other observables permit the next move.',
    incrementSentence:
      'This section adds one idea to the last: the shape you can already name now tells you where the tip is — and a list of things that are not the shape tells you when to stop.',
    prerequisiteSectionIds: ['waveform-interpretation'],
    spineStops: ['ra', 'rv', 'pa'],
    grammarRowIds: ['atrial-shape', 'ventricular-shape', 'arterial-shape'],
    controlStrip: {
      verdict: 'this-control',
      states: {
        level: 'not-this-one',
        zero: 'not-this-one',
        scale: 'not-this-one',
        tip: 'this-one',
        balloon: 'this-one',
      },
      sentence:
        'This control: the tip, one stop at a time, with the flow-directed balloon up while it floats. Not this control: level, zero, scale. A stop condition has a first move of its own, in the list.',
    },
    precommitDenyPatterns: [
      /\badvance, expecting/i,
      /ectopy is common/i,
      /fear of the next chamber/i,
    ],
    modelBoundary:
      'The simulated catheter meets no resistance and shows no ectopy; the first moves for both are in the list above.',
    practicePairing: { kind: 'mechanism-match', caseId: 'HD-03' },
    sourceIds: ['pac-waveforms-part-1-2021', 'pac-review-2014', 'edwards-swan-ganz-ifu-2023'],
  },
  {
    id: 'pawp-capture',
    newConcept:
      'A wedge is brief, taken at end expiration, judged for plausibility, and over only when the pulmonary-artery tracing is back.',
    objective:
      'Decide whether a stored wedge can be interpreted, and whether the occlusion that produced it has safely ended.',
    incrementSentence:
      'This section adds one idea to the last: from a confirmed pulmonary artery, the balloon lets you listen past the tip — briefly, and with a way to prove you have stopped.',
    prerequisiteSectionIds: ['catheter-advancement'],
    spineStops: ['pa', 'wedge'],
    grammarRowIds: ['arterial-shape', 'spontaneous-wedge', 'false-wedge'],
    controlStrip: {
      verdict: 'this-control',
      states: {
        level: 'not-this-one',
        zero: 'not-this-one',
        scale: 'not-this-one',
        tip: 'harmful-reflex',
        balloon: 'this-one',
      },
      sentence:
        'This control: the balloon, up briefly and then down. Not this control: level, zero, scale. The harmful reflex is the tip — advancing to make a poor wedge look better — and more balloon is the other one.',
    },
    precommitDenyPatterns: [
      /end[- ]expirat(ion|ory)[^.]{0,40}(store|then deflate)/i,
      /store the value, then deflate/i,
      /confirm (the )?PA return/i,
    ],
    modelBoundary:
      'The simulator lets the balloon down by itself if you leave it up; that timing is the simulator’s, not a limit for a real catheter.',
    practicePairing: { kind: 'mechanism-match', caseId: 'HD-06' },
    sourceIds: [
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
      'monitor-workflow-supplied',
    ],
  },
  {
    id: 'thermodilution-series',
    newConcept:
      'A flow measurement has a technique, and the curve shows whether the technique held before the number can be trusted.',
    objective:
      'Decide which thermodilution curves belong in a series and which method a flow number came from.',
    incrementSentence:
      'This section adds one idea to the last: pressures are read, but flow has to be measured — and every measurement has a technique that can be seen in what it produces.',
    prerequisiteSectionIds: ['catheter-advancement'],
    spineStops: ['ra', 'pa'],
    grammarRowIds: ['series-disagreement'],
    controlStrip: {
      verdict: 'no-control-find-the-cause',
      states: {
        level: 'not-this-one',
        zero: 'not-this-one',
        scale: 'not-this-one',
        tip: 'not-this-one',
        balloon: 'not-this-one',
      },
      sentence:
        'No control fixes a poor curve. The technique does: the injection, its timing, and the rhythm it lands on.',
    },
    precommitDenyPatterns: [
      /accept the two/i,
      /repeat the (irregular|poor|prolonged)/i,
      /replaced rather than forced/i,
    ],
    modelBoundary: '',
    practicePairing: { kind: 'mechanism-match', caseId: 'HD-01' },
    sourceIds: [
      'pac-derived-part-2-2021',
      'master-hemodynamics-reference',
      'edwards-swan-ganz-ifu-2023',
    ],
  },
  {
    id: 'derived-hemodynamics',
    newConcept:
      'A derived value is an equation over measurements, and it cannot be more valid than its inputs.',
    objective:
      'Decide, for a calculated value, which inputs it depends on, which of them are valid, and whether the result may be read, read with caution, or withheld.',
    incrementSentence:
      'This section adds one idea to the last: every number that is not read or measured is calculated, and a calculation inherits every doubt about what went into it.',
    prerequisiteSectionIds: ['pressure-system', 'pawp-capture', 'thermodilution-series'],
    spineStops: ['line', 'ra', 'pa', 'wedge'],
    grammarRowIds: ['derived-contradiction'],
    controlStrip: {
      verdict: 'no-control-find-the-cause',
      states: {
        level: 'not-this-one',
        zero: 'not-this-one',
        scale: 'not-this-one',
        tip: 'not-this-one',
        balloon: 'not-this-one',
      },
      sentence:
        'No control fixes a calculated value. Its inputs do: repair the measurement it depends on, then let the calculation follow.',
    },
    precommitDenyPatterns: [
      /withhold (precise )?SVR/i,
      /inherits the validity/i,
      /every required input/i,
    ],
    modelBoundary: '',
    practicePairing: { kind: 'mechanism-match', caseId: 'HD-05', secondCaseId: 'HD-02' },
    sourceIds: ['pac-derived-part-2-2021', 'master-hemodynamics-reference'],
  },
  {
    id: 'pac-signal-validation',
    newConcept: 'Apply the pressure, catheter and cardiac-output checks together in one patient.',
    objective:
      'Decide, when a screen changes and the patient does not, which of the line, the tip, the series and the calculation to doubt first — and in what order to restore them.',
    incrementSentence:
      'This section adds nothing new. Every row you need is already in the table; the work is to run them in order on one patient.',
    prerequisiteSectionIds: [
      'pressure-system',
      'waveform-interpretation',
      'waveform-components',
      'catheter-advancement',
      'pawp-capture',
      'thermodilution-series',
      'derived-hemodynamics',
    ],
    spineStops: ['line', 'ra', 'rv', 'pa', 'wedge'],
    grammarRowIds: [
      'reference-offset',
      'display-scale',
      'overdamped',
      'underdamped',
      'ventricular-shape',
      'spontaneous-wedge',
      'false-wedge',
      'series-disagreement',
      'derived-contradiction',
    ],
    controlStrip: {
      verdict: 'this-control',
      states: {
        level: 'this-one',
        zero: 'this-one',
        scale: 'not-this-one',
        tip: 'this-one',
        balloon: 'this-one',
      },
      sentence:
        'This control, in order: level and zero, then the balloon down and the tip back to the artery. Not this control: the scale. The series has no control — repeat it with the technique.',
    },
    precommitDenyPatterns: [
      /unconfirmed/i,
      /walk the line/i,
      /measurement chain/i,
      /doubt the (screen|numbers)/i,
      /first suspect is the measurement/i,
    ],
    modelBoundary: '',
    sourceIds: [
      'arterial-pressure-five-step-2020',
      'pac-waveforms-part-1-2021',
      'pac-derived-part-2-2021',
      'monitor-workflow-supplied',
    ],
  },
])

const specById = new Map(hemodynamicsSectionSpecs.map((spec) => [spec.id, spec]))

export function hemodynamicsSectionSpec(sectionId: string): HemodynamicsSectionSpec {
  const spec = specById.get(sectionId as HemodynamicsSectionId)
  if (!spec) throw new Error(`Unknown hemodynamics section: ${sectionId}`)
  return spec
}

export interface HemodynamicsSectionCase {
  readonly caseId: string
  /** The case's presentation title — never its diagnosis (`shortTitle`). */
  readonly title: string
  readonly minutes: number
}

function sectionCase(sectionId: string, caseId: string): HemodynamicsSectionCase {
  const definition = hemodynamicCaseById.get(caseId)
  if (!definition) throw new Error(`Section ${sectionId} pairs to an unknown case ${caseId}.`)
  return { caseId, title: definition.title, minutes: definition.minutes }
}

/** The case that is this section's last task, or null when the section ends without one. */
export function hemodynamicsPracticePairing(
  sectionId: string,
): (HemodynamicsSectionCase & { readonly kind: PracticePairing['kind'] }) | null {
  const pairing = hemodynamicsSectionSpec(sectionId).practicePairing
  return pairing ? { kind: pairing.kind, ...sectionCase(sectionId, pairing.caseId) } : null
}

/** The further case on this section's mechanism its completion card offers, or null. */
export function hemodynamicsSecondCase(sectionId: string): HemodynamicsSectionCase | null {
  const secondCaseId = hemodynamicsSectionSpec(sectionId).practicePairing?.secondCaseId
  return secondCaseId ? sectionCase(sectionId, secondCaseId) : null
}

export const objectiveActionVerbPattern =
  /^(reduce|increase|restore|use|escalate|isolate|give|raise|lower|advance|deflate|inflate|withdraw|zero|level)\b/i

export function validateHemodynamicsSectionSpecs(
  specs: readonly HemodynamicsSectionSpec[] = hemodynamicsSectionSpecs,
): readonly string[] {
  const errors: string[] = []
  const pathway = criticalCareLearningPathway('icu-hemodynamics')
  const pathwayIds = pathway.sections.map((section) => section.id)
  if (pathwayIds.join('|') !== hemodynamicsSectionIds.join('|')) {
    errors.push(
      `The section id list (${hemodynamicsSectionIds.join(', ')}) does not match the pathway (${pathwayIds.join(', ')}).`,
    )
  }
  if (specs.map((spec) => spec.id).join('|') !== hemodynamicsSectionIds.join('|')) {
    errors.push('Section specs are not one per pathway section, in pathway order.')
  }
  const grammarIds = new Set(signalGrammarRows.map((row) => row.id))
  specs.forEach((spec, index) => {
    const where = `Section ${spec.id}`
    errors.push(
      ...hemodynamicsLearnerCopyErrors(`${where} new concept`, spec.newConcept),
      ...hemodynamicsLearnerCopyErrors(`${where} objective`, spec.objective),
      ...hemodynamicsLearnerCopyErrors(`${where} increment`, spec.incrementSentence),
      ...(spec.modelBoundary.trim().length > 0
        ? hemodynamicsLearnerCopyErrors(`${where} boundary`, spec.modelBoundary)
        : []),
      ...hemodynamicsLearnerCopyErrors(`${where} control strip`, spec.controlStrip.sentence),
    )
    if (spec.objective.split(/[.!?](\s|$)/).filter((part) => part.trim()).length > 2) {
      errors.push(`${where} objective runs past two sentences.`)
    }
    if (objectiveActionVerbPattern.test(spec.objective)) {
      errors.push(`${where} objective opens with an action verb; it must name a discrimination.`)
    }
    if (!/\b(one idea|nothing new|one question)\b/i.test(spec.incrementSentence)) {
      errors.push(`${where} increment sentence must count its new ideas out loud.`)
    }
    if (
      index === 0
        ? spec.prerequisiteSectionIds.length > 0
        : spec.prerequisiteSectionIds.length === 0
    ) {
      errors.push(`${where} prerequisites: only the first section may assume nothing.`)
    }
    for (const prerequisite of spec.prerequisiteSectionIds) {
      const prerequisiteIndex = hemodynamicsSectionIds.indexOf(prerequisite)
      if (prerequisiteIndex < 0) errors.push(`${where} assumes an unknown section ${prerequisite}.`)
      else if (prerequisiteIndex >= index) {
        errors.push(`${where} assumes ${prerequisite}, which is not earlier on the pathway.`)
      }
    }
    if (spec.spineStops.length === 0) errors.push(`${where} lights no stop on the spine.`)
    for (const stop of spec.spineStops) {
      if (!routeStopIds.includes(stop)) errors.push(`${where} lights an unknown stop ${stop}.`)
    }
    for (const rowId of spec.grammarRowIds) {
      if (!grammarIds.has(rowId))
        errors.push(`${where} highlights an unknown grammar row ${rowId}.`)
    }
    for (const row of signalGrammarRows) {
      if (row.taughtIn.includes(spec.id) && !spec.grammarRowIds.includes(row.id)) {
        errors.push(`${where} is named by grammar row ${row.id} but does not highlight it.`)
      }
    }
    for (const controlId of hemodynamicsControlIds) {
      if (!(controlId in spec.controlStrip.states)) {
        errors.push(`${where} control strip omits ${controlId}.`)
      }
    }
    const thisOnes = Object.values(spec.controlStrip.states).filter((state) => state === 'this-one')
    if (spec.controlStrip.verdict === 'this-control' && thisOnes.length === 0) {
      errors.push(`${where} says a control answers, but marks none as the one.`)
    }
    if (spec.controlStrip.verdict !== 'this-control' && thisOnes.length > 0) {
      errors.push(`${where} says no control answers, but marks one as the one.`)
    }
    if (spec.precommitDenyPatterns.length === 0) {
      errors.push(`${where} has no deny patterns; the pre-commit scan would check nothing.`)
    }
    for (const pattern of spec.precommitDenyPatterns) {
      if (!pattern.flags.includes('i'))
        errors.push(`${where} deny pattern ${pattern} is case-sensitive.`)
      if (pattern.flags.includes('g'))
        errors.push(`${where} deny pattern ${pattern} is global (stateful).`)
    }
    const pairing = spec.practicePairing
    if (pairing) {
      const definition = hemodynamicCaseById.get(pairing.caseId)
      if (!definition) {
        errors.push(`${where} pairs to an unknown case ${pairing.caseId}.`)
      } else {
        const section = pathway.sections.find((candidate) => candidate.id === spec.id)
        // The section's minutes include its case; a section shorter than its case has left it out.
        if (section && section.minutes <= definition.minutes) {
          errors.push(`${where} lists ${section.minutes} min, which cannot include its case.`)
        }
      }
      if (pairing.secondCaseId !== undefined) {
        if (!hemodynamicCaseById.has(pairing.secondCaseId)) {
          errors.push(`${where} offers an unknown second case ${pairing.secondCaseId}.`)
        }
        if (pairing.secondCaseId === pairing.caseId) {
          errors.push(`${where} offers its own case as the second case.`)
        }
      }
    }
    if (spec.sourceIds.length === 0) errors.push(`${where} cites nothing.`)
    for (const sourceId of spec.sourceIds) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        errors.push(`${where} cites an unregistered source ${sourceId}.`)
      }
    }
  })
  const capstone = specs.at(-1)
  if (capstone && capstone.prerequisiteSectionIds.length !== specs.length - 2) {
    errors.push('The capstone must assume every section but the orientation.')
  }
  // A case lives in one section: as its last task, or as the second case its completion offers.
  const placed = specs.flatMap((spec) =>
    spec.practicePairing
      ? [spec.practicePairing.caseId, spec.practicePairing.secondCaseId ?? []].flat()
      : [],
  )
  for (const caseId of new Set(placed)) {
    if (placed.filter((candidate) => candidate === caseId).length > 1) {
      errors.push(`Case ${caseId} is placed in more than one section.`)
    }
  }
  return errors
}

const sectionSpecErrors = validateHemodynamicsSectionSpecs()
if (sectionSpecErrors.length > 0) {
  throw new Error(`Hemodynamics section specs are invalid:\n${sectionSpecErrors.join('\n')}`)
}
