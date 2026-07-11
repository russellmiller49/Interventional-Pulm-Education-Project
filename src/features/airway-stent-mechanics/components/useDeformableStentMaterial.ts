import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import type { DeviceLoadFrame } from '@/features/airway-stent-mechanics/content/deviceArchitectureProfiles'
import { DEVICE_LENGTH } from '@/features/airway-stent-mechanics/engine/deviceGeometry'

export interface DeformationUniforms {
  uAxialCoupling: { value: number }
  uBend: { value: number }
  uCompression: { value: number }
  uEccentricity: { value: number }
  uFocalCenter: { value: number }
  uFocality: { value: number }
  uFocusWidth: { value: number }
  uHalfLength: { value: number }
  uOvalization: { value: number }
  uTwistGain: { value: number }
}

export function useDeformableStentMaterial({
  axialCoupling,
  color,
  depthWrite = true,
  metalness,
  opacity = 1,
  roughness,
  side = THREE.FrontSide,
  transparent = false,
  twistGain,
}: {
  axialCoupling: number
  color: THREE.ColorRepresentation
  depthWrite?: boolean
  metalness: number
  opacity?: number
  roughness: number
  side?: THREE.Side
  transparent?: boolean
  twistGain: number
}) {
  const uniforms = useMemo<DeformationUniforms>(
    () => ({
      uAxialCoupling: { value: axialCoupling },
      uBend: { value: 0 },
      uCompression: { value: 0 },
      uEccentricity: { value: 0 },
      uFocalCenter: { value: 0.5 },
      uFocality: { value: 0 },
      uFocusWidth: { value: 0.3 },
      uHalfLength: { value: DEVICE_LENGTH * 0.5 },
      uOvalization: { value: 0 },
      uTwistGain: { value: twistGain },
    }),
    [axialCoupling, twistGain],
  )

  const material = useMemo(() => {
    const nextMaterial = new THREE.MeshStandardMaterial({
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
          uniform float uAxialCoupling;
          uniform float uBend;
          uniform float uCompression;
          uniform float uEccentricity;
          uniform float uFocalCenter;
          uniform float uFocality;
          uniform float uFocusWidth;
          uniform float uHalfLength;
          uniform float uOvalization;
          uniform float uTwistGain;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          float normalAxialPosition = clamp(position.y / (2.0 * uHalfLength) + 0.5, 0.0, 1.0);
          float normalFocus = (normalAxialPosition - uFocalCenter) / max(uFocusWidth, 0.02);
          float normalFocalWeight = exp(-(normalFocus * normalFocus));
          float normalLoadWeight = mix(1.0, normalFocalWeight, uFocality);
          float normalRadialScale = max(0.42, 1.0 - uCompression * (0.35 + 0.65 * normalLoadWeight));
          float normalOvalScaleX = max(0.5, 1.0 - uOvalization * normalLoadWeight);
          float normalOvalScaleZ = 1.0 + 0.38 * uOvalization * normalLoadWeight;

          objectNormal.x /= normalRadialScale * normalOvalScaleX;
          objectNormal.z /= normalRadialScale * normalOvalScaleZ;
          objectNormal.y /= 1.0 + uCompression * uAxialCoupling;

          float normalTwistAngle = uCompression * uTwistGain * (normalAxialPosition - 0.5) * 6.28318530718;
          float normalTwistCos = cos(normalTwistAngle);
          float normalTwistSin = sin(normalTwistAngle);
          vec2 normalTwisted = vec2(
            objectNormal.x * normalTwistCos - objectNormal.z * normalTwistSin,
            objectNormal.x * normalTwistSin + objectNormal.z * normalTwistCos
          );
          objectNormal.x = normalTwisted.x;
          objectNormal.z = normalTwisted.y;

          if (abs(uBend) > 0.0001) {
            float normalBendTheta = (position.y / uHalfLength) * uBend;
            float normalBendCos = cos(normalBendTheta);
            float normalBendSin = sin(normalBendTheta);
            vec2 bentNormal = vec2(
              objectNormal.x * normalBendCos - objectNormal.y * normalBendSin,
              objectNormal.x * normalBendSin + objectNormal.y * normalBendCos
            );
            objectNormal.x = bentNormal.x;
            objectNormal.y = bentNormal.y;
          }`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float axialPosition = clamp(position.y / (2.0 * uHalfLength) + 0.5, 0.0, 1.0);
          float normalizedFocus = (axialPosition - uFocalCenter) / max(uFocusWidth, 0.02);
          float focalWeight = exp(-(normalizedFocus * normalizedFocus));
          float loadWeight = mix(1.0, focalWeight, uFocality);
          float radialScale = max(0.42, 1.0 - uCompression * (0.35 + 0.65 * loadWeight));
          float ovalScaleX = max(0.5, 1.0 - uOvalization * loadWeight);
          float ovalScaleZ = 1.0 + 0.38 * uOvalization * loadWeight;

          transformed.x *= radialScale * ovalScaleX;
          transformed.z *= radialScale * ovalScaleZ;
          transformed.y *= 1.0 + uCompression * uAxialCoupling;
          transformed.x += uEccentricity * loadWeight;

          float twistAngle = uCompression * uTwistGain * (axialPosition - 0.5) * 6.28318530718;
          float twistCos = cos(twistAngle);
          float twistSin = sin(twistAngle);
          vec2 twisted = vec2(
            transformed.x * twistCos - transformed.z * twistSin,
            transformed.x * twistSin + transformed.z * twistCos
          );
          transformed.x = twisted.x;
          transformed.z = twisted.y;

          if (abs(uBend) > 0.0001) {
            float bendSign = sign(uBend);
            float bendRadius = uHalfLength / max(abs(uBend), 0.0001);
            float bendTheta = (transformed.y / uHalfLength) * uBend;
            float localRadius = bendRadius - bendSign * transformed.x;
            transformed.x = bendSign * (bendRadius - localRadius * cos(bendTheta));
            transformed.y = localRadius * sin(bendTheta);
          }`,
        )
    }

    nextMaterial.customProgramCacheKey = () =>
      `airway-stent-deformation-${transparent ? 'transparent' : 'opaque'}-${side}`

    return nextMaterial
  }, [color, depthWrite, metalness, opacity, roughness, side, transparent, uniforms])

  useEffect(() => () => material.dispose(), [material])

  return { material, uniforms }
}

export function applyFrameToUniforms(uniforms: DeformationUniforms, frame: DeviceLoadFrame) {
  uniforms.uBend.value = frame.bend
  uniforms.uCompression.value = frame.compression
  uniforms.uEccentricity.value = frame.eccentricity
  uniforms.uFocalCenter.value = frame.focalCenter
  uniforms.uFocality.value = frame.focality
  uniforms.uFocusWidth.value = frame.focusWidth
  uniforms.uOvalization.value = frame.ovalization
}
