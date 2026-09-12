'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { AirwaySurface, ScopeCamera } from '@/components/airway-anatomy/scope-primitives'
import { TEACHING_LUMEN_URL } from '../../engine/scope/scopeCase'
import { OPTICAL_FOV_DEG } from '../../engine/scope/scopeOstia'
import { DRACO_DECODER_PATH } from '../stage/scopeCaseLoader'
import type { ScopePaneProps } from './types'
import type { ScopeSceneAssets } from './scopeSceneAssets'
import { AccessoryTip, LarynxLumen, NamedModel, PracticeTarget, TubeModel } from './ScopeModels'

const identity = {
  sceneScale: 1,
  rotationDeg: [0, 0, 0] as [number, number, number],
  positionOffsetMm: [0, 0, 0] as [number, number, number],
}

function Headlight() {
  const light = useRef<THREE.PointLight>(null)
  const { camera } = useThree()
  useFrame(() => {
    light.current?.position.copy(camera.position)
  })
  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight ref={light} intensity={8} decay={1} distance={100} />
    </>
  )
}

export function ScopeOpticalView({
  assets,
  props,
}: {
  assets: ScopeSceneAssets
  props: ScopePaneProps
}) {
  const { state, view } = props
  return (
    <>
      <color attach="background" args={['#030609']} />
      {state.pose ? <ScopeCamera pose={state.pose} fovDeg={OPTICAL_FOV_DEG} /> : null}
      <Headlight />
      {state.place === 'bench' ? (
        <group position={[0, 0, 65]}>
          <NamedModel assets={assets} file="devices/bench.glb" />
        </group>
      ) : (
        <>
          {state.place !== 'larynx' ? (
            <AirwaySurface
              stlUrl={TEACHING_LUMEN_URL}
              transform={identity}
              mode="bronch"
              dracoDecoderPath={DRACO_DECODER_PATH}
            />
          ) : null}
          {view.mode === 'larynx-entry' ? <LarynxLumen assets={assets} state={state} /> : null}
          {view.mode === 'tube' ? <TubeModel assets={assets} state={state} /> : null}
          {view.mode === 'accessory' ? (
            <>
              <PracticeTarget assets={assets} props={props} />
              <AccessoryTip assets={assets} state={state} />
            </>
          ) : null}
        </>
      )}
    </>
  )
}
