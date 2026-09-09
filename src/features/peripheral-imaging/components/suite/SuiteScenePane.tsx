'use client'

import dynamic from 'next/dynamic'
import { SuiteFallback } from './SuiteFallback'
import type { ImagingSuitePaneProps, SuiteMode } from './types'

/**
 * CODEX-OWNED. The 3D imaging suite: one React Three Fiber scene, the DRR on the detector, the
 * monitor, the chain pins, the control dock and the readouts, per the brief in
 * `docs/peripheral-imaging/codex-3d-brief.md`.
 *
 * Until a mode's view lands, it is not in `SUITE_MODES_READY` and `ImagingSuitePane` routes that
 * mode to `SuiteFallback`. Add a mode here only when its view honours every prop and data
 * attribute in `./types.ts`; the flow tests never mount this file (they use the test double), so
 * the scene's own tests and the e2e pixel checks are what prove it.
 */
export const SUITE_MODES_READY: ReadonlySet<SuiteMode> = new Set<SuiteMode>()

export { resolveSuiteInputs, suiteViewErrors } from './suiteViewSpec'
const SuiteScene = dynamic(() => import('./SuiteScene'), {
  ssr: false,
  loading: () => <p role="status">Preparing the imaging suite…</p>,
})

export function SuiteScenePane(props: ImagingSuitePaneProps) {
  return SUITE_MODES_READY.has(props.view.mode) ? (
    <SuiteScene key={`${props.view.sectionId}:${props.view.mode}`} {...props} />
  ) : (
    <SuiteFallback {...props} />
  )
}
