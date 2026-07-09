'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { CatmullRomCurve3, Color, Vector3 } from 'three'
import type { Group } from 'three'
import { Suspense, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Expand, Pause, Play, RotateCcw } from 'lucide-react'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type PartId =
  | 'whole'
  | 'outer-cannula'
  | 'inner-cannula'
  | 'cuff'
  | 'flange'
  | 'connector'
  | 'obturator'
  | 'pilot-balloon'

interface PartDefinition {
  id: PartId
  label: string
  shortLabel: string
  description: string
  safety?: string
}

const parts: PartDefinition[] = [
  {
    id: 'whole',
    label: 'Complete tube in an anterior tracheal model',
    shortLabel: 'Whole model',
    description:
      'Rotate and zoom the simplified adult airway. The tube enters the anterior trachea below the larynx; dimensions and curvature must match the patient rather than a nominal size alone.',
  },
  {
    id: 'outer-cannula',
    label: 'Outer cannula and shaft',
    shortLabel: 'Outer cannula',
    description:
      'The outer cannula maintains the tract and airway. Outer diameter, functional inner diameter, curvature, proximal length, and distal length all affect fit.',
    safety: 'A tube that is too short can sit in pretracheal tissue or abut the posterior wall.',
  },
  {
    id: 'inner-cannula',
    label: 'Removable inner cannula',
    shortLabel: 'Inner cannula',
    description:
      'A removable inner cannula can be rapidly exchanged when blocked, but it narrows the functional lumen and may be required for a standard 15-mm connection on some designs.',
    safety:
      'In suspected obstruction, remove a removable inner cannula early and reassess patency.',
  },
  {
    id: 'cuff',
    label: 'Inflatable cuff',
    shortLabel: 'Cuff',
    description:
      'An inflated cuff supports a positive-pressure seal. It does not completely prevent aspiration, and pressure should be measured with a manometer.',
    safety:
      'A one-way speaking valve must never be placed with the cuff inflated because exhalation can be completely obstructed.',
  },
  {
    id: 'flange',
    label: 'Flange or neck plate',
    shortLabel: 'Flange',
    description:
      'The flange anchors the tube at the neck and carries identifying information. Skin pressure, tie tension, tube angle, and ventilator-circuit traction all matter.',
  },
  {
    id: 'connector',
    label: '15-mm connector',
    shortLabel: 'Connector',
    description:
      'The standard connector accepts a ventilator circuit, bag, heat-moisture exchanger, or selected speaking-valve setup according to the tube design.',
  },
  {
    id: 'obturator',
    label: 'Insertion obturator',
    shortLabel: 'Obturator',
    description:
      'The obturator rounds the distal profile for tube insertion and is removed immediately after placement so the tube can ventilate.',
    safety: 'Keep the matching obturator accessible at the bedside for planned tube exchange.',
  },
  {
    id: 'pilot-balloon',
    label: 'Inflation line, valve, and pilot balloon',
    shortLabel: 'Pilot balloon',
    description:
      'The inflation system communicates with the cuff. The pilot balloon indicates inflation state but palpation cannot determine cuff pressure reliably.',
  },
]

function materialColor(id: PartId, selected: PartId, base: string) {
  if (selected === 'whole' || selected === id) return base
  return '#334155'
}

