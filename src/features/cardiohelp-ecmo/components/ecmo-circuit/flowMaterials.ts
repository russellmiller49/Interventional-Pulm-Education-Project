import * as THREE from 'three'

// Flow-tube materials: a MeshStandardMaterial with two GLSL injections
// (pattern: airway-stent-mechanics useDeformableStentMaterial):
//  - fragment: a scrolling emissive dash along the tube's arc length (uv.x)
//    that conveys flow direction and speed, damped off when flow stops;
//  - vertex: a gaussian crimp toward the centerline (aCenter attribute) at the
//    clamp station so a closed clamp visibly pinches the tube.
// Uniform objects are mutated per-frame; materials are created once per limb.

export interface FlowUniforms {
  uFlowPhase: { value: number }
  uFlowStrength: { value: number }
  uDashRepeat: { value: number }
  uDashRatio: { value: number }
  uTint: { value: THREE.Color }
  uPinchU: { value: number }
  uPinchWidth: { value: number }
  uPinchAmount: { value: number }
}

export function createFlowUniforms(): FlowUniforms {
  return {
    uFlowPhase: { value: 0 },
    uFlowStrength: { value: 0 },
    uDashRepeat: { value: 12 },
    uDashRatio: { value: 0.45 },
    uTint: { value: new THREE.Color('#c62839') },
    uPinchU: { value: 0.5 },
    uPinchWidth: { value: 0.045 },
    uPinchAmount: { value: 0 },
  }
}

const UNIFORM_DECLARATIONS = `
uniform float uFlowPhase;
uniform float uFlowStrength;
uniform float uDashRepeat;
uniform float uDashRatio;
uniform vec3 uTint;
uniform float uPinchU;
uniform float uPinchWidth;
uniform float uPinchAmount;
`

const VERTEX_PINCH = `
#include <begin_vertex>
{
  float pinchDistance = (uv.x - uPinchU) / max(uPinchWidth, 1e-4);
  float crimp = uPinchAmount * exp(-pinchDistance * pinchDistance);
  transformed = mix(transformed, aCenter, crimp * 0.92);
  float bulgeDistance = abs(pinchDistance) - 1.8;
  transformed = mix(
    transformed,
    aCenter + (transformed - aCenter) * (1.0 + 0.15 * uPinchAmount),
    uPinchAmount * exp(-bulgeDistance * bulgeDistance) * step(1.0, abs(pinchDistance))
  );
}
`

function forceUvDefine(material: THREE.Material) {
  const withDefines = material as THREE.Material & { defines?: Record<string, string> }
  withDefines.defines = { ...withDefines.defines, USE_UV: '' }
}

const FRAGMENT_DASH = `
#include <emissivemap_fragment>
{
  float dashCoord = fract(vUv.x * uDashRepeat - uFlowPhase);
  float rise = smoothstep(0.18, 0.35, dashCoord);
  float fall = 1.0 - smoothstep(uDashRatio + 0.17, uDashRatio + 0.35, dashCoord);
  float dash = rise * fall;
  totalEmissiveRadiance += uTint * (0.10 + dash * 0.8 * uFlowStrength);
}
`

export function applyFlowShader(
  material: THREE.MeshStandardMaterial,
  uniforms: FlowUniforms,
  cacheKey: string,
): THREE.MeshStandardMaterial {
  forceUvDefine(material)
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute vec3 aCenter;${UNIFORM_DECLARATIONS}`,
      )
      .replace('#include <begin_vertex>', VERTEX_PINCH)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${UNIFORM_DECLARATIONS}`)
      .replace('#include <emissivemap_fragment>', FRAGMENT_DASH)
  }
  material.customProgramCacheKey = () => cacheKey
  return material
}

export function createBloodCoreMaterial(uniforms: FlowUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: uniforms.uTint.value.clone(),
    roughness: 0.5,
    metalness: 0,
  })
  return applyFlowShader(material, uniforms, 'ecmo-blood-core')
}

export function createSweepCoreMaterial(uniforms: FlowUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: uniforms.uTint.value.clone(),
    roughness: 0.45,
    metalness: 0,
  })
  return applyFlowShader(material, uniforms, 'ecmo-sweep-core')
}

export interface WallUniforms {
  uPinchU: { value: number }
  uPinchWidth: { value: number }
  uPinchAmount: { value: number }
}

const WALL_UNIFORM_DECLARATIONS = `
uniform float uPinchU;
uniform float uPinchWidth;
uniform float uPinchAmount;
`

/** Translucent PVC wall sharing the pinch deformation (no dash pass). */
export function createTubeWallMaterial(
  uniforms: WallUniforms,
  color: string,
  cacheKey: string,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    roughness: 0.15,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    depthWrite: false,
  })
  forceUvDefine(material)
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute vec3 aCenter;${WALL_UNIFORM_DECLARATIONS}`,
      )
      .replace('#include <begin_vertex>', VERTEX_PINCH)
  }
  material.customProgramCacheKey = () => cacheKey
  return material
}
