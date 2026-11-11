'use client'

import { useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ScopeBody } from '@/components/airway-anatomy/scope-primitives'
import type { Vec3 } from '@/lib/airway-anatomy/types'
import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import { plus } from '@/lib/bronchoscopy-core/frame'
import type { ScopePaneProps } from './types'
import type { ScopeSceneAssets } from './scopeSceneAssets'
import {
  AccessoryTip,
  BenchTarget,
  AuthoredShaft,
  DistalScope,
  HandleModel,
  LarynxLumen,
  NamedModel,
  PracticeTarget,
  TubeModel,
} from './ScopeModels'

/** Half the width and half the height, in millimetres, the camera must keep in the picture. */
interface ObserverFit {
  readonly halfWidthMm: number
  readonly halfHeightMm: number
}

function ObserverCamera({
  center,
  offset,
  up,
  fit,
}: {
  center: Vec3
  offset: Vec3
  up: Vec3
  /** Stand back along `offset` far enough to show this much, whatever shape the panel is. */
  fit?: ObserverFit
}) {
  const { camera, invalidate } = useThree()
  useFrame(({ size }) => {
    let from = offset
    if (fit && 'fov' in camera && size.width > 0 && size.height > 0) {
      const half = Math.tan(((camera.fov as number) * Math.PI) / 360)
      const distance = Math.max(
        fit.halfHeightMm / half,
        fit.halfWidthMm / (half * (size.width / size.height)),
      )
      const length = Math.hypot(...offset) || 1
      from = [
        (offset[0] / length) * distance,
        (offset[1] / length) * distance,
        (offset[2] / length) * distance,
      ]
    }
    camera.position.set(...plus(center, from))
    camera.up.set(...up)
    camera.lookAt(...center)
    camera.updateMatrixWorld()
  })
  useLayoutEffect(() => {
    invalidate()
  }, [camera, center, offset, up, invalidate])
  return null
}

export function ObserverView({
  assets,
  props,
}: {
  assets: ScopeSceneAssets
  props: ScopePaneProps
}) {
  const { state, view } = props
  const bench = view.mode === 'controls-isolated'
  const larynx = view.mode === 'larynx-entry'
  const tube = view.mode === 'tube'
  const accessory = view.mode === 'accessory'
  // Beside the scope view on a step that drives through the airways: the whole tree from the
  // front, closer than the idle model, with the tip marked so it reads at a glance.
  const position = !bench && !larynx && !tube && !accessory && view.mode !== 'idle'
  const center: Vec3 = bench
    ? [8, 0, 15]
    : larynx
      ? [-10, -192, -30]
      : tube
        ? sampleEdgePose(assets.scopeCase.index.edgesById.get(0)!, 52).point
        : accessory
          ? state.pose!.tipLps
          : [-4, -172, -160]
  const offset: Vec3 = bench
    ? [125, 60, -145]
    : larynx
      ? [75, -30, 20]
      : tube
        ? [35, -80, 30]
        : accessory
          ? [25, -20, 12]
          : position
            ? [0, -262, 6]
            : [0, -310, 10]
  const up: Vec3 = bench ? [0, 1, 0] : [0, 0, 1]
  return (
    <>
      <color attach="background" args={['#0e1b28']} />
      <ObserverCamera
        center={center}
        offset={offset}
        up={up}
        fit={position ? { halfWidthMm: 128, halfHeightMm: 118 } : undefined}
      />
      <ambientLight intensity={1.7} />
      <directionalLight position={plus(center, [30, -60, 70])} intensity={3} />
      {bench ? (
        <>
          <HandleModel assets={assets} state={state} />
          <BenchTarget view={view} />
          <group position={[0, 0, 65]}>
            <NamedModel assets={assets} file="devices/bench.glb" />
          </group>
        </>
      ) : larynx ? (
        <LarynxLumen assets={assets} state={state} outside />
      ) : tube ? (
        <TubeModel assets={assets} state={state} outside />
      ) : accessory ? (
        <>
          <PracticeTarget assets={assets} props={props} />
          <AccessoryTip assets={assets} state={state} />
        </>
      ) : (
        <mesh geometry={assets.lumen}>
          <meshStandardMaterial
            color="#64bac2"
            roughness={0.6}
            transparent
            opacity={position ? 0.3 : 0.4}
            // The scope lies inside this wall; the wall must not hide it.
            depthWrite={!position}
          />
        </mesh>
      )}
      {bench || larynx || tube || accessory ? (
        <>
          <AuthoredShaft state={state} />
          <DistalScope assets={assets} state={state} />
        </>
      ) : state.pose ? (
        <>
          <ScopeBody graph={assets.scopeCase.graph} pose={state.pose} />
          {position ? (
            <mesh position={state.pose.tipLps} renderOrder={10} data-position-tip>
              <sphereGeometry args={[3.4, 20, 14]} />
              <meshBasicMaterial color="#ffd166" depthTest={false} />
            </mesh>
          ) : null}
        </>
      ) : null}
    </>
  )
}
