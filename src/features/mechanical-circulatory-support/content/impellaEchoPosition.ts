import { clinicalLearningItemSchema } from '@/features/learning-module/activity/clinicalLearningItem'

import type { McsNumberId } from './teachingNumbers'

/**
 * Section 5: what an aligned Impella looks like on echo, and one malposition worked from the image.
 *
 * Every figure here is the manufacturer's, read from chapter 7 of the Impella CP (revision V) and
 * Impella 5.5 (revision L) instructions for use and held in the numbers register. Copy that names a
 * depth or a P-level must match a register row; `impella-echo-position.test.tsx` checks it. Neither
 * manual names an apical view or gives a centimetre figure for a 5.5 that is too deep, so neither
 * is taught.
 */

/** The register rows printed beside the long-axis picture, in reading order. */
export const MCS_ECHO_DEPTH_NUMBER_IDS = [
  'impella-cp-inlet-depth',
  'impella-cp-inlet-too-deep',
  'impella-55-inlet-depth',
] as const satisfies readonly McsNumberId[]

/** The row the worked example's first move rests on, shown once a move is chosen. */
export const MCS_ECHO_REPOSITION_NUMBER_ID = 'impella-reposition-p-level' satisfies McsNumberId

export const MCS_ECHO_POSITION = {
  title: 'Reading the position on echo',
  views:
    'Image the pump in a long-axis view that holds the aortic valve and the inlet in one plane: the parasternal long axis on transthoracic echo, or a long-axis view on TEE. Image it when the controller shows a position alarm, when the flow runs below the range for the P-level, when there are signs of hemolysis, and after the patient has been moved.',
  aligned: [
    'Inlet in the ventricle, angled toward the apex and away from the wall, clear of the papillary muscles and the mitral apparatus.',
    'Outlet well above the aortic valve. It is often not seen.',
    'Color Doppler: a dense mosaic of turbulence above the valve, at the outlet. A mosaic below the valve points to an outlet in the ventricle.',
  ],
  depthTitle: 'Inlet depth on the long-axis view',
  devices:
    'The two pumps are read from different landmarks. On the CP, measure from the annulus to the inlet. On the 5.5, find the cannula bend: it sits at the annulus, a bend past the annulus is too deep, and a bend short of it can let the pump slip back out of the ventricle. The 5.5 has no pigtail; on the CP, a pigtail close to the mitral valve goes with an inlet at the valve or in the aorta.',
  malpositions: [
    {
      id: 'too-deep',
      term: 'Too deep',
      finding:
        'Outlet across or near the valve, so both ends are in the ventricle. The pump moves blood around inside the ventricle instead of into the aorta, and an obstructed inlet causes hemolysis, often presenting as dark or blood-colored urine.',
    },
    {
      id: 'inlet-in-aorta',
      term: 'Inlet in the aorta',
      finding:
        'Inlet at or above the valve. The pump draws from the aorta, the ventricle is not unloaded, and suction is possible if the inlet lies against the aortic wall or a valve sinus.',
    },
  ],
} as const

/** The inlet depth measured in the worked example, in centimetres below the annulus. */
export const MCS_ECHO_WORKED_INLET_DEPTH_CM = 5

export const MCS_ECHO_WORKED_EXAMPLE = {
  title: 'Worked example: the morning after insertion',
  item: clinicalLearningItemSchema.parse({
    id: 'mcs.learn.impella-unloading-placement.echo-too-deep',
    activityId: 'mcs:learn:impella-unloading-placement',
    phase: 'recognize',
    itemType: 'management-decision',
    contextRequirement: 'context-independent',
    stem: `An Impella CP at P-8, the morning after it was placed in the catheterization laboratory and the patient moved to the unit. The displayed flow is below the range for P-8 and the urine has turned dark. On the parasternal long axis the inlet sits ${MCS_ECHO_WORKED_INLET_DEPTH_CM} cm below the aortic valve annulus, the outlet lies at the valve, and color Doppler shows a dense mosaic below the valve. What is your first move?`,
    choices: [
      {
        id: 'p2-then-reposition',
        label:
          'Bring the level down to P-2, have the inlet brought back to 3.5 cm below the annulus under echo, then return to P-8 and image again.',
        plausibility: 'best',
        rationale:
          'More than 4 cm deep, the outlet at the valve and the mosaic below it: both ends are in the ventricle. The pump is moving blood around inside the ventricle, and the obstructed inlet explains the dark urine. Support comes down to P-2 before the catheter moves, the position is corrected under imaging, and the level goes back up once the inlet is at 3.5 cm.',
      },
      {
        id: 'raise-level',
        label: 'Raise the level to P-9 to bring the flow back into range.',
        plausibility: 'unsafe',
        rationale:
          'The flow is low because the outlet is in the ventricle, not because the setting is low. A higher level moves no more blood into the aorta, and with hemolysis from a pump out of position the level goes the other way: down to P-2 while the catheter is repositioned.',
      },
      {
        id: 'fluid-bolus',
        label: 'Give a fluid bolus for suction, then recheck the flow.',
        plausibility: 'incorrect-mechanism',
        rationale:
          'Filling is the check once the position is acceptable. Here the image already explains the low flow and the dark urine: the inlet is too deep.',
      },
      {
        id: 'accept-depth',
        label: `Leave it where it is: ${MCS_ECHO_WORKED_INLET_DEPTH_CM} cm is the target inlet depth.`,
        plausibility: 'incorrect-mechanism',
        rationale:
          'About 5 cm is the Impella 5.5 target, read from its cannula bend at the annulus. The Impella CP target is 3.5 cm, and more than 4 cm is too deep.',
      },
    ],
    correctChoiceIds: ['p2-then-reposition'],
    explanation:
      'Read the depth against the pump in front of you: 3.5 cm for the CP, about 5 cm for the 5.5. A CP inlet more than 4 cm below the annulus, with the outlet at the valve and a mosaic below it, is too deep. Bring the level to P-2 before the catheter is moved, reposition under imaging, and check the inlet depth again before support goes back up.',
    evidenceIds: ['impella-cp-ifu-rev-v-supplied', 'impella-55-ifu-rev-l-supplied'],
    reviewStatus: 'draft',
  }),
} as const
