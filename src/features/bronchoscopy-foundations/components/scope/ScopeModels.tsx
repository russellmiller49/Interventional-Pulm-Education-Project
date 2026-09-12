'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { Vec3 } from '@/lib/airway-anatomy/types'
import { plus, times } from '@/lib/bronchoscopy-core/frame'
import deviceData from '../../../../../public/bronchoscopy-foundations/anatomy/devices/devices.json'
import propData from '../../../../../public/bronchoscopy-foundations/anatomy/devices/teaching-props.json'
import type { ScopePaneProps, ScopeState } from './types'
import type { ScopeSceneAssets } from './scopeSceneAssets'
import { CORD_MORPH_WEIGHT } from './scopeSceneModel'
import { MODEL_DEFLECTION_LIMIT_DEG } from '../../engine/scope/scopeInputs'
import { TUBE_START_MM, TUBE_TIP_MM } from '../../engine/scope/scopeScripts'
import { createScopeState } from '../../engine/scope/scopeReducer'

export function modelQuaternion(state: ScopeState) {
  const frame = scopeOpticalFrame(state.pose!)
  // Asset +Z points forward. Local X is optical left and Y is up (a right-handed basis).
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...frame.right).negate(),
      new THREE.Vector3(...frame.up),
      new THREE.Vector3(...frame.forward),
    ),
  )
}

export function NamedModel({
  assets,
  file,
  name,
}: {
  assets: ScopeSceneAssets
  file: string
  name?: string
}) {
  const source = assets.models.get(file)?.scene
  const object = useMemo(() => {
    const node = name ? source?.getObjectByName(name) : source
    if (!node) throw new Error('A teaching model is unavailable')
    return node.clone(true)
  }, [source, name])
  return <primitive object={object} dispose={null} />
}

export function LarynxLumen({
  assets,
  state,
  outside = false,
}: {
  assets: ScopeSceneAssets
  state: ScopeState
  outside?: boolean
}) {
  const source = assets.models.get('larynx/larynx-lumen.glb')!.scene
  const model = useMemo(() => {
    const copy = source.clone(true)
    copy.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      if (node.name === 'UA_skeleton') node.visible = false
      const original = Array.isArray(node.material) ? node.material[0] : node.material
      const material = original.clone() as THREE.MeshStandardMaterial
      material.side = THREE.DoubleSide
      if (outside && (node.name === 'UA_lumen' || node.name === 'UA_subglottis')) {
        material.transparent = true
        material.opacity = 0.15
        material.depthWrite = false
      }
      node.material = material
    })
    return copy
  }, [source, outside])
  useEffect(
    () => () => {
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) (node.material as THREE.Material).dispose()
      })
    },
    [model],
  )
  useEffect(() => {
    for (const name of ['UA_fold_true_L', 'UA_fold_true_R']) {
      const mesh = model.getObjectByName(name) as THREE.Mesh | undefined
      if (mesh?.morphTargetInfluences)
        mesh.morphTargetInfluences[0] = CORD_MORPH_WEIGHT[state.inputs.cords]
    }
  }, [model, state.inputs.cords])
  return <primitive object={model} dispose={null} />
}

