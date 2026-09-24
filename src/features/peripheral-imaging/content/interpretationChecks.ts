import type { Question } from '../types'
import type { ImagingSectionId } from './pathway'

/**
 * The Section 6 check as it stood before Prompt 04 (QS-3). Superseded on screen by
 * `signal-interpretation-v3`, and kept verbatim in the bank so a record written under its id keeps
 * meaning what it meant: the legacy record parser recomputes a stored choice against the item it
 * names, and drops one whose item has gone (`engine/learnProgress.ts`).
 */
const SIGNAL_INTERPRETATION_V2: Question = {
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
}

/**
 * Checks no section renders any longer, kept in the bank under their own ids (OD4-05 versioning
 * rule, 2026-09-22): changed semantics get a new id, and the old item stays as it was.
 */
export const RETIRED_INTERPRETATION_CHECKS: readonly Question[] = [SIGNAL_INTERPRETATION_V2]

/**
 * New items, not replacements under historical scored IDs. Authored 2026-09-13; faculty review pending.
 *
 * Prompt 04 (owner decisions OD4-02 and OD4-05, 2026-09-22) adds three, each under a new id because
 * its stem evidence, choices or key wording changed: Section 1's `imaging-questions-interpretation-v2`
 * (QS-1), Section 6's `signal-interpretation-v3` (QS-3, text variant) and Section 16's
 * `changing-anatomy-interpretation-v2` (QS-4, text form). The questions they displace on screen —
 * `choose-1`, `signal-interpretation-v2` and `change-1` — stay in the bank unchanged. All three are
 * AI-drafted samples the owner approved as drafts, not clinically reviewed.
 */
export const INTERPRETATION_CHECKS: Partial<Record<ImagingSectionId, Question>> = {
  // QS-1: one feature of the worked example changes (an opacity is now visible on one projection),
  // and two options hedge, so the learner has to say which uncertainty remains. `choose-1`, the
  // worked example's twin, is still the optional review in Sections 2 and 4.
  'imaging-questions': {
    id: 'imaging-questions-interpretation-v2',
    objective: 'choose',
    stem: 'Navigation places the catheter at the virtual target. On the frontal fluoroscopic projection, a faint rounded opacity now overlaps the needle tip. No other projection has been taken. What does this evidence establish?',
    choices: [
      {
        id: 'a',
        text: 'The needle is in the lesion: the catheter reached the target and the needle overlaps the opacity.',
        rationale:
          'Overlap on one projection is superimposition until shown otherwise. A single projection collapses depth, so a needle can overlap an opacity while lying in front of it or behind it.',
      },
      {
        id: 'b',
        text: 'The catheter reached the navigation target; the opacity may be the lesion, and the needle’s depth relative to it is unconfirmed.',
        rationale:
          'Navigation shows the catheter relative to a target drawn on the planning CT; it does not show what lies there today. A faint opacity on one view is a candidate for the lesion, not proof of what it is or where it lies in depth. A separated second projection, DTS or CBCT can show where the lesion is now and how the needle relates to it.',
      },
      {
        id: 'c',
        text: 'The lesion is localized by the opacity; only the needle’s depth relative to it remains to be checked.',
        rationale:
          'It treats one faint opacity on one view as a localized lesion. Structures at other depths can overlap it, and its identity is not established.',
      },
    ],
    correct: 'b',
    takeaway:
      'Navigation target reached, lesion localized, tool-in-lesion confirmed and diagnostic tissue obtained are distinct endpoints.',
    sources: ['setser', 'confirm'],
  },
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
  // QS-3, text variant: every option pairs a real cause with that cause's real response, so the
  // learner has to decide the cause. The cartoon Images A and B stay beside it as optional
  // companions; the stem carries the evidence (the image variant waits for honest media, OD4-02).
  signal: {
    id: 'signal-interpretation-v3',
    objective: 'optimize',
    stem: 'Image B was made at the same projection as Image A, with the collimator open to the edges of the detector. In Image B the diaphragm, vessels and target are nearly the same gray; the background is smooth and the tool edge is sharp. Which limitation, and which response, fit Image B?',
    choices: [
      {
        id: 'a',
        text: 'Quantum noise from too few detected photons; raise output or select a higher-dose preset.',
        rationale:
          'That is the right response to noise, but the background here is smooth, not mottled. More output in the same wide field raises scatter along with the primary beam.',
      },
      {
        id: 'b',
        text: 'Anatomical superimposition; change the C-arm projection, planned from the CT.',
        rationale:
          'That is the right response to overlying anatomy, but superimposition lowers contrast where structures overlap and spares the rest. Here contrast is reduced everywhere, and a new projection keeps the same wide field.',
      },
      {
        id: 'c',
        text: 'Scatter-related contrast loss; collimate to the task while keeping the required anatomy.',
        rationale:
          'Quantum noise is random variation from too few detected photons and looks like mottle; scatter adds unwanted signal that lowers contrast; superimposition is real overlying structure. Here the loss of contrast is even across dense and soft structures, the background is smooth, the tool edge is sharp and the field is wide: the pattern fits scatter. Collimation reduces the irradiated volume that produces it. The panels are drawings: appearance alone does not settle the cause, so use the context as well.',
      },
    ],
    correct: 'c',
    takeaway:
      'Name the limiting factor before changing anything. Noise, scatter-related contrast loss and superimposition need different responses.',
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
          'The sampling component and its depth remain unconfirmed, and required image context is missing. A teaching image cannot clear a biopsy: that decision stays with the procedure team, with the real images and the patient in front of them.',
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
  // QS-4, text form: the stem describes the appearance and leaves the cause for the learner to
  // name; the distractors are the section's own other artifact families. The image beside it is
  // still the registration model, declared illustrative (`changing-anatomy:example:0`): the model
  // shows no motion artifact, and authentic motion media are deferred (OD4-06).
  'changing-anatomy': {
    id: 'changing-anatomy-interpretation-v2',
    objective: 'verify',
    stem: 'The first CBCT spin of the case is on the review monitor. The catheter and the nodule margin each appear twice, a few millimetres apart, on several planes. The table, the C-arm and the tool did not move between the start and the end of the spin. What should change before a second spin?',
    choices: [
      {
        id: 'a',
        text: 'Select a higher-dose protocol so the edges come out better defined.',
        rationale:
          'A degraded image invites more dose, but noise degrades the whole image, and more photons do not undo an inconsistency between projections.',
      },
      {
        id: 'b',
        text: 'Agree a stable, tolerable breath hold or ventilation pause with anesthesia, including who announces readiness and when to stop.',
        rationale:
          'Duplicated edges suggest motion. With the table, the C-arm and the tool still, the likely source is breathing or other patient motion during the spin. Plan the breath hold with anesthesia: agree the intended state, who announces readiness and the stopping criteria before it begins. Anesthesia safety governs the breath hold.',
      },
      {
        id: 'c',
        text: 'Turn on metal-artifact reduction for the catheter.',
        rationale:
          'There is metal in the field, but metal produces streaks near the metal. Doubled edges on the lesion as well as the catheter point to motion, and metal-artifact reduction is meant for streaks from metal that cannot be removed.',
      },
    ],
    correct: 'b',
    takeaway: 'Match the artifact to its cause before repeating the same acquisition.',
    sources: ['setser', 'tg272', 'vespa'],
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
