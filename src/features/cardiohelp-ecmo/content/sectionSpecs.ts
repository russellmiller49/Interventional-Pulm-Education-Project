import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import type { LearningPathway } from '@/features/learning-module/curriculum/types'

import type { SupportMode } from '../engine/types'
import { ecmoLearnerCopyErrors } from './controlPanel'
import { ECMO_TRACK_INCREMENTS, type EcmoTrackIncrements } from './trackIncrements'

/**
 * The lesson spec of every section on both pathways: one new concept, the discrimination the
 * section enables, and which earlier sections taught what it assumes.
 *
 * This is the ladder the module was rebuilt against, held as data so the two things a ladder can
 * silently lose are checked at import: that every prerequisite is taught *earlier* on every
 * pathway that carries both sections, and that a section shared by both tracks assumes nothing
 * only one track teaches.
 *
 * Objectives name the discrimination the learner will be able to make, never the answer — so an
 * objective may not open with the action the drill ends in. The wording of every objective and
 * concept is the approved ladder's, verbatim. Shared sections appear once.
 */

export interface EcmoSectionSpec {
  readonly sectionId: string
  /** Exactly one. */
  readonly newConcept: string
  /** The discrimination this section enables. Never begins with the action the drill ends in. */
  readonly objective: string
  readonly prerequisiteSectionIds: readonly string[]
  /** Present on the section that opens a track, and there it is the registered increment. */
  readonly incrementSentence?: string
  /**
   * Mirrors `learnerCopyOverrideReason` on clinical learning items. A reviewed term used in its
   * clinical sense, with the reason on record and naming the term.
   */
  readonly learnerCopyOverrideReason?: string
}

export const ecmoTrackIds: readonly SupportMode[] = ['vv', 'va']

const VV_APPLICATION_DRILLS = [
  'preload-drainage-collapse',
  'afterload-return-obstruction',
  'afterload-oxygenator-resistance',
  'vv-recirculation',
  'acute-hypercapnia',
  'compensated-hypercapnia',
  'gas-source-interruption',
  'arterial-bubble-stop',
  'transport-power-loss',
] as const

const VA_APPLICATION_DRILLS = [
  'va-preload-drainage-collapse',
  'va-afterload-arterial-return-obstruction',
  'va-afterload-oxygenator-resistance',
  'va-differential-hypoxemia',
  'va-lv-loading',
  'va-acute-hypercapnia',
  'va-gas-source-interruption',
  'va-arterial-bubble-stop',
  'va-transport-power-loss',
] as const

