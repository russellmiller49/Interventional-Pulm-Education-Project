'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import type { CArmManifest } from '@fluoroview/types'
import { HandoffContent } from '@/i18n/handoff'

interface CarmInsetViewProps {
  raoLao: number
  cranialCaudal: number
  cArm: CArmManifest
  airwayGlbUri?: string
  dracoBaseUrl?: string
  className?: string
}

const CARM_ANIMATION_TOTAL_FRAMES = 250
type CarmAnimationSegment = 'lao' | 'rao' | 'cranial' | 'caudal'

interface CarmAnimationPose {
  segment: CarmAnimationSegment | null
  frame: number
}

const CARM_SEGMENT_START_FRAME: Record<CarmAnimationSegment, number> = {
  lao: 1,
  rao: 91,
  cranial: 177,
  caudal: 221,
}

function poseForCarmAngles(raoLao: number, cranialCaudal: number): CarmAnimationPose {
  const candidates = [
    {
      segment: 'lao' as const,
      strength: Math.max(0, raoLao) / 90,
      start: 1,
      end: 45,
    },
    {
      segment: 'rao' as const,
      strength: Math.max(0, -raoLao) / 90,
      start: 91,
      end: 135,
    },
    {
      segment: 'cranial' as const,
      strength: Math.max(0, cranialCaudal) / 20,
      start: 177,
      end: 202,
    },
    {
      segment: 'caudal' as const,
      strength: Math.max(0, -cranialCaudal) / 20,
      start: 221,
      end: 236,
    },
  ]
    .map((candidate) => ({
      ...candidate,
      strength: THREE.MathUtils.clamp(candidate.strength, 0, 1),
    }))
    .sort((a, b) => b.strength - a.strength)

  const chosen = candidates[0]
  if (!chosen || chosen.strength < 0.005) return { segment: null, frame: 1 }
  return {
    segment: chosen.segment,
    frame: THREE.MathUtils.lerp(chosen.start, chosen.end, chosen.strength),
  }
}

function frameForCarmAngles(raoLao: number, cranialCaudal: number): number {
  return poseForCarmAngles(raoLao, cranialCaudal).frame
}

function timeForAnimationFrame(frame: number, durationSeconds: number): number {
  const normalizedFrame = THREE.MathUtils.clamp(frame, 1, CARM_ANIMATION_TOTAL_FRAMES)
  const normalizedTime = (normalizedFrame - 1) / (CARM_ANIMATION_TOTAL_FRAMES - 1)
  return normalizedTime * Math.max(durationSeconds, 0.001)
}

function fitSceneToInset(scene: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(scene)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  box.getCenter(center)
  box.getSize(size)
  return {
    center,
    scale: 520 / Math.max(size.x, size.y, size.z, 1),
  }
}

function AnimatedGantryGlb({
  glbUri,
  raoLao,
  cranialCaudal,
  dracoBaseUrl,
}: {
  glbUri: string
  raoLao: number
  cranialCaudal: number
  dracoBaseUrl?: string
}) {
  const gltf = useGLTF(glbUri, dracoBaseUrl)
  const { invalidate } = useThree()
  const initialPose = useMemo(
    () => poseForCarmAngles(raoLao, cranialCaudal),
    [cranialCaudal, raoLao],
  )
  const initialSegment = initialPose.segment ?? 'lao'
  const activeSegmentRef = useRef<CarmAnimationSegment>(initialSegment)
  const currentFrameRef = useRef(
    initialPose.segment ? initialPose.frame : CARM_SEGMENT_START_FRAME[initialSegment],
  )
  const targetPose = useMemo(
    () => poseForCarmAngles(raoLao, cranialCaudal),
    [cranialCaudal, raoLao],
  )
  const { scene, center, scale } = useMemo(() => {
    const fit = fitSceneToInset(gltf.scene)
    return { scene: gltf.scene, center: fit.center, scale: fit.scale }
  }, [gltf.scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])

  useEffect(() => {
    const clip = gltf.animations[0]
    if (!clip) return undefined
    const action = mixer.clipAction(clip)
    action.reset()
    action.play()
    action.enabled = true
    action.setEffectiveWeight(1)
    mixer.setTime(timeForAnimationFrame(currentFrameRef.current, clip.duration))
    scene.updateMatrixWorld(true)
    invalidate()
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
    }
  }, [gltf.animations, invalidate, mixer, scene])

  useEffect(() => {
    invalidate()
  }, [invalidate, targetPose])

  useFrame((_, deltaSeconds) => {
    const clip = gltf.animations[0]
    if (!clip) return

    if (targetPose.segment && targetPose.segment !== activeSegmentRef.current) {
      activeSegmentRef.current = targetPose.segment
      currentFrameRef.current = CARM_SEGMENT_START_FRAME[targetPose.segment]
      mixer.setTime(timeForAnimationFrame(currentFrameRef.current, clip.duration))
      scene.updateMatrixWorld(true)
    }

    const targetFrame = targetPose.segment
      ? targetPose.frame
      : CARM_SEGMENT_START_FRAME[activeSegmentRef.current]
    const currentFrame = currentFrameRef.current
    const frameDelta = targetFrame - currentFrame
    const maxStep = Math.max(1, Math.min(deltaSeconds, 1 / 30) * 180)
    const nextFrame =
      Math.abs(frameDelta) <= maxStep ? targetFrame : currentFrame + Math.sign(frameDelta) * maxStep

    currentFrameRef.current = nextFrame
    mixer.setTime(timeForAnimationFrame(nextFrame, clip.duration))
    scene.updateMatrixWorld(true)
    if (Math.abs(targetFrame - nextFrame) > 0.05) {
      invalidate()
    }
  })

  return (
    <HandoffContent>
      {
        <group scale={scale} position={[-center.x * scale, -center.y * scale, -center.z * scale]}>
          <primitive object={scene} />
        </group>
      }
    </HandoffContent>
  )
}

