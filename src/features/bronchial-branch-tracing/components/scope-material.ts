import * as THREE from 'three'
import { mucosaFragmentShader, mucosaVertexShader } from '@/lib/bronchoscopy-core/mucosa'

/**
 * The scope picture's own material: the shared mucosa shader with three things added for small
 * airways, where the shared look (tuned for the trachea and main bronchi) goes flat.
 *
 *   reach    how far the light carries is a uniform, set from the width of the airway the scope is
 *            in, in place of the shared shader's fixed 23 mm;
 *   dark     the fade to black with distance scales with that reach;
 *   vessels  fine branching lines in the mucosa, fixed to the wall, so the wall has something on
 *            it that moves past as the scope advances.
 *
 * The shared shader string is not edited: the navigation trainer and the EBUS course build their
 * own materials from it. The additions are made by replacing four known lines of it, and a test
 * holds each of those lines to exactly one place in the shared string, so a change there is
 * noticed here instead of silently dropping an addition.
 */
export const SCOPE_SHADER_ANCHORS = {
  uniforms: 'uniform float uHeadlightFalloff;',
  base: 'base*=0.96+fine*0.08;',
  falloff: 'float falloff=1.0/(1.0+pow(distanceMm/23.0,1.65));',
  dark: '1.0-smoothstep(80.0,180.0,distanceMm)',
} as const

const SCOPE_SHADER_ADDITIONS: Record<keyof typeof SCOPE_SHADER_ANCHORS, string> = {
  uniforms: 'uniform float uHeadlightFalloff;\nuniform float uFalloffMm;\nuniform float uVessels;',
  // Fine vessels: a line wherever a slow noise crosses its middle value, at two scales. The
  // field is bent by a third noise first, so the lines wander and branch off one another instead
  // of closing into rings, and each fades in and out along its length. Each line is drawn a pixel or two wide at any distance (its width is
  // taken from how fast the noise changes across the screen), so it reads as a fine vessel in
  // the trachea and in a 2 mm airway alike. The lines are fixed in the wall.
  base: `base*=0.96+fine*0.08;
  vec3 bend=vec3(tissueNoise(vWorldPosition*0.21+vec3(31.0,0.0,0.0)),tissueNoise(vWorldPosition*0.21+vec3(0.0,47.0,0.0)),tissueNoise(vWorldPosition*0.21+vec3(0.0,0.0,59.0)))-0.5;
  vec3 bent=vWorldPosition+bend*5.0;
  float ridgeA=abs(tissueNoise(bent*0.3+vec3(11.0,3.0,7.0))-0.5);
  float ridgeB=abs(tissueNoise(bent*0.85+vec3(2.0,19.0,5.0))-0.5);
  float lineA=1.0-smoothstep(0.0,fwidth(ridgeA)*1.5+0.0004,ridgeA);
  float lineB=1.0-smoothstep(0.0,fwidth(ridgeB)*1.1+0.0004,ridgeB);
  // A vessel runs in and out of sight along its length, so no line closes on itself.
  float seen=smoothstep(0.3,0.62,tissueNoise(vWorldPosition*0.45+vec3(71.0,13.0,29.0)));
  float vessel=max(lineA,lineB*0.55)*seen;
  base=mix(base,base*vec3(0.74,0.46,0.47),vessel*uVessels);`,
  falloff: 'float falloff=1.0/(1.0+pow(distanceMm/uFalloffMm,1.65));',
  // 80 and 180 mm at the shared reach of 23 mm, in the same proportion at any other reach.
  dark: '1.0-smoothstep(uFalloffMm*3.48,uFalloffMm*7.83,distanceMm)',
}

/** The shared fragment shader with the scope picture's additions. Throws if an anchor is gone. */
export function scopeFragmentShader(): string {
  let source = mucosaFragmentShader
  for (const key of Object.keys(SCOPE_SHADER_ANCHORS) as (keyof typeof SCOPE_SHADER_ANCHORS)[]) {
    const anchor = SCOPE_SHADER_ANCHORS[key]
    if (source.split(anchor).length !== 2)
      throw new Error(
        `The mucosa shader no longer has the line the scope picture builds on: ${key}`,
      )
    source = source.replace(anchor, SCOPE_SHADER_ADDITIONS[key])
  }
  return source
}

/** How strongly the vessel lines show, 0 to 1. */
export const SCOPE_VESSELS = 0.5

/** Sets how far the light carries, in millimetres. */
export function setScopeReach(material: THREE.ShaderMaterial, falloffMm: number) {
  material.uniforms.uFalloffMm.value = falloffMm
}

export function createScopeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    toneMapped: false,
    uniforms: {
      uWallAlpha: { value: 1 },
      uHeadlightAxis: { value: new THREE.Vector3(0, 0, -1) },
      uHeadlightFalloff: { value: 0 },
      uFalloffMm: { value: 23 },
      uVessels: { value: SCOPE_VESSELS },
    },
    vertexShader: mucosaVertexShader,
    fragmentShader: scopeFragmentShader(),
  })
}
