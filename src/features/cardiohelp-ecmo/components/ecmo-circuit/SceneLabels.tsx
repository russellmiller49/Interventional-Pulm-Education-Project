'use client'

import { Html } from '@react-three/drei'

import type { CircuitLayout } from './layout'
import styles from '../cardiohelp-ecmo.module.css'

/**
 * Anatomy/equipment label pills. Constant screen-space size (no distanceFactor
 * — world-scaled labels ballooned over the model when zoomed in) and dimmed to
 * near-invisible while the user orbits so they never block inspection.
 *
 * `emphasisIds` is how a teaching step points at an object: the named labels are
 * emphasised and the rest are pushed back. Nothing moves — no camera nudge, no
 * material change — because a learner who has already orbited or panned should
 * not have their view taken away from them to be shown where something is. The
 * emphasis is a redundant cue in any case: the teaching pane names the same
 * objects in words, which is what carries this when the labels are switched off
 * or the viewport is too narrow to show them at all.
 */
export function SceneLabels({
  layout,
  visible,
  dimmed,
  emphasisIds = null,
}: {
  layout: CircuitLayout
  visible: boolean
  dimmed: boolean
  emphasisIds?: readonly string[] | null
}) {
  if (!visible) return null
  const emphasised = emphasisIds && emphasisIds.length > 0 ? new Set(emphasisIds) : null
  return (
    <group>
      {layout.labels.map((label) => {
        const state = emphasised ? (emphasised.has(label.id) ? 'emphasised' : 'receded') : undefined
        return (
          <Html
            key={label.id}
            center
            position={label.position}
            zIndexRange={[40, 0]}
            wrapperClass={styles.sceneHtml}
          >
            <span
              className={styles.circuit3dSceneLabel}
              data-dimmed={dimmed || undefined}
              data-emphasis={state}
            >
              {label.text}
            </span>
          </Html>
        )
      })}
    </group>
  )
}
