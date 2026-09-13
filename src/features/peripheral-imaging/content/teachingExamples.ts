import type { LabValues } from '../engine/labMetrics'
import type { LabId } from '../types'
import type { ImagingSectionId } from './pathway'

/** Authored examples, 2026-09-13. No setting here is a clinical target or a device specification. */
export interface TeachingExample {
  readonly title: string
  readonly look: string
  readonly values: LabValues
}
export interface TeachingDemonstration {
  readonly lab?: LabId
  readonly examples: readonly TeachingExample[]
}
const projection: readonly TeachingExample[] = [
  {
    title: 'Baseline · frontal overlap',
    look: 'The fictional tool and lesion are stationary, separated by 30 mm along the initial X-ray path. Their projections overlap: depth is collapsed onto the detector.',
    values: { orbit: 0, tilt: 0, depth: 30 },
  },
  {
    title: 'Change projection only',
    look: 'Parallax is the change in apparent relative position when the view changes. The tool and lesion have not moved. Compare the two projections; the oblique view shows their separation.',
    values: { orbit: 55, tilt: 0, depth: 30 },
  },
]
const field: readonly TeachingExample[] = [
  {
    title: 'Baseline · full acquisition field',
    look: 'Identify the target, dashed planned excursion and two context landmarks. The amber outline is the acquired field.',
    values: { field: 100, crop: false, cropWidth: 70, zoom: 1 },
  },
  {
    title: 'Physical collimation',
    look: 'The shutters, beam and acquired region narrow together. Check the planned excursion and landmarks before accepting this field. The percentage is geometry, not patient dose.',
    values: { field: 80, crop: false, cropWidth: 70, zoom: 1 },
  },
  {
    title: 'Crop the baseline stored frame',
    look: 'The full-field acquisition is retained. The dashed display border hides its periphery; it does not undo exposure. Compare the acquisition metadata.',
    values: { field: 100, crop: true, cropWidth: 70, zoom: 1 },
  },
  {
    title: 'Zoom the baseline stored frame',
    look: 'The same acquired information is enlarged. Its field, angle and exposure history are unchanged. Display zoom cannot recover missing depth information.',
    values: { field: 100, crop: false, cropWidth: 70, zoom: 1.5 },
  },
]
const time: readonly TeachingExample[] = [
  {
    title: 'Baseline · moving tool',
    look: 'Watch the sampled white tool at a fixed 20 mm/s: 7.5 pulses/s, 5 ms per pulse. Pause or Step to inspect acquired frames. The screen refresh is not the acquisition rate.',
    values: { rate: 7.5, width: 5, speed: 20 },
  },
  {
    title: 'Pulse width alone',
    look: 'Width doubles to 10 ms; rate and speed stay fixed. The amber within-frame travel doubles; the interval between pulses does not change.',
    values: { rate: 7.5, width: 10, speed: 20 },
  },
  {
    title: 'Pulse rate alone',
    look: 'Restore 5 ms, then halve rate to 3.75 pulses/s. Inter-frame travel increases at the same speed; within-frame blur stays the same.',
    values: { rate: 3.75, width: 5, speed: 20 },
  },
  {
    title: 'Combined example',
    look: 'Halved rate and doubled width preserve model tube loading at fixed 20 mA, but both blur and inter-frame travel increase. This is not a patient-dose calculation.',
    values: { rate: 3.75, width: 10, speed: 20 },
  },
  {
    title: 'Static localization',
    look: 'With the fictional tool stationary, the motion terms vanish. Select temporal settings for the task and use stored images to deliberate; the lowest setting is not automatically adequate during movement.',
    values: { rate: 3.75, width: 5, speed: 0 },
  },
]
const registration: readonly TeachingExample[] = [
  {
    title: 'Planning / initial current state',
    look: 'The planning target and initial current target agree in this example. This is a teaching state, not proof of registration in a patient.',
    values: { shift: 0, previous: 0, overlay: false, showCurrent: true },
  },
  {
    title: 'Saved contour · acquisition A',
    look: 'The teal contour was saved from acquisition A at zero displacement. Turning it on does not acquire a new image.',
    values: { shift: 0, previous: 0, overlay: true, showCurrent: true },
  },
  {
    title: 'Subsequent change · contour on',
    look: 'A rigid 20 mm displacement moves the current anatomy while the saved contour remains at acquisition A. This illustrates mismatch; it models neither atelectasis nor recruitment.',
    values: { shift: 20, previous: 0, overlay: true, showCurrent: true },
  },
  {
    title: 'Same current state · contour off',
    look: 'Turning off the old contour removes the annotation, not the anatomical change. Imaging can relocalize anatomy; it does not reverse atelectasis.',
    values: { shift: 20, previous: 0, overlay: false, showCurrent: true },
  },
  {
    title: 'Reassessment · acquisition B',
    look: 'Only a new modeled capture updates the contour to the changed state. Coordinate physiology with anesthesia and reassess localization when needed; no ventilation maneuver is simulated.',
    values: { shift: 20, previous: 20, overlay: true, showCurrent: true },
  },
]
const acquisition: readonly TeachingExample[] = [
  {
    title: 'Two scouts · one centered',
    look: 'The frontal scout is centered horizontally, but the orthogonal scout shows the depth offset. One satisfactory projection does not establish volume coverage.',
    values: { offsetX: 0, offsetDepth: 25 },
  },
  {
    title: 'Both scouts centered',
    look: 'Both offsets are corrected in the model. Coverage, equipment clearance, instrument/anesthesia state and protection remain learner-declared checks; there is no collision detection.',
    values: { offsetX: 0, offsetDepth: 0 },
  },
  {
    title: 'Movement requires rechecking',
    look: 'A subsequent table/setup shift changes the scout and invalidates prior readiness checks. Reassess the setup before an acquisition.',
    values: { offsetX: 18, offsetDepth: 0 },
  },
]
const sampling: readonly TeachingExample[] = [
  {
    title: 'Trace the actual sampling component',
    look: 'Follow the amber intended lesion and green fictional side window across linked thin axial, coronal and sagittal planes. The white tip is a different part of the tool.',
    values: {
      tipX: 10,
      tipY: 0,
      tipZ: 0,
      axial: 0,
      coronal: 0,
      sagittal: 0,
      slab: false,
      revealed: true,
    },
  },
  {
    title: 'Tip and window differ',
    look: 'The tip reaches the lesion but the sampling window extends behind it. Trace the green component, not just the white tip. These dimensions do not describe a real device.',
    values: {
      tipX: -5,
      tipY: 0,
      tipZ: 0,
      axial: 0,
      coronal: 0,
      sagittal: -15,
      slab: false,
      revealed: true,
    },
  },
  {
    title: 'Thick slab',
    look: 'The slab combines depths and can hide an off-plane relationship. Compare the next thin-plane view of the same geometry.',
    values: {
      tipX: 10,
      tipY: 15,
      tipZ: 0,
      axial: 0,
      coronal: 0,
      sagittal: 0,
      slab: true,
      revealed: false,
    },
  },
  {
    title: 'Same tool · thin planes',
    look: 'The window is displaced from the lesion. A model intersection describes geometry only; it is not a safe sampling decision or a guarantee of diagnostic tissue.',
    values: {
      tipX: 10,
      tipY: 15,
      tipZ: 0,
      axial: 0,
      coronal: 0,
      sagittal: 0,
      slab: false,
      revealed: true,
    },
  },
]

