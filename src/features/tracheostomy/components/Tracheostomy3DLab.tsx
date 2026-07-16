'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  BackSide,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  MathUtils,
  Path,
  Shape,
  Vector2,
  Vector3,
} from 'three'
import type { BufferGeometry, Group } from 'three'
import { useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Expand, Eye, EyeOff, Pause, Play, RotateCcw } from 'lucide-react'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { Button } from '@/components/ui/button'
import {
  getTracheostomyPart,
  tracheostomyModelParts,
  tracheostomyPartColors,
  type TracheostomyPartId,
  type TracheostomySetupMode,
} from '@/features/tracheostomy/content/modelParts'
import { cn } from '@/lib/cn'

type CuffState = 'inflated' | 'deflated'

interface SegmentedSceneProps {
  cuffState: CuffState
  exploded: boolean
  onSelect: (part: TracheostomyPartId) => void
  reducedMotion: boolean
  rotating: boolean
  selected: TracheostomyPartId
  setupMode: TracheostomySetupMode
  showAnatomy: boolean
}

function createCannulaCurve(distalOffset = 0) {
  return new CatmullRomCurve3([
    new Vector3(0, 0.58, 2.12),
    new Vector3(0, 0.58, 1.48),
    new Vector3(0, 0.56, 0.68),
    new Vector3(0, 0.38, 0.32),
    new Vector3(0, -0.22, 0.08),
    new Vector3(0, -0.92, 0.01),
    new Vector3(0, -1.46 + distalOffset, 0),
  ])
}

function createFlangeShape() {
  const flange = new Shape()
  flange.moveTo(-1.08, -0.18)
  flange.quadraticCurveTo(-1.13, 0, -1.02, 0.2)
  flange.quadraticCurveTo(-0.55, 0.42, 0, 0.34)
  flange.quadraticCurveTo(0.55, 0.42, 1.02, 0.2)
  flange.quadraticCurveTo(1.13, 0, 1.08, -0.18)
  flange.quadraticCurveTo(0.55, -0.39, 0, -0.31)
  flange.quadraticCurveTo(-0.55, -0.39, -1.08, -0.18)

  const lumen = new Path()
  lumen.absellipse(0, 0.02, 0.31, 0.25, 0, Math.PI * 2, false, 0)
  const leftSlot = new Path()
  leftSlot.absellipse(-0.76, 0, 0.2, 0.075, 0, Math.PI * 2, false, 0)
  const rightSlot = new Path()
  rightSlot.absellipse(0.76, 0, 0.2, 0.075, 0, Math.PI * 2, false, 0)
  flange.holes.push(lumen, leftSlot, rightSlot)
  return flange
}

function createThyroidCartilageShape() {
  const cartilage = new Shape()
  cartilage.moveTo(-0.72, 0.58)
  cartilage.lineTo(-0.54, -0.5)
  cartilage.quadraticCurveTo(-0.26, -0.68, 0, -0.62)
  cartilage.quadraticCurveTo(0.26, -0.68, 0.54, -0.5)
  cartilage.lineTo(0.72, 0.58)
  cartilage.quadraticCurveTo(0.35, 0.76, 0.12, 0.57)
  cartilage.lineTo(0, 0.42)
  cartilage.lineTo(-0.12, 0.57)
  cartilage.quadraticCurveTo(-0.35, 0.76, -0.72, 0.58)
  return cartilage
}

function createEpiglottisShape() {
  const epiglottis = new Shape()
  epiglottis.moveTo(0, -0.48)
  epiglottis.bezierCurveTo(-0.3, -0.28, -0.42, 0.26, -0.22, 0.55)
  epiglottis.bezierCurveTo(-0.08, 0.76, 0.08, 0.76, 0.22, 0.55)
  epiglottis.bezierCurveTo(0.42, 0.26, 0.3, -0.28, 0, -0.48)
  return epiglottis
}

function createCartilageRingCurve(radius: number) {
  const posteriorGap = 0.34
  const points = Array.from({ length: 30 }, (_, index) => {
    const progress = index / 29
    const angle = -Math.PI / 2 + posteriorGap + progress * (Math.PI * 2 - posteriorGap * 2)
    return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  })
  return new CatmullRomCurve3(points)
}

