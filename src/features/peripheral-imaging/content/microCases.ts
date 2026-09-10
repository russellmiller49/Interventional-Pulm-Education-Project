import type { ClinicalLearningItem } from '@/features/learning-module/activity'

import { QUESTION_BY_ID } from '../data/questions'
import { imagingLearnerCopyErrors } from './learnerCopy'
import {
  isImagingSectionId,
  peripheralImagingSectionIds,
  PERIPHERAL_IMAGING_MODULE_ID,
  type ImagingSectionId,
} from './pathway'
import { imagingStageItems, toClinicalLearningItem } from './stageItems'

/**
 * Practice: short cases, one decision each, paired to a section by the mechanism they use.
 *
 * A section's own two items are retrieval on the material just worked. These are the layer after
 * that: a bedside situation the learner has not seen, asking them to use the same mechanism
 * somewhere else. Static signals, one decision, a short debrief — deliberately not a multi-step
 * case, which is what the capstone is for.
 *
 * Unlike the capstone, a micro-case can be answered again as often as the learner likes. Only the
 * first decision is recorded, under `practice:<id>`, and it is never rewritten — the same
 * write-once rule the rest of the module uses, so a record always says what the learner did the
 * first time they met the situation.
 */
export const PRACTICE_ACTIVITY_ID = `${PERIPHERAL_IMAGING_MODULE_ID}:practice`

export interface ImagingMicroCase {
  readonly id: string
  readonly sectionId: ImagingSectionId
  /** Names the situation, never the mechanism and never the decision. */
  readonly presentationTitle: string
  /** The signals visible in the room, before any interpretation. */
  readonly situation: string
  readonly item: ClinicalLearningItem
}

interface MicroCaseDefinition {
  readonly id: string
  readonly sectionId: ImagingSectionId
  readonly presentationTitle: string
  readonly situation: string
}

/**
 * One case per mechanism and application section, and a second for the three sections that fill
 * two rows of the diagnostic table. Authored against each section's own teaching and the module's
 * reviewed sources; every item is `reviewStatus: 'draft'` pending subject-matter review.
 */
