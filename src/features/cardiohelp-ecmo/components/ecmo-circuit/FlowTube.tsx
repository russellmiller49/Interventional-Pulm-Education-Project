'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import {
  createBloodCoreMaterial,
  createFlowUniforms,
  createTubeWallMaterial,
  type FlowUniforms,
} from './flowMaterials'
import { buildFlowTubeGeometry } from './tubeGeometry'
import { CHATTER_HZ, chatterPinchAmount } from './chatter'
import { PALETTE } from './constants'

const DASH_LENGTH = 0.22

export interface FlowTubeProps {
  curve: THREE.CatmullRomCurve3
  wallRadius: number
  coreRadius: number
  tint: THREE.Color
  /** 1 while this limb should show motion, 0 when stopped. */
  flowTarget: number
  speed: number
  direction: 1 | -1
  /** 0 open .. 1 fully crimped at pinchU. */
  pinchTarget: number
  pinchU: number
  /** Secondary wide pinch (drainage suck-down cue), 0..1. */
  collapseTarget?: number
  /**
   * Drives the suck-down as a repeating judder rather than a held deformation.
   *
   * This is what a chattering drainage line does at the bedside: the vessel or cannula is drawn
   * shut and springs open again several times a second. Under reduced motion the same
   * `collapseTarget` is held static instead — deep enough to be unmistakable, but still.
   */
  chatter?: boolean
  reduceMotion: boolean
  wallColor?: string
  cacheKey: string
}

export function FlowTube({
  curve,
  wallRadius,
  coreRadius,
  tint,
  flowTarget,
  speed,
  direction,
  pinchTarget,
  pinchU,
  collapseTarget = 0,
  chatter = false,
  reduceMotion,
  wallColor = PALETTE.tubeWall,
  cacheKey,
}: FlowTubeProps) {
  const chatterPhase = useRef(0)
  const uniforms = useMemo<FlowUniforms>(createFlowUniforms, [])
  const wallUniforms = useMemo(
    () => ({
      uPinchU: { value: 0.5 },
      uPinchWidth: { value: 0.045 },
      uPinchAmount: { value: 0 },
    }),
    [],
  )
  const materials = useMemo(
    () => ({
      core: createBloodCoreMaterial(uniforms),
      wall: createTubeWallMaterial(wallUniforms, wallColor, `${cacheKey}-wall`),
    }),
    // Materials are created once per limb; tint updates flow through uniforms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const geometries = useMemo(
    () => ({
      wall: buildFlowTubeGeometry(curve, wallRadius, 14),
      core: buildFlowTubeGeometry(curve, coreRadius, 12),
    }),
    [coreRadius, curve, wallRadius],
  )
  const curveLength = useMemo(() => curve.getLength(), [curve])

  useEffect(() => {
    return () => {
      geometries.wall.dispose()
      geometries.core.dispose()
    }
  }, [geometries])

  useEffect(() => {
    return () => {
      materials.core.dispose()
      materials.wall.dispose()
    }
  }, [materials])

  useFrame((_, delta) => {
    uniforms.uDashRepeat.value = curveLength / DASH_LENGTH
    uniforms.uTint.value.copy(tint)
    materials.core.color.copy(tint)
    if (!reduceMotion) {
      uniforms.uFlowPhase.value =
        (uniforms.uFlowPhase.value + delta * speed * direction * uniforms.uDashRepeat.value) % 1000
    }
    const strengthTarget = reduceMotion ? (flowTarget > 0 ? 0.5 : 0) : flowTarget
    uniforms.uFlowStrength.value = THREE.MathUtils.damp(
      uniforms.uFlowStrength.value,
      strengthTarget,
      6,
      delta,
    )
    const collapse = Math.max(0, Math.min(1, collapseTarget))
    const pinch = Math.max(0, Math.min(1, pinchTarget))
    const useCollapse = collapse > pinch
    const targetU = useCollapse ? 0.5 : pinchU
    const targetWidth = useCollapse ? 0.45 : 0.045
    let targetAmount = useCollapse ? collapse * 0.35 : pinch
    if (useCollapse && chatter) {
      if (!reduceMotion) chatterPhase.current = (chatterPhase.current + delta * CHATTER_HZ) % 1
      targetAmount = chatterPinchAmount({
        collapse,
        phase: chatterPhase.current,
        reduceMotion,
      })
    }
    for (const set of [uniforms, wallUniforms]) {
      set.uPinchU.value = THREE.MathUtils.damp(set.uPinchU.value, targetU, 10, delta)
      set.uPinchWidth.value = THREE.MathUtils.damp(set.uPinchWidth.value, targetWidth, 10, delta)
      // The judder is the signal, so it is written straight through rather than damped toward —
      // a 9/s damp against a 4.5 Hz square-ish drive would smooth the chatter into a hum.
      set.uPinchAmount.value =
        reduceMotion || (useCollapse && chatter)
          ? targetAmount
          : THREE.MathUtils.damp(set.uPinchAmount.value, targetAmount, 9, delta)
    }
  })

  return (
    <group>
      <mesh geometry={geometries.wall} material={materials.wall} castShadow receiveShadow />
      <mesh geometry={geometries.core} material={materials.core} />
    </group>
  )
}
