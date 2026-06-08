'use client'

import dynamic from 'next/dynamic'

const AirwayAnatomyModule = dynamic(
  () => import('./AirwayAnatomyModule').then((module) => module.AirwayAnatomyModule),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[680px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading airway anatomy module...
      </div>
    ),
  },
)

export function AirwayAnatomyModuleDynamic() {
  return <AirwayAnatomyModule />
}
