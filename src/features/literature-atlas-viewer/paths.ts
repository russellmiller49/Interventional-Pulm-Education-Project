/**
 * The Literature Atlas draft-evidence viewer: a direct-link page under the already unlisted
 * `/literature-atlas` prefix, opened with one shared viewer password (no site account). It is not
 * physician-reviewer sign-in, which stays in the separate review portal.
 */

export const VIEWER_PAGE_PATH = '/literature-atlas/evidence'
/** The main Atlas page, which the whole-Atlas gate (LITERATURE_ATLAS_GATE_ALL) protects. */
export const ATLAS_PAGE_PATH = '/literature-atlas'
export const VIEWER_SESSION_ENDPOINT = '/api/literature-atlas-viewer/session'
export const VIEWER_SESSION_END_ENDPOINT = '/api/literature-atlas-viewer/session/end'
/** The Atlas's draft evidence pages, through the same-origin relay. */
export const EVIDENCE_ENTRY = '/api/literature-atlas/evidence-domains'

/** Where the session form returns after sign-in; only these two values are ever accepted. */
export type ViewerReturn = 'atlas' | 'evidence'

export function viewerReturn(value: FormDataEntryValue | string | null | undefined): ViewerReturn {
  return value === 'atlas' ? 'atlas' : 'evidence'
}

export type ViewerState = 'denied' | 'limited' | 'ended'

export function viewerState(value: string | string[] | undefined): ViewerState | null {
  return value === 'denied' || value === 'limited' || value === 'ended' ? value : null
}

export const VIEWER_WORDS = {
  course: 'Literature Atlas',
  title: 'Draft evidence',
  intro:
    'Machine-drafted evidence and meta-analyses for the program’s clinical questions, shared with a small working group. ' +
    'Nothing here has been verified by a physician or accepted for any use, and it is not clinical guidance.',
  passwordLabel: 'Viewer password',
  open: 'View draft evidence',
  help: 'No website account is needed. This is not physician-reviewer sign-in; reviewers sign in separately in the review portal.',
  messages: {
    denied: 'That password is not right.',
    limited: 'Too many attempts. Wait a few minutes and try again.',
    ended: 'You have left the draft evidence.',
  } satisfies Record<ViewerState, string>,
  unavailable: 'The draft evidence is not available right now.',
} as const

/** Wording for the whole-Atlas gate on the main page. */
export const ATLAS_WORDS = {
  title: 'Literature Atlas',
  intro:
    'The Literature Atlas is in private preview. Enter the viewer password to open it. ' +
    'Its machine-generated study briefs are unverified by a physician unless labeled, and nothing here is clinical guidance.',
  open: 'Open the Literature Atlas',
  unavailable: 'The Literature Atlas is not available right now.',
} as const
