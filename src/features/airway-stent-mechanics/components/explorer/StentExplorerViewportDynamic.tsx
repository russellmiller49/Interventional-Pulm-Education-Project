'use client'

import dynamic from 'next/dynamic'

import type { StentExplorerVisualizationProps } from './visualizationTypes'

const DynamicViewport = dynamic<StentExplorerVisualizationProps>(
  () => import('./StentExplorerViewport').then((module) => module.StentExplorerViewport),
  {
    loading: () => (
      <div
        aria-busy="true"
        aria-label="Loading the airway stent visualization"
        className="flex min-h-[30rem] items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-300"
        role="status"
      >
        Preparing the interactive airway and stent model…
      </div>
    ),
    ssr: false,
  },
)

/**
 * Client-only entrypoint. Keep this component mounted while changing station or view props so the
 * React Three Fiber canvas remains persistent and retains the learner's WebGL context.
 */
export function StentExplorerViewportDynamic(props: StentExplorerVisualizationProps) {
  return <DynamicViewport {...props} />
}
