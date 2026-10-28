'use client'

import dynamic from 'next/dynamic'

const DolphinAnatomyExplorer = dynamic(
  () => import('./DolphinAnatomyExplorer').then((module) => module.DolphinAnatomyExplorer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[600px] items-center justify-center rounded-xl border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading dolphin anatomy…
      </div>
    ),
  },
)

export function DolphinAnatomyExplorerDynamic() {
  return <DolphinAnatomyExplorer />
}
