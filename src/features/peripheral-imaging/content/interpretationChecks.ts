import type { Question } from '../types'
import type { ImagingSectionId } from './pathway'

/** New items, not replacements under historical scored IDs. Authored 2026-09-13; faculty review pending. */
export const INTERPRETATION_CHECKS: Partial<Record<ImagingSectionId, Question>> = {
  projection: {
    id: 'projection-interpretation-v2',
    objective: 'optimize',
    stem: 'In this new authored configuration, inspect the projection. Which conclusion about the actual sampling component is justified?',
    choices: [
      {
        id: 'a',
        text: 'The view establishes the sampling component within the intended lesion.',
        rationale:
          'A projected tip and target cannot establish the full sampling component in depth. This image also shows an apparent mismatch.',
      },
      {
        id: 'b',
        text: 'The view raises a mismatch; sampling position still needs confirmation.',
        rationale:
          'The apparent relationship depends on the projection. Use appropriate additional views or volumetric imaging to assess the actual sampling component and intended lesion.',
      },
      {
        id: 'c',
        text: 'Enlarging this stored view will establish the sampling depth.',
        rationale: 'Display zoom enlarges the image but does not resolve the depth uncertainty.',
      },
    ],
    correct: 'b',
    takeaway:
      'A changed view can reveal mismatch without moving the tool. Even overlap in multiple projections is not a universal guarantee of sampling position.',
    sources: ['setser', 'tg272'],
  },
  signal: {
    id: 'signal-interpretation-v2',
    objective: 'optimize',
    stem: 'Image B was made at the same projection as A. In the wide-field example, the diaphragm, vessels and target are nearly the same gray, with a smooth background and sharp tool edge. Which limitation and response best fit these contextual clues?',
    choices: [
      {
        id: 'a',
        text: 'Quantum noise; use display zoom to restore missing photons.',
        rationale:
          'The contextual clues emphasize smooth contrast loss. Zoom neither supplies photons nor restores acquired signal.',
      },
      {
        id: 'b',
        text: 'Superimposition; raising pulse rate separates overlapping anatomy.',
        rationale:
          'Pulse rate changes temporal sampling, not anatomical superimposition. A changed projection can address overlap.',
      },
      {
        id: 'c',
        text: 'Scatter-related contrast loss; review field size and beam path.',
        rationale:
          'Wide-field smooth contrast loss supports this interpretation in the conceptual example. Collimation retaining the required anatomy and beam-path review address possible scatter contributors. Appearance alone is not definitive.',
      },
    ],
    correct: 'c',
    takeaway:
      'Noise, scatter-related contrast loss and superimposition need different responses. A clearer tool image does not establish lesion identity or location.',
    sources: ['tg125', 'tg272', 'wabip'],
  },
  field: {
    id: 'field-interpretation-v2',
    objective: 'optimize',
    stem: 'Compare A and B. The circular target, both numbered landmarks and the full dashed tool excursion must remain visible. Which option is supported?',
    choices: [
      {
        id: 'a',
        text: 'Retain A for this task, then optimize its field with the required context visible.',
        rationale:
          'Field selection must retain the target, planned excursion and landmarks. Smaller is not sufficient evidence of better optimization.',
      },
      {
        id: 'b',
        text: 'Retain B because its smaller irradiated area establishes adequate information.',
        rationale:
          'A model area percentage cannot establish adequate coverage or patient dose. This field loses context required by the task.',
      },
      {
        id: 'c',
        text: 'Retain B and use stored-image zoom to recover its excluded landmark.',
        rationale:
          'Zoom enlarges acquired information. It cannot recover anatomy excluded from the acquisition.',
      },
    ],
    correct: 'a',
    takeaway:
      'Physical collimation changes acquisition. Crop and zoom change stored-image display and do not retrospectively change its exposure.',
    sources: ['tg272', 'tg125', 'wabip'],
  },
  time: {
    id: 'time-interpretation-v2',
    objective: 'optimize',
    stem: 'Compare the acquired positions and amber blur bars in examples A and B. Tool speed is fixed. Which acquisition change accounts for the comparison?',
    choices: [
      {
        id: 'a',
        text: 'Longer pulse width at the original pulse rate.',
        rationale:
          'Width changes within-frame motion travel. At the same rate, gaps between pulse starts do not increase.',
      },
      {
        id: 'b',
        text: 'Lower pulse rate at the original pulse width.',
        rationale:
          'A longer interval permits more travel between acquired frames while fixed width and speed preserve within-frame blur.',
      },
      {
        id: 'c',
        text: 'Greater display refresh rate with unchanged acquisition.',
        rationale:
          'The monitor cannot create additional acquired positions by refreshing more often.',
      },
    ],
    correct: 'b',
    takeaway:
      'Choose temporal settings for the motion and imaging task. The fixed-current model reports tube loading, not patient dose; image lag is not simulated.',
    sources: ['tg272', 'tg125', 'wabip'],
  },
  'two-dimensional': {
    id: 'two-dimensional-interpretation-v2',
    objective: 'optimize',
    stem: 'The second situation uses another projection and a restricted field. Inspect its marked excursion and numbered landmarks. What should the team address before accepting this as tool confirmation?',
    choices: [
      {
        id: 'a',
        text: 'Accept the visible tip and target as adequate confirmation for sampling.',
        rationale:
          'The sampling component and depth remain unconfirmed; required image context is also missing. The module never grants permission to biopsy.',
      },
      {
        id: 'b',
        text: 'Repeat this restricted view until the tool appears sharper.',
        rationale:
          'A sharper tool does not restore excluded context or establish lesion identity. Another exposure should have a defined information question.',
      },
      {
        id: 'c',
        text: 'Restore required context and obtain evidence of the sampling relationship.',
        rationale:
          'The restricted field loses required landmarks/excursion. Reassess the field and choose an additional view or modality for the remaining localization and sampling question.',
      },
    ],
    correct: 'c',
    takeaway:
      'Adequate information takes priority over minimum field, time or exposure counts. Navigation, radial EBUS, fluoroscopy, DTS and CBCT supply complementary evidence.',
    sources: ['setser', 'wabip'],
  },
  'tool-confirmation': {
    id: 'sampling-interpretation-v2',
    objective: 'verify',
    stem: 'Trace the intended lesion and green fictional sampling window in the new thin-plane configuration. What conclusion is supported?',
    choices: [
      {
        id: 'a',
        text: 'The sampling window is not established within the lesion by this review.',
        rationale:
          'The window is displaced off the lesion. Follow its extent across the linked thin views; the white tip and a slab impression are not interchangeable with the sampling window.',
      },
      {
        id: 'b',
        text: 'The white tip alone establishes the sampling window within the lesion.',
        rationale:
          'Tip position is a different geometric question from the window’s relationship to the intended lesion.',
      },
      {
        id: 'c',
        text: 'A matching thick-slab appearance would establish diagnostic tissue.',
        rationale:
          'A slab collapses depth. Even demonstrated tool–lesion intersection would not establish diagnosis, safe sampling or tissue adequacy.',
      },
    ],
    correct: 'a',
    takeaway:
      'Trace the sampling component in linked thin views. Model intersection is not a clinical safety decision or a diagnosis.',
    sources: ['setser', 'confirm'],
  },
  'dose-reporting': {
    id: 'dose-record-interpretation-v2',
    objective: 'protect',
    stem: 'The fictional report lists fluoroscopy KAP 4 Gy·cm², CBCT KAP 2 Gy·cm², combined KAP 6 Gy·cm² and cumulative reference air kerma 55 mGy. What should be recorded for the combined KAP?',
    choices: [
      {
        id: 'a',
        text: '12 Gy·cm², by adding both subtotals to the combined entry.',
        rationale:
          'The combined entry already includes both subtotals. Adding them again double counts exposure.',
      },
      {
        id: 'b',
        text: '6 Gy·cm², with both included modes identified.',
        rationale:
          'The two non-overlapping subtotals sum to the combined value. Preserve quantity, units and included modes when comparing records.',
      },
      {
        id: 'c',
        text: '55 mGy, because reference air kerma is another unit for KAP.',
        rationale:
          'Reference air kerma and KAP are different quantities. Neither is automatically peak skin dose or effective dose.',
      },
    ],
    correct: 'b',
    takeaway:
      'Compare like quantities with compatible units and included modes. Do not add totals to their own subtotals.',
    sources: ['wabip', 'aapm12'],
  },
}
