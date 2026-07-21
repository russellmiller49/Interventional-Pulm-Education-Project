'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Eye,
  EyeOff,
  Minus,
  Plus,
  RotateCcw,
  ScanSearch,
  TriangleAlert,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { socratesDemoAnnotations, socratesDemoSlide } from '../content/demo-slide'
import {
  findDeepestAnnotationAtPoint,
  getAnnotationAncestry,
  polygonBounds,
} from '../engine/geometry'
import { annotationsInCurrentView, resolveVisibleAnnotationIds } from '../engine/visibility'
import type {
  DeepZoomViewerHandle,
  DeepZoomViewerStatus,
  DemoAnnotation,
  ImagePoint,
  ViewportSnapshot,
} from '../types'
import { DeepZoomViewer } from './DeepZoomViewer'
import styles from './socrates-demo.module.css'

function setsAreEqual(first: ReadonlySet<string>, second: ReadonlySet<string>) {
  if (first.size !== second.size) return false
  return [...first].every((value) => second.has(value))
}

interface SocratesDemoProps {
  slide?: typeof socratesDemoSlide
  annotations?: readonly DemoAnnotation[]
}

export function SocratesDemo({
  slide = socratesDemoSlide,
  annotations = socratesDemoAnnotations,
}: SocratesDemoProps) {
  const defaultSelectedId =
    annotations.find((annotation) => annotation.style === 'parent')?.id ?? annotations[0]?.id ?? ''
  const viewerRef = useRef<DeepZoomViewerHandle | null>(null)
  const [selectedId, setSelectedId] = useState(defaultSelectedId)
  const [previewedId, setPreviewedId] = useState<string | null>(null)
  const [annotationsVisible, setAnnotationsVisible] = useState(true)
  const [viewerStatus, setViewerStatus] = useState<DeepZoomViewerStatus>({ phase: 'loading' })
  const [viewport, setViewport] = useState<ViewportSnapshot>({
    zoomRatio: 1,
    visibleImageBounds: slide.initialImageRect,
  })
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() =>
    resolveVisibleAnnotationIds(annotations, 1, new Set()),
  )

  const annotationsById = useMemo(
    () => new Map(annotations.map((annotation) => [annotation.id, annotation])),
    [annotations],
  )
  const selectedAnnotation =
    annotationsById.get(selectedId) ?? annotationsById.get(defaultSelectedId) ?? annotations[0]!
  const breadcrumbs = getAnnotationAncestry(selectedAnnotation.id, annotations)
  const currentViewAnnotations = annotationsInCurrentView(
    annotations,
    visibleIds,
    viewport.visibleImageBounds,
  )
  const overlayAnnotations = annotationsVisible
    ? annotations.filter((annotation) => visibleIds.has(annotation.id))
    : []

  const handleViewportChange = useCallback(
    (snapshot: ViewportSnapshot) => {
      setViewport(snapshot)
      setVisibleIds((previouslyVisibleIds) => {
        const nextVisibleIds = resolveVisibleAnnotationIds(
          annotations,
          snapshot.zoomRatio,
          previouslyVisibleIds,
        )
        return setsAreEqual(previouslyVisibleIds, nextVisibleIds)
          ? previouslyVisibleIds
          : nextVisibleIds
      })
    },
    [annotations],
  )

  const regionAtPoint = useCallback(
    (point: ImagePoint) =>
      annotationsVisible ? findDeepestAnnotationAtPoint(annotations, visibleIds, point) : null,
    [annotations, annotationsVisible, visibleIds],
  )

  const handleImageHover = useCallback(
    (point: ImagePoint | null) => {
      setPreviewedId(point ? (regionAtPoint(point)?.id ?? null) : null)
    },
    [regionAtPoint],
  )

  const handleImageSelect = useCallback(
    (point: ImagePoint) => {
      const annotation = regionAtPoint(point)
      if (annotation) setSelectedId(annotation.id)
    },
    [regionAtPoint],
  )

  const fitAnnotation = useCallback((annotation: DemoAnnotation, revealChildren = false) => {
    viewerRef.current?.fitImageRect(polygonBounds(annotation.polygon))
    if (revealChildren && annotation.style === 'parent') {
      viewerRef.current?.zoomBy(1.55)
    }
  }, [])

  const selectBreadcrumb = useCallback(
    (annotation: DemoAnnotation) => {
      setSelectedId(annotation.id)
      setPreviewedId(null)
      fitAnnotation(annotation)
    },
    [fitAnnotation],
  )

  const resetDemo = useCallback(() => {
    setSelectedId(defaultSelectedId)
    setPreviewedId(null)
    setVisibleIds(resolveVisibleAnnotationIds(annotations, 1, new Set()))
    viewerRef.current?.resetToInitialView()
  }, [annotations, defaultSelectedId])

  const toggleAnnotations = useCallback(() => {
    setAnnotationsVisible((areVisible) => !areVisible)
    setPreviewedId(null)
  }, [])

  const controlsDisabled = viewerStatus.phase !== 'ready'

  return (
    <section className={styles.demoPage} aria-labelledby="socrates-demo-title">
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrowRow}>
            <Badge variant="info">Unlisted functional demo</Badge>
            <span className={styles.slideId}>Slide {slide.id}</span>
          </div>
          <h1 id="socrates-demo-title">SOCRATES deep-slide annotation demo</h1>
          <p>
            Explore a live pathology pyramid with source-pixel annotations, nested regions, and
            mouse, touch, or keyboard navigation.
          </p>
        </div>

        <div className={styles.placeholderBanner} role="note">
          <TriangleAlert aria-hidden="true" />
          <div>
            <strong>{slide.contentStatus}</strong>
            <span>All region names, boundaries, and descriptions are illustrative.</span>
          </div>
        </div>
      </div>

      <div className={styles.demoGrid}>
        <div className={styles.slideColumn}>
          <div className={styles.viewerFrame}>
            <div className={styles.viewerHeader}>
              <div>
                <span className={styles.viewerKicker}>Live sample slide</span>
                <span className={styles.viewerHint}>Drag to pan · scroll or pinch to zoom</span>
              </div>
              <span className={styles.zoomReadout} aria-live="polite">
                {viewport.zoomRatio.toFixed(2)}× demo view
              </span>
            </div>

            <div className={styles.viewerStage}>
              <DeepZoomViewer
                ref={viewerRef}
                slide={slide}
                annotations={overlayAnnotations}
                selectedAnnotationId={selectedId}
                previewedAnnotationId={previewedId}
                onImageHover={handleImageHover}
                onImageSelect={handleImageSelect}
                onViewportChange={handleViewportChange}
                onStatusChange={setViewerStatus}
              />

              <div className={styles.viewerControls} role="group" aria-label="Slide controls">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Zoom in"
                  title="Zoom in"
                  disabled={controlsDisabled}
                  onClick={() => viewerRef.current?.zoomBy(1.35)}
                >
                  <Plus aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Zoom out"
                  title="Zoom out"
                  disabled={controlsDisabled}
                  onClick={() => viewerRef.current?.zoomBy(1 / 1.35)}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Reset slide view"
                  title="Reset slide view"
                  disabled={controlsDisabled}
                  onClick={resetDemo}
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant={annotationsVisible ? 'secondary' : 'outline'}
                  size="icon"
                  aria-label={annotationsVisible ? 'Hide annotations' : 'Show annotations'}
                  title={annotationsVisible ? 'Hide annotations' : 'Show annotations'}
                  aria-pressed={annotationsVisible}
                  onClick={toggleAnnotations}
                >
                  {annotationsVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.belowViewer}>
            <div className={styles.legend} aria-label="Annotation legend">
              <span>
                <i className={styles.parentSwatch} aria-hidden="true" /> Parent zone
              </span>
              <span>
                <i className={styles.detailSwatch} aria-hidden="true" /> Nested detail
              </span>
              <span className={styles.legendState}>
                Overlay {annotationsVisible ? 'visible' : 'hidden'}
              </span>
            </div>
            <p>
              Hover for a preview, click or tap to pin a region, or use the region buttons for
              keyboard access.
            </p>
          </div>
        </div>

        <aside className={styles.inspector} aria-label="Annotation details">
          <nav className={styles.breadcrumbs} aria-label="Selected region path">
            <button type="button" onClick={resetDemo}>
              Demo crop
            </button>
            {breadcrumbs.map((annotation) => (
              <span key={annotation.id}>
                <ChevronRight aria-hidden="true" />
                <button
                  type="button"
                  aria-current={annotation.id === selectedId ? 'page' : undefined}
                  onClick={() => selectBreadcrumb(annotation)}
                >
                  {annotation.label}
                </button>
              </span>
            ))}
          </nav>

          <section className={styles.regionListCard} aria-labelledby="visible-regions-title">
            <div className={styles.cardHeadingRow}>
              <div>
                <span className={styles.cardEyebrow}>Keyboard access</span>
                <h2 id="visible-regions-title">Regions in view</h2>
              </div>
              <span className={styles.regionCount}>{currentViewAnnotations.length}</span>
            </div>

            <div className={styles.regionList}>
              {currentViewAnnotations.length > 0 ? (
                currentViewAnnotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    type="button"
                    className={
                      annotation.id === selectedId ? styles.regionButtonSelected : undefined
                    }
                    aria-label={annotation.label}
                    aria-pressed={annotation.id === selectedId}
                    onPointerEnter={() => setPreviewedId(annotation.id)}
                    onPointerLeave={() => setPreviewedId(null)}
                    onFocus={() => setPreviewedId(annotation.id)}
                    onBlur={() => setPreviewedId(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedId(annotation.id)
                      }
                    }}
                    onClick={() => setSelectedId(annotation.id)}
                  >
                    <span>
                      <i
                        className={
                          annotation.style === 'detail'
                            ? styles.detailRegionDot
                            : styles.parentRegionDot
                        }
                        aria-hidden="true"
                      />
                      {annotation.label}
                    </span>
                    <small>{annotation.style === 'detail' ? 'Nested' : 'Parent'}</small>
                  </button>
                ))
              ) : (
                <p className={styles.emptyRegions}>Pan back toward a demo zone to list it here.</p>
              )}
            </div>
            {!annotationsVisible ? (
              <p className={styles.overlayHiddenNote}>
                The visual overlay is hidden; these accessible region controls remain available.
              </p>
            ) : null}
          </section>

          <section
            className={styles.pinnedCard}
            aria-labelledby="pinned-region-title"
            aria-live="polite"
          >
            <div className={styles.cardEyebrow}>Pinned demonstration panel</div>
            <div className={styles.pinnedTitleRow}>
              <div>
                <h2 id="pinned-region-title">{selectedAnnotation.label}</h2>
                <span>
                  {selectedAnnotation.style === 'detail' ? 'Nested detail zone' : 'Parent zone'}
                </span>
              </div>
              <ScanSearch aria-hidden="true" />
            </div>
            <p>{selectedAnnotation.summary}</p>
            <div className={styles.placeholderNote}>{selectedAnnotation.placeholderNote}</div>
            <Button
              type="button"
              className={styles.zoomToRegionButton}
              disabled={controlsDisabled}
              onClick={() => fitAnnotation(selectedAnnotation, true)}
            >
              Zoom to {selectedAnnotation.label}
            </Button>
          </section>

          <section className={styles.sourceCard} aria-labelledby="source-title">
            <h2 id="source-title">Source &amp; scope</h2>
            <p>
              Slide imagery streams directly from the provider&apos;s public deep-zoom service. No
              tiles are copied or stored by this demo.
            </p>
            <a href={slide.attribution.href} target="_blank" rel="noreferrer">
              {slide.attribution.label}
            </a>
          </section>
        </aside>
      </div>

      <footer className={styles.disclaimer}>
        <strong>Education and demonstration only.</strong> This prototype is not for diagnosis,
        treatment decisions, or clinical use. Annotation content has not undergone clinical review.
      </footer>
    </section>
  )
}
