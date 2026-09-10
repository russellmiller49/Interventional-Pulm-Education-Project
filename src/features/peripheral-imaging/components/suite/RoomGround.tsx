'use client'
import { Color } from 'three'
import { type ImagingGeometry, type Point3 } from '../../lib/physics'
import { roomMonitorOffset } from './suiteModel'

const vertexShader = `varying vec2 groundUv;
varying vec4 projected;
void main() { groundUv = uv; projected = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = projected; }`
const fragmentShader = `varying vec2 groundUv;
varying vec4 projected;
uniform vec3 tint;
uniform float strength;
void main() {
  float radius = length((groundUv - 0.5) * 2.0);
  float alpha = (1.0 - smoothstep(0.25, 1.0, radius)) * strength;
  // Fade the decorative floor cue into the shell before the frame's edges.
  vec2 screenUv = projected.xy / projected.w * 0.5 + 0.5;
  float edge = min(min(screenUv.x, 1.0 - screenUv.x), min(screenUv.y, 1.0 - screenUv.y));
  alpha *= smoothstep(0.015, 0.08, edge);
  gl_FragColor = vec4(tint, alpha);
  #include <colorspace_fragment>
}`

/** Authored soft grounding cues, not a lighting or radiation simulation. */
function GroundPatch({
  position,
  size,
  color,
  opacity,
}: {
  position: Point3
  size: [number, number]
  color: string
  opacity: number
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <planeGeometry args={size} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ tint: { value: new Color(color) }, strength: { value: opacity } }}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function RoomGround({ geometry: { field: f, sod, sid } }: { geometry: ImagingGeometry }) {
  const y = -sod - f * 0.25
  const monitorX = roomMonitorOffset({ field: f, sod, sid })[0]
  return (
    <group name="room-grounding">
      <GroundPatch
        position={[f * 0.7, y + 0.5, -f * 0.45]}
        size={[f * 5.5, f * 2]}
        color="#345159"
        opacity={0.55}
      />
      <GroundPatch
        position={[0, y + 1, -f * 0.6]}
        size={[f * 0.95, f * 1.2]}
        color="#000000"
        opacity={0.8}
      />
      <GroundPatch
        position={[-sid * 0.52, y + 1, 0]}
        size={[f * 1.05, f * 1.05]}
        color="#000000"
        opacity={0.8}
      />
      <GroundPatch
        position={[f * 1.45 + monitorX, y + 1, -f * 0.9]}
        size={[f * 0.95, f * 0.95]}
        color="#000000"
        opacity={0.8}
      />
      <GroundPatch
        position={[f * 0.85 + monitorX, y + 1, -f * 0.85]}
        size={[f * 0.45, f * 0.55]}
        color="#000000"
        opacity={0.8}
      />
    </group>
  )
}
