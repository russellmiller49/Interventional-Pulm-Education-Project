'use client'

import dynamic from 'next/dynamic'

import type { MechanicalVentilationCaseActivityV2Props } from './MechanicalVentilationCaseActivityV2'

const MechanicalVentilationCaseActivityV2 = dynamic(
  () => import('./MechanicalVentilationCaseActivityV2'),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-[32rem] place-items-center px-4" role="status" aria-live="polite">
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <strong>Loading the ventilator workspace</strong>
          <p className="mt-2 text-sm text-muted-foreground">
            The case workspace and console assets load only after setup is complete.
          </p>
        </div>
      </main>
    ),
  },
)

export function MechanicalVentilationCaseActivityLoader(
  props: MechanicalVentilationCaseActivityV2Props,
) {
  return <MechanicalVentilationCaseActivityV2 {...props} />
}
