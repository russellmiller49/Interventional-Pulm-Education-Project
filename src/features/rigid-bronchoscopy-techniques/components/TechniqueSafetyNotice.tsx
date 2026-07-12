import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'

interface TechniqueSafetyNoticeProps {
  /** Lesson-specific safety statement. */
  statement?: string
  /** When true (default) the standing supplements-not-credentials disclaimer is shown. */
  showDisclaimer?: boolean
}

/** A non-alarming safety callout shown before/with a technique video. */
export function TechniqueSafetyNotice({
  statement,
  showDisclaimer = true,
}: TechniqueSafetyNoticeProps) {
  return (
    <div
      role="note"
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6"
    >
      {statement ? <p className="font-medium text-foreground">{statement}</p> : null}
      {showDisclaimer ? (
        <p className={statement ? 'mt-1 text-muted-foreground' : 'text-muted-foreground'}>
          {techniqueCopy.standingDisclaimer}
        </p>
      ) : null}
    </div>
  )
}