function TracheostomyScene({
  selected,
  exploded,
  rotating,
}: {
  selected: PartId
  exploded: boolean
  rotating: boolean
}) {
  const group = useRef<Group>(null)
  const outerCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.2, 1.45),
        new Vector3(0, 0.16, 0.82),
        new Vector3(0, 0.02, 0.38),
        new Vector3(0, -0.48, 0.05),
        new Vector3(0, -1.15, 0),
      ]),
    [],
  )
  const pilotCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.55, 0.02, 1.35),
        new Vector3(1.05, -0.02, 1.3),
        new Vector3(1.45, -0.35, 1.18),
        new Vector3(1.68, -0.72, 1.08),
      ]),
    [],
  )
  const obturatorCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.2, 1.48),
        new Vector3(0, 0.15, 0.82),
        new Vector3(0, -0.04, 0.32),
        new Vector3(0, -0.56, 0.02),
        new Vector3(0, -1.3, -0.02),
      ]),
    [],
  )

  useFrame((_, delta) => {
    if (group.current && rotating) group.current.rotation.y += delta * 0.18
  })

  const choose = (id: PartId) => ({
    color: new Color(materialColor(id, selected, partColor[id])),
    emissive: new Color(selected === id ? partColor[id] : '#000000'),
    emissiveIntensity: selected === id ? 0.34 : 0,
    roughness: 0.42,
    metalness: 0.04,
  })

  return (
    <group ref={group} rotation={[0.08, -0.25, 0]}>
      <group position={[0, -0.05, -0.15]}>
        <mesh>
          <cylinderGeometry args={[0.63, 0.67, 3.7, 48, 1, true]} />
          <meshStandardMaterial
            color="#6b8cab"
            transparent
            opacity={selected === 'whole' ? 0.18 : 0.08}
            side={2}
            roughness={0.6}
          />
        </mesh>
        {Array.from({ length: 10 }, (_, index) => (
          <mesh key={index} position={[0, 1.43 - index * 0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.64, 0.055, 14, 64, Math.PI * 1.72]} />
            <meshStandardMaterial color="#dbe4ee" roughness={0.55} metalness={0.03} />
          </mesh>
        ))}
        <mesh position={[0, 1.78, 0]} scale={[1.05, 0.58, 0.88]}>
          <sphereGeometry args={[0.78, 36, 24]} />
          <meshStandardMaterial color="#d1dae6" roughness={0.58} />
        </mesh>
        <mesh position={[0, 1.44, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.7, 0.11, 20, 64]} />
          <meshStandardMaterial color="#eef2f7" roughness={0.5} />
        </mesh>
      </group>

      <group
        position={exploded ? [-0.65, 0.22, 0.12] : [0, 0, 0]}
        onClick={(event) => event.stopPropagation()}
      >
        <mesh>
          <tubeGeometry args={[outerCurve, 72, 0.22, 24, false]} />
          <meshStandardMaterial {...choose('outer-cannula')} transparent opacity={0.94} />
        </mesh>
      </group>

      <group position={exploded ? [0.62, 0.18, 0.1] : [0, 0, 0]}>
        <mesh>
          <tubeGeometry args={[outerCurve, 72, 0.105, 20, false]} />
          <meshStandardMaterial {...choose('inner-cannula')} />
        </mesh>
      </group>

      <group position={exploded ? [0.78, -0.1, -0.05] : [0, 0, 0]}>
        <mesh position={[0, -0.93, 0]} scale={[0.61, 0.4, 0.54]}>
          <sphereGeometry args={[1, 36, 24]} />
          <meshStandardMaterial
            {...choose('cuff')}
            transparent
            opacity={selected === 'cuff' || selected === 'whole' ? 0.7 : 0.24}
          />
        </mesh>
      </group>

      <group position={exploded ? [-0.9, 0.34, 0.22] : [0, 0, 0]}>
        <mesh position={[0, 0.15, 1.42]}>
          <boxGeometry args={[1.7, 0.54, 0.12]} />
          <meshStandardMaterial {...choose('flange')} />
        </mesh>
        <mesh position={[-0.67, 0.15, 1.49]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.035, 12, 32]} />
          <meshStandardMaterial color="#7dd3fc" />
        </mesh>
        <mesh position={[0.67, 0.15, 1.49]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.035, 12, 32]} />
          <meshStandardMaterial color="#7dd3fc" />
        </mesh>
      </group>

      <group position={exploded ? [0, 0.55, 0.75] : [0, 0, 0]}>
        <mesh position={[0, 0.19, 1.78]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.29, 0.78, 32]} />
          <meshStandardMaterial {...choose('connector')} />
        </mesh>
        <mesh position={[0, 0.19, 2.19]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.055, 12, 40]} />
          <meshStandardMaterial color="#93c5fd" />
        </mesh>
      </group>

      <group position={exploded ? [1.12, 0.72, 0.2] : [0, 0, 0]}>
        <mesh>
          <tubeGeometry args={[obturatorCurve, 72, 0.065, 16, false]} />
          <meshStandardMaterial {...choose('obturator')} />
        </mesh>
        <mesh position={[0, -1.37, -0.03]}>
          <coneGeometry args={[0.12, 0.3, 24]} />
          <meshStandardMaterial {...choose('obturator')} />
        </mesh>
      </group>

      <group position={exploded ? [0.88, 0.52, 0.22] : [0, 0, 0]}>
        <mesh>
          <tubeGeometry args={[pilotCurve, 48, 0.025, 10, false]} />
          <meshStandardMaterial {...choose('pilot-balloon')} />
        </mesh>
        <mesh position={[1.72, -0.83, 1.06]} scale={[0.18, 0.32, 0.18]}>
          <sphereGeometry args={[1, 24, 18]} />
          <meshStandardMaterial {...choose('pilot-balloon')} transparent opacity={0.8} />
        </mesh>
        <mesh position={[1.72, -1.12, 1.06]}>
          <cylinderGeometry args={[0.08, 0.08, 0.22, 18]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      </group>
    </group>
  )
}