export function teachingDemonstration(id: ImagingSectionId): TeachingDemonstration | null {
  switch (id) {
    case 'chain-walk':
    case 'projection':
      return { lab: 'geometry', examples: projection }
    case 'good-image':
      return {
        lab: 'geometry',
        examples: [
          ...projection,
          ...field.slice(2).map((example) => ({
            ...example,
            values: { orbit: 0, tilt: 0, depth: 22, ...example.values },
          })),
        ],
      }
    case 'field':
      return { lab: 'field', examples: field }
    case 'time':
      return { lab: 'temporal', examples: time }
    case 'signal':
      return {
        lab: 'geometry',
        examples: [
          {
            title: 'CT superimposition · baseline',
            look: 'Use the matched conceptual examples to distinguish noise and contrast loss. Here, inspect which CT structures project across the target ray; photon statistics and scatter are not calculated.',
            values: { orbit: 0, tilt: 0, depth: 0 },
          },
          {
            title: 'CT superimposition · changed view',
            look: 'Only the beam angle changes. Compare anatomical silhouettes and the CT density bands along the target ray. The model does not score whether the heart clears the lesion.',
            values: { orbit: -35, tilt: 0, depth: 0 },
          },
        ],
      }
    case 'current-anatomy':
    case 'changing-anatomy':
      return { lab: 'registration', examples: registration }
    case 'cbct-acquisition':
    case 'fixed-suite':
    case 'mobile-suite':
      return { lab: 'acquisition', examples: acquisition }
    case 'tool-confirmation':
      return { lab: 'mpr', examples: sampling }
    case 'two-dimensional':
      return {
        lab: 'geometry',
        examples: [
          {
            title: 'Coached problem · locate before sampling',
            look: 'The navigation target comes from planning CT. Current imaging must establish the lesion location, and the actual biopsy tool still needs confirmation. First inspect the full field and trajectory.',
            values: { orbit: 0, tilt: 0, depth: 22, field: 100, crop: false, zoom: 1 },
          },
          {
            title: 'Change the view, retain context',
            look: 'The changed view reveals a mismatch. Collimate around the target while keeping the modeled excursion and landmarks. This field tracks the target center automatically; manual patient recentering is not modeled.',
            values: { orbit: 35, tilt: 0, depth: 22, field: 80, crop: false, zoom: 1 },
          },
          {
            title: 'Inspect the stored image',
            look: 'Zoom helps inspect the mark. It cannot identify the lesion or establish sampling depth. Decide whether another projection, DTS or CBCT would add the missing information. Radial EBUS and navigation remain complementary.',
            values: { orbit: 35, tilt: 0, depth: 22, field: 80, crop: false, zoom: 1.5 },
          },
        ],
      }
    case 'dts-acquisition':
    case 'dts-interpretation':
      return {
        lab: 'dts',
        examples: [
          {
            title: 'Acquisition arc',
            look: 'Play or Step through the limited-angle acquisition, then inspect the reconstructed plane. The labeled reconstruction illustration explains the difference from a broad CT orbit.',
            values: { sweep: 30, plane: 0 },
          },
          {
            title: 'Scroll through the fictional tool',
            look: 'This demonstration uses a tool at −18 mm in the parallel teaching model. Its focus changes with the selected plane; out-of-plane structures blur.',
            values: { sweep: 30, plane: -18 },
          },
          {
            title: 'Scroll through the fictional lesion',
            look: 'The demonstration lesion is centered at zero. Limited-angle depth uncertainty remains. Finer voxel spacing is not evidence of finer measured resolution.',
            values: { sweep: 30, plane: 0 },
          },
        ],
      }
    case 'staff-protection':
      return {
        lab: 'safety',
        examples: [
          {
            title: 'Patient, source and exposure path',
            look: 'Inspect the patient as the scatter source, the tube side and staff position. Rings illustrate an idealized point-source distance relationship, not calibrated staff dose or a safe-distance boundary.',
            values: { distance: 1.3, orbit: 0, shield: false },
          },
          {
            title: 'Distance and barrier',
            look: 'Compare the exposure path after moving farther away and adding the barrier. Barrier placement, access and equipment-specific protection still require local review.',
            values: { distance: 2, orbit: 0, shield: true },
          },
        ],
      }
    case 'dose-reporting':
      return {
        lab: 'dose',
        examples: [
          {
            title: 'Worked KAP arithmetic',
            look: 'The fictional uniform field has 10 mGy air kerma over 100 cm²: 1 Gy·cm² KAP. This is not peak skin dose or effective dose.',
            values: { kerma: 10, area: 100 },
          },
          {
            title: 'Same kerma · different area',
            look: 'Doubling the fictional field area doubles the arithmetic product at fixed kerma. Real automatic exposure response and patient dose are not represented.',
            values: { kerma: 10, area: 200 },
          },
        ],
      }
    default:
      return null
  }
}

/** Separate, authored image states. The lesson controller never writes them into learner lab history. */
export function independentValues(id: ImagingSectionId, round: 0 | 1): LabValues | null {
  if (id === 'projection')
    return {
      orbit: round ? 0 : -28,
      tilt: round ? 0 : 6,
      depth: round ? 0 : -16,
      field: 100,
      zoom: 1,
    }
  if (id === 'two-dimensional')
    return {
      orbit: round ? 0 : -30,
      tilt: 0,
      depth: round ? 22 : -18,
      field: round ? 100 : 45,
      crop: false,
      zoom: 1,
    }
  if (id === 'tool-confirmation')
    return {
      tipX: 5,
      tipY: 12,
      tipZ: -3,
      axial: -3,
      coronal: 0,
      sagittal: -5,
      slab: false,
      revealed: false,
    }
  return null
}
