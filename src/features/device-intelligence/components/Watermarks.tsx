import { AlertTriangle, FlaskConical } from 'lucide-react'

/**
 * The two D1 watermarks. Both are plain markup (no positioning tricks), so they print with
 * the content they warn about; `print:` variants keep them visible on paper.
 */

/** DRAFT PROTOTYPE — the procedure-content watermark, with the verbatim governance status. */
export function DraftWatermark({
  title,
  status,
  disclaimer,
}: {
  title: string
  status: string
  disclaimer: string
}) {
  return (
    <div
      role="note"
      aria-label={title}
      className="relative overflow-hidden rounded-2xl border-2 border-amber-500/70 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(239,68,68,0.08))] px-5 py-4 shadow-sm print:border-black"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-amber-500" aria-hidden="true" />
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
        />
        <div>
          <p className="font-black tracking-[0.12em] text-amber-950 dark:text-amber-100">{title}</p>
          <p className="mt-1 font-mono text-xs text-amber-950/90 dark:text-amber-100/90">
            {status}
          </p>
          <p className="mt-1 max-w-5xl text-sm leading-6 text-amber-950/80 dark:text-amber-100/80">
            {disclaimer}
          </p>
        </div>
      </div>
    </div>
  )
}

/** DEMO DATA — NOT AN ACTUAL INSTITUTION. Required on every readiness/capability render. */
export function DemoWatermark({ title, disclaimer }: { title: string; disclaimer: string }) {
  return (
    <div
      role="note"
      aria-label={title}
      className="relative overflow-hidden rounded-2xl border-2 border-violet-500/70 bg-violet-500/10 px-5 py-4 shadow-sm print:border-black"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-violet-500" aria-hidden="true" />
      <div className="flex items-start gap-3">
        <FlaskConical
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300"
        />
        <div>
          <p className="font-black tracking-[0.12em] text-violet-950 dark:text-violet-100">
            {title}
          </p>
          <p className="mt-1 max-w-5xl text-sm leading-6 text-violet-950/80 dark:text-violet-100/80">
            {disclaimer}
          </p>
        </div>
      </div>
    </div>
  )
}