function GantryGlb({
  glbUri,
  raoLao,
  cranialCaudal,
  dracoBaseUrl,
}: {
  glbUri: string
  raoLao: number
  cranialCaudal: number
  dracoBaseUrl?: string
}) {
  const gltf = useGLTF(glbUri, dracoBaseUrl)
  const { scene, center, scale } = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    const fit = fitSceneToInset(cloned)
    return { scene: cloned, center: fit.center, scale: fit.scale }
  }, [gltf.scene])

  return (
    <HandoffContent>
      {
        <group
          rotation={[THREE.MathUtils.degToRad(cranialCaudal), THREE.MathUtils.degToRad(raoLao), 0]}
          scale={scale}
          position={[-center.x * scale, -center.y * scale, -center.z * scale]}
        >
          <primitive object={scene} />
        </group>
      }
    </HandoffContent>
  )
}

function SchematicGantry({ raoLao, cranialCaudal }: { raoLao: number; cranialCaudal: number }) {
  return (
    <HandoffContent>
      {
        <group
          rotation={[THREE.MathUtils.degToRad(cranialCaudal), THREE.MathUtils.degToRad(raoLao), 0]}
        >
          <mesh position={[0, 0, 0]}>
            <torusGeometry args={[210, 16, 18, 72, Math.PI * 1.35]} />
            <meshStandardMaterial color="#d6e4f0" metalness={0.45} roughness={0.38} />
          </mesh>
          <mesh position={[0, -235, 0]}>
            <sphereGeometry args={[24, 24, 18]} />
            <meshStandardMaterial color="#fde68a" emissive="#facc15" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 235, 0]}>
            <boxGeometry args={[170, 18, 120]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.25} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[120, 430, 4, 1, true]} />
            <meshBasicMaterial
              color="#fde047"
              transparent
              opacity={0.16}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      }
    </HandoffContent>
  )
}

function DetectorPlane({ raoLao, cranialCaudal }: { raoLao: number; cranialCaudal: number }) {
  return (
    <HandoffContent>
      {
        <mesh
          position={[0, 250, 0]}
          rotation={[THREE.MathUtils.degToRad(cranialCaudal), THREE.MathUtils.degToRad(raoLao), 0]}
        >
          <planeGeometry args={[180, 130]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      }
    </HandoffContent>
  )
}

export function CarmInsetView({
  raoLao,
  cranialCaudal,
  cArm,
  dracoBaseUrl,
  className,
}: CarmInsetViewProps) {
  const sad = cArm.sadMm ?? cArm.sad ?? 600
  const sid = cArm.sidMm ?? cArm.sid ?? 1200
  void sad
  void sid

  return (
    <HandoffContent>
      {
        <div
          className={
            className ??
            'pointer-events-none absolute bottom-3 right-3 h-48 w-48 overflow-hidden rounded-lg border border-white/15 bg-slate-950/70 shadow-lg backdrop-blur-sm'
          }
          aria-label="C-arm gantry orientation"
          data-carm-animation={cArm.animationGlbUri ? 'animated' : 'static'}
          data-carm-frame={Math.round(frameForCarmAngles(raoLao, cranialCaudal))}
        >
          <Canvas
            frameloop="demand"
            dpr={[1, 2]}
            camera={{ position: [620, 520, 720], fov: 32, near: 1, far: 4000 }}
            gl={{ antialias: true, alpha: true }}
            style={{ width: '100%', height: '100%' }}
          >
            <ambientLight intensity={0.62} />
            <directionalLight position={[700, 900, 500]} intensity={1.05} />
            <directionalLight position={[-500, -400, 250]} intensity={0.38} color={0xcfe4ff} />
            <Suspense fallback={<SchematicGantry raoLao={raoLao} cranialCaudal={cranialCaudal} />}>
              {cArm.animationGlbUri ? (
                <AnimatedGantryGlb
                  glbUri={cArm.animationGlbUri}
                  raoLao={raoLao}
                  cranialCaudal={cranialCaudal}
                  dracoBaseUrl={dracoBaseUrl}
                />
              ) : cArm.gantryGlbUri ? (
                <GantryGlb
                  glbUri={cArm.gantryGlbUri}
                  raoLao={raoLao}
                  cranialCaudal={cranialCaudal}
                  dracoBaseUrl={dracoBaseUrl}
                />
              ) : (
                <SchematicGantry raoLao={raoLao} cranialCaudal={cranialCaudal} />
              )}
              {!cArm.animationGlbUri ? (
                <DetectorPlane raoLao={raoLao} cranialCaudal={cranialCaudal} />
              ) : null}
            </Suspense>
          </Canvas>
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
            C-arm
          </div>
        </div>
      }
    </HandoffContent>
  )
}