function partAppearance(id: TracheostomyPartId, selected: TracheostomyPartId, opacity = 1) {
  const active = selected === 'whole' || selected === id
  const color = active ? tracheostomyPartColors[id] : '#526377'
  return {
    color: new Color(color),
    emissive: new Color(selected === id ? tracheostomyPartColors[id] : '#000000'),
    emissiveIntensity: selected === id ? 0.3 : 0,
    metalness: 0.02,
    opacity: active ? opacity : Math.min(opacity, 0.34),
    roughness: 0.3,
    transparent: opacity < 1 || !active,
  }
}

function AnimatedRemovablePart({
  children,
  exploded,
  installed,
  reducedMotion,
  side,
  visible,
}: {
  children: React.ReactNode
  exploded: boolean
  installed: boolean
  reducedMotion: boolean
  side: -1 | 1
  visible: boolean
}) {
  const group = useRef<Group>(null)
  const progress = useRef(exploded || !installed ? 1 : 0)

  useFrame((_, delta) => {
    if (!group.current) return
    const target = exploded || !installed ? 1 : 0
    progress.current = reducedMotion ? target : MathUtils.damp(progress.current, target, 7.5, delta)

    const pull = Math.min(progress.current / 0.58, 1)
    const park = Math.max((progress.current - 0.58) / 0.42, 0)
    group.current.position.set(side * park * 0.9, park * 0.28, pull * 1.16 + park * 0.12)
    group.current.rotation.set(side * park * 0.06, side * park * 0.2, side * park * 0.1)
  })

  return (
    <group ref={group} visible={visible}>
      {children}
    </group>
  )
}

function AnimatedCuff({
  inflated,
  reducedMotion,
  selected,
  onSelect,
}: {
  inflated: boolean
  reducedMotion: boolean
  selected: TracheostomyPartId
  onSelect: (part: TracheostomyPartId) => void
}) {
  const cuffGeometry = useRef<BufferGeometry>(null)
  const originalPositions = useRef<Float32Array | null>(null)
  const inflationProgress = useRef(inflated ? 1 : 0.04)
  const cuffProfile = useMemo(
    () => [
      new Vector2(0.215, -0.46),
      new Vector2(0.35, -0.42),
      new Vector2(0.51, -0.31),
      new Vector2(0.56, -0.12),
      new Vector2(0.56, 0.12),
      new Vector2(0.51, 0.31),
      new Vector2(0.35, 0.42),
      new Vector2(0.215, 0.46),
    ],
    [],
  )

  useFrame((_, delta) => {
    if (!cuffGeometry.current) return
    const position = cuffGeometry.current.attributes.position
    if (!originalPositions.current) {
      originalPositions.current = Float32Array.from(position.array as ArrayLike<number>)
    }

    const target = inflated ? 1 : 0.04
    inflationProgress.current = reducedMotion
      ? target
      : MathUtils.damp(inflationProgress.current, target, 8, delta)
    const factor = inflationProgress.current
    const axialScale = 1 + (1 - factor) * 0.08

    for (let index = 0; index < position.count; index += 1) {
      const offset = index * 3
      const originalX = originalPositions.current[offset]
      const originalY = originalPositions.current[offset + 1]
      const originalZ = originalPositions.current[offset + 2]
      const originalRadius = Math.hypot(originalX, originalZ)
      const currentRadius = 0.215 + (originalRadius - 0.215) * factor
      const radialScale = originalRadius > 0 ? currentRadius / originalRadius : 1
      position.setXYZ(
        index,
        originalX * radialScale,
        originalY * axialScale,
        originalZ * radialScale,
      )
    }
    position.needsUpdate = true
    cuffGeometry.current.computeVertexNormals()
  })

  return (
    <group
      position={[0, -0.84, 0.01]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect('cuff')
      }}
    >
      <mesh>
        <latheGeometry ref={cuffGeometry} args={[cuffProfile, 64]} />
        <meshPhysicalMaterial
          {...partAppearance('cuff', selected, 0.64)}
          clearcoat={0.38}
          clearcoatRoughness={0.2}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.016, 10, 48]} />
        <meshStandardMaterial {...partAppearance('cuff', selected, 0.86)} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.016, 10, 48]} />
        <meshStandardMaterial {...partAppearance('cuff', selected, 0.86)} />
      </mesh>
    </group>
  )
}