export const ecmoSectionSpecs: readonly EcmoSectionSpec[] = Object.freeze([
  // ── Shared by both tracks ─────────────────────────────────────────────────────────────────────
  {
    sectionId: 'why-extracorporeal-support',
    newConcept: 'delivery = flow × content; consumption on the other side',
    objective:
      'Tell which term of oxygen delivery has given way from a saturation, a hemoglobin and a cardiac output, and which of those a circuit can stand in for',
    prerequisiteSectionIds: [],
  },
  {
    sectionId: 'circuit-flow-path',
    newConcept: 'every reading has a location on the path',
    objective:
      'Name where on the path a displayed reading is taken before reading its value; tell a drainage-side reading from a return-side one',
    prerequisiteSectionIds: ['why-extracorporeal-support'],
  },
  {
    sectionId: 'pump-and-pressure-zones',
    newConcept: 'speed is a setting, flow is a result; the three zones read as a set',
    objective:
      'Distinguish a change confined to the drainage zone from one that moves both post-pump pressures together, and from one that widens the gradient across the membrane',
    prerequisiteSectionIds: ['circuit-flow-path'],
  },
  {
    sectionId: 'blood-flow-versus-sweep',
    newConcept: 'three knobs, two axes; everything else is monitoring',
    objective:
      'Given a rising CO₂ with steady oxygenation, or the reverse, decide which of the three settings to reach for, and recognise when none of them is',
    prerequisiteSectionIds: ['pump-and-pressure-zones'],
  },
  // ── VV ────────────────────────────────────────────────────────────────────────────────────────
  {
    sectionId: 'vv-normal-state',
    newConcept: 'normal is a stable relationship, not a number',
    objective:
      "Distinguish a value that has moved from this run's own baseline from one that merely differs from a number you carry",
    prerequisiteSectionIds: ['blood-flow-versus-sweep'],
  },
  {
    sectionId: 'vv-series-physiology',
    newConcept: 'circuit flow is not effective flow',
    objective:
      "Decide when a higher displayed flow means more support and when it does not, using the drainage-line saturation against the patient's own",
    prerequisiteSectionIds: ['vv-normal-state'],
  },
  {
    sectionId: 'startup-sensor-orientation',
    newConcept: 'four information domains, one of which the console reports',
    objective:
      'Say, for each reading on the startup screen, which domain produced it, and which readings a stopped pump cannot produce',
    prerequisiteSectionIds: ['blood-flow-versus-sweep', 'vv-normal-state'],
  },
  {
    sectionId: 'preload-drainage-collapse',
    newConcept: 'a falling flow can be a supply problem',
    objective:
      'Decide whether a falling flow is limited upstream or downstream of the pump before touching a setting',
    prerequisiteSectionIds: ['pump-and-pressure-zones', 'startup-sensor-orientation'],
  },
  {
    sectionId: 'afterload-return-obstruction',
    newConcept: 'a downstream load raises everything upstream of it',
    objective:
      'Decide from the two post-pump pressures and the gradient whether the load sits beyond the membrane or in it',
    prerequisiteSectionIds: ['pump-and-pressure-zones', 'preload-drainage-collapse'],
  },
  {
    sectionId: 'afterload-oxygenator-resistance',
    newConcept: 'the gradient belongs to the device, read at similar flow',
    objective:
      'Tell a gradient widened at matched flow from one widened because flow rose; decide whether one reading justifies an action',
    prerequisiteSectionIds: ['afterload-return-obstruction'],
  },
  {
    sectionId: 'vv-recirculation',
    newConcept: 'the flow display can count the same blood twice',
    objective:
      'Decide whether a reassuring flow number and a worsening patient are telling you about the pump or about where the returned blood goes',
    prerequisiteSectionIds: ['vv-series-physiology', 'preload-drainage-collapse'],
  },
  {
    sectionId: 'acute-hypercapnia',
    newConcept: 'one control for one axis, moved in bounded steps',
    objective: 'Choose the control for a CO₂ problem and decide how fast to correct it',
    prerequisiteSectionIds: ['blood-flow-versus-sweep'],
    learnerCopyOverrideReason:
      'The approved objective uses "correct" in its clinical sense — correcting an acidemia — not as scoring vocabulary.',
  },
  {
    sectionId: 'compensated-hypercapnia',
    newConcept: 'an abnormal number in a settled state',
    objective:
      'Decide whether an elevated CO₂ calls for a setting change or for leaving a settled state alone',
    prerequisiteSectionIds: ['acute-hypercapnia'],
  },
  {
    sectionId: 'gas-source-interruption',
    newConcept: 'a setting is a request, not proof of delivery',
    objective:
      'Decide from unchanged pressures and worsening gas values whether the problem is in the blood path or somewhere the flow display cannot see',
    prerequisiteSectionIds: ['blood-flow-versus-sweep', 'acute-hypercapnia'],
  },
  {
    sectionId: 'arterial-bubble-stop',
    newConcept: 'a stopped pump is not an isolated patient',
    objective:
      "Tell the device's stop, the patient's isolation, the air source and the restart apart as separate acts",
    prerequisiteSectionIds: ['startup-sensor-orientation'],
  },
  {
    sectionId: 'transport-power-loss',
    newConcept: 'reserve power buys time, not permission',
    objective:
      'Decide what continued flow on reserve power does and does not buy, and which action secures support without trading it away',
    prerequisiteSectionIds: ['startup-sensor-orientation'],
  },
  {
    sectionId: 'vv-integration-capstone',
    newConcept: 'combine the grammar rows',
    objective:
      'Separate four explanations by what each predicts elsewhere in the circuit and the patient',
    prerequisiteSectionIds: VV_APPLICATION_DRILLS,
  },
  // ── VA ────────────────────────────────────────────────────────────────────────────────────────
  {
    sectionId: 'va-normal-state',
    newConcept: 'the artery pushes back; two circulations share one aorta',
    objective:
      'Say which signals belong to a stable VA state that a VV state does not have, and why each exists',
    prerequisiteSectionIds: ['blood-flow-versus-sweep'],
    incrementSentence: ECMO_TRACK_INCREMENTS.va.sentence,
  },
  {
    sectionId: 'va-parallel-physiology',
    newConcept: 'the meeting point of two streams is a place, and it moves',
    objective:
      'Separate a loading problem from an oxygenation one when the circuit display has not moved, naming the two signals that decide it',
    prerequisiteSectionIds: ['va-normal-state'],
  },
  {
    sectionId: 'va-startup-sensor-orientation',
    newConcept: 'same hardware, different destinations to verify',
    objective:
      'Say which extra things must be established by hand before support starts on VA, and which the console cannot show',
    prerequisiteSectionIds: ['va-normal-state', 'va-parallel-physiology'],
  },
  {
    sectionId: 'va-preload-drainage-collapse',
    newConcept: 'circuit flow is one contributor to systemic perfusion',
    objective: 'Decide whether the endpoint of a holding move is the flow display or the patient',
    prerequisiteSectionIds: ['pump-and-pressure-zones', 'va-startup-sensor-orientation'],
  },
  {
    sectionId: 'va-afterload-arterial-return-obstruction',
    newConcept: "circuit return pressure is not the patient's arterial pressure",
    objective:
      "Tell a circuit-return load from the patient's own afterload, using the independent monitor beside the circuit pressures",
    prerequisiteSectionIds: ['pump-and-pressure-zones', 'va-preload-drainage-collapse'],
  },
  {
    sectionId: 'va-afterload-oxygenator-resistance',
    newConcept: "the gradient still says nothing about the patient's pressure",
    objective:
      'Tell a gradient widened at matched flow from one widened because flow rose, then reassess the territories the circuit supplies',
    prerequisiteSectionIds: ['va-afterload-arterial-return-obstruction'],
  },
  {
    sectionId: 'va-differential-hypoxemia',
    newConcept: 'sampling site is part of the measurement',
    objective:
      'Say which territory each arterial sampling site reports, and whether the console can change what reaches the right arm',
    prerequisiteSectionIds: ['va-parallel-physiology'],
  },
  {
    sectionId: 'va-lv-loading',
    newConcept: 'an acceptable flow and MAP do not establish ejection',
    objective:
      'Decide whether flow and mean pressure establish that the heart is still ejecting, and name the signals that do',
    prerequisiteSectionIds: ['va-parallel-physiology'],
  },
  {
    sectionId: 'va-acute-hypercapnia',
    newConcept: 'the gas control does not replace the VA checks',
    objective:
      'Choose the control for a CO₂ problem on VA and say which VA-specific checks it does not replace',
    prerequisiteSectionIds: ['blood-flow-versus-sweep', 'va-lv-loading'],
  },
  {
    sectionId: 'va-gas-source-interruption',
    newConcept: 'ongoing arterial flow is not oxygenated flow',
    objective:
      'Decide from unchanged pressures and worsening gas values whether the problem is in the blood path or the gas path, then sample the upper body',
    prerequisiteSectionIds: ['blood-flow-versus-sweep', 'va-differential-hypoxemia'],
  },
  {
    sectionId: 'va-arterial-bubble-stop',
    newConcept: 'a pump stop interrupts circulation but does not isolate the artery',
    objective:
      "Tell the device's stop, the patient's isolation, the air source and the restart apart, and name what circulation loses meanwhile",
    prerequisiteSectionIds: ['va-startup-sensor-orientation'],
  },
  {
    sectionId: 'va-transport-power-loss',
    newConcept: 'trading flow for reserve trades circulation',
    objective:
      'Decide what continued flow on reserve power does and does not buy for a patient whose circulation depends on it',
    prerequisiteSectionIds: ['va-startup-sensor-orientation'],
  },
  {
    sectionId: 'va-integration-capstone',
    newConcept: 'VA adds explanations VV does not have',
    objective:
      'Separate the VV explanations from the four VA-only ones by where you look and what you sample',
    prerequisiteSectionIds: VA_APPLICATION_DRILLS,
  },
])

