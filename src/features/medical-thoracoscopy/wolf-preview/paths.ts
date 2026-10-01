/**
 * Addresses of the private manufacturer preview of the device explorer. Safe for pages: no
 * storage location, no credential and no reviewer name is here.
 */
export const WOLF_PREVIEW_PATH = '/medical-thoracoscopy/wolf-preview'
export const WOLF_PREVIEW_API = '/api/medical-thoracoscopy/wolf-preview'
export const WOLF_PREVIEW_SESSION_ENDPOINT = `${WOLF_PREVIEW_API}/session`
export const WOLF_PREVIEW_END_ENDPOINT = `${WOLF_PREVIEW_API}/session/end`

/** Models are asked for by id; the server maps an id to its private object. */
export function wolfPreviewModelUrl(id: string): string {
  return `${WOLF_PREVIEW_API}/models/${id}.glb`
}

export const REVIEW_STATES = ['denied', 'limited', 'ended'] as const
export type ReviewState = (typeof REVIEW_STATES)[number]

export function reviewState(value: unknown): ReviewState | null {
  return REVIEW_STATES.includes(value as ReviewState) ? (value as ReviewState) : null
}

export const WOLF_PREVIEW_WORDS = {
  course: 'Medical Thoracoscopy',
  title: 'Device Explorer — Manufacturer Review',
  intro: 'This private development preview is provided for Richard Wolf review.',
  codeLabel: 'Review code',
  open: 'Open preview',
  help: 'If your code is not accepted, contact the person who sent you this link.',
  messages: {
    denied: 'Review code not recognized.',
    limited: 'Too many attempts. Please wait a few minutes and try again.',
    ended: 'The preview has ended on this browser.',
  } satisfies Record<ReviewState, string>,
  unavailable: 'The private preview is temporarily unavailable. Please try again later.',
  signedIn: 'Private manufacturer preview',
  end: 'End preview',
  disclosure:
    'Development preview for manufacturer review. Parametric educational models; not manufacturer CAD. Device details remain subject to manufacturer fact-check.',
} as const