export function TubeModel({
  assets,
  state,
  outside = false,
}: {
  assets: ScopeSceneAssets
  state: ScopeState
  outside?: boolean
}) {
  const tube = deviceData.tubes.find((item) => item.idMm === state.inputs.tube?.idMm)
  const edge = assets.scopeCase.index.edgesById.get(0)!
  const geometry = useMemo(() => {
    if (!tube) return null
    const points = Array.from(
      { length: 71 },
      (_, i) =>
        new THREE.Vector3(
          ...sampleEdgePose(edge, TUBE_START_MM + ((TUBE_TIP_MM - TUBE_START_MM) * i) / 70).point,
        ),
    )
    const curve = new THREE.CatmullRomCurve3(points)
    return {
      inner: new THREE.TubeGeometry(curve, 70, tube.idMm / 2, 48, false),
      outer: new THREE.TubeGeometry(curve, 70, tube.odMm / 2, 48, false),
      rim: new THREE.RingGeometry(tube.idMm / 2, tube.odMm / 2, 48),
    }
  }, [edge, tube])
  useEffect(
    () => () => {
      geometry?.inner.dispose()
      geometry?.outer.dispose()
      geometry?.rim.dispose()
    },
    [geometry],
  )
  if (!geometry) return null
  const tip = sampleEdgePose(edge, TUBE_TIP_MM).point
  const tangent = assets.scopeCase.framesPlain.at(0, TUBE_TIP_MM).forward
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(...tangent),
  )
  const center = sampleEdgePose(edge, (TUBE_START_MM + TUBE_TIP_MM) / 2).point
  const clippingPlanes = outside ? [new THREE.Plane(new THREE.Vector3(0, 1, 0), -center[1])] : []
  return (
    <group>
      <mesh geometry={geometry.inner}>
        <meshStandardMaterial
          color="#cedddd"
          roughness={0.3}
          side={THREE.BackSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      <mesh geometry={geometry.outer}>
        <meshStandardMaterial
          color="#82b8c2"
          roughness={0.3}
          side={THREE.FrontSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      <mesh geometry={geometry.rim} position={tip} quaternion={q}>
        <meshStandardMaterial
          color="#b9d9df"
          side={THREE.DoubleSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    </group>
  )
}

export function AccessoryTip({ assets, state }: { assets: ScopeSceneAssets; state: ScopeState }) {
  const { accessory, accessoryPosition } = state.inputs
  if (
    accessory === 'none' ||
    accessoryPosition === 'none' ||
    accessoryPosition === 'in-channel' ||
    !state.pose
  )
    return null
  const entry = deviceData.accessories.find((item) =>
    item.states.some((entry) => entry.state === accessory),
  )!
  const node = entry.states.find((item) => item.state === accessory)!.node
  const distance = entry.tipOffsetBeyondScopeTipMm[accessoryPosition]
  const frame = scopeOpticalFrame(state.pose)
  // The working-channel offset is authored; distance is the distal tip offset, not the shaft origin.
  const position = plus(
    plus(frame.position, times(frame.forward, distance)),
    times(frame.up, -state.inputs.scopeOdMm * 0.28),
  )
  return (
    <group position={position} quaternion={modelQuaternion(state)}>
      <NamedModel assets={assets} file="devices/accessories.glb" name={node} />
    </group>
  )
}

export function PracticeTarget({
  assets,
  props,
}: {
  assets: ScopeSceneAssets
  props: ScopePaneProps
}) {
  const start = useMemo(
    () => createScopeState(props.view, assets.scopeCase),
    [props.view, assets.scopeCase],
  )
  if (!start.pose) return null
  const frame = scopeOpticalFrame(start.pose)
  const point = plus(
    plus(frame.position, times(frame.forward, propData.practiceTarget.aheadMm)),
    times(frame.up, propData.practiceTarget.radialOffsetMm),
  )
  return (
    <group position={point} quaternion={modelQuaternion(start)}>
      <NamedModel assets={assets} file="devices/findings.glb" name="PRACTICE_target" />
    </group>
  )
}

export function DistalScope({ assets, state }: { assets: ScopeSceneAssets; state: ScopeState }) {
  if (!state.pose) return null
  return (
    <group
      position={state.pose.tipLps}
      quaternion={modelQuaternion(state)}
      scale={state.inputs.scopeOdMm / propData.scopeTip.odMm}
    >
      <NamedModel assets={assets} file="devices/scope-tip.glb" />
    </group>
  )
}

export function HandleModel({ assets, state }: { assets: ScopeSceneAssets; state: ScopeState }) {
  const rotation = (state.inputs.rotationDeg * Math.PI) / 180
  const bend =
    ((-state.inputs.deflectionDeg / MODEL_DEFLECTION_LIMIT_DEG) *
      propData.handle.leverVisualLimitDeg *
      Math.PI) /
    180
  return (
    <group position={[28, 8, 28]} rotation={[0, 0, rotation]} scale={0.5}>
      <NamedModel assets={assets} file="devices/handle.glb" name="HANDLE_body" />
      <group position={propData.handle.leverPivotMm as Vec3} rotation={[bend, 0, 0]}>
        <NamedModel assets={assets} file="devices/handle.glb" name="HANDLE_lever" />
      </group>
      <group
        position={plus(propData.handle.suctionPivotMm as Vec3, [
          0,
          0,
          state.inputs.suction ? -propData.handle.suctionTravelMm : 0,
        ])}
      >
        <NamedModel assets={assets} file="devices/handle.glb" name="HANDLE_suction" />
      </group>
    </group>
  )
}

/** The visible shaft ends at the engine's tip; the distal bend follows its optical axis. */
export function AuthoredShaft({ state }: { state: ScopeState }) {
  const geometry = useMemo(() => {
    if (!state.pose) return null
    const pose = state.pose
    const frame = scopeOpticalFrame(pose)
    const start = plus(pose.tipLps, times(pose.tangentLps, -35))
    const end = plus(pose.tipLps, times(frame.forward, -6))
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...plus(pose.tipLps, times(pose.tangentLps, -18))),
      new THREE.Vector3(...plus(pose.tipLps, times(frame.forward, -12))),
      new THREE.Vector3(...end),
    )
    return new THREE.TubeGeometry(curve, 40, state.inputs.scopeOdMm / 2, 16, false)
  }, [state.pose, state.inputs.scopeOdMm])
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry ? (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#27313e" roughness={0.45} />
    </mesh>
  ) : null
}
