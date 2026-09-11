'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import {
  atArcLength,
  PREVIEW_BASE,
  PREVIEW_CT,
  previewGraphSchema,
  type PreviewGraph,
} from '../geometry/clinical-preview'
import styles from './branch-tracing.module.css'

const ClinicalAirwayView = dynamic(
  () => import('./ClinicalAirwayView').then((m) => m.ClinicalAirwayView),
  { ssr: false, loading: () => <p>Loading 3D viewer…</p> },
)

export function RealCtExplorer() {
  const [graph, setGraph] = useState<PreviewGraph | null>(null)
  const [path, setPath] = useState<number[]>([])
  const [distance, setDistance] = useState(0.92)
  const [slice, setSlice] = useState(157)
  const [loadedSlice, setLoadedSlice] = useState<number | null>(null)
  const [imageError, setImageError] = useState(false)
  const [roll, setRoll] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${PREVIEW_BASE}/geometry.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('The airway graph is unavailable.')
        return r.json()
      })
      .then((raw) => {
        const data = previewGraphSchema.parse(raw),
          root = data.edges.find((e) => e.startNodeId === data.rootNodeId)
        if (!root) throw new Error('The graph has no root branch.')
        setGraph(data)
        setPath([root.id])
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load the anatomy package.')
      })
    return () => controller.abort()
  }, [retry])
  const edge = graph?.edges.find((e) => e.id === path[path.length - 1])
  const camera = edge ? atArcLength(edge.pointsLps, distance) : null
  const children = edge ? (graph?.edges.filter((e) => e.startNodeId === edge.endNodeId) ?? []) : []
  function changeSlice(value: number) {
    setSlice(Math.min(255, Math.max(0, value)))
    setImageError(false)
  }
  function exportRoute() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schema: 'branch-tracing-learner-route/v1',
            caseVersion: 'preview-v1',
            kind: 'ungraded-geometric-exploration',
            edgeIds: path,
            review: 'No anatomical identities or clinical route validity asserted.',
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = 'branch-tracing-route.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className={styles.explorer}>
      <div className={styles.notice}>
        <strong>One real teaching CT · ungraded exploration</strong>
        <p>
          CT spacing: 1.38 × 1.38 × 1.24 mm in this resampled preview. Distal lumen detail is
          limited. The fixed lung display is exported from an 8-bit preview; it is not adjustable
          source-HU windowing.
        </p>
      </div>
      {error ? (
        <p role="alert">
          {error.slice(0, 240)}{' '}
          <button
            onClick={() => {
              setError('')
              setGraph(null)
              setRetry((n) => n + 1)
            }}
          >
            Retry case
          </button>
        </p>
      ) : !camera || !graph ? (
        <p role="status">Loading CT geometry…</p>
      ) : (
        <>
          <div className={styles.explorerGrid}>
            <section className={styles.view}>
              <h2>Teaching CT · axial stack</h2>
              <div
                className={styles.realCt}
                role="group"
                tabIndex={0}
                aria-label="CT image. Arrow keys pan; Home resets pan."
                onKeyDown={(event) => {
                  const offsets: Record<string, [number, number]> = {
                    ArrowLeft: [-12, 0],
                    ArrowRight: [12, 0],
                    ArrowUp: [0, -12],
                    ArrowDown: [0, 12],
                  }
                  if (event.key === 'Home') {
                    event.preventDefault()
                    setPan({ x: 0, y: 0 })
                  }
                  const offset = offsets[event.key]
                  if (offset) {
                    event.preventDefault()
                    setPan((p) => ({
                      x: Math.max(-120, Math.min(120, p.x + offset[0])),
                      y: Math.max(-120, Math.min(120, p.y + offset[1])),
                    }))
                  }
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1)
                    setPan((p) => ({
                      x: Math.max(-120, Math.min(120, p.x + e.movementX)),
                      y: Math.max(-120, Math.min(120, p.y + e.movementY)),
                    }))
                }}
              >
                {/* Source-sized, lazy plane-by-plane medical preview. Next/Image optimization adds no benefit here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${PREVIEW_BASE}/axial/${String(slice).padStart(3, '0')}.png`}
                  width="256"
                  height="256"
                  alt={`Unannotated axial CT plane ${slice + 1} of 256. Patient right is screen-left; anterior is up.`}
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                    opacity: loadedSlice === slice ? 1 : 0,
                  }}
                  onLoad={() => setLoadedSlice(slice)}
                  onError={() => setImageError(true)}
                />
                <span className={styles.ctTop}>A</span>
                <span className={styles.ctLeft}>R</span>
                <span className={styles.ctRight}>L</span>
                <span className={styles.ctBottom}>P</span>
                {imageError ? (
                  <p role="alert">
                    This CT plane could not load. Try an adjacent plane or reload the case.
                  </p>
                ) : (
                  loadedSlice !== slice && <p role="status">Loading plane {slice + 1}…</p>
                )}
              </div>
              <div className={styles.sliceControl}>
                <button aria-label="Previous CT slice" onClick={() => changeSlice(slice - 1)}>
                  −
                </button>
                <label>
                  Slice {slice + 1} / 256 · z{' '}
                  {(PREVIEW_CT.origin[2] + slice * PREVIEW_CT.spacing[2]).toFixed(1)} mm
                  <input
                    aria-label="Real CT slice"
                    type="range"
                    min="0"
                    max="255"
                    value={slice}
                    onChange={(e) => changeSlice(Number(e.target.value))}
                  />
                </label>
                <button aria-label="Next CT slice" onClick={() => changeSlice(slice + 1)}>
                  +
                </button>
              </div>
              <button
                onClick={() =>
                  changeSlice(
                    Math.round((camera.position[2] - PREVIEW_CT.origin[2]) / PREVIEW_CT.spacing[2]),
                  )
                }
              >
                Align CT to current camera
              </button>
              <label>
                Image zoom
                <input
                  aria-label="Real CT zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <button
                onClick={() => {
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
              >
                Reset CT view
              </button>
              <p className={styles.small}>
                Drag to pan. Browsing slices does not move your camera or choose a route.
              </p>
            </section>
            <ClinicalAirwayView
              position={camera.position}
              direction={camera.direction}
              roll={roll}
              slice={slice}
            />
          </div>
          <section className={styles.routeControls}>
            <div>
              <h2>Your airway route</h2>
              <p>
                {path.length} connected branch{path.length === 1 ? '' : 'es'} in your map.{' '}
                {children.length
                  ? `${children.length} geometric continuation${children.length === 1 ? '' : 's'} at this branch end.`
                  : 'The segmented route ends here; no distal passage is established.'}
              </p>
              <p className={styles.small}>
                The choices below are graph connections. Their order does not label a screen
                position or a named bronchus. Confirm continuity on CT before interpreting an
                opening.
              </p>
              <div className={styles.tabs}>
                {children.map((child, i) => (
                  <button
                    key={child.id}
                    onClick={() => {
                      setPath((p) => [...p, child.id])
                      setDistance(0.1)
                    }}
                  >
                    Follow connected branch {i + 1}
                  </button>
                ))}
              </div>
              <button
                disabled={path.length < 2}
                onClick={() => {
                  setPath((p) => p.slice(0, -1))
                  setDistance(0.92)
                }}
              >
                Backtrack one branch
              </button>
            </div>
            <div>
              <label>
                Position along current branch
                <input
                  aria-label="Camera position along branch"
                  type="range"
                  min="0.02"
                  max="0.98"
                  step="0.01"
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value))}
                />
              </label>
              <label>
                Camera roll: {roll}°
                <input
                  aria-label="Camera roll"
                  type="range"
                  min="-180"
                  max="180"
                  value={roll}
                  onChange={(e) => setRoll(Number(e.target.value))}
                />
              </label>
              <button onClick={() => setRoll(0)}>Reset roll</button>
              <button onClick={exportRoute}>Export your route</button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
