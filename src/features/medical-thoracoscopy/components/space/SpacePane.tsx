'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'

import type { LoadedSpace } from '../../engine/space/loadSpace'
import type { SceneStatus } from './scene/SpaceSceneViews'
import styles from './space-pane.module.css'
import { SpaceFallbackViews } from './SpaceFallbackPane'
import { SpacePaneShell } from './SpacePaneShell'
import { READINESS_WORDS, SCENE_WORDS } from './spaceWords'
import type { SpacePaneProps } from './types'
import { useWebGLSupport } from './useSpaceSupport'

const SceneViews = dynamic(() => import('./scene/SpaceSceneViews'), {
  ssr: false,
  loading: () => (
    <p className={styles.viewWaiting} role="status">
      {READINESS_WORDS.loading}
    </p>
  ),
})

/**
 * The space pane (plan, section 4.6): the 3D Chest and Scope views when the browser can draw them
 * and the anatomy is ready, the cut through the space otherwise, and the same shell around either:
 * the keys, the dock, the refusal and the model's estimate, all read from the one state. If the scene
 * cannot be drawn (no WebGL, a renderer that will not start, a file that will not load), the pane
 * says so and shows the cut; nothing the learner has done is lost, since the engine holds it.
 */
export function SpacePane(
  props: SpacePaneProps & {
    readonly space: LoadedSpace | null
    /** False draws the cut even where the browser could draw the scene. */
    readonly drawIn3d?: boolean
  },
) {
  const { space, drawIn3d = true, ...pane } = props
  const webgl = useWebGLSupport()
  const [status, setStatus] = useState<SceneStatus>('loading')
  const onStatus = useCallback((next: SceneStatus) => setStatus(next), [])
  const wanted = drawIn3d && webgl
  const drawing =
    wanted && status !== 'failed' && space !== null && pane.state.readiness.kind === 'ready'
  const note = drawIn3d && (!webgl || status === 'failed') ? SCENE_WORDS.drawnWithout : undefined
  return (
    <SpacePaneShell
      {...pane}
      note={note}
      views={
        drawing ? (
          <SceneViews state={pane.state} space={space} onStatus={onStatus} />
        ) : (
          <SpaceFallbackViews state={pane.state} />
        )
      }
    />
  )
}
