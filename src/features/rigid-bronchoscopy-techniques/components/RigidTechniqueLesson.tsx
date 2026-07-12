import { TechniqueChapterList } from '@/features/rigid-bronchoscopy-techniques/components/TechniqueChapterList'
import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'
import { TechniqueReviewBadge } from '@/features/rigid-bronchoscopy-techniques/components/TechniqueReviewBadge'
import { TechniqueSafetyNotice } from '@/features/rigid-bronchoscopy-techniques/components/TechniqueSafetyNotice'
import { TechniqueTranscript } from '@/features/rigid-bronchoscopy-techniques/components/TechniqueTranscript'
import { TechniqueVideoPlayer } from '@/features/rigid-bronchoscopy-techniques/components/TechniqueVideoPlayer'
import { canPublishClip } from '@/features/rigid-bronchoscopy-techniques/lib/validation'
import type {
  MediaSourceType,
  RigidBronchoscopyClip,
  TechniqueLesson,
} from '@/features/rigid-bronchoscopy-techniques/types'

interface RigidTechniqueLessonProps {
  lesson: TechniqueLesson
  /** Clips belonging to this lesson (manifest order). */
  clips: RigidBronchoscopyClip[]
  /** Development / admin only. When true, planned and draft clips are shown with a review badge. */
  showDrafts?: boolean
}

function panelRole(sourceType: MediaSourceType): string {
  switch (sourceType) {
    case 'higgsfield-synthetic':
      return techniqueCopy.panelExternal
    case 'validated-3d-render':
      return techniqueCopy.panelDiagram
    case 'manikin-recording':
      return 'Manikin footage'
    case 'faculty-approved-clinical':
      return 'Faculty-approved clinical'
  }
}

function ClipBlock({ clip, showDrafts }: { clip: RigidBronchoscopyClip; showDrafts: boolean }) {
  const hasMedia = clip.videoPath.trim().length > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {panelRole(clip.sourceType)}
          {clip.anatomicalSide === 'left' || clip.anatomicalSide === 'right'
            ? ` · patient ${clip.anatomicalSide}`
            : ''}
        </p>
      </div>

      {hasMedia ? (
        <TechniqueVideoPlayer
          title={clip.title}
          src={clip.videoPath}
          container={clip.container}
          poster={clip.posterPath || undefined}
          captionsSrc={clip.captionsPath}
          syntheticLabel={clip.syntheticLabelRequired}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {techniqueCopy.awaitingProduction}
        </div>
      )}

      <p className="text-sm font-medium text-foreground">{clip.title}</p>
      {showDrafts ? <TechniqueReviewBadge clip={clip} /> : null}
      <TechniqueChapterList chapters={clip.chapters} />
    </div>
  )
}

/**
 * Renders a single technique micro-lesson. In production (`showDrafts` false)
 * only publishable clips are shown and the lesson never falls back to drafts.
 */
export function RigidTechniqueLesson({
  lesson,
  clips,
  showDrafts = false,
}: RigidTechniqueLessonProps) {
  const visibleClips = showDrafts ? clips : clips.filter(canPublishClip)

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">{lesson.title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="font-semibold text-foreground">{techniqueCopy.objectiveLabel}: </span>
          {lesson.objective}
        </p>
        <p className="text-xs text-muted-foreground">
          {techniqueCopy.durationLabel}: ~{Math.round(lesson.approxDurationSeconds / 15) * 15}s
        </p>
      </header>

      <TechniqueSafetyNotice statement={lesson.safetyStatement} />

      {visibleClips.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground"
        >
          {techniqueCopy.noPublishedClips}
        </div>
      ) : (
        <div
          className={
            lesson.movementSync
              ? 'grid gap-6 md:grid-cols-2'
              : 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'
          }
        >
          {visibleClips.map((clip) => (
            <ClipBlock key={clip.id} clip={clip} showDrafts={showDrafts} />
          ))}
        </div>
      )}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {techniqueCopy.keyMovementLabel}
          </dt>
          <dd className="mt-1 text-sm leading-6 text-foreground">{lesson.keyMovementRule}</dd>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            {techniqueCopy.commonErrorLabel}
          </dt>
          <dd className="mt-1 text-sm leading-6 text-foreground">{lesson.commonError}</dd>
        </div>
      </dl>

      <TechniqueTranscript />

      {lesson.retrievalQuestions.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {techniqueCopy.retrievalHeading}
          </h3>
          {lesson.retrievalQuestions.map((question) => {
            const answer =
              question.options && question.answerIndex != null
                ? question.options[question.answerIndex]
                : undefined
            return (
              <div key={question.id} className="rounded-lg border border-border/60 bg-card p-4">
                <p className="text-sm font-medium text-foreground">{question.prompt}</p>
                {question.options ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {question.options.map((option, index) => (
                      <li key={option}>
                        {String.fromCharCode(65 + index)}. {option}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {question.orderedSteps ? (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    {question.orderedSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : null}
                {answer || question.explanation ? (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer font-medium text-foreground">
                      Show answer
                    </summary>
                    <div className="mt-1 space-y-1 text-muted-foreground">
                      {answer ? <p className="text-foreground">Answer: {answer}</p> : null}
                      {question.explanation ? <p>{question.explanation}</p> : null}
                    </div>
                  </details>
                ) : null}
              </div>
            )
          })}
        </section>
      ) : null}
    </article>
  )
}
