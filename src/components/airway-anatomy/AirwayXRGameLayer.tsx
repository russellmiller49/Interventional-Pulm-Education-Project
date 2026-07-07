'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import {
  computeTargetGuide,
  difficultyById,
  DIFFICULTIES,
  LOBE_COLORS,
  LOBE_LABELS,
  type GameTarget,
} from '@/lib/airway-anatomy/airway-game'
import type { AirwayGraph, ScopePoseSnapshot, Vec3 } from '@/lib/airway-anatomy/types'
import type { AirwayGameActions, AirwayGameView } from './AirwayGameLayer'
import { XrButton } from './xr-widgets'

/**
 * "Bronch Quest VR" — the headset-native layer for the airway navigation game.
 * The game engine (target queue, scoring, arrival detection) is shared with the
 * desktop challenge mode via `useAirwayGame`; this file only adds the spatial
 * presentation: an in-lumen target beacon, a glowing destination segment, a
 * mesh-based celebration burst, and a billboarded HUD panel with in-headset
 * Start / Play-again controls (the headset has no DOM, so every affordance is a
 * mesh). All world visuals live inside the scaled airway group and are authored
 * in LPS millimetres, so they track and scale with the grabbable model.
 */

// ---------------------------------------------------------------------------
// In-world visuals (rendered inside the scaled + recentred LPS airway group)
// ---------------------------------------------------------------------------

