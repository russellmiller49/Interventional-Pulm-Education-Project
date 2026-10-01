'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { ASSEMBLY_HOTSPOTS } from '../../content/deviceExplorerCatalogue'
import {
  ASSEMBLY_FRONT_VIEW,
  type AssemblyGeometry,
  type AssemblyParams,
  blendParams,
  boundsMoments,
  type CameraKey,
  cameraAt,
  explodedCamera,
  explodedParams,
  jawsClearOfChannel,
  mixCamera,
  paramsAt,
  posesFor,
  stepAt,
  type SystemBounds,
} from '../../engine/deviceExplorer/assembly'
import { applyPose, type Pose, type Vec3 } from '../../engine/deviceExplorer/vector'
import { fitPoints, INSTRUMENT_DISPLAY, keyToWorld } from './explorerCamera'
import {
  type PreparedModel,
  seeThrough,
  setJaws,
  setOpacity,
  useExplorerModel,
} from './explorerModels'
import { HotspotMarkers } from './HotspotMarkers'
import { motionSeconds, useReducedMotion } from './reducedMotion'
import { StudioFloor } from './StudioFloor'
import type { ExplorerAssetSource, HotspotTarget, SceneLink } from './sceneLink'
import type { SequenceClock } from './sequenceClock'

/** Seconds to blend into a moment the playhead jumped to. */
const JUMP_SECONDS = 0.8
/** Seconds to spread the parts out, or bring them back. */
const EXPLODE_SECONDS = 1.1
/** Seconds for the viewer's jaw control to open the jaws fully. */
const JAW_SECONDS = 0.6

function toward(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
}

function setPose(object: THREE.Object3D | null, pose: Pose): void {
  if (!object) return
  object.position.set(...pose.position)
  object.quaternion.set(...pose.quaternion)
}

/** The part's bounds, placed by a pose: the eight corners of its own box. */
function placedCorners(box: THREE.Box3, pose: Pose): Vec3[] {
  const corners: Vec3[] = []
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) corners.push(applyPose(pose, [x, y, z]))
  return corners
}

/**
 * The flexible sleeve, the telescope (solid or cutaway) and the double-spoon forceps, posed every
 * frame from the sequence's moment. Blends are applied to the sequence's numbers, never to the
 * poses, so every part always stays on the relationship its anchors define.
 */
