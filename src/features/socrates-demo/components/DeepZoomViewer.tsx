'use client'

import { createPortal } from 'react-dom'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type OpenSeadragonType from 'openseadragon'

import type {
  DeepZoomSlide,
  DeepZoomViewerHandle,
  DeepZoomViewerStatus,
  DemoAnnotation,
  ImagePoint,
  ImageRect,
  ViewportSnapshot,
} from '../types'
import { polygonBounds } from '../engine/geometry'
import styles from './socrates-demo.module.css'

interface DeepZoomViewerProps {
  slide: DeepZoomSlide
  annotations: readonly DemoAnnotation[]
  selectedAnnotationId: string
  previewedAnnotationId: string | null
  onImageHover: (point: ImagePoint | null) => void
  onImageSelect: (point: ImagePoint) => void
  onViewportChange: (snapshot: ViewportSnapshot) => void
  onStatusChange?: (status: DeepZoomViewerStatus) => void
}

interface LabelPosition {
  x: number
  y: number
}

function reduceMotionIsPreferred() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function imageRectFromOpenSeadragonRect(rect: OpenSeadragonType.Rect): ImageRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

function pointsAttribute(annotation: DemoAnnotation) {
  return annotation.polygon.map((point) => `${point.x},${point.y}`).join(' ')
}

