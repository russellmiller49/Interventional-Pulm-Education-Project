'use client'
import type { ImagingGeometry } from '../../lib/physics'

/** Schematic head, pillow and draped continuation around the unmodified, cropped CT thorax. */
export function RoomPatient({ geometry: { field: f } }: { geometry: ImagingGeometry }) {
  return (
    <group name="schematic-patient-context">
      <mesh position={[0, -f * 0.245, f * 0.48]}>
        <boxGeometry args={[f * 0.34, f * 0.055, f * 0.37]} />
        <meshStandardMaterial color="#a8c1c2" roughness={1} />
      </mesh>
      <mesh position={[0, -f * 0.083, f * 0.29]} scale={[f * 0.082, f * 0.09, f * 0.11]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial color="#b5b9af" roughness={0.85} />
      </mesh>
      <mesh position={[0, -f * 0.065, f * 0.47]} scale={[f * 0.12, f * 0.15, f * 0.155]}>
        <sphereGeometry args={[1, 40, 28]} />
        <meshStandardMaterial color="#c5c5b8" roughness={0.85} />
      </mesh>
      <mesh position={[0, f * 0.074, f * 0.49]} scale={[f * 0.021, f * 0.03, f * 0.031]}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color="#c5c5b8" roughness={0.85} />
      </mesh>
      <group position={[0, -f * 0.12, -f * 0.63]} scale={[1, 0.7, 1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[f * 0.22, f * 0.43, 12, 32]} />
          <meshStandardMaterial color="#65969c" roughness={1} />
        </mesh>
      </group>
    </group>
  )
}
