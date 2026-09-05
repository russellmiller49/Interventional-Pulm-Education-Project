import type { EcmoInteractiveFoundationSectionId } from './foundationLessonRuntime'

/**
 * Which component of oxygen delivery a proposed change acts on.
 *
 * The first foundation section teaches that oxygen delivery is a flow carrying a content, with
 * consumption on the other side of the balance, and that a reassuring value in one of those says
 * nothing about the other two. Reading that is not the same as being able to use it, so the section's
 * Act step asks the learner to do the thing the section exists to enable: take a change someone might
 * reasonably propose at the bedside and name the component it moves first.
 *
 * Every candidate here is a real bedside move, and two of them act on the same component by different
 * routes — transfusing raises the carrier, raising the sweep-gas oxygen fraction raises how loaded that
 * carrier is. Keeping both is deliberate: a learner who has understood the section can attribute both to
 * content, while a learner who has memorised "oxygen goes with saturation" will split them.
 *
 * The registry is validated at import, so a candidate that names a component this file does not define
 * fails the build rather than rendering a select with nothing behind it.
 */

export type EcmoDeliveryComponentId = 'oxygen-content' | 'blood-flow' | 'oxygen-consumption'

export interface EcmoDeliveryComponent {
  readonly id: EcmoDeliveryComponentId
  readonly label: string
  /** One clinical sentence, in the words a bedside clinician would use. */
  readonly definition: string
}

export interface EcmoDeliveryCandidateChange {
  readonly id: string
  /** The proposed change, phrased the way it would be said on a round. */
  readonly label: string
  readonly componentId: EcmoDeliveryComponentId
  /** Why it acts there — and, where it matters, what it does not do. */
  readonly rationale: string
}

export interface EcmoDeliveryAttribution {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly prompt: string
  readonly components: readonly EcmoDeliveryComponent[]
  readonly candidates: readonly EcmoDeliveryCandidateChange[]
  readonly sourceIds: readonly string[]
  /**
   * Evidence id → the claim this surface takes from that source.
   *
   * Required for every id, and checked at import. A physiology audit in September 2026 found this
   * surface inheriting the section's core sources wholesale, two of which support nothing about
   * oxygen delivery — an id that resolves is not the same as an id that supports what it is cited
   * for, and this module has no gate that catches the difference. Naming the claim per id is the
   * gate.
   */
  readonly claims: Readonly<Record<string, string>>
}

const DELIVERY_COMPONENTS: readonly EcmoDeliveryComponent[] = Object.freeze([
  {
    id: 'oxygen-content',
    label: 'Oxygen content',
    definition:
      'How much oxygen each decilitre of arterial blood carries. Set mainly by the hemoglobin available to carry it, and then by how much of that hemoglobin is loaded.',
  },
  {
    id: 'blood-flow',
    label: 'Blood flow',
    definition:
      'How much of that blood reaches the tissues each minute — the native cardiac output, and on arterial support the circuit flow alongside it.',
  },
  {
    id: 'oxygen-consumption',
    label: 'Oxygen consumption',
    definition:
      'What the tissues are asking for. It sits on the other side of the balance and can move without anything on the supply side changing.',
  },
])

const ATTRIBUTIONS: Readonly<
  Partial<Record<EcmoInteractiveFoundationSectionId, EcmoDeliveryAttribution>>