/** Pulsing lobe-coloured beacon + expanding sonar ring at the current target. */
function XrTargetBeacon({ target }: { target: GameTarget }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const clockRef = useRef(0)
  const color = LOBE_COLORS[target.lobe]

  useFrame((_, delta) => {
    clockRef.current += Math.min(delta, 0.05)
    const t = clockRef.current
    const pulse = 1 + Math.sin(t * 3.2) * 0.18
    if (coreRef.current) coreRef.current.scale.setScalar(pulse)
    const cycle = (t % 1.6) / 1.6
    if (ringRef.current) ringRef.current.scale.setScalar(3 + cycle * 16)
    if (ringMaterialRef.current) ringMaterialRef.current.opacity = 0.6 * (1 - cycle)
  })

  return (
    <group position={target.anchorLps as Vec3}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[3.2, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[5.2, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 1, 32]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={color} intensity={6} distance={70} decay={1.4} />
    </group>
  )
}

/** The destination segment lit as a glowing tube so it reads through the shell. */
function XrTargetGlow({ graph, target }: { graph: AirwayGraph; target: GameTarget }) {
  const color = LOBE_COLORS[target.lobe]
  const tubes = useMemo(() => {
    const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]))
    const out: THREE.TubeGeometry[] = []
    for (const edgeId of target.edgeIds) {
      const edge = edgeById.get(edgeId)
      if (!edge || edge.pointsLps.length < 2) continue
      const points = edge.pointsLps.map((point) => new THREE.Vector3(...point))
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
      const segments = Math.min(200, Math.max(8, Math.round(curve.getLength() / 2)))
      out.push(new THREE.TubeGeometry(curve, segments, 1.1, 8, false))
    }
    return out
  }, [graph, target])

  useEffect(() => () => tubes.forEach((geometry) => geometry.dispose()), [tubes])

  return (
    <group>
      {tubes.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

const SPARK_COUNT = 14

/**
 * A one-shot, mesh-based celebration fired at `origin` whenever `triggerKey`
 * changes: an expanding shock ring, a white flash, and a spray of lobe-coloured
 * shards under gravity. Meshes (not points) so it scales cleanly with the group.
 */
function XrHitCelebration({
  triggerKey,
  origin,
  colorHex,
}: {
  triggerKey: number
  origin: Vec3
  colorHex: string
}) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const flashMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const sparkRefs = useRef<Array<THREE.Mesh | null>>([])
  const stateRef = useRef({ age: 1, velocities: new Float32Array(SPARK_COUNT * 3) })

  useEffect(() => {
    if (triggerKey === 0) return
    const group = groupRef.current
    if (group) group.position.set(origin[0], origin[1], origin[2])
    const local = stateRef.current
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.max(0, 1 - u * u))
      const speed = 24 + Math.random() * 46
      local.velocities[i * 3] = r * Math.cos(theta) * speed
      local.velocities[i * 3 + 1] = u * speed + 14
      local.velocities[i * 3 + 2] = r * Math.sin(theta) * speed
      const mesh = sparkRefs.current[i]
      if (mesh) {
        mesh.position.set(0, 0, 0)
        mesh.visible = true
      }
    }
    local.age = 0
    // Re-fire only when the trigger changes; origin is captured intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey])

  useFrame((_, delta) => {
    const local = stateRef.current
    if (local.age >= 1) return
    const dt = Math.min(delta, 0.05)
    local.age += dt / 0.95
    const age = local.age

    if (ringRef.current) ringRef.current.scale.setScalar(2 + age * 38)
    if (ringMaterialRef.current) ringMaterialRef.current.opacity = 0.7 * (1 - age)
    if (flashRef.current) flashRef.current.scale.setScalar(1 + age * 3)
    if (flashMaterialRef.current)
      flashMaterialRef.current.opacity = Math.max(0, 0.9 * (1 - age * 1.6))

    for (let i = 0; i < SPARK_COUNT; i += 1) {
      const mesh = sparkRefs.current[i]
      if (!mesh) continue
      local.velocities[i * 3 + 1] -= 52 * dt
      mesh.position.x += local.velocities[i * 3] * dt
      mesh.position.y += local.velocities[i * 3 + 1] * dt
      mesh.position.z += local.velocities[i * 3 + 2] * dt
      mesh.scale.setScalar(Math.max(0.001, 1 - age))
      if (age >= 1) mesh.visible = false
    }
  })

  return (
    <group ref={groupRef} position={origin as Vec3}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.1, 40]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={colorHex}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={flashRef}>
        <sphereGeometry args={[2.4, 16, 16]} />
        <meshBasicMaterial
          ref={flashMaterialRef}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {Array.from({ length: SPARK_COUNT }).map((_, index) => (
        <mesh
          key={index}
          ref={(element) => {
            sparkRefs.current[index] = element
          }}
          visible={false}
        >
          <octahedronGeometry args={[1.5, 0]} />
          <meshBasicMaterial
            color={colorHex}
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * All in-lumen game visuals. Rendered INSIDE the scaled + recentred airway group
 * so its LPS-authored children track the grabbable model.
 */
export function XrGameWorld({
  graph,
  target,
  hitPulse,
  hitAnchor,
  active,
}: {
  graph: AirwayGraph
  target: GameTarget | null
  hitPulse: number
  hitAnchor: Vec3 | null
  active: boolean
}) {
  const color = target ? LOBE_COLORS[target.lobe] : '#38bdf8'
  return (
    <group>
      {active && target ? <XrTargetGlow graph={graph} target={target} /> : null}
      {active && target ? <XrTargetBeacon target={target} /> : null}
      {target ? (
        <XrHitCelebration
          triggerKey={hitPulse}
          origin={hitAnchor ?? target.anchorLps}
          colorHex={color}
        />
      ) : null}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Spatial HUD panel (a billboarded canvas-texture, world-fixed sibling)
// ---------------------------------------------------------------------------

const HUD_CANVAS_W = 640
const HUD_CANVAS_H = 800
const HUD_PANEL_W = 0.5
const HUD_PANEL_H = (HUD_PANEL_W * HUD_CANVAS_H) / HUD_CANVAS_W

function formatClock(totalSec: number): string {
  const rounded = Math.ceil(totalSec)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function proximityColor(proximity: number): string {
  if (proximity >= 0.9) return '#f472b6'
  if (proximity >= 0.7) return '#fbbf24'
  if (proximity >= 0.4) return '#34d399'
  return '#38bdf8'
}

function proximityWord(proximity: number): string {
  if (proximity >= 0.9) return 'On top of it'
  if (proximity >= 0.7) return 'Hot'
  if (proximity >= 0.45) return 'Warmer'
  if (proximity >= 0.25) return 'Cool'
  return 'Cold'
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, cx, currentY)
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  value: string,
  label: string,
): void {
  ctx.fillStyle = '#f8fafc'
  ctx.font = '900 62px system-ui, -apple-system, sans-serif'
  ctx.fillText(value, cx, cy)
  ctx.fillStyle = '#64748b'
  ctx.font = '700 22px system-ui, -apple-system, sans-serif'
  ctx.fillText(label, cx, cy + 44)
}

function drawHud(canvas: HTMLCanvasElement, view: AirwayGameView, proximity: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const target = view.currentTarget
  const lobeColor = target ? LOBE_COLORS[target.lobe] : '#38bdf8'

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(2,6,23,0.92)'
  roundRect(ctx, 0, 0, W, H, 30)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (view.status === 'idle') {
    ctx.fillStyle = '#67e8f9'
    ctx.font = '900 66px system-ui, -apple-system, sans-serif'
    ctx.fillText('BRONCH QUEST', cx, 78)
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '600 30px system-ui, -apple-system, sans-serif'
    ctx.fillText('VR Challenge', cx, 130)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '400 25px system-ui, -apple-system, sans-serif'
    wrapText(
      ctx,
      'Steer the scope to the called segment before the clock runs out. Clean, fast runs build a combo.',
      cx,
      195,
      W - 96,
      34,
    )
    ctx.fillStyle = '#475569'
    ctx.font = '700 22px system-ui, -apple-system, sans-serif'
    ctx.fillText('CHOOSE YOUR AIRWAYS', cx, 300)
    const difficulty = difficultyById(view.difficultyId)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '800 40px system-ui, -apple-system, sans-serif'
    ctx.fillText(difficulty.label, cx, 352)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '400 24px system-ui, -apple-system, sans-serif'
    ctx.fillText(`${difficulty.blurb} · ${difficulty.durationSec}s`, cx, 396)
    return
  }

  if (view.status === 'countdown') {
    ctx.fillStyle = '#67e8f9'
    ctx.font = '900 220px system-ui, -apple-system, sans-serif'
    ctx.fillText(view.countdownValue > 0 ? String(view.countdownValue) : 'GO!', cx, H / 2 - 30)
    if (target) {
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '600 30px system-ui, -apple-system, sans-serif'
      ctx.fillText('First target', cx, H / 2 + 140)
      ctx.fillStyle = lobeColor
      ctx.font = '900 72px system-ui, -apple-system, sans-serif'
      ctx.fillText(target.abbr, cx, H / 2 + 210)
    }
    return
  }

  if (view.status === 'playing') {
    const lowTime = view.timeLeftSec <= 10
    ctx.textAlign = 'left'
    ctx.font = '800 50px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = lowTime ? '#fb7185' : '#e2e8f0'
    ctx.fillText(formatClock(view.timeLeftSec), 44, 62)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#67e8f9'
    ctx.fillText(String(view.score), W - 44, 62)
    ctx.textAlign = 'center'
    if (view.combo >= 2) {
      ctx.fillStyle = '#fbbf24'
      ctx.font = '800 32px system-ui, -apple-system, sans-serif'
      ctx.fillText(`COMBO ${view.combo}  ×${view.comboMultiplier.toFixed(2)}`, cx, 116)
    }

    ctx.fillStyle = '#475569'
    ctx.font = '700 24px system-ui, -apple-system, sans-serif'
    ctx.fillText('NAVIGATE TO', cx, 214)
    if (target) {
      ctx.fillStyle = lobeColor
      ctx.font = '900 130px system-ui, -apple-system, sans-serif'
      ctx.fillText(target.abbr, cx, 306)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '600 32px system-ui, -apple-system, sans-serif'
      ctx.fillText(target.shortName, cx, 380)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '400 25px system-ui, -apple-system, sans-serif'
      ctx.fillText(LOBE_LABELS[target.lobe], cx, 420)
    }

    const barX = 72
    const barY = 486
    const barW = W - 144
    const barH = 36
    ctx.fillStyle = '#475569'
    ctx.font = '700 21px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('PROXIMITY', barX, barY - 20)
    const proxColor = proximityColor(proximity)
    ctx.textAlign = 'right'
    ctx.fillStyle = proxColor
    ctx.fillText(proximityWord(proximity), barX + barW, barY - 20)
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(30,41,59,0.9)'
    roundRect(ctx, barX, barY, barW, barH, barH / 2)
    ctx.fill()
    ctx.fillStyle = proxColor
    roundRect(ctx, barX, barY, Math.max(barH, barW * proximity), barH, barH / 2)
    ctx.fill()

    ctx.fillStyle = view.wrongTurns > 0 ? '#fca5a5' : '#4ade80'
    ctx.font = '600 26px system-ui, -apple-system, sans-serif'
    ctx.fillText(
      view.wrongTurns > 0
        ? `${view.wrongTurns} wrong turn${view.wrongTurns > 1 ? 's' : ''}`
        : 'clean path',
      cx,
      576,
    )
    return
  }

  if (view.status === 'finished' && view.results) {
    const results = view.results
    ctx.fillStyle = results.newBest ? '#fbbf24' : '#94a3b8'
    ctx.font = '800 30px system-ui, -apple-system, sans-serif'
    ctx.fillText(results.newBest ? 'NEW PERSONAL BEST' : 'TIME UP', cx, 82)
    ctx.fillStyle = '#f8fafc'
    ctx.font = '900 140px system-ui, -apple-system, sans-serif'
    ctx.fillText(String(results.score), cx, 194)
    ctx.fillStyle = '#64748b'
    ctx.font = '500 25px system-ui, -apple-system, sans-serif'
    ctx.fillText(results.perfect ? 'points · flawless navigation' : 'points', cx, 276)
    drawStat(ctx, W * 0.28, 372, String(results.hits), 'REACHED')
    drawStat(ctx, W * 0.72, 372, String(results.bestCombo), 'BEST COMBO')
    drawStat(ctx, W * 0.28, 486, `${results.accuracyPct}%`, 'CLEAN')
    drawStat(ctx, W * 0.72, 486, String(results.starsTotal), 'STARS')
  }
}

/**
 * The spatial game HUD: a billboarded canvas panel showing the timer, score,
 * combo, current target, and proximity, plus in-headset Start / Play-again
 * buttons so the whole challenge can be run without leaving VR. Placed once to
 * the user's front-left, then billboards to whichever camera is active.
 */
export function XrGameHud({
  view,
  actions,
  pose,
}: {
  view: AirwayGameView
  actions: AirwayGameActions
  pose: ScopePoseSnapshot
}) {
  const groupRef = useRef<THREE.Group>(null)
  const placedRef = useRef(false)
  const facePos = useRef(new THREE.Vector3())
  const drawAccumRef = useRef(0)
  const viewRef = useRef(view)
  const poseRef = useRef(pose)
  viewRef.current = view
  poseRef.current = pose

  // The panel is redrawn ~10x/s (the timer ticks), so the canvas + texture live
  // in a ref and are mutated in place — recreating a CanvasTexture each tick is
  // wasteful, and the React-compiler immutability rule forbids mutating a
  // useMemo value's `needsUpdate`. A ref is the sanctioned mutable escape hatch.
  const hudRef = useRef<{ canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } | null>(null)
  if (!hudRef.current) {
    const canvas = document.createElement('canvas')
    canvas.width = HUD_CANVAS_W
    canvas.height = HUD_CANVAS_H
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    hudRef.current = { canvas, texture }
  }
  const hud = hudRef.current

  useEffect(() => {
    // Prime the panel so it is legible before the first throttled redraw.
    drawHud(hud.canvas, viewRef.current, 0)
    hud.texture.needsUpdate = true
    return () => hud.texture.dispose()
    // hud is a stable ref value; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Billboard + one-time placement (front-left; the endoluminal feed sits front-right).
  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    if (!placedRef.current) {
      group.position.set(-0.55, 1.45, -0.5)
      placedRef.current = true
    }
    const out = facePos.current
    if (state.gl.xr.isPresenting) {
      out.setFromMatrixPosition(state.gl.xr.getCamera().matrixWorld)
    } else {
      state.camera.getWorldPosition(out)
    }
    group.rotation.set(0, Math.atan2(out.x - group.position.x, out.z - group.position.z), 0)
  })

  // Throttled canvas redraw (~10 Hz); proximity reads the live pose each tick.
  useFrame((_, delta) => {
    drawAccumRef.current += delta
    if (drawAccumRef.current < 0.1) return
    drawAccumRef.current = 0
    const currentView = viewRef.current
    let proximity = 0
    const target = currentView.currentTarget
    if (target && currentView.status === 'playing') {
      proximity = computeTargetGuide(target.anchorLps, poseRef.current, 1, 88).proximity
    }
    drawHud(hud.canvas, currentView, proximity)
    hud.texture.needsUpdate = true
  })

  return (
    <group ref={groupRef} position={[-0.55, 1.45, -0.5]}>
      <mesh position={[0, 0, -0.004]}>
        <planeGeometry args={[HUD_PANEL_W + 0.03, HUD_PANEL_H + 0.03]} />
        <meshBasicMaterial color="#0b1120" toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[HUD_PANEL_W, HUD_PANEL_H]} />
        <meshBasicMaterial map={hud.texture} transparent toneMapped={false} />
      </mesh>

      {view.status === 'idle' ? (
        <>
          {DIFFICULTIES.map((difficulty, index) => (
            <XrButton
              key={difficulty.id}
              label={difficulty.label}
              position={[(index - 1) * 0.162, -0.13, 0.006]}
              size={[0.15, 0.05]}
              primary={difficulty.id === view.difficultyId}
              accent={difficulty.id === view.difficultyId ? '#22d3ee' : undefined}
              onTrigger={() => actions.setDifficulty(difficulty.id)}
            />
          ))}
          <XrButton
            label="Start ▶"
            position={[0, -0.235, 0.006]}
            size={[0.34, 0.06]}
            primary
            onTrigger={() => actions.start(view.difficultyId)}
          />
        </>
      ) : null}

      {view.status === 'playing' ? (
        <XrButton
          label="End"
          position={[0, -0.275, 0.006]}
          size={[0.16, 0.045]}
          onTrigger={actions.stop}
        />
      ) : null}

      {view.status === 'finished' ? (
        <>
          <XrButton
            label="Play again"
            position={[-0.11, -0.24, 0.006]}
            size={[0.2, 0.056]}
            primary
            onTrigger={actions.playAgain}
          />
          <XrButton
            label="Difficulty"
            position={[0.12, -0.24, 0.006]}
            size={[0.22, 0.056]}
            onTrigger={actions.stop}
          />
        </>
      ) : null}
    </group>
  )
}
