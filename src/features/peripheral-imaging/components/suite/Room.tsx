'use client'
import { DEFAULT_GEOMETRY, type ImagingGeometry, type Point3 } from '../../lib/physics'
import type { SuiteLayer } from './types'
import { add, chainStopAnchors, suiteFrame } from './suiteModel'

export const ROOM_BACKGROUND = '#061519'

/** Fit each piece of furniture, rather than the empty corners of a box around the whole room. */
export function roomBounds({ field, sid, sod }: ImagingGeometry): Point3[] {
  const floorY = -sod - field * 0.25
  const boxes: [Point3, Point3][] = [
    [
      [-field * 0.35, -field * 0.285, -field * 1.15],
      [field * 0.35, -field * 0.235, field * 1.15],
    ],
    [
      [-field * 0.275, floorY, -field * 1.025],
      [field * 0.275, -field * 0.29, -field * 0.175],
    ],
    [
      [-sid * 0.52 - field * 0.325, floorY, -field * 0.375],
      [-sid * 0.52 + field * 0.325, 0, field * 0.375],
    ],
    [
      [field * 1.175, floorY, -field * 1.225],
      [field * 1.725, floorY + field * 0.08, -field * 0.575],
    ],
    [
      [field * 1.075, sod * 0.15, -field * 0.935],
      [field * 1.485, field * 0.78, -field * 0.5],
    ],
    [
      [field * 0.65, floorY, -field * 1.025],
      [field * 1.05, field * 0.3, -field * 0.675],
    ],
    [
      [field * 0.875, sod * 0.15 - field * 0.17, -field * 0.58],
      [field * 1.325, sod * 0.15 + field * 0.17, -field * 0.52],
    ],
  ]
  return boxes.flatMap(([min, max]) =>
    [min[0], max[0]].flatMap((x) =>
      [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z): Point3 => [x, y, z])),
    ),
  )
}

export function Room({
  layers,
  geometry = DEFAULT_GEOMETRY,
  floorSpan,
  atRest = false,
}: {
  layers: readonly SuiteLayer[]
  geometry?: ImagingGeometry
  floorSpan?: number
  atRest?: boolean
}) {
  const f = geometry.field
  const floorY = -geometry.sod - f * 0.25
  const anchors = chainStopAnchors(suiteFrame(0, 0, geometry))
  return (
    <group>
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[floorSpan ?? f * 5, floorSpan ?? f * 5]} />
        {atRest ? (
          <meshBasicMaterial color={ROOM_BACKGROUND} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#192c36" roughness={1} />
        )}
      </mesh>
      {layers.includes('table') && (
        <group>
          <mesh position={[0, -f * 0.26, 0]}>
            <boxGeometry args={[f * 0.7, f * 0.045, f * 2.3]} />
            <meshStandardMaterial color="#78909a" roughness={0.75} />
          </mesh>
          <mesh position={[0, atRest ? (floorY - f * 0.29) / 2 : -f * 0.53, -f * 0.6]}>
            <boxGeometry args={[f * 0.28, atRest ? -f * 0.29 - floorY : f * 0.5, f * 0.45]} />
            <meshStandardMaterial color="#415b68" />
          </mesh>
          {atRest && (
            <mesh position={[0, floorY + f * 0.04, -f * 0.6]}>
              <boxGeometry args={[f * 0.55, f * 0.08, f * 0.85]} />
              <meshStandardMaterial color="#344f5d" roughness={0.8} />
            </mesh>
          )}
        </group>
      )}
      {layers.includes('monitor') && (
        <group>
          <mesh position={add(anchors.reconstruction, [0, -f * 0.15, 0])}>
            <boxGeometry args={[f * 0.32, f * 0.7, f * 0.3]} />
            <meshStandardMaterial color="#344f5d" />
          </mesh>
          <mesh position={add(anchors.reconstruction, [0, f * 0.3, 0])}>
            <boxGeometry args={[f * 0.4, f * 0.32, f * 0.065]} />
            <meshStandardMaterial color="#293e4a" emissive="#294455" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={anchors.display}>
            <boxGeometry args={[f * 0.43, f * 0.34, f * 0.05]} />
            <meshStandardMaterial color="#2a5460" emissive="#1b3e47" emissiveIntensity={0.45} />
          </mesh>
          {atRest && (
            <group name="monitor-boom">
              <mesh position={[f * 1.45, (floorY + f * 0.75) / 2, -f * 0.9]}>
                <cylinderGeometry args={[f * 0.025, f * 0.035, f * 0.75 - floorY, 20]} />
                <meshStandardMaterial color="#708c96" metalness={0.35} roughness={0.5} />
              </mesh>
              <mesh position={[f * 1.45, floorY + f * 0.04, -f * 0.9]}>
                <boxGeometry args={[f * 0.55, f * 0.08, f * 0.65]} />
                <meshStandardMaterial color="#344f5d" />
              </mesh>
              <mesh position={[f * 1.275, f * 0.75, -f * 0.9]}>
                <boxGeometry args={[f * 0.4, f * 0.045, f * 0.045]} />
                <meshStandardMaterial color="#708c96" metalness={0.35} />
              </mesh>
              <mesh position={[f * 1.1, f * 0.75, -f * 0.715]}>
                <boxGeometry args={[f * 0.045, f * 0.045, f * 0.415]} />
                <meshStandardMaterial color="#708c96" metalness={0.35} />
              </mesh>
              <mesh position={[f * 1.1, (f * 0.75 + anchors.display[1]) / 2, -f * 0.585]}>
                <boxGeometry args={[f * 0.035, f * 0.75 - anchors.display[1], f * 0.035]} />
                <meshStandardMaterial color="#708c96" metalness={0.35} />
              </mesh>
              <mesh
                position={[
                  anchors.reconstruction[0],
                  (floorY - f * 0.725) / 2,
                  anchors.reconstruction[2],
                ]}
              >
                <boxGeometry args={[f * 0.2, -f * 0.725 - floorY, f * 0.2]} />
                <meshStandardMaterial color="#344f5d" />
              </mesh>
            </group>
          )}
        </group>
      )}
      {atRest && layers.includes('gantry') && (
        <mesh position={[-geometry.sid * 0.52, floorY + f * 0.08, 0]}>
          <boxGeometry args={[f * 0.65, f * 0.16, f * 0.75]} />
          <meshStandardMaterial color="#415b68" roughness={0.8} />
        </mesh>
      )}
      {layers.includes('fieldGenerator') && (
        <mesh position={[0, -f * 0.29, 0]}>
          <boxGeometry args={[f * 0.58, f * 0.018, f * 0.5]} />
          <meshStandardMaterial color="#648d90" />
        </mesh>
      )}
    </group>
  )
}
