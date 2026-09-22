'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ComparisonSlideViewer } from '@/features/socrates-demo/components/ComparisonSlideViewer'
import {
  findDeepestAnnotationAtPoint,
  polygonBounds,
} from '@/features/socrates-demo/engine/geometry'
import { resolveVisibleAnnotationIds } from '@/features/socrates-demo/engine/visibility'
import type {
  DeepZoomSlide,
  DeepZoomViewerHandle,
  DemoAnnotation,
  ViewportSnapshot,
} from '@/features/socrates-demo/types'
import styles from './study.module.css'
const empty: DemoAnnotation[] = []
export function StudyViewer({
  slide,
  annotations = empty,
}: {
  slide: DeepZoomSlide
  annotations?: DemoAnnotation[]
}) {
  const viewer = useRef<DeepZoomViewerHandle>(null)
  const [viewport, setViewport] = useState<ViewportSnapshot>({
    zoomRatio: 1,
    visibleImageBounds: slide.initialImageRect,
  })
  const [selected, setSelected] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const [shown, setShown] = useState(true)
  const [previouslyVisible, setPreviouslyVisible] = useState<ReadonlySet<string>>(new Set())
  const visible = useMemo(
    () => resolveVisibleAnnotationIds(annotations, viewport.zoomRatio, previouslyVisible),
    [annotations, viewport.zoomRatio, previouslyVisible],
  )
  const region = annotations.find((a) => a.id === selected)
  const onViewport = useCallback(
    (value: ViewportSnapshot) => {
      setViewport(value)
      setPreviouslyVisible((previous) => {
        const next = resolveVisibleAnnotationIds(annotations, value.zoomRatio, previous)
        return next.size === previous.size && [...next].every((id) => previous.has(id))
          ? previous
          : next
      })
    },
    [annotations],
  )
  return (
    <div>
      <div
        className={styles.viewer}
        data-testid="study-viewer"
        data-viewport={JSON.stringify(viewport)}
      >
        <div className={styles.controls}>
          <button type="button" onClick={() => viewer.current?.zoomBy(1.35)}>
            Zoom in
          </button>
          <button type="button" onClick={() => viewer.current?.zoomBy(1 / 1.35)}>
            Zoom out
          </button>
          <button type="button" onClick={() => viewer.current?.resetToInitialView()}>
            Reset view
          </button>
          {annotations.length > 0 && (
            <button type="button" aria-pressed={shown} onClick={() => setShown(!shown)}>
              {shown ? 'Hide' : 'Show'} teaching regions
            </button>
          )}
        </div>
        <ComparisonSlideViewer
          ref={viewer}
          slide={slide}
          annotations={shown ? annotations.filter((a) => visible.has(a.id)) : empty}
          selectedAnnotationId={selected}
          previewedAnnotationId={hovered}
          onViewportChange={onViewport}
          onImageSelect={(point) => {
            if (shown)
              setSelected(findDeepestAnnotationAtPoint(annotations, visible, point)?.id ?? '')
          }}
          onImageHover={(point) =>
            setHovered(
              point && shown
                ? (findDeepestAnnotationAtPoint(annotations, visible, point)?.id ?? null)
                : null,
            )
          }
        />
      </div>
      {annotations.length > 0 && (
        <section className={styles.panel} aria-label="Teaching regions">
          <h3>Teaching regions</h3>
          <div className={styles.controls}>
            {annotations.map((a) => (
              <button
                type="button"
                key={a.id}
                aria-pressed={selected === a.id}
                onClick={() => {
                  setSelected(a.id)
                  viewer.current?.fitImageRect(polygonBounds(a.polygon))
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
          {region && (
            <>
              <h3>{region.label}</h3>
              <p>{region.summary}</p>
              <p style={{ whiteSpace: 'pre-line' }}>{region.explanation}</p>
            </>
          )}
        </section>
      )}
    </div>
  )
}
