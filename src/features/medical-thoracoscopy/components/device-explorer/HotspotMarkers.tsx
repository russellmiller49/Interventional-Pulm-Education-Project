'use client'

import { Fragment, useCallback, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

import type { HotspotTarget } from './sceneLink'
import styles from './device-explorer.module.css'

/**
 * A marker on each hotspot, carried by the node it sits on so it moves with its part. Markers are
 * a pointer convenience: the same hotspots are ordinary buttons in the panel beside the viewport,
 * so the markers stay out of the tab order.
 *
 * Each frame the markers are laid out once: a marker whose part is hidden is hidden, and each label
 * sits above or below its dot so it never covers the instrument at the anchor, clear of the other
 * dots and labels, or keeps only its dot (the chosen hotspot is placed first).
 */
function Marker({
  target,
  selected,
  labels,
  onSelect,
  register,
}: {
  target: HotspotTarget
  selected: boolean
  labels: boolean
  onSelect: (key: string) => void
  register: (id: string, element: HTMLDivElement | null) => void
}) {
  return (
    <Html zIndexRange={[20, 10]} center>
      <div ref={(element) => register(target.id, element)} className={styles.markerHolder}>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className={styles.marker}
          data-selected={selected || undefined}
          data-hotspot={target.key}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(target.key)
          }}
        >
          <span className={styles.markerDot} />
          {(labels || selected) && <span className={styles.markerLabel}>{target.spec.title}</span>}
        </button>
      </div>
    </Html>
  )
}

const point = new THREE.Vector3()

function overlaps(a: readonly number[], b: readonly number[]): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
}

export function HotspotMarkers({
  targets,
  selected,
  labels,
  onSelect,
}: {
  targets: readonly HotspotTarget[]
  selected: string | null
  labels: boolean
  onSelect: (key: string) => void
}) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const holders = useRef(new Map<string, HTMLDivElement>())
  const register = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) holders.current.set(id, element)
    else holders.current.delete(id)
  }, [])

  const shown = targets.filter((target) => labels || target.key === selected)

  useFrame(() => {
    const labelsPlaced: number[][] = []
    const dots: { id: string; box: number[] }[] = []
    const layout: { target: HotspotTarget; holder: HTMLDivElement; x: number; y: number }[] = []
    for (const target of shown) {
      const holder = holders.current.get(target.id)
      if (!holder) continue
      let visible = target.visible()
      if (visible) {
        target.object.getWorldPosition(point).project(camera)
        visible = point.z < 1
      }
      const visibility = visible ? 'visible' : 'hidden'
      if (holder.style.visibility !== visibility) holder.style.visibility = visibility
      if (!visible) continue
      const x = ((point.x + 1) / 2) * size.width
      const y = ((1 - point.y) / 2) * size.height
      dots.push({ id: target.id, box: [x - 8, y - 8, x + 8, y + 8] })
      layout.push({ target, holder, x, y })
    }
    // The chosen hotspot is placed first; then each label goes above its dot, or below, clear of
    // every dot and every label already placed, or keeps only its dot.
    layout.sort((a, b) => Number(b.target.key === selected) - Number(a.target.key === selected))
    for (const { target, holder, x, y } of layout) {
      const width = 18 + target.spec.title.length * 6.9
      const left = x + 10 + width > size.width - 4
      const x0 = left ? x - 10 - width : x + 10
      const slots = [
        ['above', [x0, y - 36, x0 + width, y - 12]],
        ['below', [x0, y + 12, x0 + width, y + 36]],
      ] as const
      const clear = slots.find(([, box]) =>
        [
          ...labelsPlaced,
          ...dots.filter((dot) => dot.id !== target.id).map((dot) => dot.box),
        ].every((other) => !overlaps(other, box)),
      )
      const place = clear ? clear[0] : target.key === selected ? 'above' : 'hidden'
      if (clear) labelsPlaced.push([...clear[1]])
      if (holder.dataset.label !== place) holder.dataset.label = place
      const side = left ? 'left' : 'right'
      if (holder.dataset.side !== side) holder.dataset.side = side
    }
  }, -1)

  return (
    <>
      {shown.map((target) => (
        <Fragment key={target.id}>
          {createPortal(
            <Marker
              target={target}
              selected={target.key === selected}
              labels={labels}
              onSelect={onSelect}
              register={register}
            />,
            target.object,
          )}
        </Fragment>
      ))}
    </>
  )
}