> = {
  'why-extracorporeal-support': {
    sectionId: 'why-extracorporeal-support',
    prompt:
      'Each of these is a reasonable thing to propose at the bedside. For each one, choose the part of the oxygen balance it acts on first.',
    components: DELIVERY_COMPONENTS,
    candidates: Object.freeze([
      {
        id: 'transfuse-red-cells',
        label: 'Transfuse red cells in profound anemia.',
        componentId: 'oxygen-content',
        rationale:
          'This raises the carrier itself, which is what content depends on most. The saturation does not have to change for content to rise, and in profound anemia it is usually already near its ceiling.',
      },
      {
        id: 'raise-sweep-oxygen-fraction',
        label: 'Raise the oxygen fraction on the sweep gas.',
        componentId: 'oxygen-content',
        rationale:
          'This acts on content too, by the other route: it raises how loaded the carrier is rather than how much carrier there is. When the saturation is already close to its ceiling there is very little room left there, which is why this can feel like acting while changing little.',
      },
      {
        id: 'start-an-inotrope',
        label: 'Start an inotrope for a low cardiac output.',
        componentId: 'blood-flow',
        rationale:
          'This moves the volume of blood carrying the content, not the content itself. Each decilitre is unchanged; more decilitres arrive.',
      },
      {
        id: 'treat-fever-and-deepen-sedation',
        label: 'Treat the fever and deepen sedation in an agitated, shivering patient.',
        componentId: 'oxygen-consumption',
        rationale:
          'This is the only one that works on the other side of the balance. It lowers what the tissues are asking for rather than raising what arrives, which is why it can help when the supply side cannot be moved further.',
      },
    ]),
    sourceIds: [
      'ecmo-book-ch16',
      'ecmo-book-ch17',
      'elso-adult-vv-2021',
      'bounded-educational-model',
    ],
    claims: Object.freeze({
      'ecmo-book-ch16':
        'Support is chosen by naming the step that has failed, rather than by reading a single number.',
      'ecmo-book-ch17':
        'Blood flow is a dose that is titrated, within preload and recirculation limits.',
      'elso-adult-vv-2021':
        'Circuit data is read alongside an independent assessment of the patient, not instead of it.',
      'bounded-educational-model':
        'The oxygen content and delivery arithmetic these components are attributed against.',
    }),
  },
}

export function ecmoDeliveryAttribution(
  sectionId: EcmoInteractiveFoundationSectionId,
): EcmoDeliveryAttribution | null {
  return ATTRIBUTIONS[sectionId] ?? null
}

export const ecmoDeliveryComponents = DELIVERY_COMPONENTS

export function ecmoDeliveryComponentById(
  id: EcmoDeliveryComponentId,
): EcmoDeliveryComponent | undefined {
  return DELIVERY_COMPONENTS.find((component) => component.id === id)
}

/** Import-time checks the type system cannot express. */
export function validateEcmoDeliveryAttributions(): string[] {
  const errors: string[] = []
  const componentIds = new Set(DELIVERY_COMPONENTS.map((component) => component.id))
  for (const attribution of Object.values(ATTRIBUTIONS)) {
    if (!attribution) continue
    const seen = new Set<string>()
    if (attribution.candidates.length < 3) {
      errors.push(`${attribution.sectionId}: fewer than three candidate changes to attribute`)
    }
    for (const candidate of attribution.candidates) {
      if (seen.has(candidate.id))
        errors.push(`${attribution.sectionId}: duplicate candidate ${candidate.id}`)
      seen.add(candidate.id)
      if (!componentIds.has(candidate.componentId)) {
        errors.push(`${attribution.sectionId}: ${candidate.id} names an unknown component`)
      }
    }
    // Every component the learner can choose has to be the answer to something, or it is a decoy
    // that teaches nothing and reads as a trick.
    for (const component of attribution.components) {
      if (!attribution.candidates.some((candidate) => candidate.componentId === component.id)) {
        errors.push(`${attribution.sectionId}: no candidate acts on ${component.id}`)
      }
    }
    if (attribution.sourceIds.length === 0) {
      errors.push(`${attribution.sectionId}: no sources registered`)
    }
    for (const sourceId of attribution.sourceIds) {
      if (!attribution.claims[sourceId]?.trim()) {
        errors.push(`${attribution.sectionId}: ${sourceId} is cited without naming the claim`)
      }
    }
    for (const sourceId of Object.keys(attribution.claims)) {
      if (!attribution.sourceIds.includes(sourceId)) {
        errors.push(`${attribution.sectionId}: a claim is registered for uncited ${sourceId}`)
      }
    }
    // A number attached to a treatment reads as an indication this module has not sourced, and the
    // section's own transfer item turns on a hemoglobin figure the Act step must not pre-empt.
    for (const candidate of attribution.candidates) {
      if (/\d/.test(candidate.label)) {
        errors.push(`${attribution.sectionId}: ${candidate.id} names a number in its label`)
      }
    }
  }
  return errors
}

const attributionErrors = validateEcmoDeliveryAttributions()
if (attributionErrors.length > 0) {
  throw new Error(`ecmoDeliveryAttribution registry invalid:\n${attributionErrors.join('\n')}`)
}
