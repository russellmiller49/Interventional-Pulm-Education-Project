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
  AuthoredShaft,
  DistalScope,
  HandleModel,
  LarynxLumen,
  NamedModel,
  PracticeTarget,
  TubeModel,
} from './ScopeModels'

function ObserverCamera({ center, offset, up }: { center: Vec3; offset: Vec3; up: Vec3 }) {
  const { camera, invalidate } = useThree()
  useFrame(() => {
    camera.position.set(...plus(center, offset))
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
          : [0, -310, 10]
  const up: Vec3 = bench ? [0, 1, 0] : [0, 0, 1]
  return (
    <>
      <color attach="background" args={['#0e1b28']} />
      <ObserverCamera center={center} offset={offset} up={up} />
      <ambientLight intensity={1.7} />
      <directionalLight position={plus(center, [30, -60, 70])} intensity={3} />
      {bench ? (
        <>
          <HandleModel assets={assets} state={state} />
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
          <meshStandardMaterial color="#64bac2" roughness={0.6} transparent opacity={0.4} />
        </mesh>
      )}
      {bench || larynx || tube || accessory ? (
        <>
          <AuthoredShaft state={state} />
          <DistalScope assets={assets} state={state} />
        </>
      ) : state.pose ? (
        <ScopeBody graph={assets.scopeCase.graph} pose={state.pose} />
      ) : null}
    </>
  )
}
