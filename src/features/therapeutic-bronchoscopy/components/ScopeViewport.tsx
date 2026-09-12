'use client'
import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createBronchoscopyMaterial } from '@/lib/airway-anatomy/airway-render'
import { sourceVisibility } from '@/lib/airway-anatomy/pathology/geometry'
import { verticalFov } from '@/lib/bronchoscopy-core/frame'
import {
  PathologyMeshes,
  BloodVisibilityOverlay,
} from '@/components/airway-anatomy/pathology/PathologyScene'
import { InstrumentMesh } from './InstrumentMesh'
import { contactDescription } from '../engine/instruments'
import type { Simulator } from '../engine/useSimulator'
import styles from '../therapeutic.module.css'

class ViewBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <p role="alert">The 3D view is unavailable. Reload the page to retry WebGL.</p>
    ) : (
      this.props.children
    )
  }
}
function Scene({ sim }: { sim: Simulator }) {
  const { camera, size, invalidate } = useThree(),
    light = useRef<THREE.PointLight>(null)
  const material = useMemo(() => createBronchoscopyMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    if (!sim.frame) return
    camera.position.set(...sim.frame.position)
    camera.up.set(...sim.frame.up)
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(...sim.frame.forward)))
    if (camera instanceof THREE.PerspectiveCamera) {
      // R3F owns this imperative Three.js camera, not React state.
      // eslint-disable-next-line react-hooks/immutability
      camera.fov = verticalFov(88, size.width / size.height)
      camera.updateProjectionMatrix()
    }
    light.current?.position.copy(camera.position)
    invalidate()
  }, [sim.frame, camera, size, invalidate])
  return (
    <>
      <color attach="background" args={['#090405']} />
      <ambientLight intensity={0.35} />
      <pointLight ref={light} intensity={18} decay={1} distance={110} />
      {sim.loaded && <mesh geometry={sim.loaded.geometry} material={material} dispose={null} />}
      <PathologyMeshes
        scene={sim.scene}
        bleeding={sim.normal ? 'off' : 'oozing'}
        time={sim.clock}
        elapsed={sim.clock.current}
        bloodAmount={sim.normal ? 0 : sim.instrument.blood}
      />
      {sim.frame && !sim.normal && (
        <InstrumentMesh frame={sim.frame} state={sim.instrument} contact={sim.contact} />
      )}
    </>
  )
}
export function ScopeViewport({ sim }: { sim: Simulator }) {
  const dragging = useRef<{ x: number; y: number } | null>(null)
  const text = sim.contact
    ? contactDescription(sim.contact, sim.instrument)
    : 'Preparing airway model'
  return (
    <section className={styles.optics} aria-label="Bronchoscope view">
      <div className={styles.viewLabel}>
        <span>BRONCHOSCOPE</span>
        <span>{sim.normal ? 'Normal reference' : sim.settings.site.replaceAll('-', ' ')}</span>
      </div>
      <div
        className={styles.viewport}
        tabIndex={0}
        aria-label="Scope controls: drag to steer, W and S to move, Q and E to roll"
        data-testid="bronchoscope-viewport"
        onPointerDown={(e) => {
          if (
            !sim.ready ||
            sim.busy ||
            (e.target instanceof HTMLElement && e.target.closest('button, input, select, a'))
          )
            return
          if (e.button === 0) {
            dragging.current = { x: e.clientX, y: e.clientY }
            e.currentTarget.setPointerCapture(e.pointerId)
          }
        }}
        onPointerMove={(e) => {
          if (dragging.current) {
            sim.move(
              0,
              (e.clientX - dragging.current.x) * 0.15,
              -(e.clientY - dragging.current.y) * 0.15,
            )
            dragging.current = { x: e.clientX, y: e.clientY }
          }
        }}
        onPointerUp={() => {
          dragging.current = null
        }}
        onPointerCancel={() => {
          dragging.current = null
        }}
        onKeyDown={(e) => {
          const keys: Record<string, number[]> = {
            w: [1],
            s: [-1],
            ArrowRight: [0, 2],
            ArrowLeft: [0, -2],
            ArrowUp: [0, 0, 2],
            ArrowDown: [0, 0, -2],
            q: [0, 0, 0, -4],
            e: [0, 0, 0, 4],
          }
          const d = keys[e.key]
          if (d) {
            e.preventDefault()
            sim.move(d[0], d[1], d[2], d[3])
          }
        }}
      >
        <ViewBoundary key={sim.revision}>
          <Canvas
            dpr={[1, 1.5]}
            camera={{ near: 0.15, far: 260 }}
            gl={{ antialias: true, alpha: false }}
            frameloop="demand"
          >
            <Scene sim={sim} />
          </Canvas>
        </ViewBoundary>
        <BloodVisibilityOverlay
          amount={sim.normal ? 0 : sim.instrument.blood}
          visibility={
            sim.frame && sim.pathology.placement && sim.loaded
              ? sourceVisibility(sim.frame, sim.pathology.placement, sim.loaded.lumen)
              : 0
          }
        />
        <div className={styles.reticle} aria-hidden="true" />
        {sim.instrument.outside && (
          <div className={styles.outside}>
            <strong>Assembly withdrawn</strong>
            <p>
              {sim.instrument.pending
                ? 'Tissue remains attached to the instrument.'
                : 'Specimen transferred.'}
            </p>
            <span className={styles.specimenVisual} aria-hidden="true" />
            <p>Use the retrieval controls to transfer tissue and re-enter.</p>
          </div>
        )}
        {(!sim.ready || sim.busy) && (
          <div className={styles.loading} role="status">
            {sim.error ||
              (sim.busy ? 'Separating tissue…' : 'Preparing the airway and editable tissue…')}
            {sim.error && <button onClick={sim.retry}>Reload model</button>}
          </div>
        )}
      </div>
      <div className={styles.viewStatus}>
        <span
          className={styles.contactDot}
          data-contact={sim.contact?.touching || sim.contact?.stalkInLoop}
        />
        <span>{text}</span>
      </div>
      <p className={styles.micro}>Drag to steer · W/S move · Q/E roll · Arrow keys deflect</p>
    </section>
  )
}