function AirwayContext({ visible }: { visible: boolean }) {
  const ringCurve = useMemo(() => createCartilageRingCurve(0.68), [])
  const thyroidShape = useMemo(() => createThyroidCartilageShape(), [])
  const epiglottisShape = useMemo(() => createEpiglottisShape(), [])

  if (!visible) return null

  return (
    <group position={[0, -0.12, -0.08]}>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.63, 0.68, 3.65, 64, 1, true]} />
        <meshPhysicalMaterial
          color="#9ab9c7"
          depthWrite={false}
          opacity={0.12}
          roughness={0.7}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <mesh position={[0, -0.18, -0.64]}>
        <planeGeometry args={[1.12, 3.58, 1, 1]} />
        <meshStandardMaterial
          color="#a86f72"
          depthWrite={false}
          opacity={0.22}
          roughness={0.9}
          side={DoubleSide}
          transparent
        />
      </mesh>

      {Array.from({ length: 10 }, (_, index) =>
        index === 2 ? null : (
          <mesh key={index} position={[0, 1.18 - index * 0.31, 0]}>
            <tubeGeometry args={[ringCurve, 76, 0.052, 12, false]} />
            <meshStandardMaterial color="#cbbba3" roughness={0.68} />
          </mesh>
        ),
      )}

      <mesh position={[0, 1.49, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.69, 0.095, 18, 72]} />
        <meshStandardMaterial color="#c3af91" roughness={0.64} />
      </mesh>

      <mesh position={[0, 2.07, 0.05]}>
        <extrudeGeometry
          args={[
            thyroidShape,
            {
              bevelEnabled: true,
              bevelSegments: 3,
              bevelSize: 0.035,
              bevelThickness: 0.035,
              depth: 0.11,
            },
          ]}
        />
        <meshPhysicalMaterial
          color="#bca893"
          depthWrite={false}
          opacity={0.38}
          roughness={0.64}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <mesh position={[0, 2.88, -0.02]} scale={[0.72, 0.72, 0.72]}>
        <extrudeGeometry
          args={[
            epiglottisShape,
            {
              bevelEnabled: true,
              bevelSegments: 3,
              bevelSize: 0.025,
              bevelThickness: 0.025,
              depth: 0.08,
            },
          ]}
        />
        <meshPhysicalMaterial
          color="#c9938a"
          depthWrite={false}
          opacity={0.5}
          roughness={0.72}
          transparent
        />
      </mesh>

      <mesh position={[0, 0.68, 0.62]}>
        <torusGeometry args={[0.29, 0.042, 14, 56]} />
        <meshStandardMaterial color="#c88983" opacity={0.84} roughness={0.72} transparent />
      </mesh>
    </group>
  )
}