export function AssemblyView({
  source,
  geometry,
  clock,
  link,
  exploded,
  cutaway,
  jaw,
  labels,
  hotspot,
  onSelectHotspot,
}: {
  source: ExplorerAssetSource
  geometry: AssemblyGeometry
  clock: SequenceClock
  link: SceneLink
  exploded: boolean
  cutaway: boolean
  jaw: number
  labels: boolean
  hotspot: string | null
  onSelectHotspot: (key: string) => void
}) {
  const invalidate = useThree((state) => state.invalidate)
  const sleeve = useExplorerModel(
    'trocar-sleeve-flexible',
    source.urlOf('trocar-sleeve-flexible'),
    'trocar-sleeve-flexible',
  )
  const telescope = useExplorerModel(
    'operative-telescope',
    source.urlOf('operative-telescope'),
    'operative-telescope',
  )
  const ghost = useExplorerModel(
    'operative-telescope-illustrative-cutaway',
    source.urlOf('operative-telescope-illustrative-cutaway'),
    'operative-telescope',
  )
  const forceps = useExplorerModel(
    'double-spoon-forceps',
    source.urlOf('double-spoon-forceps'),
    'double-spoon-forceps',
  )

  // In the assembly the cutaway's channel is drawn see-through, so the forceps shows inside it.
  useLayoutEffect(() => seeThrough(ghost, 'mt-illustrative-channel', 0.42), [ghost])

  const sleeveGroup = useRef<THREE.Group>(null)
  const telescopeGroup = useRef<THREE.Group>(null)
  const forcepsGroup = useRef<THREE.Group>(null)

  // What each overview must show, fitted to this viewport's shape: only the parts that are
  // showing at that moment.
  const lensCamera = useThree((three) => three.camera) as THREE.PerspectiveCamera
  const size = useThree((three) => three.size)
  const bounds = useMemo<SystemBounds>(() => {
    const front = keyToWorld(
      { target: [0, 0, 0], direction: ASSEMBLY_FRONT_VIEW, radius: 1 },
      INSTRUMENT_DISPLAY,
    ).direction
    const back = INSTRUMENT_DISPLAY.clone().invert()
    const aspect = size.width / Math.max(1, size.height)
    const lens = Object.assign(lensCamera.clone(), { aspect })
    const fit = (params: AssemblyParams) => {
      const poses = posesFor(params, geometry)
      const parts: [PreparedModel, Pose, number][] = [
        [sleeve, poses.sleeve, params.sleeveVisible],
        [telescope, poses.telescope, params.telescopeVisible],
        [forceps, poses.forceps, params.forcepsVisible],
      ]
      const points = parts
        .filter(([, , visible]) => visible > 0.5)
        .flatMap(([model, pose]) => placedCorners(model.localBox, pose))
        .map((point) => new THREE.Vector3(...point).applyQuaternion(INSTRUMENT_DISPLAY))
      const key = fitPoints(points, front, lens)
      return {
        centre: key.target.clone().applyQuaternion(back).toArray() as Vec3,
        radius: key.radius,
      }
    }
    const moments = boundsMoments(geometry)
    return {
      aligned: fit(moments.aligned),
      seated: fit(moments.seated),
      exploded: fit(moments.exploded),
    }
  }, [forceps, geometry, lensCamera, size.height, size.width, sleeve, telescope])

  // One floor for every moment, so the shadow's plane never jumps as parts move.
  const floor = useMemo(() => {
    const moments = boundsMoments(geometry)
    const points = [moments.seated, moments.exploded].flatMap((params) => {
      const poses = posesFor(params, geometry)
      return [
        ...placedCorners(sleeve.localBox, poses.sleeve),
        ...placedCorners(telescope.localBox, poses.telescope),
        ...placedCorners(forceps.localBox, poses.forceps),
      ].map((point) => new THREE.Vector3(...point).applyQuaternion(INSTRUMENT_DISPLAY))
    })
    return new THREE.Box3().setFromPoints(points)
  }, [forceps, geometry, sleeve, telescope])

  // The latest choices, for the frame loop.
  const reduced = useReducedMotion()
  const choices = useRef({ exploded, cutaway, jaw, reduced })
  useLayoutEffect(() => {
    choices.current = { exploded, cutaway, jaw, reduced }
    invalidate()
  }, [cutaway, exploded, invalidate, jaw, reduced])
  useEffect(() => clock.subscribe(() => invalidate()), [clock, invalidate])

  const motion = useRef({
    explode: exploded ? 1 : 0,
    jaw: 0,
    jumps: clock.get().jumps,
    jump: null as null | { from: AssemblyParams; camera: CameraKey; t: number },
    shown: null as null | { params: AssemblyParams; camera: CameraKey },
  })

  const telescopeShown = (): PreparedModel => (choices.current.cutaway ? ghost : telescope)
  const lastParams = useRef<AssemblyParams>(paramsAt(clock.get().seconds, geometry))

  const targets = useMemo<readonly HotspotTarget[]>(() => {
    const models = { sleeve: [sleeve], forceps: [forceps], telescope: [telescope, ghost] }
    const visibleKey = {
      sleeve: 'sleeveVisible',
      forceps: 'forcepsVisible',
      telescope: 'telescopeVisible',
    } as const
    return ASSEMBLY_HOTSPOTS.flatMap(({ part, spot }) =>
      models[part].flatMap((model) => {
        const object = spot.anchor ? model.anchors.get(spot.anchor) : undefined
        if (!object) return []
        const drawn = () =>
          part !== 'telescope' || model === (choices.current.cutaway ? ghost : telescope)
        return [
          {
            id: `${model.id}:${spot.id}`,
            key: `${part}:${spot.id}`,
            spec: spot,
            object,
            visible: () => drawn() && lastParams.current[visibleKey[part]] > 0.5,
          },
        ]
      }),
    )
  }, [forceps, ghost, sleeve, telescope])

  useLayoutEffect(() => {
    link.setTargets(targets.filter((target) => target.visible()))
    link.setFrame(null)
    link.setReports(
      new Map([sleeve, telescope, ghost, forceps].map((model) => [model.id, model.report])),
    )
    invalidate()
    return () => {
      link.setTargets([])
      link.setFollowKey(null)
    }
  }, [forceps, ghost, invalidate, link, sleeve, targets, telescope])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20)
    const state = motion.current
    clock.advance(delta)
    const moment = clock.get()
    if (moment.jumps !== state.jumps) {
      state.jumps = moment.jumps
      if (state.shown) state.jump = { from: state.shown.params, camera: state.shown.camera, t: 0 }
    }

    const still = choices.current.reduced
    state.explode = toward(
      state.explode,
      choices.current.exploded ? 1 : 0,
      delta / motionSeconds(EXPLODE_SECONDS, still),
    )
    const spread = THREE.MathUtils.smootherstep(state.explode, 0, 1)
    let params = paramsAt(moment.seconds, geometry)
    let camera = cameraAt(moment.seconds, params, geometry, bounds)
    if (spread > 0) {
      params = blendParams(params, explodedParams(geometry), spread)
      camera = mixCamera(camera, explodedCamera(bounds), spread)
    }
    const jawTarget = jawsClearOfChannel(params, geometry) ? choices.current.jaw : 0
    state.jaw = toward(state.jaw, jawTarget, delta / motionSeconds(JAW_SECONDS, still))
    params = {
      ...params,
      jawOpen: Math.min(1, params.jawOpen + THREE.MathUtils.smoothstep(state.jaw, 0, 1)),
    }
    if (state.jump) {
      state.jump.t = Math.min(1, state.jump.t + delta / motionSeconds(JUMP_SECONDS, still))
      const k = THREE.MathUtils.smootherstep(state.jump.t, 0, 1)
      params = blendParams(state.jump.from, params, k)
      camera = mixCamera(state.jump.camera, camera, k)
      if (state.jump.t >= 1) state.jump = null
    }
    state.shown = { params, camera }
    lastParams.current = params

    const poses = posesFor(params, geometry)
    setPose(sleeveGroup.current, poses.sleeve)
    setPose(telescopeGroup.current, poses.telescope)
    setPose(forcepsGroup.current, poses.forceps)
    setOpacity(sleeve, params.sleeveVisible)
    const shownTelescope = telescopeShown()
    setOpacity(shownTelescope, params.telescopeVisible)
    setOpacity(shownTelescope === ghost ? telescope : ghost, 0)
    setOpacity(forceps, params.forcepsVisible)
    if (forceps.jaws) setJaws(forceps.jaws, poses.jawEachDeg)

    link.setFollowKey(keyToWorld(camera, INSTRUMENT_DISPLAY))
    link.setTargets(targets.filter((target) => target.visible()))
    const { index, k } = stepAt(moment.seconds)
    link.setStatus({
      view: 'assembly',
      seconds: moment.seconds,
      playing: moment.playing,
      step: index,
      stepProgress: k,
      explode: state.explode,
      cutaway: choices.current.cutaway,
      params,
      toolTip: poses.toolTip,
      jawEachDeg: poses.jawEachDeg,
      jawsClear: jawsClearOfChannel(params, geometry),
      bounds,
    })

    const settling =
      moment.playing ||
      state.jump !== null ||
      state.explode !== (choices.current.exploded ? 1 : 0) ||
      state.jaw !== jawTarget
    if (settling) invalidate()
  }, -3)

  return (
    <>
      <StudioFloor box={floor} />
      <group quaternion={INSTRUMENT_DISPLAY}>
        <group ref={sleeveGroup}>
          <primitive object={sleeve.root} dispose={null} />
        </group>
        <group ref={telescopeGroup}>
          <primitive object={telescope.root} dispose={null} />
          <primitive object={ghost.root} dispose={null} />
        </group>
        <group ref={forcepsGroup}>
          <primitive object={forceps.root} dispose={null} />
        </group>
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
