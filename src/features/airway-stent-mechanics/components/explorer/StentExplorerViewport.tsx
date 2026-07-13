'use client'

import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'

import { applyStentMechanicsModifiers, getStentExplorerPose } from '../../explorer/pose'
import { StentExplorerCrossSection } from './StentExplorerCrossSection'
import {
  getStationHotspots,
  StentExplorerScene,
  type StentExplorerCameraAction,
  type StentExplorerCameraCommand,
} from './StentExplorerScene'
import type { StentExplorerVisualizationProps } from './visualizationTypes'

export type StentExplorerViewportProps = StentExplorerVisualizationProps

function supportsWebGL() {
  if (typeof document === 'undefined') return true

  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      (typeof window.WebGL2RenderingContext !== 'undefined' && canvas.getContext('webgl2')) ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return prefersReducedMotion
}

function VisualizationFallback({
  reason,
  ...props
}: StentExplorerViewportProps & { reason: string }) {
  return (
    <div
      className={`min-h-[30rem] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 ${props.className ?? ''}`}
      data-testid="stent-explorer-webgl-fallback"
    >
      <div className="border-b border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
        <p className="font-semibold text-amber-200">Static visualization</p>
        <p className="mt-1 leading-5 text-slate-300">{reason}</p>
      </div>
      <StentExplorerCrossSection {...props} viewMode="cross-section" />
    </div>
  )
}

function getPhaseIndex(progress: number, phaseCount: number) {
  if (phaseCount <= 1) return 0
  const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  return normalized >= 1 ? phaseCount - 1 : Math.floor(normalized * phaseCount)
}

