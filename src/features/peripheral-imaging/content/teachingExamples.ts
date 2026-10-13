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
    look: 'The tool and the lesion are stationary and 30 mm apart along the X-ray path. Their projections overlap: depth is collapsed onto the detector.',
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
    look: 'The open field takes in the spine and the mediastinum. Find the lesion, the dashed planned tool path and the two landmarks. The amber outline is the collimated field.',
    values: { field: 100, crop: false, cropWidth: 70, zoom: 1 },
  },
  {
    title: 'Physical collimation',
    look: 'The shutters close, and the beam and the exposed area narrow together. The planned tool path and both landmarks are still inside the field: this is the field for advancing the tool.',
    values: { field: 80, crop: false, cropWidth: 70, zoom: 1 },
  },
  {
    // Owner's teaching, 2026-10-11. 40% is past the width at which the spine leaves this field.
    title: 'Collimated to the lesion · spine out of the field',
    look: 'With the tool at the lesion the field is closed until the spine is outside it. Compare with the baseline: the lung, the lesion and the tool have more contrast, because less tissue is producing scatter and the display range is no longer spent on the spine.',
    values: { field: 40, crop: false, cropWidth: 70, zoom: 1 },
  },
  {
    title: 'Crop the baseline stored frame',
    look: 'The full field was still acquired. The dashed border only hides its periphery on the display; it does not undo the exposure. The caption under the image still reads field 100%.',
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
    look: 'Halving the rate and doubling the width leaves the tube load unchanged at a fixed 20 mA, while both the blur and the travel between frames increase. Tube load is not patient dose.',
    values: { rate: 3.75, width: 10, speed: 20 },
  },
  {
    title: 'Static localization',
    look: 'With the tool stationary, the motion terms vanish. Select temporal settings for the task and use stored images to deliberate; the lowest setting is not automatically adequate during movement.',
    values: { rate: 3.75, width: 5, speed: 0 },
  },
]
const registration: readonly TeachingExample[] = [
  {
    title: 'Planning / initial current state',
    look: 'The planning target and the lesion on current imaging agree here: there is no divergence yet.',
    values: { shift: 0, previous: 0, overlay: false, showCurrent: true },
  },
  {
    title: 'Stored contour · acquisition A',
    look: 'The teal contour was saved from acquisition A, before any displacement. Turning it on does not acquire a new image.',
    values: { shift: 0, previous: 0, overlay: true, showCurrent: true },
  },
  {
    title: 'Subsequent change · contour on',
    look: 'The anatomy has moved 20 mm since acquisition A, and the stored contour has not moved with it. The contour now marks where the lesion was.',
    values: { shift: 20, previous: 0, overlay: true, showCurrent: true },
  },
  {
    title: 'Same current state · contour off',
    look: 'Turning off the old contour removes the annotation, not the anatomical change. Imaging can relocalize anatomy; it does not reverse atelectasis.',
    values: { shift: 20, previous: 0, overlay: false, showCurrent: true },
  },
  {
    title: 'Reassessment · acquisition B',
    look: 'Only a new acquisition brings the contour to the current anatomy. Coordinate physiology with anesthesia and reassess localization when needed.',
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
    look: 'Both offsets are corrected. Coverage, equipment clearance, the instrument and anesthesia state, and radiation protection are still checked with the team before the spin.',
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
    look: 'Follow the amber lesion and the green side-cutting window across the linked thin axial, coronal and sagittal planes. The white tip is a different part of the tool.',
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
    look: 'The tip reaches the lesion but the sampling window extends behind it. Trace the green window, not just the white tip.',
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
    look: 'The window is displaced from the lesion: the thin planes show what the thick slab concealed.',
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
          ...field.slice(3).map((example) => ({
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
            look: 'Noise and scatter were compared on the earlier steps. Here, look at which structures project across the X-ray path through the lesion.',
            values: { orbit: 0, tilt: 0, depth: 0 },
          },
          {
            title: 'CT superimposition · changed view',
            look: 'Only the C-arm angle changes. Compare the anatomical silhouettes and the density bands along the X-ray path through the lesion.',
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
            look: 'The changed view reveals a mismatch. Collimate around the target while keeping the planned tool path and the landmarks in the field. The field stays centered on the target.',
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
            look: 'Play or Step through the limited-angle acquisition, then inspect the reconstructed plane. The reconstruction figure explains how this differs from a wide CT rotation.',
            values: { sweep: 30, plane: 0 },
          },
          {
            title: 'Scroll through the tool',
            look: 'The tool lies at −18 mm. It is sharp when the plane passes through it and blurs as the plane moves away, as does every other out-of-plane structure.',
            values: { sweep: 30, plane: -18 },
          },
          {
            title: 'Scroll through the lesion',
            look: 'The lesion is centered at 0 mm. With a limited arc its depth remains uncertain: finer voxel spacing is not finer measured resolution.',
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
            look: 'The patient is the scatter source. In lateral projections, positions on the detector side often receive less than the beam-entrance (tube) side, but a CBCT spin changes directions throughout. The rings show the inverse-square fall-off with distance from the patient; they are not measured staff doses or a safe-distance line.',
            values: { distance: 1.3, orbit: 0, shield: false },
          },
          {
            title: 'Distance and barrier',
            look: 'Compare the exposure path after moving farther away and adding the barrier.',
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
            look: 'A uniform field of 10 mGy air kerma over 100 cm² gives a KAP of 1 Gy·cm². KAP is not peak skin dose or effective dose.',
            values: { kerma: 10, area: 100 },
          },
          {
            title: 'Same kerma · different area',
            look: 'Doubling the field area at the same air kerma doubles the KAP. On a real system, automatic exposure control may change the air kerma when the field changes.',
            values: { kerma: 10, area: 200 },
          },
        ],
      }
    default:
      return null
  }
}

