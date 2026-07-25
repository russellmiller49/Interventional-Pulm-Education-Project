import { AlertTriangle } from 'lucide-react'

interface PrototypeBannerProps {
  title: string
  disclaimer: string
  compact?: boolean
}
export function PrototypeBanner({ title, disclaimer, compact = false }: PrototypeBannerProps) {
  return (
    <aside
      aria-label={title}
      className="relative overflow-hidden rounded-2xl border-2 border-amber-500/70 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(239,68,68,0.08))] px-5 py-4 shadow-sm"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-amber-500" />
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
        />
        <div>
          <p className="font-black tracking-[0.12em] text-amber-950 dark:text-amber-100">{title}</p>
          {!compact ? (
            <p className="mt-1 max-w-5xl text-sm leading-6 text-amber-950/80 dark:text-amber-100/80">
              {disclaimer}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
