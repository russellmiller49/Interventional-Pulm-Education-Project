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
    presentationTitle: 'A large patient, a grey picture',
    situation:
      'A large patient is on the table and a catheter sits in the right lower lobe. The shutters are open to the edges of the panel, so most of the chest is on the monitor. The catheter edge is crisp and the background is smooth rather than speckled, but the whole picture reads flat, and the diaphragm, the vessels and the lesion all sit at nearly the same grey.',
  },
  {
    id: 'signal-practice-2',
    sectionId: 'signal',
    presentationTitle: 'Worse picture after the angle change',
    situation:
      "After a planned angle change the lesion sits clear of the mediastinum, and the needle is in view. The image now looks washed out rather than grainy, with edges low in contrast across the whole picture. The shutters are still where they were for the frontal view and take in most of the hemithorax, and the patient's arm lies across the beam well away from the lesion. The display window and the monitor brightness are set where they were before the rotation.",
  },
  {
    id: 'field-practice-1',
    sectionId: 'field',
    presentationTitle: 'A hazy picture, a still tool',
    situation:
      "A peripheral airway is being worked under live fluoroscopy with the C-arm frontal. The picture is even and low in contrast — the sheath markings blend into the lung behind them — and it is not grainy. The frame includes the shoulder and the upper abdomen alongside the working segment, the unit is on the room's default low-dose fluoroscopy setting, and the room's standard preset and display window are in use and unchanged. The tool is stationary and the target sits mid-screen.",
  },
  {
    id: 'field-practice-2',
    sectionId: 'field',
    presentationTitle: 'A tight view and a lost landmark',
    situation:
      'The team stops to re-orient the sheath in the thorax before going further. The screen holds the last frame: the sheath tip and a short length of airway, sharp, with little grain, and nothing beyond a plain narrow border that carries no blade edge or collimator graphic to read. The pedal is off. Nobody at the table remembers whether the shutters were brought in earlier or the picture was cropped at the workstation.',
  },
  {
    id: 'time-practice-1',
    sectionId: 'time',
    presentationTitle: 'The tool jumps as it advances',
    situation:
      'A sheath is being advanced toward a peripheral target under live fluoroscopy. As it moves, the tool shows up at a series of separated positions rather than gliding forward. Images held still from that run show a clean tool edge and a well-defined tip. When the hand stops on the advance, the picture settles at the same moment.',
  },
  {
    id: 'two-dimensional-practice-1',
    sectionId: 'two-dimensional',
    presentationTitle: 'Tissue on one side, snow on the other',
    situation:
      'A solid peripheral target in the right lower lobe was planned on the CT, and the sheath has been advanced along the planned airway. The radial probe at the far end of the sheath shows tissue filling one side of its picture and a uniform snowstorm on the other. Fluoroscopy from a frontal and an oblique direction shows the sheath tip in the branch marked on the plan, with no separately visible lesion. Nothing has been sampled.',
  },
  {
    id: 'dts-acquisition-practice-1',
    sectionId: 'dts-acquisition',
    presentationTitle: 'The tip sits over the nodule',
    situation:
      'A faint nodule in the right lower lobe sits under the catheter tip on the frontal image, and the two stay together while the tool is held still. A rib edge crosses the target on that same image. With the robot docked and the drapes up, the arm still angles a short way either side of frontal, and within that arc the console will take single images at chosen angles, a short series taken across it, or the frontal image again in a finer detector mode. Grain and brightness are acceptable, the field is closed around the target, and the anesthesia team can hold ventilation briefly for whichever of the three is taken.',
  },
  {
    id: 'dts-acquisition-practice-2',
    sectionId: 'dts-acquisition',
    presentationTitle: 'Bright on the same plane',
    situation:
      "A needle has been advanced toward a peripheral nodule in the right lower lobe, and one sweep has been taken across the arc the arm travels, with the tool still and the breath held throughout. Stepping the planes it built: the nodule comes up brightest on one of them, the needle tip is bright on that same plane, and so is a vessel crossing the region. The vessel holds its brightness through the neighbouring planes and never narrows onto one. The tip's own brightness peaks on a plane slightly shallower than the nodule's.",
  },
  {
    id: 'dts-interpretation-practice-1',
    sectionId: 'dts-interpretation',
    presentationTitle: 'Reading the second monitor',
    situation:
      'A robotic catheter was parked in a subsegmental airway of the right lower lobe before the sweep was run and has not been moved since; live fluoroscopy resolves its distal end cleanly. The second monitor carries a reconstructed view of that region, where the lesion holds fine lobulated margins much as it did on the planning scan open on the adjacent display. The operator scrolls the reconstructed planes through the airway and through the lesion, and the catheter is on none of them. The gantry and the table have not moved since the sweep.',
  },
  {
    id: 'cbct-acquisition-practice-1',
    sectionId: 'cbct-acquisition',
    presentationTitle: 'The volume in hand before sampling',
    situation:
      'The table was moved to give the robot arm room, and the spin was run from that position. On the reconstructed slices the catheter and the needle are sharp, edges are single throughout, and the needle sits against the near part of the nodule. The far side of the nodule runs up to the upper edge of the reconstruction and carries on beyond it.',
  },
  {
    id: 'fixed-suite-practice-1',
    sectionId: 'fixed-suite',
    presentationTitle: 'After the needle was repositioned',
    situation:
      'You are in an installed cone-beam suite. A spin earlier in the case defined the nodule, and the room carries that contour onto the images it displays, live fluoroscopy included; the live image is up in the projection the case has been working in. The needle has since been repositioned, and the team wants to know where its sampling end sits against the nodule. The console holds the presets it always holds: the fluoroscopic modes the case has been using, and chest studies that turn a full orbit around the patient.',
  },
  {
    id: 'mobile-suite-practice-1',
    sectionId: 'mobile-suite',
    presentationTitle: 'The first spin in this room',
    situation:
      "The mobile scanner has been wheeled into the bronchoscopy room and its first rotational acquisition is up on the workstation. Dark and bright bands fan across the reconstructed slices, and the nodule margin breaks apart where they cross it. The patient is on the room's own procedure table, its side rail raised and an armboard bracket fitted to that rail, with the monitoring lines running off the chest and hooked over the same rail. The arc completed its full sweep without striking any of it.",
  },
  {
    id: 'tool-confirmation-practice-1',
    sectionId: 'tool-confirmation',
    presentationTitle: 'Metal that comes and goes',
    situation:
      'A rotational acquisition has finished and the volume is open on the review monitor. A side-window needle has been advanced out of the catheter, and nothing has been moved since the acquisition. The target outline is visible on the images in front of the team. As they scroll the axial images, a short bright piece of metal appears on a few consecutive images and is gone above and below them, and on each of those it stops short of the target outline. The question in the room is whether the needle has reached far enough.',
  },
  {
    id: 'changing-anatomy-practice-1',
    sectionId: 'changing-anatomy',
    presentationTitle: 'The second volume looks different',
    situation:
      'A peripheral nodule has been sampled once and the needle is now withdrawn into the sheath. A small amount of blood is suctioned and then clears. A repeat rotational acquisition shows a soft, ill-defined region around the nodule that was absent on the first volume, and the stored contour from that volume still sits on the earlier border. Ventilation settings have not been changed and oxygenation and hemodynamics are stable; no adjustment was made between the two acquisitions.',
  },
  {
    id: 'staff-protection-practice-1',
    sectionId: 'staff-protection',
    presentationTitle: 'A steep lateral at the bedside',
    situation:
      "A steep lateral projection is set up for a peripheral airway task. The X-ray tube sits on the near side of the table and the flat detector on the far side. A fellow steadying the bronchoscope stands beside the tube housing in an apron and thyroid shield, hands well clear of the irradiated field. The room's shielding plan lists three standing positions for this setup — beside the housing, farther back on the same side, and across on the detector side — and the bronchoscope can be steadied from any of them.",
  },
  {
    id: 'dose-reporting-practice-1',
    sectionId: 'dose-reporting',
    presentationTitle: 'A notification partway through the case',
    situation:
      'Partway through a peripheral nodule procedure, the console posts a notification tied to the cumulative reference air kerma line, which it reports in mGy. The summary panel prints that line beside a kerma–area product in Gy·cm² and a separate line for the rotational acquisitions. The beam has worked from several angles, including steep obliques. Sampling has not begun, and more imaging is planned.',
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
