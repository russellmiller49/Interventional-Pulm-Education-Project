'use client'

import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import type { CircuitLayout } from './layout'
import { placeSceneLabels, type SceneLabelBox, type SceneRect } from './sceneLabelLayout'
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
 *
 * Each frame the anchors are projected exactly as drei projects them, and a pill that would land on
 * another pill, or under the HUD or the labels toggle, moves up or down its own leader until it
 * clears (`placeSceneLabels`). Only two custom properties and a side attribute change, and only when
 * a placement does; the anchor — the object the pill names — never moves.
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
  const pills = useRef(new Map<string, HTMLSpanElement>())
  const applied = useRef(new Map<string, string>())
  const projected = useRef(new THREE.Vector3())
  useFrame(({ camera, size, gl }) => {
    if (!visible || pills.current.size === 0) return
    const boxes: SceneLabelBox[] = []
    for (const label of layout.labels) {
      const pill = pills.current.get(label.id)
      if (!pill) continue
      const point = projected.current.copy(label.position).project(camera)
      boxes.push({
        id: label.id,
        x: ((point.x + 1) / 2) * size.width,
        y: ((1 - point.y) / 2) * size.height,
        width: pill.offsetWidth,
        height: pill.offsetHeight,
      })
    }
    const canvas = gl.domElement.getBoundingClientRect()
    const obstacles: SceneRect[] = []
    const host = gl.domElement.closest('[data-scene-label-host]')
    host?.querySelectorAll('[data-scene-label-obstacle]').forEach((overlay) => {
      const box = overlay.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      obstacles.push({
        left: box.left - canvas.left,
        right: box.right - canvas.left,
        top: box.top - canvas.top,
        bottom: box.bottom - canvas.top,
      })
    })
    const restingLeader =
      0.9 * (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
    const placements = placeSceneLabels(boxes, {
      priorityIds: emphasisIds ?? [],
      obstacles,
      bounds: size,
      restingLeader,
    })
    for (const [id, placement] of placements) {
      const key = `${placement.side}:${placement.leader}:${placement.offsetY}`
      if (applied.current.get(id) === key) continue
      applied.current.set(id, key)
      const pill = pills.current.get(id)
      if (!pill) continue
      pill.dataset.leader = placement.side
      pill.style.setProperty('--scene-label-leader', `${placement.leader}px`)
      pill.style.setProperty('--scene-label-offset', `${placement.offsetY}px`)
    }
  })
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
              ref={(pill) => {
                if (pill) {
                  pills.current.set(label.id, pill)
                } else {
                  pills.current.delete(label.id)
                  applied.current.delete(label.id)
                }
              }}
              className={styles.circuit3dSceneLabel}
              data-dimmed={dimmed || undefined}
              data-emphasis={state}
              data-scene-label-id={label.id}
            >
              {label.text}
            </span>
          </Html>
        )
      })}
    </group>
  )
}