export function StentExplorerViewport(props: StentExplorerViewportProps) {
  const { onVisibilityChange } = props
  const [webglAvailable] = useState(supportsWebGL)
  const [contextLost, setContextLost] = useState(false)
  const [cameraCommand, setCameraCommand] = useState<StentExplorerCameraCommand>()
  const [visibleOnScreen, setVisibleOnScreen] = useState(true)
  const containerRef = useRef<HTMLElement>(null)
  const systemReducedMotion = usePrefersReducedMotion()
  const effectiveReducedMotion = Boolean(props.reducedMotion || systemReducedMotion)
  const crossSectionVisible = props.viewMode === 'cross-section'
  const updateRenderedScene = !crossSectionVisible && visibleOnScreen
  const renderedSceneProgress = updateRenderedScene ? props.progress : 0
  const pose = useMemo(
    () =>
      applyStentMechanicsModifiers(
        props.station.id,
        getStentExplorerPose(props.station.id, props.architectureId, renderedSceneProgress),
        props.modifiers,
      ),
    [props.architectureId, props.modifiers, props.station.id, renderedSceneProgress],
  )
  const phaseIndex = getPhaseIndex(props.progress, props.station.phases.length)
  const phase = props.station.phases[phaseIndex]
  const shouldAnimate =
    props.playing && !effectiveReducedMotion && !crossSectionVisible && visibleOnScreen
  const handleContextLost = useCallback(() => setContextLost(true), [])
  const sendCameraCommand = useCallback((action: StentExplorerCameraAction) => {
    setCameraCommand((current) => ({ action, id: (current?.id ?? 0) + 1 }))
  }, [])
  const hotspots = getStationHotspots(props.station, props.architectureId)

  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      onVisibilityChange?.(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        setVisibleOnScreen(visible)
        onVisibilityChange?.(visible)
      },
      { rootMargin: '120px 0px', threshold: 0.01 },
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      onVisibilityChange?.(false)
    }
  }, [onVisibilityChange])

  if (!webglAvailable || contextLost) {
    return (
      <VisualizationFallback
        {...props}
        reason={
          contextLost
            ? 'The WebGL context was lost. The synchronized cross-section and full text equivalent remain available.'
            : 'WebGL is unavailable in this browser. The synchronized cross-section and full text equivalent remain available.'
        }
      />
    )
  }

  return (
    <section
      ref={containerRef}
      aria-label={`${props.station.title} visualization`}
      className={`relative min-h-[30rem] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ${props.className ?? ''}`}
      data-testid="stent-explorer-viewport"
    >
      <p className="sr-only" aria-atomic="true" aria-live="polite" role="status">
        {effectiveReducedMotion && props.playing
          ? `Reduced motion is active. ${props.station.reducedMotionSummary}`
          : `${phase?.label ?? props.station.shortLabel}. ${phase?.textEquivalent ?? props.station.reducedMotionSummary}`}
      </p>

      <div
        aria-hidden={crossSectionVisible}
        className={`absolute inset-0 transition-opacity duration-200 ${crossSectionVisible ? 'pointer-events-none invisible opacity-0' : 'visible opacity-100'}`}
      >
        <CanvasErrorBoundary
          fallback={
            <VisualizationFallback
              {...props}
              reason="The 3D renderer could not start. The synchronized cross-section and full text equivalent remain available."
            />
          }
        >
          <Canvas
            aria-label={`Interactive qualitative 3D model for ${props.station.title}`}
            camera={{ far: 100, fov: 38, near: 0.02, position: [7.2, 3.25, 7.5] }}
            dpr={[1, 1.65]}
            frameloop={shouldAnimate ? 'always' : 'demand'}
            gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true
              gl.outputColorSpace = THREE.SRGBColorSpace
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.08
            }}
            shadows
          >
            <color attach="background" args={['#07111f']} />
            <fog attach="fog" args={['#07111f', 10, 24]} />
            <hemisphereLight args={['#e0f2fe', '#07111f', 1.2]} />
            <directionalLight castShadow intensity={2.25} position={[5, 7, 6]} />
            <directionalLight color="#67e8f9" intensity={0.9} position={[-5, 1, -4]} />
            <pointLight color="#fb7185" intensity={0.7} position={[0, -2.5, 4]} />
            <StentExplorerScene
              architectureId={props.architectureId}
              cameraCommand={cameraCommand}
              modifiers={props.modifiers}
              onContextLost={handleContextLost}
              playing={props.playing}
              pose={pose}
              reducedMotion={effectiveReducedMotion}
              showHotspots={props.showHotspots}
              station={props.station}
              viewMode={props.viewMode}
            />
          </Canvas>
        </CanvasErrorBoundary>
      </div>

      <div
        aria-hidden={!crossSectionVisible}
        className={`absolute inset-0 transition-opacity duration-200 ${crossSectionVisible ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'}`}
      >
        <StentExplorerCrossSection {...props} />
      </div>

      {!crossSectionVisible ? (
        <>
          <div className="pointer-events-none absolute left-3 top-3 max-w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-white/10 bg-slate-950/88 px-3 py-2 text-white shadow-xl backdrop-blur sm:left-4 sm:top-4 sm:px-4 sm:py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Qualitative educational model
              </p>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                Not to scale
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-white">
              {phase?.label ?? props.station.shortLabel}
            </p>
            <p className="mt-1 hidden text-xs leading-5 text-slate-300 sm:block">
              {phase?.instruction ?? props.station.summary}
            </p>
          </div>

          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-white/10 bg-slate-950/85 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 backdrop-blur sm:bottom-4 sm:right-4">
            {props.viewMode === 'endoscopic'
              ? 'Fixed endoscopic-style camera · illustrative view'
              : 'Drag to orbit or pan · scroll or pinch to zoom'}
          </div>

          <div
            className="absolute bottom-12 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5 sm:bottom-4 sm:left-4 sm:max-w-[60%]"
            role="group"
            aria-label="Keyboard-accessible 3D camera controls"
          >
            {(
              [
                ['orbit-left', 'Orbit left'],
                ['orbit-right', 'Orbit right'],
                ['pan-left', 'Pan left'],
                ['pan-right', 'Pan right'],
              ] as const
            ).map(([action, label]) => (
              <button
                key={action}
                type="button"
                aria-label={label}
                disabled={props.viewMode === 'endoscopic'}
                onClick={() => sendCameraCommand(action)}
                className="min-h-9 rounded-lg border border-white/15 bg-slate-950/90 px-2.5 text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur hover:border-cyan-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => sendCameraCommand('reset')}
              className="min-h-9 rounded-lg border border-white/15 bg-slate-950/90 px-2.5 text-[10px] font-semibold text-slate-100 shadow-lg backdrop-blur hover:border-cyan-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Reset camera
            </button>
          </div>

          {props.showHotspots ? (
            <ol className="sr-only" aria-label="Visible 3D inspection hotspots">
              {hotspots.map((hotspot, index) => (
                <li key={hotspot.id}>
                  {index + 1}. {hotspot.label}: {hotspot.description}
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
