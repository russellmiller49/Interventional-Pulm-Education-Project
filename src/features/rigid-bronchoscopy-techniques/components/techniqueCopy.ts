import type { ClinicalReviewStatus } from '@/features/rigid-bronchoscopy-techniques/types'

/**
 * UI chrome strings for the technique-video module, centralized so they are
 * translation-ready. English-first: these can be migrated to next-intl message
 * IDs when the module is integrated into the localized curriculum (Phase 8).
 */
export const techniqueCopy = {
  moduleEyebrow: 'Rigid Bronchoscopy',
  moduleTitle: 'Technique Videos',
  moduleDescription:
    'Short, faculty-reviewed technique demonstrations for rigid bronchoscopy — positioning, intubation, scope manipulation, mainstem direction, and mechanical debulking.',
  standingDisclaimer:
    'This module supplements supervised simulation and clinical instruction. It does not independently credential a learner to perform rigid bronchoscopy.',
  syntheticLabel: 'Synthetic procedural visualization',
  awaitingProduction:
    'This clip is planned. Media appears here after generation and physician review.',
  noPublishedClips:
    'No approved technique videos are published yet. Every clip is in production and pending physician review.',
  draftPreviewNotice:
    'Development preview — draft and planned clips are shown with a review badge. Draft media is never shown on the production learner route.',
  objectiveLabel: 'Objective',
  safetyLabel: 'Safety',
  keyMovementLabel: 'Key movement rule',
  commonErrorLabel: 'Common error',
  durationLabel: 'Approx. duration',
  retrievalHeading: 'Check your understanding',
  chaptersHeading: 'Chapters',
  transcriptSummary: 'Transcript',
  transcriptUnavailable: 'A transcript will be available once narration is produced.',
  captionsLabel: 'English',
  panelExternal: 'External view',
  panelDiagram: 'Directional diagram / validated 3D',
  panelInternal: 'Synthetic internal consequence',
  videoUnavailable: 'Video resource coming soon',
} as const

export interface ReviewStatusMeta {
  label: string
  /** Tailwind classes for the badge chip. */
  className: string
  /** True when the status must carry a "draft — not for clinical use" caution. */
  isDraft: boolean
}

export const REVIEW_STATUS_META: Record<ClinicalReviewStatus, ReviewStatusMeta> = {
  planned: {
    label: 'Planned',
    className: 'border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-300',
    isDraft: true,
  },
  'generated-draft': {
    label: 'Generated draft',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    isDraft: true,
  },
  'faculty-review': {
    label: 'In faculty review',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    isDraft: true,
  },
  'revision-required': {
    label: 'Revision required',
    className: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    isDraft: true,
  },
  approved: {
    label: 'Approved',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    isDraft: false,
  },
  rejected: {
    label: 'Rejected',
    className: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
    isDraft: true,
  },
}
