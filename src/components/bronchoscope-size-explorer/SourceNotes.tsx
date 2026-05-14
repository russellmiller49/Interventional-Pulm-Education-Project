import { ExternalLink } from 'lucide-react'

import type {
  BronchoscopeDevice,
  BronchoscopyInstrument,
} from '@/lib/bronchoscope-size-explorer/types'

interface SourceNotesProps {
  scopes: BronchoscopeDevice[]
  instruments: BronchoscopyInstrument[]
}

export function SourceNotes({ scopes, instruments }: SourceNotesProps) {
  return (
    <section
      aria-labelledby="source-notes-heading"
      className="rounded-2xl border border-border/70 bg-muted/30 p-5"
    >
      <details>
        <summary
          id="source-notes-heading"
          className="cursor-pointer text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Source and evidence notes
        </summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <SourceList title="Scope presets" items={scopes} />
          <SourceList title="Instrument presets" items={instruments} />
        </div>
      </details>
    </section>
  )
}

function SourceList({
  title,
  items,
}: {
  title: string
  items: Array<BronchoscopeDevice | BronchoscopyInstrument>
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="font-semibold text-foreground">{item.displayName}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {item.sourceType.replace('-', ' ')}
            </p>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
              >
                <span>{item.sourceLabel}</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : (
              <p className="mt-2 text-xs">{item.sourceLabel}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
