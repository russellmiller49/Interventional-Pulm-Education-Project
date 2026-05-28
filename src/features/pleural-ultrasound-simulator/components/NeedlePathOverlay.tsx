'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

import type { PleuralProbeState } from '../types'
import { needleEndpoint, probeOrigin } from '../engine/sectorGeometry'

interface NeedlePathOverlayProps {
  probe: PleuralProbeState
  unsafe: boolean
}

export function NeedlePathOverlay({ probe, unsafe }: NeedlePathOverlayProps) {
  const line = useMemo(() => {
    const origin = probeOrigin(probe)
    const endpoint = needleEndpoint(probe, probe.depthCm * 10)
    const positions = new Float32Array([...origin, ...endpoint])
    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({
      color: unsafe ? '#f59e0b' : '#10b981',
      linewidth: 2,
    })
    return new THREE.Line(nextGeometry, material)
  }, [probe, unsafe])

  return <primitive object={line} />
}
