'use client'

import dynamic from 'next/dynamic'

import type { AirwayXRSceneProps } from './AirwayXRScene'

// WebGL + WebXR only run in the browser, so load the scene client-side with SSR disabled.
const AirwayXRScene = dynamic(
  () => import('./AirwayXRScene').then((module) => module.AirwayXRScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[clamp(420px,52vh,640px)] items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-sm text-slate-400">
        Loading spatial view…
      </div>
    ),
  },
)

export function AirwayXRSceneDynamic(props: AirwayXRSceneProps) {
  return <AirwayXRScene {...props} />
}