function SegmentedTracheostomyScene({
  cuffState,
  exploded,
  onSelect,
  reducedMotion,
  rotating,
  selected,
  setupMode,
  showAnatomy,
}: SegmentedSceneProps) {
  const group = useRef<Group>(null)
  const pilotBalloon = useRef<Group>(null)
  const canvasWidth = useThree((state) => state.size.width)
  const compact = canvasWidth < 640
  const narrow = canvasWidth < 360
  const outerCurve = useMemo(() => createCannulaCurve(), [])
  const innerCurve = useMemo(() => createCannulaCurve(0.12), [])
  const flangeShape = useMemo(() => createFlangeShape(), [])
  const pilotCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.22, -0.94, 0.02),
        new Vector3(0.23, -0.5, 0.09),
        new Vector3(0.24, 0.05, 0.31),
        new Vector3(0.28, 0.5, 0.83),
        new Vector3(0.48, 0.54, 1.38),
        new Vector3(1.05, 0.34, 1.55),
        new Vector3(1.58, -0.14, 1.56),
      ]),
    [],
  )
  const pilotBalloonProfile = useMemo(
    () => [
      new Vector2(0.07, -0.32),
      new Vector2(0.16, -0.26),
      new Vector2(0.19, -0.08),
      new Vector2(0.19, 0.08),
      new Vector2(0.16, 0.26),
      new Vector2(0.07, 0.32),
    ],
    [],
  )

  useFrame((_, delta) => {
    if (!group.current) return
    if (exploded) {
      group.current.rotation.y = reducedMotion
        ? -0.2
        : MathUtils.damp(group.current.rotation.y, -0.2, 5, delta)
    } else if (rotating) {
      group.current.rotation.y += delta * 0.16
    }

    const targetScale = narrow
      ? exploded
        ? 0.52
        : 0.62
      : compact
        ? exploded
          ? 0.58
          : 0.7
        : exploded
          ? 0.76
          : 0.88
    if (reducedMotion) {
      group.current.scale.setScalar(targetScale)
    } else {
      group.current.scale.setScalar(MathUtils.damp(group.current.scale.x, targetScale, 7.5, delta))
    }

    if (pilotBalloon.current) {
      const radialTarget = cuffState === 'inflated' ? 1 : 0.52
      const axialTarget = cuffState === 'inflated' ? 1 : 1.08
      if (reducedMotion) {
        pilotBalloon.current.scale.set(radialTarget, axialTarget, radialTarget)
      } else {
        pilotBalloon.current.scale.set(
          MathUtils.damp(pilotBalloon.current.scale.x, radialTarget, 8, delta),
          MathUtils.damp(pilotBalloon.current.scale.y, axialTarget, 8, delta),
          MathUtils.damp(pilotBalloon.current.scale.z, radialTarget, 8, delta),
        )
      }
    }
  })

  const innerInstalled = setupMode === 'in-use'
  const obturatorInstalled = setupMode === 'insertion'

  return (
    <group
      ref={group}
      position={[0, compact ? -0.25 : -0.18, 0]}
      rotation={[0.04, -0.2, 0]}
      scale={narrow ? 0.62 : compact ? 0.7 : 0.88}
    >
      <AirwayContext visible={showAnatomy} />

      <group
        onClick={(event) => {
          event.stopPropagation()
          onSelect('outer-cannula')
        }}
      >
        <mesh>
          <tubeGeometry args={[outerCurve, 120, 0.215, 32, false]} />
          <meshPhysicalMaterial
            {...partAppearance('outer-cannula', selected, 0.72)}
            clearcoat={0.62}
            clearcoatRoughness={0.16}
            depthWrite={false}
            transmission={0.08}
          />
        </mesh>
        <mesh>
          <tubeGeometry args={[outerCurve, 120, 0.155, 32, false]} />
          <meshPhysicalMaterial
            color="#36586e"
            opacity={selected === 'whole' || selected === 'outer-cannula' ? 0.48 : 0.15}
            roughness={0.36}
            side={BackSide}
            transparent
          />
        </mesh>
        <mesh position={[0, -1.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.185, 0.03, 16, 48]} />
          <meshPhysicalMaterial
            {...partAppearance('outer-cannula', selected, 0.86)}
            clearcoat={0.5}
          />
        </mesh>
      </group>

      <AnimatedCuff
        inflated={cuffState === 'inflated'}
        reducedMotion={reducedMotion}
        selected={selected}
        onSelect={onSelect}
      />

      <group
        onClick={(event) => {
          event.stopPropagation()
          onSelect('flange')
        }}
      >
        <mesh position={[0, 0.56, 1.41]}>
          <extrudeGeometry
            args={[
              flangeShape,
              {
                bevelEnabled: true,
                bevelSegments: 4,
                bevelSize: 0.035,
                bevelThickness: 0.035,
                depth: 0.11,
              },
            ]}
          />
          <meshPhysicalMaterial
            {...partAppearance('flange', selected, 0.88)}
            clearcoat={0.55}
            clearcoatRoughness={0.18}
          />
        </mesh>
      </group>

      <group
        onClick={(event) => {
          event.stopPropagation()
          onSelect('connector')
        }}
      >
        <mesh position={[0, 0.58, 2.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.275, 0.25, 0.73, 48, 1, true]} />
          <meshPhysicalMaterial
            {...partAppearance('connector', selected, 0.84)}
            clearcoat={0.54}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.58, 2.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.19, 0.17, 0.73, 48, 1, true]} />
          <meshPhysicalMaterial
            color="#173448"
            opacity={selected === 'whole' || selected === 'connector' ? 0.8 : 0.18}
            side={BackSide}
            transparent
          />
        </mesh>
        <mesh position={[0, 0.58, 2.62]}>
          <torusGeometry args={[0.232, 0.043, 14, 56]} />
          <meshPhysicalMaterial {...partAppearance('connector', selected, 0.92)} clearcoat={0.55} />
        </mesh>
      </group>

      <AnimatedRemovablePart
        exploded={exploded}
        installed={innerInstalled}
        reducedMotion={reducedMotion}
        side={-1}
        visible={innerInstalled || exploded}
      >
        <group
          onClick={(event) => {
            event.stopPropagation()
            onSelect('inner-cannula')
          }}
        >
          <mesh>
            <tubeGeometry args={[innerCurve, 120, 0.112, 28, false]} />
            <meshPhysicalMaterial
              {...partAppearance('inner-cannula', selected, 0.92)}
              clearcoat={0.5}
              clearcoatRoughness={0.18}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <tubeGeometry args={[innerCurve, 120, 0.072, 24, false]} />
            <meshPhysicalMaterial
              color="#21394a"
              opacity={selected === 'whole' || selected === 'inner-cannula' ? 0.9 : 0.18}
              side={BackSide}
              transparent
            />
          </mesh>
          <mesh position={[0, 0.58, 2.13]}>
            <torusGeometry args={[0.118, 0.026, 12, 44]} />
            <meshPhysicalMaterial {...partAppearance('inner-cannula', selected, 0.96)} />
          </mesh>
        </group>
      </AnimatedRemovablePart>

      <AnimatedRemovablePart
        exploded={exploded}
        installed={obturatorInstalled}
        reducedMotion={reducedMotion}
        side={1}
        visible={obturatorInstalled || exploded}
      >
        <group
          onClick={(event) => {
            event.stopPropagation()
            onSelect('obturator')
          }}
        >
          <mesh>
            <tubeGeometry args={[outerCurve, 120, 0.132, 24, false]} />
            <meshPhysicalMaterial
              {...partAppearance('obturator', selected, 0.96)}
              clearcoat={0.4}
            />
          </mesh>
          <mesh position={[0, -1.52, 0]}>
            <sphereGeometry args={[0.15, 28, 18]} />
            <meshPhysicalMaterial {...partAppearance('obturator', selected, 0.96)} />
          </mesh>
          <mesh position={[0, 0.58, 2.22]} scale={[1.45, 0.72, 1]}>
            <torusGeometry args={[0.19, 0.052, 14, 48]} />
            <meshPhysicalMaterial
              {...partAppearance('obturator', selected, 0.96)}
              clearcoat={0.35}
            />
          </mesh>
        </group>
      </AnimatedRemovablePart>

      <group
        onClick={(event) => {
          event.stopPropagation()
          onSelect('pilot-balloon')
        }}
      >
        <mesh>
          <tubeGeometry args={[pilotCurve, 100, 0.027, 12, false]} />
          <meshStandardMaterial {...partAppearance('pilot-balloon', selected, 0.9)} />
        </mesh>
        <group
          ref={pilotBalloon}
          position={[1.58, -0.44, 1.56]}
          scale={cuffState === 'inflated' ? 1 : [0.52, 1.08, 0.52]}
        >
          <mesh>
            <latheGeometry args={[pilotBalloonProfile, 48]} />
            <meshPhysicalMaterial
              {...partAppearance('pilot-balloon', selected, 0.66)}
              clearcoat={0.4}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
        </group>
        <mesh position={[1.58, -0.78, 1.56]}>
          <cylinderGeometry args={[0.085, 0.085, 0.22, 24]} />
          <meshStandardMaterial color="#d8e2ea" roughness={0.36} />
        </mesh>
        <mesh position={[1.58, -0.93, 1.56]}>
          <cylinderGeometry args={[0.055, 0.075, 0.12, 24]} />
          <meshStandardMaterial color="#64748b" roughness={0.42} />
        </mesh>
      </group>
    </group>
  )
}