export const DeepZoomViewer = forwardRef<DeepZoomViewerHandle, DeepZoomViewerProps>(
  function DeepZoomViewer(
    {
      slide,
      annotations,
      selectedAnnotationId,
      previewedAnnotationId,
      onImageHover,
      onImageSelect,
      onViewportChange,
      onStatusChange,
    },
    ref,
  ) {
    const viewerElementRef = useRef<HTMLDivElement | null>(null)
    const viewerRef = useRef<OpenSeadragonType.Viewer | null>(null)
    const tiledImageRef = useRef<OpenSeadragonType.TiledImage | null>(null)
    const initialZoomRef = useRef(1)
    const callbacksRef = useRef({
      onImageHover,
      onImageSelect,
      onViewportChange,
      onStatusChange,
    })
    const activeAnnotationRef = useRef<DemoAnnotation | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null)
    const [status, setStatus] = useState<DeepZoomViewerStatus>({ phase: 'loading' })
    const [tileWarning, setTileWarning] = useState(false)
    const [labelPosition, setLabelPosition] = useState<LabelPosition | null>(null)

    const activeAnnotation =
      annotations.find((annotation) => annotation.id === previewedAnnotationId) ??
      annotations.find((annotation) => annotation.id === selectedAnnotationId) ??
      null

    useEffect(() => {
      callbacksRef.current = {
        onImageHover,
        onImageSelect,
        onViewportChange,
        onStatusChange,
      }
    }, [onImageHover, onImageSelect, onStatusChange, onViewportChange])

    useEffect(() => {
      activeAnnotationRef.current = activeAnnotation
    }, [activeAnnotation])

    const publishStatus = useCallback((nextStatus: DeepZoomViewerStatus) => {
      setStatus(nextStatus)
      callbacksRef.current.onStatusChange?.(nextStatus)
    }, [])

    const updateLabelPosition = useCallback(() => {
      const viewer = viewerRef.current
      const tiledImage = tiledImageRef.current
      const annotation = activeAnnotationRef.current

      if (!viewer || !tiledImage || !annotation) {
        setLabelPosition(null)
        return
      }

      const bounds = polygonBounds(annotation.polygon)
      const viewportPoint = tiledImage.imageToViewportCoordinates(
        bounds.x + bounds.width / 2,
        bounds.y,
        true,
      )
      const position = viewer.viewport.viewportToViewerElementCoordinates(viewportPoint)
      setLabelPosition({ x: position.x, y: position.y })
    }, [])

    const emitViewportSnapshot = useCallback(() => {
      const viewer = viewerRef.current
      const tiledImage = tiledImageRef.current
      if (!viewer || !tiledImage) return

      const visibleBounds = tiledImage.viewportToImageRectangle(
        viewer.viewport.getBounds(true),
        true,
      )
      const currentZoom = viewer.viewport.getZoom(true)
      const zoomRatio = initialZoomRef.current > 0 ? currentZoom / initialZoomRef.current : 1

      callbacksRef.current.onViewportChange({
        zoomRatio,
        visibleImageBounds: imageRectFromOpenSeadragonRect(visibleBounds),
      })
      updateLabelPosition()
    }, [updateLabelPosition])

    const fitImageRect = useCallback(
      (rect: ImageRect, establishInitialZoom = false) => {
        const viewer = viewerRef.current
        const tiledImage = tiledImageRef.current
        if (!viewer || !tiledImage) return

        const viewportRect = tiledImage.imageToViewportRectangle(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          true,
        )
        viewer.viewport.fitBounds(viewportRect, reduceMotionIsPreferred())

        if (establishInitialZoom) {
          initialZoomRef.current = viewer.viewport.getZoom(false)
        }

        emitViewportSnapshot()
      },
      [emitViewportSnapshot],
    )

    const retry = useCallback(() => {
      setAttempt((currentAttempt) => currentAttempt + 1)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        fitImageRect: (rect) => fitImageRect(rect),
        zoomBy: (factor) => {
          const viewer = viewerRef.current
          if (!viewer) return
          viewer.viewport.zoomBy(factor, undefined, reduceMotionIsPreferred())
          viewer.viewport.applyConstraints(reduceMotionIsPreferred())
          emitViewportSnapshot()
        },
        resetToInitialView: () => fitImageRect(slide.initialImageRect, true),
        retry,
      }),
      [emitViewportSnapshot, fitImageRect, retry, slide.initialImageRect],
    )

    useEffect(() => {
      updateLabelPosition()
    }, [activeAnnotation, updateLabelPosition])

    useEffect(() => {
      const viewerElement = viewerElementRef.current
      if (!viewerElement) return
      const mountElement: HTMLDivElement = viewerElement

      let disposed = false
      let viewer: OpenSeadragonType.Viewer | null = null
      let pointerMoveHandler: ((event: PointerEvent) => void) | null = null
      let pointerLeaveHandler: (() => void) | null = null

      setOverlayElement(null)
      setTileWarning(false)
      setLabelPosition(null)
      publishStatus({ phase: 'loading' })

      async function initializeViewer() {
        try {
          const { default: OpenSeadragon } = await import('openseadragon')
          if (disposed) return

          viewer = OpenSeadragon({
            element: mountElement,
            tileSources: slide.descriptorUrl,
            showNavigationControl: false,
            showNavigator: true,
            navigatorPosition: 'TOP_RIGHT',
            navigatorSizeRatio: 0.18,
            navigatorAutoFade: false,
            navigatorBackground: '#07151d',
            navigatorBorderColor: '#d8f3f0',
            navigatorDisplayRegionColor: '#35d0ba',
            crossOriginPolicy: 'Anonymous',
            ajaxWithCredentials: false,
            loadTilesWithAjax: true,
            constrainDuringPan: true,
            visibilityRatio: 0.5,
            maxZoomPixelRatio: 4,
            tileRetryMax: 1,
            gestureSettingsMouse: {
              clickToZoom: false,
              dblClickToZoom: true,
              scrollToZoom: true,
              dragToPan: true,
            },
            gestureSettingsTouch: {
              clickToZoom: false,
              dblClickToZoom: true,
              pinchToZoom: true,
              dragToPan: true,
            },
          })

          viewerRef.current = viewer

          viewer.addHandler('open', () => {
            if (disposed || !viewer) return

            const tiledImage = viewer.world.getItemAt(0)
            const contentSize = tiledImage?.getContentSize()
            if (!tiledImage || !contentSize) {
              publishStatus({
                phase: 'error',
                kind: 'descriptor',
                message: 'The slide opened without a readable tiled image.',
              })
              return
            }

            if (
              contentSize.x !== slide.expectedDimensions.width ||
              contentSize.y !== slide.expectedDimensions.height
            ) {
              publishStatus({
                phase: 'error',
                kind: 'dimensions',
                message: `Slide dimensions changed: expected ${slide.expectedDimensions.width} × ${slide.expectedDimensions.height}, received ${contentSize.x} × ${contentSize.y}.`,
              })
              viewer.close()
              return
            }

            tiledImageRef.current = tiledImage

            const overlayHost = document.createElement('div')
            overlayHost.className = styles.overlayHost
            overlayHost.setAttribute('aria-hidden', 'true')
            viewer.addOverlay({
              element: overlayHost,
              location: tiledImage.imageToViewportRectangle(
                0,
                0,
                slide.expectedDimensions.width,
                slide.expectedDimensions.height,
                true,
              ),
              checkResize: false,
            })
            setOverlayElement(overlayHost)

            fitImageRect(slide.initialImageRect, true)
            publishStatus({ phase: 'ready' })
          })

          viewer.addHandler('open-failed', (event) => {
            if (disposed) return
            publishStatus({
              phase: 'error',
              kind: 'descriptor',
              message: event.message || 'The remote slide descriptor could not be loaded.',
            })
          })

          viewer.addHandler('tile-load-failed', () => {
            if (!disposed) setTileWarning(true)
          })

          viewer.addHandler('canvas-click', (event) => {
            if (!event.quick || !tiledImageRef.current) return
            const point = tiledImageRef.current.viewerElementToImageCoordinates(event.position)
            callbacksRef.current.onImageSelect({ x: point.x, y: point.y })
          })

          viewer.addHandler('viewport-change', emitViewportSnapshot)
          viewer.addHandler('animation-finish', emitViewportSnapshot)
          viewer.addHandler('resize', emitViewportSnapshot)

          pointerMoveHandler = (event: PointerEvent) => {
            const activeTiledImage = tiledImageRef.current
            if (!activeTiledImage || !viewer) return

            const viewerBounds = viewer.element.getBoundingClientRect()
            const point = activeTiledImage.viewerElementToImageCoordinates(
              new OpenSeadragon.Point(
                event.clientX - viewerBounds.left,
                event.clientY - viewerBounds.top,
              ),
            )
            callbacksRef.current.onImageHover({ x: point.x, y: point.y })
          }
          pointerLeaveHandler = () => callbacksRef.current.onImageHover(null)
          viewer.canvas.addEventListener('pointermove', pointerMoveHandler, { passive: true })
          viewer.canvas.addEventListener('pointerleave', pointerLeaveHandler)
        } catch {
          if (!disposed) {
            publishStatus({
              phase: 'error',
              kind: 'descriptor',
              message: 'The deep-zoom viewer could not be initialized.',
            })
          }
        }
      }

      void initializeViewer()

      return () => {
        disposed = true
        if (viewer && pointerMoveHandler) {
          viewer.canvas.removeEventListener('pointermove', pointerMoveHandler)
        }
        if (viewer && pointerLeaveHandler) {
          viewer.canvas.removeEventListener('pointerleave', pointerLeaveHandler)
        }
        callbacksRef.current.onImageHover(null)
        tiledImageRef.current = null
        viewerRef.current = null
        viewer?.destroy()
      }
    }, [
      attempt,
      emitViewportSnapshot,
      fitImageRect,
      publishStatus,
      slide.descriptorUrl,
      slide.expectedDimensions.height,
      slide.expectedDimensions.width,
      slide.initialImageRect,
    ])

    return (
      <div className={styles.viewerSurface} data-testid="deep-zoom-viewer">
        <div
          ref={viewerElementRef}
          className={styles.viewerCanvas}
          aria-label="Interactive pathology slide. Drag to pan, scroll or pinch to zoom."
        />

        {overlayElement
          ? createPortal(
              <svg
                className={styles.annotationOverlay}
                viewBox={`0 0 ${slide.expectedDimensions.width} ${slide.expectedDimensions.height}`}
                preserveAspectRatio="none"
              >
                {annotations.map((annotation) => {
                  const isSelected = annotation.id === selectedAnnotationId
                  const isPreviewed = annotation.id === previewedAnnotationId
                  const classNames = [
                    styles.annotationPolygon,
                    annotation.style === 'detail'
                      ? styles.annotationDetail
                      : styles.annotationParent,
                    isSelected ? styles.annotationSelected : '',
                    isPreviewed ? styles.annotationPreviewed : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <polygon
                      key={annotation.id}
                      points={pointsAttribute(annotation)}
                      className={classNames}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                })}
              </svg>,
              overlayElement,
            )
          : null}

        {activeAnnotation && labelPosition ? (
          <span
            className={styles.viewerLabel}
            style={{ left: labelPosition.x, top: labelPosition.y }}
            aria-hidden="true"
          >
            {activeAnnotation.label}
          </span>
        ) : null}

        {status.phase === 'loading' ? (
          <div className={styles.viewerMessage} role="status">
            <span className={styles.loadingSpinner} aria-hidden="true" />
            Loading the remote slide…
          </div>
        ) : null}

        {status.phase === 'error' ? (
          <div className={styles.viewerMessage} role="alert">
            <strong>Slide unavailable</strong>
            <span>{status.message}</span>
            <button type="button" className={styles.inlineRetryButton} onClick={retry}>
              Retry slide
            </button>
          </div>
        ) : null}

        {tileWarning && status.phase === 'ready' ? (
          <div className={styles.tileWarning} role="status">
            Some image tiles did not load.
            <button type="button" onClick={retry}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    )
  },
)

DeepZoomViewer.displayName = 'DeepZoomViewer'