/**
 * Separate, authored image states. The lesson controller never writes them into learner lab history.
 *
 * These are the sections whose check and transfer rounds differ from each other. Sections whose
 * example is the same in both rounds are in `SECTION_FIXED_EXAMPLE` below. Resolve either through
 * `fixedExampleValues`, never directly: a fixed example must never fall back to learner state.
 */
export function independentValues(id: ImagingSectionId, round: 0 | 1): LabValues | null {
  // Section 10's check was drawn at sweep 20 / plane 10 until PR #279's sanity review (F3): it is
  // now a written check with no image, so it has no authored image state.
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

/**
 * The state every other section's fixed example is drawn at, authored from that section's own
 * question and demonstration rather than from whatever the learner last did.
 *
 * Report 2.1 (fellow walkthrough, PDF p.16/p.22): the "This example stays fixed" banner promised a
 * held image while the pane, having no authored state for the section, was handed the learner's own
 * lab values. A learner who set the C-arm to 47 degrees in the component walk then read a question
 * about a superimposed tool and nodule over an image that showed them apart. The state below is the
 * whole of the fix: it is fixed data, it cannot inherit a control, and it is the same on a first
 * visit, a retry and a deep link.
 *
 * Each entry names why it is what it is. None of them is a device setting or a clinical target.
 */
const SECTION_FIXED_EXAMPLE: Readonly<Partial<Record<ImagingSectionId, LabValues>>> = {
  // The stem describes a frontal image on which the tool and nodule are superimposed although they
  // are two centimetres apart along the X-ray path: zero obliquity, and 20 mm of depth offset.
  'chain-walk': { orbit: 0, tilt: 0, depth: 20 },
  // The stem reads a last-image-hold frame and asks which change alters what is acquired rather
  // than how it is displayed, so the example carries the section's own worked geometry with the
  // full acquired field and no display operation applied.
  'good-image': { orbit: 0, tilt: 0, depth: 22, field: 100, crop: false, cropWidth: 70, zoom: 1 },
  // The stem's situation is the section's own first demonstration, 'Two scouts · one centered':
  // centered on one view, offset in depth on the orthogonal one.
  'cbct-acquisition': { offsetX: 0, offsetDepth: 25 },
}

/**
 * The immutable authored state a fixed example is drawn at. Total by construction: it never returns
 * null, so no caller can fall back to the learner's own controls.
 *
 * Sections whose check renders self-contained panels or a text scenario resolve to the lab's own
 * defaults, which are themselves fixed data.
 */
export function fixedExampleValues(id: ImagingSectionId, round: 0 | 1): LabValues {
  const authored = independentValues(id, round)
  if (authored) return authored
  return { ...(SECTION_FIXED_EXAMPLE[id] ?? {}) }
}

/**
 * The identity of a fixed example: one section, one round, one authored image. Equal identities
 * must produce equal image and readout semantics whatever the learner did before arriving.
 */
export function fixedExampleIdentity(id: ImagingSectionId, round: 0 | 1): string {
  return `${id}:example:${round}`
}

/**
 * A fixed example always depicts its question: the learner can read the answer's evidence off the
 * image. A check whose scenario the section's suite cannot show either carries an image of its own
 * (a new dependent opacity in Section 4, doubled edges from motion in Section 16:
 * `INDEPENDENT_IMAGE_PANEL_SECTIONS`, drawn by `simulatedFindings.ts`) or is a written scenario with
 * no image (a hand in the primary beam in Section 17: `finish('record', 'case')`). It is never an
 * unrelated image with a disclaimer (owner follow-up, 2026-10-12).
 */
