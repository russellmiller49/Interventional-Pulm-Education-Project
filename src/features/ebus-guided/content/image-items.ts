import { question } from './authoring'
import type { Question } from './types'

/** Versioned interpretations; original item objects and recorded keys remain historical. */
export const IMAGE_INTERPRETATIONS: Record<string, Question> = {
  'image-depth': {
    ...question(
      'depth-observe-v2',
      'Compare the previous deep recording with your shallower view. What explains the larger displayed target?',
      [
        'The displayed depth range is smaller; the view still needs its far margin and surrounding context',
        'The recordings demonstrate field selection. A larger display alone does not establish a better examination or a different physical dimension.',
      ],
      [
        'The change demonstrates a different measured short-axis diameter',
        'No calibrated calipers were used in this depth task; screen occupancy is not a clinical measurement.',
      ],
      [
        'The larger display establishes that less tissue beyond the target is always preferable',
        'The far margin and relevant vessels must remain assessable; the smallest field is not automatically the useful one.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  'gain-contrast': {
    ...question(
      'gain-observe-v2',
      'Compare the previous recording with your current image. How should a change in border or internal-echo visibility be interpreted?',
      [
        'As a difference in displayed detail under the selected recorded settings',
        'Compare visible borders and intermediate echoes. Each recording changes one control; brightness alone does not determine pathology.',
      ],
      [
        'As proof that the second image is a different cross-sectional plane',
        'Gain and contrast change how the same plane is displayed; the scope did not move.',
      ],
      [
        'As evidence that maximum contrast preserves the most tissue information',
        'Strong dark-to-bright separation can remove intermediate detail; overall contrast alone is insufficient.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  doppler: {
    ...question(
      'doppler-observe-v2',
      'Compare the grayscale and color recordings. Which statement can be supported by the added color display?',
      [
        'The color represents detected flow in this recording and must be interpreted with the surrounding anatomy',
        'Identify where the color appears, then reconcile it with the anatomy before choosing a needle path.',
      ],
      [
        'Only the colored pixels need to be excluded from a planned needle path',
        'Vascular assessment includes the complete path and anatomy; detected color does not map every vessel.',
      ],
      [
        'A dark structure outside the color display has been shown to be avascular',
        'Flow may go undetected because of settings, angle, slow flow or poor contact.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  capture: {
    ...question(
      'capture-observe-v2',
      'Inspect your saved frame and calipers. What belongs in the capture record for this exercise?',
      [
        'The selected recorded frame and the two caliper positions, with clinical size and border accuracy unvalidated',
        'The actual capture preserves your positions. There is no scored expert border or calibrated short-axis measurement in this recording exercise.',
      ],
      [
        'A validated short-axis dimension because two distinct calipers were saved',
        'Distinct positions demonstrate control use, not correct borders, axis or calibration.',
      ],
      [
        'A station label, since a saved frame documents the station',
        'A label on a saved frame is only as good as the landmarks identified before freezing; none were established in this exercise.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
  'acoustic-contact': {
    ...question(
      'contact-observe-v2',
      'Compare the initial and current images. What accounts for the return of tissue echoes?',
      [
        'The transducer-to-wall relationship restored the acoustic window',
        'The actual comparison retains the initial and current frames. Tip flexion changed contact; gain stayed fixed.',
      ],
      [
        'The sector became usable because its gain automatically increased',
        'Tip flexion moved the transducer; gain was not changed.',
      ],
      [
        'Optical visualization of the wall alone established acoustic contact',
        'The optical and transducer-facing surfaces differ. A wall in the endoscopic view does not establish the ultrasound window.',
      ],
    ),
    imagePolicy: 'retained-acquisition',
  },
}