const MICRO_CASE_DEFINITIONS: readonly MicroCaseDefinition[] = [
  {
    id: 'signal-practice-1',
    sectionId: 'signal',
    presentationTitle: 'Poor lesion conspicuity in a large patient',
    situation:
      'A large patient is on the table with a catheter in the right lower lobe. The collimator blades are open to the edges of the detector, so most of the chest is in the field. The catheter edge is sharp and the background is smooth rather than mottled, but the whole image is low in contrast: the diaphragm, the vessels and the lesion are nearly the same grey.',
  },
  {
    id: 'signal-practice-2',
    sectionId: 'signal',
    presentationTitle: 'Washed-out image after an oblique projection',
    situation:
      'After a planned change of C-arm projection, the lesion is clear of the mediastinum and the needle is in view. The image now looks washed out rather than noisy, with low contrast across the whole field. Collimation is unchanged from the frontal projection and still includes most of the hemithorax, and the patient’s arm lies across the beam, well away from the lesion. Window/level and monitor brightness are as they were before the rotation.',
  },
  {
    id: 'field-practice-1',
    sectionId: 'field',
    presentationTitle: 'Low-contrast image, stationary tool',
    situation:
      'A peripheral airway is being worked under live fluoroscopy in the frontal projection. The image is uniformly low in contrast, with the sheath markings blending into the lung behind them, and it is not noisy. The field includes the shoulder and the upper abdomen as well as the working segment, the unit is on the room’s default low-dose fluoroscopy setting, and the standard preset and window/level are unchanged. The tool is stationary and the lesion is mid-screen.',
  },
  {
    id: 'field-practice-2',
    sectionId: 'field',
    presentationTitle: 'Narrow field, lost landmark',
    situation:
      'The team pauses to re-orient the sheath before going further. The last-image-hold frame shows the sheath tip and a short length of airway, sharp and with little noise, inside a plain narrow border with no collimator blade edge or graphic. Fluoroscopy is off. Nobody at the table remembers whether the field was collimated earlier or the image was electronically cropped at the workstation.',
  },
  {
    id: 'time-practice-1',
    sectionId: 'time',
    presentationTitle: 'Stepwise tool motion during advancement',
    situation:
      'A sheath is being advanced toward a peripheral lesion under live fluoroscopy. As it moves, it appears at a series of separated positions rather than moving smoothly. Last-image-hold frames from that run show a sharp tool edge and a well-defined tip. When the hand stops advancing, the image settles at the same moment.',
  },
  {
    id: 'two-dimensional-practice-1',
    sectionId: 'two-dimensional',
    presentationTitle: 'Eccentric radial EBUS view',
    situation:
      'A solid peripheral lesion in the right lower lobe was planned on the CT, and the sheath has been advanced along the planned airway. The radial EBUS view shows lesional-appearing tissue on one side of the probe and aerated-lung snowstorm on the other. Frontal and oblique fluoroscopic projections show the sheath tip in the planned branch, with no separately visible lesion. Nothing has been sampled.',
  },
  {
    id: 'dts-acquisition-practice-1',
    sectionId: 'dts-acquisition',
    presentationTitle: 'Apparent tool–target overlap',
    situation:
      'A faint nodule in the right lower lobe lies under the catheter tip on the frontal projection, and the two stay together while the tool is held still. A rib edge crosses the lesion on the same image. With the robot docked and the drapes up, the C-arm can rotate only a limited arc either side of frontal, and within that arc the system can acquire single images at chosen angles, a DTS acquisition across the arc, or the frontal projection again in a finer detector mode. Noise and brightness are acceptable, the field is collimated around the lesion, and anesthesia can provide a brief ventilation pause for whichever is chosen.',
  },
  {
    id: 'dts-acquisition-practice-2',
    sectionId: 'dts-acquisition',
    presentationTitle: 'DTS depth mismatch',
    situation:
      'A needle has been advanced toward a peripheral nodule in the right lower lobe, and one DTS acquisition has been obtained across the available arc, with the tool still and the breath held throughout. Scrolling the reconstructed planes, the nodule is brightest on one plane, the needle tip is bright on that same plane, and so is a vessel crossing the region. The vessel stays bright through the neighbouring planes and never narrows onto one. The tip’s own brightness peaks on a plane slightly shallower than the nodule’s.',
  },
  {
    id: 'dts-interpretation-practice-1',
    sectionId: 'dts-interpretation',
    presentationTitle: 'Catheter absent from the DTS planes',
    situation:
      'A robotic catheter was parked in a subsegmental airway of the right lower lobe before the DTS acquisition and has not moved since; live fluoroscopy shows its distal end clearly. The second monitor shows a reconstructed view of that region, where the lesion has fine lobulated margins much as on the planning CT open on the adjacent display. Scrolling the reconstructed planes through the airway and the lesion, the catheter appears on none of them. The C-arm and the table have not moved since the acquisition.',
  },
  {
    id: 'cbct-acquisition-practice-1',
    sectionId: 'cbct-acquisition',
    presentationTitle: 'CBCT truncation',
    situation:
      'The table was moved to give the robotic arm room, and the CBCT spin was acquired from that position. On the reconstructed images the catheter and needle are sharp, edges are single throughout, and the needle lies against the near part of the nodule. The far side of the nodule runs to the upper edge of the reconstruction volume and continues beyond it.',
  },
  {
    id: 'fixed-suite-practice-1',
    sectionId: 'fixed-suite',
    presentationTitle: 'Needle repositioned under an overlay',
    situation:
      'In a fixed C-arm CBCT suite, a spin earlier in the case defined the nodule, and the system projects that contour onto the images it displays, live fluoroscopy included; the live image is in the projection the case has been using. The needle has since been repositioned, and the team wants to know where its sampling end lies relative to the nodule. The console offers the fluoroscopy modes in use and the CBCT protocols for a full spin.',
  },
  {
    id: 'mobile-suite-practice-1',
    sectionId: 'mobile-suite',
    presentationTitle: 'Banding artifact on the first spin',
    situation:
      'The mobile CBCT scanner has been brought into the bronchoscopy room, and its first spin is on the workstation. Alternating dark and bright bands fan across the reconstructed images, and the nodule margin breaks up where they cross it. The patient is on the room’s own procedure table with its side rail raised and an armboard bracket fitted to the rail, and the monitoring lines run off the chest and hook over the same rail. The C-arm completed its full spin without striking any of it.',
  },
  {
    id: 'tool-confirmation-practice-1',
    sectionId: 'tool-confirmation',
    presentationTitle: 'Needle fragments on axial images',
    situation:
      'A CBCT spin has finished and the volume is open on the review monitor. A needle with a side-cutting window has been advanced out of the catheter, and nothing has moved since the acquisition. The lesion outline is visible on the images. Scrolling the axial images, a short bright segment of metal appears on a few consecutive images and disappears above and below them, and on each of those images it stops short of the lesion outline. The question is whether the needle has advanced far enough.',
  },
  {
    id: 'changing-anatomy-practice-1',
    sectionId: 'changing-anatomy',
    presentationTitle: 'New opacity on the repeat CBCT',
    situation:
      'A peripheral nodule has been sampled once and the needle is withdrawn into the sheath. A small amount of blood is suctioned and clears. A repeat CBCT spin shows a soft, ill-defined opacity around the nodule that was absent on the first volume, and the stored contour from that volume still sits on the earlier border. Ventilator settings have not changed, oxygenation and hemodynamics are stable, and nothing was adjusted between the two acquisitions.',
  },
  {
    id: 'staff-protection-practice-1',
    sectionId: 'staff-protection',
    presentationTitle: 'Where to stand for a lateral projection',
    situation:
      'A steep lateral projection is set up for a peripheral airway task. The X-ray tube is on the near side of the table and the flat-panel detector on the far side. A fellow steadying the bronchoscope stands beside the tube housing in an apron and thyroid shield, hands well outside the irradiated field. The room’s shielding plan lists three standing positions for this setup, beside the tube housing, farther back on the same side, and across on the detector side, and the bronchoscope can be steadied from any of them.',
  },
  {
    id: 'dose-reporting-practice-1',
    sectionId: 'dose-reporting',
    presentationTitle: 'Dose notification during the case',
    situation:
      'Partway through a peripheral nodule procedure, the console posts a notification tied to the cumulative reference air kerma, reported in mGy. The dose summary lists it beside the kerma–area product in Gy·cm² and a separate line for the CBCT spins. Fluoroscopy has been used from several angles, including steep obliques. Sampling has not begun, and more imaging is planned.',
  },
]

