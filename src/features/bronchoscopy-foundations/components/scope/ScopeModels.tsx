'use client'

import { createBronchoscopyMaterial } from '@/lib/airway-anatomy/airway-render'
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
import { drawnCordWeight } from './scopeSceneModel'
import { MODEL_DEFLECTION_LIMIT_DEG } from '../../engine/scope/scopeInputs'
import { LARYNX_GLOTTIS_MM, TUBE_START_MM, TUBE_TIP_MM } from '../../engine/scope/scopeScripts'
import type { LarynxOutsideLook } from './larynxOutsideView'
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

/** Fixed authored practice object, observed by both cameras from the same world coordinates. */
export function BenchTarget({ view }: Pick<ScopePaneProps, 'view'>) {
  if (!view.benchTarget) return null
  return (
    <group position={view.benchTarget.point}>
      <mesh>
        <ringGeometry args={[view.benchTarget.radiusMm * 0.65, view.benchTarget.radiusMm, 48]} />
        <meshBasicMaterial color="#ffce57" side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <circleGeometry args={[view.benchTarget.radiusMm * 0.25, 24]} />
        <meshBasicMaterial color="#fff0b0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/**
 * How each part of the model larynx is drawn from outside.
 *
 * `inside`: the cartilages as pale glass, the mucosa as a thin pink skin inside them, the true
 * folds and the hyoid solid, so the scope and the folds it is passing are seen through everything
 * round them. `order` draws the inner layers first, so each layer tints the ones inside it.
 * `solid`: every part opaque in its own tissue colour, as the larynx is built.
 */
interface OutsideLook {
  readonly color: string
  readonly opacity: number
  readonly roughness: number
  readonly order: number
}
const MUCOSA_SKIN: OutsideLook = { color: '#e0958c', opacity: 0.3, roughness: 0.5, order: 1 }
const FALSE_FOLD: OutsideLook = { color: '#d9827b', opacity: 0.5, roughness: 0.5, order: 1 }
const HYALINE: OutsideLook = { color: '#d3e6ee', opacity: 0.3, roughness: 0.3, order: 3 }
const MEMBRANE: OutsideLook = { color: '#f0d6c8', opacity: 0.08, roughness: 0.6, order: 5 }
const LARYNX_INSIDE_LOOK: Readonly<Record<string, OutsideLook>> = {
  UA_lumen: MUCOSA_SKIN,
  UA_subglottis: MUCOSA_SKIN,
  UA_trachea_wall: MUCOSA_SKIN,
  UA_fold_false_L: FALSE_FOLD,
  UA_fold_false_R: FALSE_FOLD,
  UA_fold_true_L: { color: '#ffffff', opacity: 1, roughness: 0.35, order: 0 },
  UA_fold_true_R: { color: '#ffffff', opacity: 1, roughness: 0.35, order: 0 },
  UA_arytenoid_L: { ...HYALINE, opacity: 0.75, order: 2 },
  UA_arytenoid_R: { ...HYALINE, opacity: 0.75, order: 2 },
  UA_epiglottis: { color: '#ecd9a0', opacity: 0.4, roughness: 0.4, order: 2 },
  UA_cricoid: { ...HYALINE, opacity: 0.42 },
  UA_tracheal_rings: { ...HYALINE, opacity: 0.55 },
  UA_thyroid: { ...HYALINE, order: 4 },
  UA_hyoid: { color: '#efe6cc', opacity: 1, roughness: 0.55, order: 0 },
  UA_thyrohyoid_membrane: MEMBRANE,
  UA_cricothyroid_ligament: { ...MEMBRANE, opacity: 0.2 },
}
const SOLID_MUCOSA: OutsideLook = { color: '#d68c82', opacity: 1, roughness: 0.5, order: 0 }
const SOLID_HYALINE: OutsideLook = { color: '#c6d8de', opacity: 1, roughness: 0.42, order: 0 }
const SOLID_MEMBRANE: OutsideLook = { color: '#e9dfd2', opacity: 1, roughness: 0.7, order: 0 }
const LARYNX_SOLID_LOOK: Readonly<Record<string, OutsideLook>> = {
  UA_fold_true_L: { color: '#ffffff', opacity: 1, roughness: 0.35, order: 0 },
  UA_fold_true_R: { color: '#ffffff', opacity: 1, roughness: 0.35, order: 0 },
  UA_arytenoid_L: SOLID_HYALINE,
  UA_arytenoid_R: SOLID_HYALINE,
  UA_cricoid: SOLID_HYALINE,
  UA_tracheal_rings: SOLID_HYALINE,
  UA_thyroid: SOLID_HYALINE,
  UA_epiglottis: { color: '#e0cc8e', opacity: 1, roughness: 0.45, order: 0 },
  UA_hyoid: { color: '#efe6cc', opacity: 1, roughness: 0.55, order: 0 },
  UA_thyrohyoid_membrane: SOLID_MEMBRANE,
  UA_cricothyroid_ligament: SOLID_MEMBRANE,
}
/** The mucosa the scope sees. Every other part is the framework under it, drawn only from outside. */
const LARYNX_MUCOSA = /^UA_(lumen|subglottis|fold_)/

export function LarynxLumen({
  assets,
  state,
  outside,
}: {
  assets: ScopeSceneAssets
  state: ScopeState
  /** Drawn from outside, and how; left out, the larynx is drawn as the scope sees it. */
  outside?: LarynxOutsideLook
}) {
  const source = assets.models.get('larynx/larynx-lumen.glb')!.scene
  const model = useMemo(() => {
    const copy = source.clone(true)
    copy.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      const trueFold = node.name.startsWith('UA_fold_true')
      if (outside) {
        const look =
          outside === 'solid'
            ? (LARYNX_SOLID_LOOK[node.name] ?? SOLID_MUCOSA)
            : (LARYNX_INSIDE_LOOK[node.name] ?? MUCOSA_SKIN)
        const solid = look.opacity >= 1
        node.renderOrder = look.order
        node.material = new THREE.MeshPhysicalMaterial({
          color: look.color,
          // A true fold carries its own colour, pearly at the free edge and pink at the wall.
          vertexColors: trueFold,
          roughness: look.roughness,
          clearcoat: 0.35,
          clearcoatRoughness: 0.4,
          side: THREE.DoubleSide,
          transparent: !solid,
          opacity: look.opacity,
          // A see-through layer must not hide what lies inside it.
          depthWrite: solid,
        })
        return
      }
      if (!LARYNX_MUCOSA.test(node.name)) {
        // From the scope the framework is under the mucosa: the wall's own relief shows the
        // arytenoid mounds and the epiglottic tubercle. The cartilages are for the outside view.
        node.visible = false
        return
      }
      if (trueFold) {
        // The true folds: pearly white and wet, against the pink of everything round them. A
        // standard material, because the folds open and close by a morph target.
        node.material = new THREE.MeshPhysicalMaterial({
          // The model gives each fold its colour: pearly at the free edge, pink toward the wall.
          color: '#ffffff',
          vertexColors: true,
          // Lit by the headlight alone they went grey; a fold is the brightest thing in the view.
          emissive: '#5e4d3c',
          roughness: 0.3,
          clearcoat: 0.6,
          clearcoatRoughness: 0.25,
          side: THREE.DoubleSide,
        })
        return
      }
      // Seen from the scope, the larynx's wall, the false folds, the epiglottis and the arytenoids
      // are one continuous mucosa, the same tissue as the trachea below: the same colour, vessels
      // and sheen, with no rings (none of them carries a ring attribute). As flat colours they
      // were separate cut-out shapes, and a wall was one blank colour when the tip turned to it.
      const mucosa = createBronchoscopyMaterial(undefined, { anatomy: true })
      mucosa.side = THREE.DoubleSide
      node.material = mucosa
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
  // The scope is through the glottis from just short of its plane, and for as long as the tip is
  // further on, in the subglottis or the trachea.
  const through = state.place === 'airway' || state.depthMm >= LARYNX_GLOTTIS_MM - 0.5
  useEffect(() => {
    for (const name of ['UA_fold_true_L', 'UA_fold_true_R']) {
      const mesh = model.getObjectByName(name) as THREE.Mesh | undefined
      if (mesh?.morphTargetInfluences)
        mesh.morphTargetInfluences[0] = drawnCordWeight(state.inputs.cords, through)
    }
  }, [model, state.inputs.cords, through])
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
export function AuthoredShaft({
  state,
  color = '#27313e',
}: {
  state: ScopeState
  /** A lighter shaft where it must be picked out through other things. */
  color?: string
}) {
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
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  ) : null
}

/**
 * The scope where something solid hides it: the same shaft, drawn pale and see-through only where
 * it lies behind what is in front, with its tip marked. In the outside view of the larynx the
 * scope is inside the cartilages for the whole of the step.
 */
export function HiddenScopeTrace({ state }: { state: ScopeState }) {
  const geometry = useMemo(() => {
    if (!state.pose) return null
    const pose = state.pose
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(...plus(pose.tipLps, times(pose.tangentLps, -35))),
      new THREE.Vector3(...pose.tipLps),
    )
    return new THREE.TubeGeometry(curve, 8, state.inputs.scopeOdMm / 2, 16, false)
  }, [state.pose, state.inputs.scopeOdMm])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry || !state.pose) return null
  return (
    <>
      <mesh geometry={geometry} renderOrder={15}>
        <meshBasicMaterial
          color="#a9dcff"
          transparent
          opacity={0.5}
          depthFunc={THREE.GreaterDepth}
          depthWrite={false}
        />
      </mesh>
      <mesh position={state.pose.tipLps} renderOrder={20} data-position-tip>
        <sphereGeometry args={[1.5, 20, 14]} />
        <meshBasicMaterial color="#ffd166" depthTest={false} />
      </mesh>
    </>
  )
}