export const ecmoSectionSpecById: ReadonlyMap<string, EcmoSectionSpec> = new Map(
  ecmoSectionSpecs.map((definition) => [definition.sectionId, definition]),
)

export function ecmoSectionSpec(sectionId: string): EcmoSectionSpec {
  const definition = ecmoSectionSpecById.get(sectionId)
  if (!definition) throw new Error(`Unknown ECMO section spec: ${sectionId}`)
  return definition
}

export function ecmoLearningPathways(): readonly LearningPathway[] {
  return ecmoTrackIds.map((track) => criticalCareLearningPathway('cardiohelp-ecmo', track))
}

/** The specs of one track, in that track's pathway order. */
export function ecmoSectionSpecsForTrack(track: SupportMode): readonly EcmoSectionSpec[] {
  return criticalCareLearningPathway('cardiohelp-ecmo', track).sections.map((section) =>
    ecmoSectionSpec(section.id),
  )
}

/** Section ids that appear on every ECMO pathway. */
export function ecmoSharedSectionIds(
  pathways: readonly LearningPathway[] = ecmoLearningPathways(),
): readonly string[] {
  const [first, ...rest] = pathways
  if (!first) return []
  return first.sections
    .map((section) => section.id)
    .filter((id) => rest.every((pathway) => pathway.sections.some((section) => section.id === id)))
}

