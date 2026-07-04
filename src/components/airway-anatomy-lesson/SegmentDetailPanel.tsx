'use client'

import { Eye, Lightbulb, MapPin } from 'lucide-react'

import {
  LOBE_LABELS,
  getAncestry,
  getChildren,
  getNode,
  lobeColor,
} from '@/lib/airway-anatomy-lesson/airway-graph'
import { cn } from '@/lib/cn'

interface SegmentDetailPanelProps {
  nodeId: string | null
  onSelect: (id: string) => void
  className?: string
}

export function SegmentDetailPanel({ nodeId, onSelect, className }: SegmentDetailPanelProps) {
  const node = nodeId ? getNode(nodeId) : undefined

  if (!node) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        Select a structure in the diagram or 3D model to see its bronchoscopic landmarks.
      </div>
    )
  }

  const color = lobeColor(node.lobe)
  const ancestry = getAncestry(node.id)
  const children = getChildren(node.id)

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm',
        className,
      )}
    >
      {/* Breadcrumb trail */}
      <nav
        aria-label="Airway path"
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs"
      >
        {ancestry.map((crumb, index) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-muted-foreground/50">/</span>}
            <button
              type="button"
              onClick={() => onSelect(crumb.id)}
              className={cn(
                'rounded px-1 py-0.5 transition-colors hover:text-foreground',
                crumb.id === node.id ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {crumb.shortLabel}
            </button>
          </span>
        ))}
      </nav>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {LOBE_LABELS[node.lobe]}
          </span>
          {node.code && (
            <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              {node.code}
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold tracking-tight text-foreground">{node.fullName}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{node.summary}</p>
      </div>

      {node.whatYouSee.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Eye className="h-4 w-4 text-sky-500" aria-hidden />
            What you see
          </h4>
          <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
            {node.whatYouSee.map((point) => (
              <li key={point} className="flex gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/80"
                  aria-hidden
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {node.pearls.length > 0 && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
            Clinical pearls
          </h4>
          <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
            {node.pearls.map((point) => (
              <li key={point} className="flex gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80"
                  aria-hidden
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children.length > 0 && (
        <section className="mt-auto space-y-2 border-t border-border/60 pt-3">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Branches into
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child.id)}
                className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
              >
                {child.shortLabel}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
