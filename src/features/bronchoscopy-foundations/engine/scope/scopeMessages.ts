import type { AirwayLabel } from '../../components/scope/types'

/**
 * What the engine says on the scene when it refuses, redirects or confirms a command, and what a
 * scripted speaker says. Learner-facing copy: every string passes the course's copy gate
 * (checked in `__tests__/scope-engine.test.ts`), and every scripted line says it is scripted.
 */
export const SCOPE_MESSAGES = {
  aimRefused:
    'Aim the tip into one opening before advancing: the aim guard will not choose a branch for you.',
  lumenEnd:
    'The teaching model ends here, one generation inside this segment. Withdraw to continue.',
  entryRefused: (label: AirwayLabel) =>
    `A scripted narrowing: the scope cannot be advanced safely into ${label}. Record what the view allows.`,
  wallFromBend: 'The bent tip is against the wall. Reduce the bend or withdraw before advancing.',
  wallContact: 'Wall contact. Withdraw or redirect the tip.',
  advancedInRedOut:
    'The field is red because the lens is against the mucosa; advancing only pushes into the wall.',
  suctionInRedOut:
    'Suction with the lens against the mucosa draws the wall in; the field stays red.',
  redOutRecovered: 'The lumen is back in view.',
  advancedBlind: 'The scope moved without a clear view.',
  lensCleared: 'The lens is clear again.',
  lensAlreadyClear: 'The lens is already clear.',
  foldsNotApart:
    'The true folds are not apart. Wait for the breath in rather than pushing against them.',
  alignWithGlottis: 'Align the tip with the opening between the folds before advancing.',
  tubeWall: 'The bent tip meets the tube wall. Straighten it before advancing along the tube.',
  tubeStart: 'The scope is at the start of the tube.',
  historyLimit: 'The recorded insertion path is full. Withdraw to continue.',
  captured: 'Image captured.',
  exposeInChannel:
    'Expose it only beyond the tip, where it can be seen; exposed inside the channel it can damage the scope.',
  retrieveExposed:
    'It is still exposed: drawing it into the channel now can damage the scope. Check the image first.',
  loadExposed: 'Load it protected: an exposed accessory can damage the channel on the way in.',
  noAccessory: 'No accessory is loaded.',
  wrongAccessory: (kind: string) => `The loaded accessory is a ${kind}.`,
  cannotSeeAccessory:
    'Inside the channel the accessory cannot be seen. Check it where the image shows it.',
  accessoryChecked: (words: string) => `Checked against the image: ${words}.`,
  reportDisagrees: (words: string) =>
    `The image shows ${words}. The assistant’s report and the image disagree.`,
  assistNotOffered: 'That help is not offered on this step.',
  noSuchOpening: 'That opening is not ahead of the tip.',
  labelsNotOffered: 'In-view labels are not offered on this step.',
  controlNotOffered: 'That control is not offered on this step.',
  labelsWithheld: 'In-view labels stay off until the view is identified again from a landmark.',
} as const

/** Scripted speech, shown on the scene and always marked as scripted (§23.4). */
export const SCRIPT_REPORTS = {
  holdForImage:
    'Assistant (scripted): “Can you hold there? An image of the carina is needed for the report.”',
  holdThanks: 'Assistant (scripted): “Thank you — hold steady until the image is done.”',
  holdDone: 'Assistant (scripted): “That’s the image. Thank you.”',
  misreportSheathed: 'Assistant (scripted): “The brush is back in its sheath.”',
  sheathedNow: 'Assistant (scripted): “Sheathed now.”',
  misreportProtected: 'Assistant (scripted): “It is protected.”',
  protectedNow: 'Assistant (scripted): “Protected now.”',
} as const
