'use client'

import { Html } from '@react-three/drei'

import type { CircuitLayout } from './layout'
import styles from '../cardiohelp-ecmo.module.css'

/**
 * Anatomy/equipment label pills. Constant screen-space size (no distanceFactor
 * — world-scaled labels ballooned over the model when zoomed in) and dimmed to
 * near-invisible while the user orbits so they never block inspection.
 */
export function SceneLabels({
  layout,
  visible,
  dimmed,
}: {
  layout: CircuitLayout
  visible: boolean
  dimmed: boolean
}) {
  if (!visible) return null
  return (
    <group>
      {layout.labels.map((label) => (
        <Html
          key={label.id}
          center
          position={label.position}
          zIndexRange={[40, 0]}
          wrapperClass={styles.sceneHtml}
        >
          <span className={styles.circuit3dSceneLabel} data-dimmed={dimmed || undefined}>
            {label.text}
          </span>
        </Html>
      ))}
    </group>
  )
}
