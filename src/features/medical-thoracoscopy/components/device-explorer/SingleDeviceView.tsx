'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import {
  kitModel as kitModelNamed,
  type ExplorerDevice,
} from '../../content/deviceExplorerCatalogue'
import {
  boxCorners,
  fitPoints,
  FRONT_VIEW,
  INSTRUMENT_DISPLAY,
  TOWER_DISPLAY,
} from './explorerCamera'
import { setJaws, useExplorerModel } from './explorerModels'
import { HotspotMarkers } from './HotspotMarkers'
import { motionSeconds, useReducedMotion } from './reducedMotion'
import { StudioFloor } from './StudioFloor'
import type { ExplorerAssetSource, HotspotTarget, SceneLink } from './sceneLink'

/** Seconds for the jaws to go from closed to fully open. */
const JAW_SECONDS = 0.6

/**
 * One model on the turntable: laid along the screen (the tower stood upright), framed, with its
 * hotspots, and for the forceps the jaws turned about their hinge as the controls ask.
 */
export function SingleDeviceView({
  device,
  source,
  link,
  jaw,
  labels,
  hotspot,
  onSelectHotspot,
}: {
  device: ExplorerDevice
  source: ExplorerAssetSource
  link: SceneLink
  jaw: number
  labels: boolean
  hotspot: string | null
  onSelectHotspot: (key: string) => void
}) {
  const invalidate = useThree((state) => state.invalidate)
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const kitModel = device.kitModel ? kitModelNamed(device.kitModel) : null
  const model = useExplorerModel(device.id, source.urlOf(device.id), device.kitModel)
  const display = device.frame === 'tower' ? TOWER_DISPLAY : INSTRUMENT_DISPLAY
  const openDeg = useMemo(() => {
    const extras = kitModel?.extras as { jawOpeningDeg?: number } | undefined
    return device.jaws === 'measured' ? (extras?.jawOpeningDeg ?? 0) : 0
  }, [device.jaws, kitModel])

  const targets = useMemo<readonly HotspotTarget[]>(
    () =>
      device.hotspots.flatMap((spec) => {
        const object = spec.anchor
          ? model.anchors.get(spec.anchor)
          : model.labels.get(spec.node ?? '')
        return object ? [{ id: spec.id, key: spec.id, spec, object, visible: () => true }] : []
      }),
    [device.hotspots, model],
  )

  useLayoutEffect(() => {
    link.setTargets(targets)
    const corners = boxCorners(model.localBox, display)
    link.setFrame(() => fitPoints(corners, FRONT_VIEW, camera))
    link.setFollowKey(null)
    link.setReports(new Map([[model.id, model.report]]))
    link.setStatus({
      view: 'single',
      model: model.id,
      qualityClass: device.qualityClass,
      hotspots: targets.map((target) => target.key),
    })
    invalidate()
    return () => {
      link.setTargets([])
      link.setFrame(null)
    }
  }, [camera, device.qualityClass, display, invalidate, link, model, targets])

  const reduced = useReducedMotion()
  const current = useRef(0)
  useEffect(() => invalidate(), [jaw, invalidate])
  useFrame((_, delta) => {
    if (!model.jaws) return
    const target = openDeg > 0 ? jaw : 0
    const step = Math.min(delta, 1 / 20) / motionSeconds(JAW_SECONDS, reduced)
    const next =
      current.current < target
        ? Math.min(target, current.current + step)
        : Math.max(target, current.current - step)
    if (next !== current.current || current.current === 0) {
      current.current = next
      setJaws(model.jaws, (THREE.MathUtils.smoothstep(next, 0, 1) * openDeg) / 2)
    }
    link.setStatus({ ...link.status(), jawOpen: current.current })
    if (current.current !== target) invalidate()
  }, -3)

  const floor = useMemo(
    () => new THREE.Box3().setFromPoints(boxCorners(model.localBox, display)),
    [display, model.localBox],
  )

  return (
    <>
      <StudioFloor box={floor} />
      <group quaternion={display}>
        <primitive object={model.root} dispose={null} />
        <HotspotMarkers
          targets={targets}
          selected={hotspot}
          labels={labels}
          onSelect={onSelectHotspot}
        />
      </group>
    </>
  )
}
