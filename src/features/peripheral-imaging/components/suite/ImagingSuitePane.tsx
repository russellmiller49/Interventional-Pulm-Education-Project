'use client'

import { SuiteFallback } from './SuiteFallback'
import { SUITE_MODES_READY, SuiteScenePane } from './SuiteScenePane'
import type { ImagingSuitePaneProps } from './types'

/**
 * The simulator pane the stage host renders: the suite's scene for the modes it has, the draft's
 * lab bodies for the rest. The host never knows which it got.
 */
export function ImagingSuitePane(props: ImagingSuitePaneProps) {
  return SUITE_MODES_READY.has(props.view.mode) ? (
    <SuiteScenePane {...props} />
  ) : (
    <SuiteFallback {...props} />
  )
}