function TextFallback() {
  return (
    <div className="flex h-full min-h-[430px] items-center justify-center p-8 text-center text-sm leading-6 text-slate-300">
      The interactive 3D view is unavailable. Use the component selector and complete text
      descriptions beside the viewer; the Practice section also includes a keyboard-accessible tube
      labeling diagram.
    </div>
  )
}

export function Tracheostomy3DLab() {
  const reduceMotion = Boolean(useReducedMotion())
  const [selected, setSelected] = useState<TracheostomyPartId>('whole')
  const [setupMode, setSetupMode] = useState<TracheostomySetupMode>('in-use')
  const [cuffState, setCuffState] = useState<CuffState>('inflated')
  const [exploded, setExploded] = useState(false)
  const [rotating, setRotating] = useState(!reduceMotion)
  const [showAnatomy, setShowAnatomy] = useState(true)
  const [resetVersion, setResetVersion] = useState(0)
  const anatomyBeforeExplode = useRef(true)
  const active = getTracheostomyPart(selected)
  const effectiveRotating = rotating && !reduceMotion

  function assembleFromExplodedView() {
    if (exploded) setShowAnatomy(anatomyBeforeExplode.current)
    setExploded(false)
  }

  function changeSetupMode(next: TracheostomySetupMode) {
    setSetupMode(next)
    assembleFromExplodedView()
    if (next === 'insertion') {
      setCuffState('deflated')
      setSelected('obturator')
    } else if (selected === 'obturator') {
      setSelected('whole')
    }
  }

  function selectPart(partId: TracheostomyPartId) {
    setSelected(partId)
    if (partId === 'obturator') {
      setSetupMode('insertion')
      setCuffState('deflated')
      assembleFromExplodedView()
    } else if (partId === 'inner-cannula') {
      setSetupMode('in-use')
      assembleFromExplodedView()
    }
  }

  function resetLesson() {
    setSelected('whole')
    setSetupMode('in-use')
    setCuffState('inflated')
    setExploded(false)
    setRotating(!reduceMotion)
    setShowAnatomy(true)
    anatomyBeforeExplode.current = true
    setResetVersion((version) => version + 1)
  }

  return (
    <section className="rounded-3xl border border-slate-700/70 bg-slate-950 text-white shadow-xl">
      <div className="grid items-start lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="relative h-[540px] overflow-hidden rounded-t-3xl border-b border-slate-700/70 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:max-h-[760px] lg:min-h-[620px] lg:rounded-l-3xl lg:rounded-tr-none lg:border-b-0 lg:border-r">
          <p className="sr-only" role="status" aria-live="polite">
            Interactive segmented tracheostomy model. Current setup:{' '}
            {setupMode === 'insertion'
              ? 'insertion setup, not ventilatable, obturator installed'
              : 'in-use setup, inner cannula installed'}
            . Cuff {cuffState}. {exploded ? 'Removable parts are exploded.' : 'Tube is assembled.'}
          </p>
          <CanvasErrorBoundary fallback={<TextFallback />}>
            <Canvas
              key={resetVersion}
              dpr={[1, 2]}
              camera={{ position: [3.5, 1.35, 7.2], fov: 36, near: 0.01, far: 100 }}
              gl={{ antialias: true, alpha: false }}
            >
              <color attach="background" args={['#06101f']} />
              <fog attach="fog" args={['#06101f', 8.5, 14]} />
              <ambientLight intensity={0.76} />
              <hemisphereLight args={['#dff5ff', '#142238', 1.35]} />
              <directionalLight position={[4, 6, 7]} intensity={2.2} color="#e0f2fe" />
              <directionalLight position={[-4, 1, 3]} intensity={0.85} color="#38bdf8" />
              <pointLight position={[0, -3, 3]} intensity={0.48} color="#f6c77b" />
              <SegmentedTracheostomyScene
                cuffState={cuffState}
                exploded={exploded}
                onSelect={selectPart}
                reducedMotion={reduceMotion}
                rotating={effectiveRotating}
                selected={selected}
                setupMode={setupMode}
                showAnatomy={showAnatomy}
              />
              <OrbitControls
                makeDefault
                enablePan={false}
                minDistance={5.1}
                maxDistance={9.4}
                minPolarAngle={0.55}
                maxPolarAngle={2.45}
                target={[0, 0.18, 0.35]}
              />
            </Canvas>
          </CanvasErrorBoundary>

          <div className="pointer-events-none absolute left-4 top-4 max-w-[220px] space-y-1 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Segmented 3D model
            </p>
            <p className="text-sm font-medium">Drag to rotate · scroll or pinch to zoom</p>
            <p className="text-[11px] text-slate-400">
              Flange side = anterior · cranial ↑ · caudal ↓
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAnatomy((value) => !value)}
            aria-pressed={showAnatomy}
            className="absolute right-4 top-40 gap-2 border-white/25 bg-slate-950/75 text-white hover:bg-white/10 sm:top-4"
          >
            {showAnatomy ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
            {showAnatomy ? 'Hide anatomy' : 'Show anatomy'}
          </Button>

          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setExploded((value) => {
                  const next = !value
                  if (next) {
                    anatomyBeforeExplode.current = showAnatomy
                    setShowAnatomy(false)
                  } else {
                    setShowAnatomy(anatomyBeforeExplode.current)
                  }
                  return next
                })
                setRotating(false)
              }}
              aria-pressed={exploded}
              className="gap-2 bg-white/90 text-slate-950 hover:bg-white"
            >
              <Expand className="h-4 w-4" aria-hidden />
              {exploded ? 'Reassemble tube' : 'Explode removable parts'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRotating((value) => !value)}
              aria-pressed={effectiveRotating}
              disabled={reduceMotion}
              title={reduceMotion ? 'Disabled by reduced-motion preference' : undefined}
              className="gap-2 border-white/30 bg-slate-950/70 text-white hover:bg-white/10 disabled:text-slate-500"
            >
              {effectiveRotating ? (
                <Pause className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {effectiveRotating ? 'Pause rotation' : 'Auto rotate'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetLesson}
              className="gap-2 text-slate-200 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset lesson
            </Button>
          </div>
        </div>

        <div className="space-y-6 p-5 md:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              Structure explorer
            </p>
            <h2 className="mt-2 text-2xl font-semibold">See what stays—and what comes out</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The fixed outer assembly remains connected. Explode the view to withdraw the two
              removable pieces, then select any structure to isolate it in context.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                Functional setup
              </p>
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  setupMode === 'insertion'
                    ? 'bg-amber-400/15 text-amber-200'
                    : 'bg-emerald-400/15 text-emerald-200',
                )}
              >
                {setupMode === 'insertion' ? 'Not ventilatable' : 'In-use setup'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Tube setup">
              <button
                type="button"
                onClick={() => changeSetupMode('in-use')}
                aria-pressed={setupMode === 'in-use'}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                  setupMode === 'in-use'
                    ? 'border-emerald-300 bg-emerald-300/10 text-emerald-100'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white',
                )}
              >
                Inner cannula in
              </button>
              <button
                type="button"
                onClick={() => changeSetupMode('insertion')}
                aria-pressed={setupMode === 'insertion'}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                  setupMode === 'insertion'
                    ? 'border-amber-300 bg-amber-300/10 text-amber-100'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white',
                )}
              >
                Obturator in
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-700 pt-3">
              <div>
                <p className="text-xs font-semibold text-white">
                  Cuff {cuffState === 'inflated' ? 'inflated' : 'deflated'}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {setupMode === 'insertion'
                    ? 'Locked deflated for insertion'
                    : 'Animate radial inflation state'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={setupMode === 'insertion'}
                onClick={() => {
                  setCuffState((value) => (value === 'inflated' ? 'deflated' : 'inflated'))
                  setSelected('cuff')
                }}
                className="border-cyan-300/30 bg-cyan-300/5 text-cyan-100 hover:bg-cyan-300/10"
              >
                {cuffState === 'inflated' ? 'Deflate cuff' : 'Inflate cuff'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tube components">
            {tracheostomyModelParts.map((part) => (
              <button
                key={part.id}
                type="button"
                onClick={() => selectPart(part.id)}
                aria-pressed={selected === part.id}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                  selected === part.id
                    ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white',
                )}
              >
                {part.shortLabel}
              </button>
            ))}
          </div>

          <div
            className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tracheostomyPartColors[active.id] }}
                aria-hidden
              />
              <h3 className="text-sm font-semibold text-white">{active.label}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{active.description}</p>
            {active.safety ? (
              <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                <span className="font-semibold">Safety cue:</span> {active.safety}
              </p>
            ) : null}
          </div>

          {exploded ? (
            <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs leading-5 text-cyan-100">
              Exploded view is schematic: the flange, connector, cuff, and pilot system remain
              attached to the outer assembly. The inner cannula and obturator are shown parked
              outside; only the selected functional setup is installed when reassembled.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
