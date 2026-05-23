'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import type { RoutePath } from '@fluoroview/interaction'
import type { AssetTransform, Vec3 } from '@fluoroview/types'

interface Anatomy3DViewProps {
  airwayGlbUri: string
  dracoBaseUrl?: string
  activeGroups: Set<string>
  airwayTransform?: AssetTransform
  route: RoutePath | null
  scopeProgress: number
  noduleLps: Vec3 | null
  tubeRadiusMm?: number
  tubeColor?: string
  className?: string
}

function AirwayMesh({
  glbUrl,
  dracoBaseUrl = '/fluoroview/draco',
  transform,
}: {
  glbUrl: string
  dracoBaseUrl?: string
  transform?: AssetTransform
}) {
  // drei's useGLTF expects the DRACO decoder path with a trailing slash.
  const dracoPath = dracoBaseUrl.endsWith('/') ? dracoBaseUrl : `${dracoBaseUrl}/`
  const gltf = useGLTF(glbUrl, dracoPath)

  useEffect(() => {
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
          if ('opacity' in mat) {
            mat.transparent = true
            mat.opacity = 0.32
            mat.depthWrite = false
          }
        }
      }
    })
  }, [gltf.scene])

  const rotation = transform?.rotationDeg ?? [0, 0, 0]
  const offset = transform?.positionOffsetMm ?? [0, 0, 0]

  return (
    <primitive
      object={gltf.scene}
      scale={transform?.sceneScale ?? 1}
      rotation={rotation.map((deg) => THREE.MathUtils.degToRad(deg)) as [number, number, number]}
      position={offset}
    />
  )
}

function ScopeTube({
  points,
  scopeProgress,
  tubeRadiusMm = 2.5,
  tubeColor = '#1a1a1a',
}: {
  points: Vec3[]
  scopeProgress: number
  tubeRadiusMm?: number
  tubeColor?: string
}) {
  const { tubeGeom, tipPos } = useMemo(() => {
    if (points.length < 2) return { tubeGeom: null, tipPos: null as THREE.Vector3 | null }
    const v3 = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    const curve = new THREE.CatmullRomCurve3(v3, false, 'catmullrom', 0.4)
    const progressed = Math.max(0, Math.min(1, scopeProgress))
    const totalLen = curve.getLength()
    const targetLen = totalLen * progressed
    const sampleCount = Math.max(8, Math.round(progressed * 240))
    const subPoints: THREE.Vector3[] = []
    let accum = 0
    let lastPt = curve.getPoint(0)
    subPoints.push(lastPt)
    for (let i = 1; i <= sampleCount; i++) {
      const t = i / sampleCount
      const pt = curve.getPoint(t * progressed)
      const seg = pt.distanceTo(lastPt)
      if (accum + seg >= targetLen) {
        subPoints.push(pt)
        break
      }
      accum += seg
      subPoints.push(pt)
      lastPt = pt
    }
    if (subPoints.length < 2) {
      return { tubeGeom: null, tipPos: subPoints[0] ?? null }
    }
    const subCurve = new THREE.CatmullRomCurve3(subPoints, false)
    const tubeGeom = new THREE.TubeGeometry(
      subCurve,
      Math.max(8, subPoints.length * 2),
      tubeRadiusMm,
      14,
      false,
    )
    const tipPos = subPoints[subPoints.length - 1]
    return { tubeGeom, tipPos }
  }, [points, scopeProgress, tubeRadiusMm])

  if (!tubeGeom) return null

  return (
    <group>
      <mesh geometry={tubeGeom}>
        <meshStandardMaterial color={tubeColor} metalness={0.7} roughness={0.3} />
      </mesh>
      {tipPos && (
        <mesh position={tipPos}>
          <sphereGeometry args={[tubeRadiusMm * 1.6, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive={0xffd668} emissiveIntensity={0.9} />
        </mesh>
      )}
    </group>
  )
}

function NoduleMarker({ lps, radiusMm }: { lps: Vec3; radiusMm: number }) {
  return (
    <mesh position={[lps[0], lps[1], lps[2]]}>
      <sphereGeometry args={[radiusMm, 20, 20]} />
      <meshStandardMaterial
        color="#f43f5e"
        emissive={0xb91c1c}
        emissiveIntensity={0.4}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}

export function Anatomy3DView({
  airwayGlbUri,
  dracoBaseUrl,
  activeGroups,
  airwayTransform,
  route,
  scopeProgress,
  noduleLps,
  tubeRadiusMm,
  tubeColor,
  className,
}: Anatomy3DViewProps) {
  void activeGroups

  const bounds = useMemo(() => {
    if (!route || !route.points.length) return null
    let cx = 0
    let cy = 0
    let cz = 0
    for (const p of route.points) {
      cx += p[0]
      cy += p[1]
      cz += p[2]
    }
    const n = Math.max(1, route.points.length)
    const ctr: Vec3 = [cx / n, cy / n, cz / n]
    let maxD = 0
    for (const p of route.points) {
      const d = Math.hypot(p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2])
      if (d > maxD) maxD = d
    }
    return { center: ctr, radius: Math.max(180, maxD * 1.4) }
  }, [route])

  const center = bounds?.center ?? [0, 0, 0]
  const radius = bounds?.radius ?? 220

  const camPos: [number, number, number] = [
    center[0] + radius * 1.2,
    center[1] - radius * 1.5,
    center[2] + radius * 0.6,
  ]

  return (
    <div
      className={
        className ??
        'relative h-80 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950'
      }
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: camPos, fov: 30, near: 1, far: radius * 12 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[0x05070c]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[radius, -radius * 2, radius]} intensity={1.1} />
        <directionalLight
          position={[-radius, radius, -radius * 0.5]}
          intensity={0.4}
          color={0x9bb8ff}
        />
        <Suspense fallback={null}>
          <AirwayMesh
            glbUrl={airwayGlbUri}
            dracoBaseUrl={dracoBaseUrl}
            transform={airwayTransform}
          />
          {route && route.points.length > 1 && (
            <ScopeTube
              points={route.points}
              scopeProgress={scopeProgress}
              tubeRadiusMm={tubeRadiusMm}
              tubeColor={tubeColor}
            />
          )}
          {noduleLps && <NoduleMarker lps={noduleLps} radiusMm={6} />}
        </Suspense>
        <OrbitControls
          target={[center[0], center[1], center[2]]}
          enablePan
          enableZoom
          enableRotate
        />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
        3D anatomy
      </div>
    </div>
  )
}
