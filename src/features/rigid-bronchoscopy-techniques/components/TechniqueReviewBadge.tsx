import { REVIEW_STATUS_META } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'
import type { RigidBronchoscopyClip } from '@/features/rigid-bronchoscopy-techniques/types'

/**
 * Development / admin only. Surfaces a clip's review status and verification
 * flags so draft media is never mistaken for approved content. This component
 * must not be rendered on a production learner route.
 */
export function TechniqueReviewBadge({ clip }: { clip: RigidBronchoscopyClip }) {
  const meta = REVIEW_STATUS_META[clip.reviewStatus]
  const leftRight =
    clip.anatomicalSide === 'not-applicable'
      ? 'n/a'
      : clip.leftRightVerified
        ? 'verified'
        : 'unverified'

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="technique-review-badge">
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${meta.className}`}
      >
        {meta.label}
      </span>
      {meta.isDraft ? (
        <span className="font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
          Draft — not for clinical use
        </span>
      ) : null}
      <span className="text-muted-foreground">
        Medical accuracy: {clip.medicalAccuracyVerified ? 'verified' : 'unverified'} · Left/right:{' '}
        {leftRight}
      </span>
    </div>
  )
}
