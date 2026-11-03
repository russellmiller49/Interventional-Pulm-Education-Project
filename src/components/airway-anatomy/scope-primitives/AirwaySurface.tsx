'use client'

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

import { HandoffContent } from '@/i18n/handoff'
import {
  createBronchoscopyMaterial,
  loadAirwayStlGeometry,
  type MucosaTint,
} from '@/lib/airway-anatomy/airway-render'
import type { AirwayAnatomyCaseManifest, Vec3 } from '@/lib/airway-anatomy/types'

/**
 * The airway lumen as a mesh: the endoluminal mucosa in `bronch` mode, a translucent shell in
 * `tree` mode. `dracoDecoderPath` is additive: set it for a Draco-compressed GLB (the Bronchoscopy
 * Foundations teaching lumen); the admin module's STL and reviewed GLB load exactly as before.
 */
export function AirwaySurface({
  stlUrl,
  transform,
  mode,
  dracoDecoderPath,
  mucosaTint,
}: {
  stlUrl: string | null
  transform: AirwayAnatomyCaseManifest['airwayTransform']
  mode: 'bronch' | 'tree'
  dracoDecoderPath?: string
  /** A case's own mucosa tones (the dolphin case); omitted, the shared tones. */
  mucosaTint?: MucosaTint
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    if (!stlUrl) return
    let cancelled = false
    loadAirwayStlGeometry(stlUrl, dracoDecoderPath ? { dracoDecoderPath } : undefined)
      .then((nextGeometry) => {
        if (!cancelled) {
          setGeometry(nextGeometry)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGeometry(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [dracoDecoderPath, stlUrl])

  const material = useMemo(
    () =>
      mode === 'bronch'
        ? createBronchoscopyMaterial(mucosaTint)
        : new THREE.MeshStandardMaterial({
            color: '#7dd3fc',
            roughness: 0.55,
            metalness: 0.02,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          }),
    [mode, mucosaTint],
  )

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  if (!stlUrl || !geometry) return <HandoffContent>{null}</HandoffContent>

  return (
    <HandoffContent>
      {
        <mesh
          geometry={geometry}
          material={material}
          scale={transform.sceneScale}
          rotation={transform.rotationDeg.map((deg) => THREE.MathUtils.degToRad(deg)) as Vec3}
          position={transform.positionOffsetMm}
        />
      }
    </HandoffContent>
  )
}