export function practiceItemId(caseId: string): string {
  return `practice:${caseId}`
}

export function practiceActivityId(sectionId: ImagingSectionId): string {
  return `${PRACTICE_ACTIVITY_ID}:${sectionId}`
}

export const imagingMicroCases: readonly ImagingMicroCase[] = MICRO_CASE_DEFINITIONS.map(
  (definition) => {
    const question = QUESTION_BY_ID[definition.id]
    if (!question) throw new Error(`Unknown practice case ${definition.id}`)
    return {
      id: definition.id,
      sectionId: definition.sectionId,
      presentationTitle: definition.presentationTitle,
      situation: definition.situation,
      item: toClinicalLearningItem(question, {
        id: practiceItemId(definition.id),
        activityId: practiceActivityId(definition.sectionId),
        phase: 'predict',
      }),
    }
  },
)

export const imagingMicroCaseById: ReadonlyMap<string, ImagingMicroCase> = new Map(
  imagingMicroCases.map((microCase) => [microCase.id, microCase] as const),
)

/** The cases paired to a section, in authored order. */
export function microCasesForSection(sectionId: ImagingSectionId): readonly ImagingMicroCase[] {
  return imagingMicroCases.filter((microCase) => microCase.sectionId === sectionId)
}

/** The cases in pathway order, so Practice lists them the way the course teaches them. */
export function imagingMicroCasesInPathwayOrder(): readonly ImagingMicroCase[] {
  return peripheralImagingSectionIds.flatMap((sectionId) => microCasesForSection(sectionId))
}

/**
 * How much longer the keyed choice may be than the longest distractor before length alone starts
 * to give it away. A quarter again is generous; beyond it the key is the one that "looks like the
 * careful answer" whether or not the learner knows why.
 */
const KEY_LENGTH_TOLERANCE = 1.25

export function validateImagingMicroCases(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const stems = new Map<string, string>()

  for (const sectionId of peripheralImagingSectionIds) {
    for (const item of [
      imagingStageItems[sectionId].prediction,
      imagingStageItems[sectionId].transfer,
    ]) {
      stems.set(item.stem.trim().toLowerCase(), `the ${sectionId} section`)
    }
  }

  for (const microCase of imagingMicroCases) {
    const where = `Practice case ${microCase.id}`
    if (ids.has(microCase.id)) errors.push(`${where} is declared twice.`)
    ids.add(microCase.id)

    if (!isImagingSectionId(microCase.sectionId)) {
      errors.push(`${where} pairs to an unknown section.`)
    }

    errors.push(
      ...imagingLearnerCopyErrors(`${where} title`, microCase.presentationTitle, {
        allowDigits: false,
      }),
      ...imagingLearnerCopyErrors(`${where} situation`, microCase.situation),
    )

    if (microCase.item.evidenceIds.length === 0) {
      errors.push(`${where} cites no source.`)
    }

    const stem = microCase.item.stem.trim().toLowerCase()
    const clash = stems.get(stem)
    if (clash) errors.push(`${where} repeats the stem already used by ${clash}.`)
    stems.set(stem, where)

    const keyedId = microCase.item.correctChoiceIds[0]
    const keyed = microCase.item.choices.find((choice) => choice.id === keyedId)
    const distractors = microCase.item.choices.filter((choice) => choice.id !== keyedId)
    if (!keyed) {
      errors.push(`${where} has no keyed choice.`)
      continue
    }
    if (microCase.item.choices.length !== 3) {
      errors.push(`${where} must offer three choices.`)
    }
    const longestDistractor = Math.max(...distractors.map((choice) => choice.label.length), 0)
    if (keyed.label.length > longestDistractor * KEY_LENGTH_TOLERANCE) {
      errors.push(
        `${where} keys the longest choice by a margin: ${keyed.label.length} characters against ${longestDistractor}. Length alone points at it.`,
      )
    }
    if (distractors.some((choice) => !choice.rationale?.trim())) {
      errors.push(`${where} has a distractor with no reasoning of its own.`)
    }

    const firstWords = keyed.label.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
    if (firstWords && microCase.presentationTitle.toLowerCase().includes(firstWords)) {
      errors.push(`${where} title repeats its keyed answer.`)
    }
  }

  return errors
}

const microCaseErrors = validateImagingMicroCases()
if (microCaseErrors.length > 0) {
  throw new Error(`The imaging practice cases are invalid:\n${microCaseErrors.join('\n')}`)
}
