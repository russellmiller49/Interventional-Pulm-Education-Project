'use client'
import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { Point3 } from '../../lib/physics'
import { placeLabels, type LabelRequest } from './labelLayout'

export interface SceneLabel {
  readonly id: string
  /** The world position of the object this label names. Never moved to make a label fit. */
  readonly anchor: Point3
  readonly placement: LabelRequest['placement']
  readonly gap: number
  /** Size assumed until the label has been measured. */
  readonly estimate: readonly [number, number]
  readonly node: ReactNode
}

interface Placement {
  readonly position: Point3
  readonly leader: boolean
  readonly hidden: boolean
}

/** A leader is drawn once a label has had to sit further than this from its object. */
const LEADER_FROM_PX = 10

/**
 * Draws every DOM label of the scene through one layout pass, so a component pin and an object
 * label are kept clear of each other by the same rule (`placeLabels`). Each label is positioned
 * from its object's own projected anchor on every rendered frame, so it follows the object through
 * a preset change, a C-arm move, a resize and a drag.
 */
export function SceneLabels({
  labels,
  portal,
}: {
  labels: readonly SceneLabel[]
  portal: RefObject<HTMLDivElement>
}) {
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const [placements, setPlacements] = useState<Record<string, Placement>>({})
  // The scene renders on demand, so a label that changes size without the scene changing — text
  // enlarged after load, a font arriving late — would keep a layout made for its old size. Ask for
  // a frame whenever a label's box changes.
  const invalidate = useThree((state) => state.invalidate)
  const observer = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const watching = new ResizeObserver(() => invalidate())
    observer.current = watching
    for (const node of nodes.current.values()) watching.observe(node)
    return () => {
      watching.disconnect()
      observer.current = null
    }
  }, [invalidate])
  useFrame(({ camera, size }) => {
    const projected = labels.map((label) => new Vector3(...label.anchor).project(camera))
    const requests: LabelRequest[] = labels.map((label, index) => {
      const node = nodes.current.get(label.id)
      if (node) {
        // Where the named object is in the figure, for anything measuring the label against it.
        node.dataset.anchorX = (((projected[index].x + 1) / 2) * size.width).toFixed(1)
        node.dataset.anchorY = (((1 - projected[index].y) / 2) * size.height).toFixed(1)
      }
      return {
        id: label.id,
        anchor: [
          ((projected[index].x + 1) / 2) * size.width,
          ((1 - projected[index].y) / 2) * size.height,
        ],
        width: node?.offsetWidth || label.estimate[0],
        height: node?.offsetHeight || label.estimate[1],
        placement: label.placement,
        gap: label.gap,
      }
    })
    const placed = placeLabels(requests, size.width, size.height)
    let changed = false
    const next: Record<string, Placement> = {}
    placed.forEach((item, index) => {
      // Back at the object's own depth, so the label keeps its place in the scene's draw order.
      const world = new Vector3(
        (item.x / size.width) * 2 - 1,
        1 - (item.y / size.height) * 2,
        projected[index].z,
      ).unproject(camera)
      const hidden = projected[index].z > 1
      const before = placements[item.id]
      const position = world.toArray() as Point3
      const leader = item.distance > LEADER_FROM_PX
      if (
        !before ||
        before.hidden !== hidden ||
        before.leader !== leader ||
        world.distanceToSquared(new Vector3(...before.position)) > 0.01
      )
        changed = true
      next[item.id] = { position, leader, hidden }
    })
    if (changed || Object.keys(placements).length !== placed.length) setPlacements(next)
  })
  return (
    <>
      {labels.map((label) => {
        const placement = placements[label.id]
        const position = placement?.position ?? label.anchor
        return (
          <group key={label.id}>
            {placement?.leader && !placement.hidden && (
              <Line
                points={[label.anchor, position]}
                color="#9fb9c6"
                lineWidth={1}
                depthTest={false}
                renderOrder={5}
              />
            )}
            <Html portal={portal} position={position} center zIndexRange={[20, 10]}>
              <div
                ref={(node) => {
                  const previous = nodes.current.get(label.id)
                  if (previous && previous !== node) observer.current?.unobserve(previous)
                  if (node) {
                    nodes.current.set(label.id, node)
                    observer.current?.observe(node)
                  } else nodes.current.delete(label.id)
                }}
                data-scene-label={label.id}
                data-label-leader={placement?.leader ? 'true' : undefined}
                style={placement && !placement.hidden ? undefined : { visibility: 'hidden' }}
              >
                {label.node}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}