const partColor: Record<PartId, string> = {
  whole: '#dbeafe',
  'outer-cannula': '#7dd3fc',
  'inner-cannula': '#f8fafc',
  cuff: '#5eead4',
  flange: '#dbeafe',
  connector: '#93c5fd',
  obturator: '#fbbf24',
  'pilot-balloon': '#38bdf8',
}

function TextFallback() {
  return (
    <div className="flex h-full min-h-[430px] items-center justify-center p-8 text-center text-sm leading-6 text-slate-300">
      The interactive 3D view is unavailable. Use the component selector and the complete text
      descriptions beside the viewer; the Practice section also includes a keyboard-accessible tube
      labeling diagram.
    </div>
  )
}

export function Tracheostomy3DLab() {
  const reduceMotion = useReducedMotion()
  const [selected, setSelected] = useState<PartId>('whole')
  const [exploded, setExploded] = useState(false)
  const [rotating, setRotating] = useState(!reduceMotion)
  const active = parts.find((part) => part.id === selected) ?? parts[0]

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-950 text-white shadow-xl">
      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="relative min-h-[500px] border-b border-slate-700/70 lg:border-b-0 lg:border-r">
          <CanvasErrorBoundary fallback={<TextFallback />}>
            <Canvas
              dpr={[1, 2]}
              camera={{ position: [0.3, 0.35, 5.8], fov: 36, near: 0.01, far: 100 }}
              gl={{ antialias: true }}
            >
              <color attach="background" args={['#06101f']} />
              <fog attach="fog" args={['#06101f', 7, 13]} />
              <ambientLight intensity={0.82} />
              <directionalLight position={[4, 5, 6]} intensity={2.1} color="#e0f2fe" />
              <directionalLight position={[-4, 1, 2]} intensity={0.9} color="#38bdf8" />
              <pointLight position={[0, -3, 2]} intensity={0.55} color="#fbbf24" />
              <Suspense fallback={null}>
                <TracheostomyScene
                  selected={selected}
                  exploded={exploded}
                  rotating={rotating && !reduceMotion}
                />
              </Suspense>
              <OrbitControls
                makeDefault
                enablePan={false}
                minDistance={3.8}
                maxDistance={8.2}
                minPolarAngle={0.55}
                maxPolarAngle={2.5}
              />
            </Canvas>
          </CanvasErrorBoundary>

          <div className="pointer-events-none absolute left-4 top-4 space-y-1 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Interactive 3D
            </p>
            <p className="text-sm font-medium">Drag to rotate · scroll to zoom</p>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const next = !exploded
                setExploded(next)
                if (next) setRotating(false)
              }}
              aria-pressed={exploded}
              className="gap-2 bg-white/90 text-slate-950 hover:bg-white"
            >
              <Expand className="h-4 w-4" aria-hidden />
              {exploded ? 'Assemble tube' : 'Explode components'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRotating((value) => !value)}
              aria-pressed={rotating}
              className="gap-2 border-white/30 bg-slate-950/70 text-white hover:bg-white/10"
            >
              {rotating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {rotating ? 'Pause rotation' : 'Auto rotate'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected('whole')
                setExploded(false)
                setRotating(!reduceMotion)
              }}
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
            <h2 className="mt-2 text-2xl font-semibold">Know the tube before the crisis</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Select a component to isolate its job and its failure mode. Geometry is intentionally
              simplified and not shown to scale.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2" role="list" aria-label="Tube components">
            {parts.map((part) => (
              <button
                key={part.id}
                type="button"
                onClick={() => setSelected(part.id)}
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
                style={{ backgroundColor: partColor[active.id] }}
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
        </div>
      </div>
    </section>
  )
}
