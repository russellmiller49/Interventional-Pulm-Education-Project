'use client'

import dynamic from 'next/dynamic'

import type { AnatomyViewerProps } from './AnatomyViewer'

const AnatomyViewer = dynamic(
  () => import('./AnatomyViewer').then((module) => module.AnatomyViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[560px] items-center justify-center rounded-3xl border border-slate-700 bg-slate-950 text-sm text-slate-300">
        Loading anatomy workspace...
      </div>
    ),
  },
)

export function AnatomyViewerDynamic(props: AnatomyViewerProps) {
  return <AnatomyViewer {...props} />
}
