'use client'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { channelOrigin, type InstrumentContact, type InstrumentState } from '../engine/instruments'
import { type OpticalFrame, times } from '@/lib/bronchoscopy-core/frame'

/** Articulated, generic instruments, modeled in millimetres with the tip along local -Z. */
export function InstrumentMesh({
  frame,
  state,
  contact,
}: {
  frame: OpticalFrame
  state: InstrumentState
  contact: InstrumentContact | null
}) {
  const matrix = useMemo(
    () =>
      new THREE.Matrix4()
        .makeBasis(
          new THREE.Vector3(...frame.right),
          new THREE.Vector3(...frame.up),
          new THREE.Vector3(...times(frame.forward, -1)),
        )
        .setPosition(...channelOrigin(frame)),
    [frame],
  )
  const metal = useMemo(
    () => new THREE.MeshPhongMaterial({ color: '#a8b3b7', specular: '#ffffff', shininess: 100 }),
    [],
  )
  const dark = useMemo(
    () => new THREE.MeshPhongMaterial({ color: '#727e83', specular: '#e7f4ff', shininess: 35 }),
    [],
  )
  const loop = useMemo(() => {
    const points: THREE.Vector3[] = []
    const width = state.open ? 5.8 : state.loopCaptured ? 1.5 : 0.24
    const length = state.open ? 4.5 : state.loopCaptured ? 2.7 : 1.4
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2
      points.push(new THREE.Vector3(Math.sin(a) * width, 0, Math.cos(a) * length))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 72, 0.12, 6, true)
  }, [state.open, state.loopCaptured])
  useEffect(
    () => () => {
      metal.dispose()
      dark.dispose()
    },
    [metal, dark],
  )
  useEffect(() => () => loop.dispose(), [loop])
  if (state.extension < 0.1 || state.outside) return null
  const capturedCenter =
    contact && state.loopCaptured
      ? new THREE.Vector3(...contact.stalk)
          .applyMatrix4(matrix.clone().invert())
          .applyAxisAngle(new THREE.Vector3(0, 0, 1), (state.rotation * Math.PI) / 180)
      : null
  const length = state.extension,
    head = state.id === 'snare' ? (state.open ? 9 : 3) : state.id === 'forceps' ? 2.6 : 1.2
  const shaft = Math.max(0.1, length - head)
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <group rotation={[0, 0, (-state.rotation * Math.PI) / 180]}>
        <mesh position={[0, 0, -shaft / 2]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
          <cylinderGeometry args={[0.65, 0.68, shaft, 16]} />
        </mesh>
        {state.id === 'forceps' && (
          <group position={[0, 0, -length + 2.1]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={metal}>
              <cylinderGeometry args={[0.48, 0.48, 1.7, 16]} />
            </mesh>
            {[-1, 1].map((side) => (
              <group key={side} rotation={[0, -side * (state.open ? 0.55 : 0.04), 0]}>
                <mesh
                  position={[side * 0.32, 0, -0.95]}
                  scale={[0.44, 0.65, 1.18]}
                  material={metal}
                >
                  <sphereGeometry args={[1, 20, 16, 0, Math.PI * 2, 0, Math.PI]} />
                </mesh>
                <mesh position={[side * 0.14, 0, -1]} scale={[0.12, 0.47, 0.8]}>
                  <sphereGeometry args={[1, 16, 12]} />
                  <meshPhongMaterial color="#34424a" shininess={60} />
                </mesh>
              </group>
            ))}
          </group>
        )}
        {state.id === 'cryoprobe' && (
          <>
            <mesh position={[0, 0, -length + 0.65]} rotation={[Math.PI / 2, 0, 0]} material={metal}>
              <cylinderGeometry args={[0.82, 0.82, 1.3, 20]} />
            </mesh>
            {(state.freezing || state.pending) && (
              <mesh position={[0, 0, -length]} scale={[1, 1, 1.1]}>
                <sphereGeometry args={[0.7 + state.adhesion * 2.4, 32, 20]} />
                <meshPhongMaterial
                  color="#dbeff2"
                  specular="#ffffff"
                  shininess={85}
                  transparent
                  opacity={0.3 + state.adhesion * 0.48}
                />
              </mesh>
            )}
          </>
        )}
        {state.id === 'snare' && (
          <mesh
            position={capturedCenter ?? [0, 0, -length + (state.open ? 4.5 : 1.4)]}
            geometry={loop}
            material={metal}
          />
        )}
        {state.pending && (
          <mesh position={capturedCenter ?? [0, 0, -length - 0.5]} scale={[1, 0.85, 1.1]}>
            <sphereGeometry args={[state.pending.radius * 0.65, 20, 16]} />
            <meshPhongMaterial
              color={state.id === 'snare' ? '#903b30' : '#be6554'}
              specular="#f6dad0"
              shininess={50}
            />
          </mesh>
        )}
      </group>
    </group>
  )
}
