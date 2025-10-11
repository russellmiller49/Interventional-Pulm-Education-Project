import Image from 'next/image'
import { useState } from 'react'

interface ComparisonImage {
  src: string
  alt: string
  label?: string
}

interface ImageComparisonProps {
  before: ComparisonImage
  after: ComparisonImage
}

export function ImageComparison({ before, after }: ImageComparisonProps) {
  const [position, setPosition] = useState(50)

  return (
    <div className="not-prose space-y-3">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/60">
        <Image
          src={after.src}
          alt={after.alt}
          width={1600}
          height={900}
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 overflow-hidden border-r border-border/80 transition-all"
          style={{ width: `${position}%` }}
          aria-hidden
        >
          <Image
            src={before.src}
            alt={before.alt}
            width={1600}
            height={900}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0 flex items-center justify-center">
          <div className="rounded-full border border-border/80 bg-background/80 px-2 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Slide to compare
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label="Adjust comparison"
          className="absolute inset-x-12 bottom-6 h-1 w-[calc(100%-6rem)] cursor-ew-resize appearance-none rounded-full bg-muted/60 accent-primary/80"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{before.label ?? 'Before'}</span>
        <span>{after.label ?? 'After'}</span>
      </div>
    </div>
  )
}

