import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import type { LoadFrame } from '../../engine/learningLabTypes'

export interface StentDeformationUniforms {
  uAxialOffset: { value: number }
  uAxialScale: { value: number }
  uBendRadians: { value: number }
  uHalfLength: { value: number }
  uRadialScaleX: { value: number }
  uRadialScaleZ: { value: number }
  uTwistRadians: { value: number }
}

interface DeformableStentMaterialOptions {
  clearcoat?: number
  color: THREE.ColorRepresentation
  depthWrite?: boolean
  halfLength?: number
  metalness: number
  opacity?: number
  roughness: number
  side?: THREE.Side
  transparent?: boolean
}

/**
 * Creates a polished material whose geometry is deformed in the vertex shader.
 * The uniforms describe imposed motion only; they never encode force, pressure,
 * stress, or a product-specific mechanical ranking.
 */
export function useDeformableStentMaterial({
  clearcoat = 0.18,
  color,
  depthWrite = true,
  halfLength = 2.4,
  metalness,
  opacity = 1,
  roughness,
  side = THREE.FrontSide,
  transparent = false,
}: DeformableStentMaterialOptions) {
  const uniforms = useMemo<StentDeformationUniforms>(
    () => ({
      uAxialOffset: { value: 0 },
      uAxialScale: { value: 1 },
      uBendRadians: { value: 0 },
      uHalfLength: { value: halfLength },
      uRadialScaleX: { value: 1 },
      uRadialScaleZ: { value: 1 },
      uTwistRadians: { value: 0 },
    }),
    [halfLength],
  )

  const material = useMemo(() => {
    const nextMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat,
      clearcoatRoughness: Math.min(1, roughness + 0.16),
      color,
      depthWrite,
      metalness,
      opacity,
      roughness,
      side,
      transparent,
    })

    nextMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uAxialOffset;
          uniform float uAxialScale;
          uniform float uBendRadians;
          uniform float uHalfLength;
          uniform float uRadialScaleX;
          uniform float uRadialScaleZ;
          uniform float uTwistRadians;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          objectNormal.x /= max(uRadialScaleX, 0.05);
          objectNormal.y /= max(uAxialScale, 0.05);
          objectNormal.z /= max(uRadialScaleZ, 0.05);

          float normalAxialPosition = clamp(position.y / (2.0 * uHalfLength) + 0.5, 0.0, 1.0);
          float normalTwist = uTwistRadians * (normalAxialPosition - 0.5);
          float normalTwistCos = cos(normalTwist);
          float normalTwistSin = sin(normalTwist);
          vec2 normalTwisted = vec2(
            objectNormal.x * normalTwistCos - objectNormal.z * normalTwistSin,
            objectNormal.x * normalTwistSin + objectNormal.z * normalTwistCos
          );
          objectNormal.x = normalTwisted.x;
          objectNormal.z = normalTwisted.y;

          if (abs(uBendRadians) > 0.0001) {
            float normalBendTheta = (position.y / uHalfLength) * uBendRadians;
            float normalBendCos = cos(normalBendTheta);
            float normalBendSin = sin(normalBendTheta);
            vec2 normalBent = vec2(
              objectNormal.x * normalBendCos - objectNormal.y * normalBendSin,
              objectNormal.x * normalBendSin + objectNormal.y * normalBendCos
            );
            objectNormal.x = normalBent.x;
            objectNormal.y = normalBent.y;
          }`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float axialPosition = clamp(position.y / (2.0 * uHalfLength) + 0.5, 0.0, 1.0);
          transformed.x *= uRadialScaleX;
          transformed.z *= uRadialScaleZ;
          transformed.y = transformed.y * uAxialScale + uAxialOffset;

          float twistAngle = uTwistRadians * (axialPosition - 0.5);
          float twistCos = cos(twistAngle);
          float twistSin = sin(twistAngle);
          vec2 twisted = vec2(
            transformed.x * twistCos - transformed.z * twistSin,
            transformed.x * twistSin + transformed.z * twistCos
          );
          transformed.x = twisted.x;
          transformed.z = twisted.y;

          if (abs(uBendRadians) > 0.0001) {
            float bendSign = sign(uBendRadians);
            float bendRadius = uHalfLength / max(abs(uBendRadians), 0.0001);
            float bendTheta = (transformed.y / uHalfLength) * uBendRadians;
            float localRadius = bendRadius - bendSign * transformed.x;
            transformed.x = bendSign * (bendRadius - localRadius * cos(bendTheta));
            transformed.y = localRadius * sin(bendTheta);
          }`,
        )
    }

    nextMaterial.customProgramCacheKey = () =>
      `airway-stent-learning-lab-${transparent ? 'transparent' : 'opaque'}-${side}`

    return nextMaterial
  }, [clearcoat, color, depthWrite, metalness, opacity, roughness, side, transparent, uniforms])

  useEffect(() => () => material.dispose(), [material])

  return { material, uniforms }
}

export function applyLoadFrameToUniforms(uniforms: StentDeformationUniforms, frame: LoadFrame) {
  uniforms.uAxialOffset.value = frame.axialOffset
  uniforms.uAxialScale.value = frame.axialScale
  uniforms.uBendRadians.value = frame.bendRadians
  uniforms.uRadialScaleX.value = frame.radialScaleX
  uniforms.uRadialScaleZ.value = frame.radialScaleZ
  uniforms.uTwistRadians.value = frame.twistRadians
}