/** An objective names a discrimination, so it may not open with the action a drill ends in. */
export const ecmoObjectiveActionVerbPattern =
  /^(reduce|increase|restore|use|escalate|isolate|give|raise|lower|clamp)\b/i

function sentenceCount(value: string): number {
  return value.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0).length
}

function pathwayIndex(pathway: LearningPathway, sectionId: string): number {
  return pathway.sections.findIndex((section) => section.id === sectionId)
}

export function validateEcmoSectionSpecs(
  specs: readonly EcmoSectionSpec[] = ecmoSectionSpecs,
  pathways: readonly LearningPathway[] = ecmoLearningPathways(),
  increments: EcmoTrackIncrements = ECMO_TRACK_INCREMENTS,
): readonly string[] {
  const errors: string[] = []
  const declared = specs.map((definition) => definition.sectionId)
  if (new Set(declared).size !== declared.length) errors.push('a section has two specs')

  const pathwayIds = new Set(pathways.flatMap((pathway) => pathway.sections.map((s) => s.id)))
  for (const id of pathwayIds) {
    if (!declared.includes(id)) errors.push(`${id}: pathway section has no spec`)
  }
  for (const id of declared) {
    if (!pathwayIds.has(id)) errors.push(`${id}: spec for a section on no ECMO pathway`)
  }

  const specById = new Map(specs.map((definition) => [definition.sectionId, definition]))

  for (const definition of specs) {
    const id = definition.sectionId
    const copyOptions = { learnerCopyOverrideReason: definition.learnerCopyOverrideReason }
    errors.push(...ecmoLearnerCopyErrors(`${id}.newConcept`, definition.newConcept, copyOptions))
    errors.push(...ecmoLearnerCopyErrors(`${id}.objective`, definition.objective, copyOptions))

    // An override that excuses nothing is a stale reason waiting to excuse the next thing.
    if (
      definition.learnerCopyOverrideReason !== undefined &&
      ecmoLearnerCopyErrors(id, `${definition.newConcept} ${definition.objective}`).length === 0
    ) {
      errors.push(`${id}: carries a learner-copy override that excuses nothing`)
    }

    if (sentenceCount(definition.objective) > 2) {
      errors.push(`${id}: the objective runs past two sentences`)
    }
    if (ecmoObjectiveActionVerbPattern.test(definition.objective)) {
      errors.push(`${id}: the objective opens with an action rather than a discrimination`)
    }

    const containing = pathways.filter((pathway) => pathwayIndex(pathway, id) >= 0)
    const isShared = containing.length === pathways.length && pathways.length > 0

    const prerequisites = definition.prerequisiteSectionIds
    if (new Set(prerequisites).size !== prerequisites.length) {
      errors.push(`${id}: lists a prerequisite twice`)
    }
    for (const prerequisite of prerequisites) {
      if (prerequisite === id) {
        errors.push(`${id}: is its own prerequisite`)
        continue
      }
      if (!specById.has(prerequisite)) {
        errors.push(`${id}: prerequisite ${prerequisite} has no spec`)
        continue
      }
      const both = containing.filter((pathway) => pathwayIndex(pathway, prerequisite) >= 0)
      if (both.length === 0) {
        errors.push(`${id}: prerequisite ${prerequisite} is on no pathway that carries the section`)
      }
      for (const pathway of both) {
        if (pathwayIndex(pathway, prerequisite) >= pathwayIndex(pathway, id)) {
          errors.push(
            `${id}: prerequisite ${prerequisite} does not precede it on the ${pathway.trackId ?? pathway.moduleId} pathway`,
          )
        }
      }
      if (isShared && both.length !== pathways.length) {
        errors.push(`${id}: a shared section assumes ${prerequisite}, which only one track teaches`)
      }
    }

    // Only the opening section of a pathway assumes nothing.
    if (prerequisites.length === 0) {
      for (const pathway of containing) {
        if (pathwayIndex(pathway, id) !== 0) {
          errors.push(`${id}: assumes nothing, yet is not the first section of the pathway`)
        }
      }
    }
  }

  // A capstone assumes every application drill of its track, and only those.
  for (const pathway of pathways) {
    const applicationIds = pathway.sections
      .filter((section) => section.stage === 'application')
      .map((section) => section.id)
      .sort()
    for (const section of pathway.sections.filter((s) => s.stage === 'integration')) {
      const definition = specById.get(section.id)
      if (!definition) continue
      const assumed = [...definition.prerequisiteSectionIds].sort()
      if (assumed.join() !== applicationIds.join()) {
        errors.push(`${section.id}: does not assume exactly the track's application drills`)
      }
    }
  }

  // The increment sentence is one string, carried by the section that opens the track it counts.
  const registered = Object.entries(increments).flatMap(([track, increment]) =>
    increment ? [{ track, sentence: increment.sentence }] : [],
  )
  for (const definition of specs) {
    if (definition.incrementSentence === undefined) continue
    const match = registered.find((entry) => entry.sentence === definition.incrementSentence)
    if (!match) {
      errors.push(`${definition.sectionId}: carries an increment sentence that is not registered`)
      continue
    }
    const trackPathway = pathways.find((pathway) => pathway.trackId === match.track)
    if (!trackPathway || pathwayIndex(trackPathway, definition.sectionId) < 0) {
      errors.push(
        `${definition.sectionId}: carries the ${match.track} increment but is not on that pathway`,
      )
    }
    const elsewhere = pathways.filter(
      (pathway) =>
        pathway.trackId !== match.track && pathwayIndex(pathway, definition.sectionId) >= 0,
    )
    if (elsewhere.length > 0) {
      errors.push(`${definition.sectionId}: a shared section cannot open the ${match.track} track`)
    }
  }
  for (const entry of registered) {
    const carriers = specs.filter((definition) => definition.incrementSentence === entry.sentence)
    if (carriers.length !== 1) {
      errors.push(
        `${entry.track}: the increment is carried by ${carriers.length} sections, not one`,
      )
    }
  }

  return errors
}

const sectionSpecErrors = validateEcmoSectionSpecs()
if (sectionSpecErrors.length > 0) {
  throw new Error(`Invalid ECMO section specs:\n- ${sectionSpecErrors.join('\n- ')}`)
}
