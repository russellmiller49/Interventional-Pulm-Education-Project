'use client'

import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import type { CircuitLayout } from './layout'
import {
  placeSceneLabels,
  placeSceneLabelsOnRails,
  type SceneLabelBox,
  type SceneRect,
} from './sceneLabelLayout'
import styles from '../cardiohelp-ecmo.module.css'

/**
 * Project each labelled object through the actual camera and move only its screen-space pill,
 * keeping a leader to the object.
 *
 * The overview sets its pills in rails along the top and bottom of the view, off the model
 * (`placeSceneLabelsOnRails`). A single label, which is what the finder shows, rests just above its
 * object on a short leader (`placeSceneLabels`). Labels that do not fit are left out, with every
 * structure still available through the finder. This layer is decorative; the finder carries its
 * names.
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
      const point = projected.current.copy(label.target).project(camera)
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
    const rails = boxes.length > 1
    const placements = rails
      ? placeSceneLabelsOnRails(boxes, {
          priorityIds: emphasisIds ?? [],
          obstacles,
          bounds: size,
        })
      : placeSceneLabels(boxes, {
          priorityIds: emphasisIds ?? [],
          obstacles,
          bounds: size,
          restingLeader,
        })
    for (const [id, placement] of placements) {
      const key = `${rails}:${placement.row ?? 0}:${placement.side}:${placement.leader}:${placement.offsetY}:${placement.offsetX}:${placement.visible}`
      if (applied.current.get(id) === key) continue
      applied.current.set(id, key)
      const pill = pills.current.get(id)
      if (!pill) continue
      pill.dataset.leader = placement.side
      if (rails) {
        pill.dataset.rail = placement.side === 'above' ? 'top' : 'bottom'
        pill.dataset.railRow = String((placement.row ?? 0) + 1)
      } else {
        delete pill.dataset.rail
        delete pill.dataset.railRow
      }
      pill.dataset.placementVisible = String(placement.visible)
      pill.style.visibility = placement.visible ? 'visible' : 'hidden'
      // The dot on the object goes with its pill.
      const anchor = pill.previousElementSibling
      if (anchor instanceof HTMLElement) {
        anchor.style.visibility = placement.visible ? 'visible' : 'hidden'
      }
      pill.style.setProperty('--scene-label-x', `${placement.offsetX}px`)
      const dy = placement.side === 'above' ? placement.leader : -placement.leader
      pill.style.setProperty('--scene-leader-length', `${Math.hypot(placement.offsetX, dy)}px`)
      pill.style.setProperty('--scene-leader-angle', `${Math.atan2(dy, -placement.offsetX)}rad`)
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
            position={label.target}
            zIndexRange={[40, 0]}
            wrapperClass={styles.sceneHtml}
          >
            {/* The end of the leader: a dot on the object the pill names. */}
            <span
              className={styles.circuit3dSceneAnchor}
              data-scene-label-anchor={label.id}
              data-dimmed={dimmed || undefined}
            />
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
