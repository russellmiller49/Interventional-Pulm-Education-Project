'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { CARDIAC_DRACO_PATH } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import { useWebGLSupport } from '@/features/cardiac-anatomy/components/useCardiac3DSupport'
import { CARDIAC_RIG, cardiacAssetUrl } from '@/features/cardiac-anatomy/content/rig'

import { impellaAnatomyVariants, type ImpellaAnatomyVariant } from '../content'
import styles from './mechanical-circulatory-support.module.css'

function VariantModel({ variant }: { variant: ImpellaAnatomyVariant }) {
  const source = useGLTF(cardiacAssetUrl(variant.asset), CARDIAC_DRACO_PATH)
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(source.scene) as THREE.Group
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.frustumCulled = false
      const material = Array.isArray(object.material) ? object.material[0] : object.material
      const next = material.clone()
      if (next instanceof THREE.MeshStandardMaterial) {
        next.emissive.setRGB(0, 0, 0)
        next.emissiveIntensity = 0
        next.metalness = Math.min(0.4, Math.max(0.12, next.metalness))
        next.roughness = Math.max(0.28, next.roughness)
      }
      object.material = next
    })
    return clone
  }, [source.scene])

  useEffect(
    () => () => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
    },
    [model],
  )

  return (
    <group rotation={[Math.PI, 0, 0]} scale={1.38}>
      <primitive object={model} dispose={null} />
    </group>
  )
}

export function ImpellaVariantPreview() {
  const webglReady = useWebGLSupport()
  const [selectedId, setSelectedId] = useState<ImpellaAnatomyVariant['id']>('cp')
  const selected =
    impellaAnatomyVariants.find((variant) => variant.id === selectedId) ?? impellaAnatomyVariants[0]
  const camera = CARDIAC_RIG.cameras.preview

  return (
    <section className={styles.impellaPreview} aria-labelledby="impella-anatomy-preview-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.kicker}>ANATOMY-ONLY COMPARISON</span>
        <h2 id="impella-anatomy-preview-heading">
          Recognize the pump pathway before comparing support
        </h2>
        <p>
          CP is the active LV-support simulation. The 5.5 and RP models are provided only to compare
          device shape and source-to-return anatomy.
        </p>
      </div>
      <div className={styles.impellaPreviewGrid}>
        <div>
          <div
            className={styles.impellaVariantTabs}
            role="group"
            aria-label="Choose Impella anatomy model"
          >
            {impellaAnatomyVariants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                aria-pressed={selected.id === variant.id}
                onClick={() => setSelectedId(variant.id)}
              >
                {variant.label}
              </button>
            ))}
          </div>
          <dl>
            <div>
              <dt>Pathway</dt>
              <dd>{selected.pathway}</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{selected.teachingBoundary}</dd>
            </div>
          </dl>
        </div>
        <div className={styles.impellaPreviewViewport} aria-hidden="true">
          {!webglReady ? (
            <div>
              <strong>{selected.label}</strong>
              <span>{selected.pathway}</span>
            </div>
          ) : (
            <CanvasErrorBoundary fallback={<div>3D preview unavailable.</div>}>
              <Canvas
                key={selected.id}
                dpr={[1, 1.5]}
                camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 20 }}
                gl={{ antialias: true, powerPreference: 'high-performance' }}
              >
                <ambientLight intensity={1.7} />
                <directionalLight position={[3, 4, 5]} intensity={2.5} />
                <directionalLight position={[-3, 1, 2]} intensity={0.7} color="#9adbd4" />
                <Suspense fallback={null}>
                  <VariantModel variant={selected} />
                </Suspense>
                <OrbitControls
                  enablePan={false}
                  minDistance={camera.minDistance}
                  maxDistance={camera.maxDistance}
                  target={camera.target}
                />
              </Canvas>
            </CanvasErrorBoundary>
          )}
          <span>{selected.label} · isolated educational model</span>
        </div>
      </div>
    </section>
  )
}
