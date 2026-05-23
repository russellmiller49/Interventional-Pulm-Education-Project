'use client'

import dynamic from 'next/dynamic'

const FluoroViewApp = dynamic(
  () => import('./FluoroViewApp').then((module) => module.FluoroViewApp),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[640px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading FluoroView simulator...
      </div>
    ),
  },
)

export function FluoroViewAppDynamic() {
  return <FluoroViewApp />
}
