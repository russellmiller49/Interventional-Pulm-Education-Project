'use client'

import { createPortal } from 'react-dom'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type OpenSeadragonType from 'openseadragon'
import { socratesTileSourceUrl } from '@/features/socrates-builder/invenio-source'
import {
  resizeAnnotation,
  resizeBoundsFromHandle,
  resizeHandles,
  type ResizeHandle,
} from '@/features/socrates-builder/annotation-editing'

import type {
  DeepZoomSlide,
  DeepZoomViewerHandle,
  DeepZoomViewerStatus,
  DemoAnnotation,
  ImagePoint,
  ImageRect,
  ViewportSnapshot,
} from '../types'
import { findDeepestAnnotationAtPoint, polygonBounds, rectangleToPolygon } from '../engine/geometry'
import styles from './socrates-demo.module.css'

export interface DeepZoomViewerProps {
  slide: DeepZoomSlide
  annotations: readonly DemoAnnotation[]
  selectedAnnotationId: string
  previewedAnnotationId: string | null
  onImageHover: (point: ImagePoint | null) => void
  onImageSelect: (point: ImagePoint) => void
  onViewportChange: (snapshot: ViewportSnapshot) => void
  onStatusChange?: (status: DeepZoomViewerStatus) => void
  interactionMode?: 'navigate' | 'draw-rectangle' | 'move-rectangle'
  onDrawRectangle?: (rect: ImageRect) => void
  onMoveAnnotation?: (id: string, delta: ImagePoint) => void
  onResizeAnnotation?: (id: string, bounds: ImageRect) => void
  ariaLabel?: string
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
      interactionMode = 'navigate',
      onDrawRectangle,
      onMoveAnnotation,
      onResizeAnnotation,
      ariaLabel = 'Interactive pathology slide. Drag to pan, scroll or pinch to zoom.',
    },
    ref,
  ) {
    const viewerElementRef = useRef<HTMLDivElement | null>(null)
    const viewerRef = useRef<OpenSeadragonType.Viewer | null>(null)
    const tiledImageRef = useRef<OpenSeadragonType.TiledImage | null>(null)
    const initialZoomRef = useRef(1)
    const synchronizingRef = useRef(false)
    const resizeFrameRef = useRef<number | null>(null)
    const canonicalViewRef = useRef<ViewportSnapshot | null>(null)
    const callbacksRef = useRef({
      onImageHover,
      onImageSelect,
      onViewportChange,
      onStatusChange,
      onDrawRectangle,
      onMoveAnnotation,
      onResizeAnnotation,
    })
    const interactionModeRef = useRef(interactionMode)
    const imagePointFromPointerRef = useRef<
      ((event: { clientX: number; clientY: number }) => ImagePoint | null) | null
    >(null)
    const drawStartRef = useRef<ImagePoint | null>(null)
    const moveStartRef = useRef<{
      id: string
      point: ImagePoint
      bounds: ImageRect
      pointerId: number
      handle?: ResizeHandle
    } | null>(null)
    const annotationsRef = useRef(annotations)
    const activeAnnotationRef = useRef<DemoAnnotation | null>(null)
    const selectedAnnotation = annotations.find(
      (annotation) => annotation.id === selectedAnnotationId,
    )
    const selectedAnnotationRef = useRef(selectedAnnotation)
    const [attempt, setAttempt] = useState(0)
    const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null)
    const [status, setStatus] = useState<DeepZoomViewerStatus>({ phase: 'loading' })
    const [tileWarning, setTileWarning] = useState(false)
    const [labelPosition, setLabelPosition] = useState<LabelPosition | null>(null)
    const [draftRectangle, setDraftRectangle] = useState<ImageRect | null>(null)
    const [handlePositions, setHandlePositions] = useState<LabelPosition[]>([])

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
        onDrawRectangle,
        onMoveAnnotation,
        onResizeAnnotation,
      }
      annotationsRef.current = annotations
      selectedAnnotationRef.current = selectedAnnotation
    }, [
      annotations,
      onDrawRectangle,
      onMoveAnnotation,
      onResizeAnnotation,
      onImageHover,
      onImageSelect,
      onStatusChange,
      onViewportChange,
      selectedAnnotation,
    ])

    useEffect(() => {
      interactionModeRef.current = interactionMode
      drawStartRef.current = null
      const pointerId = moveStartRef.current?.pointerId
      if (pointerId !== undefined && viewerRef.current?.canvas.hasPointerCapture?.(pointerId))
        viewerRef.current.canvas.releasePointerCapture(pointerId)
      moveStartRef.current = null
      setDraftRectangle(null)
      viewerRef.current?.setMouseNavEnabled(interactionMode === 'navigate')
    }, [interactionMode])

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

      const selected = selectedAnnotationRef.current
      setHandlePositions(
        viewer && tiledImage && selected
          ? resizeHandles.map((handle) => {
              const bounds = polygonBounds(selected.polygon)
              return viewer.viewport.viewportToViewerElementCoordinates(
                tiledImage.imageToViewportCoordinates(
                  bounds.x + bounds.width * handle.x,
                  bounds.y + bounds.height * handle.y,
                  true,
                ),
              )
            })
          : [],
      )

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
      if (!viewer || !tiledImage || synchronizingRef.current || resizeFrameRef.current !== null)
        return

      const visibleBounds = tiledImage.viewportToImageRectangle(
        viewer.viewport.getBounds(true),
        true,
      )
      const currentZoom = viewer.viewport.getZoom(true)
      const zoomRatio = initialZoomRef.current > 0 ? currentZoom / initialZoomRef.current : 1

      const snapshot = {
        zoomRatio,
        visibleImageBounds: imageRectFromOpenSeadragonRect(visibleBounds),
      }
      const previous = canonicalViewRef.current
      const bounds = snapshot.visibleImageBounds
      const oldBounds = previous?.visibleImageBounds
      // Resizing adds aspect-ratio padding, not a new area of interest. Retain the
      // canonical crop until an actual pan/zoom changes the focus or zoom ratio.
      if (
        !previous ||
        !oldBounds ||
        Math.abs(previous.zoomRatio - zoomRatio) > 0.0001 ||
        Math.abs(oldBounds.x + oldBounds.width / 2 - bounds.x - bounds.width / 2) > 0.05 ||
        Math.abs(oldBounds.y + oldBounds.height / 2 - bounds.y - bounds.height / 2) > 0.05
      ) {
        canonicalViewRef.current = snapshot
      }
      callbacksRef.current.onViewportChange(snapshot)
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
        synchronizeViewport: (snapshot) => {
          const viewer = viewerRef.current
          const tiledImage = tiledImageRef.current
          if (!viewer || !tiledImage) return
          canonicalViewRef.current = snapshot
          const rect = snapshot.visibleImageBounds
          synchronizingRef.current = true
          try {
            viewer.viewport.fitBounds(
              tiledImage.imageToViewportRectangle(rect.x, rect.y, rect.width, rect.height, true),
              true,
            )
            // Keep zoom-triggered teaching regions consistent in either pane and after resizing.
            initialZoomRef.current = viewer.viewport.getZoom(true) / snapshot.zoomRatio
            updateLabelPosition()
          } finally {
            synchronizingRef.current = false
          }
        },
      }),
      [emitViewportSnapshot, fitImageRect, retry, slide.initialImageRect, updateLabelPosition],
    )

    useEffect(() => {
      updateLabelPosition()
    }, [activeAnnotation, selectedAnnotation, updateLabelPosition])

    const resizedBounds = useCallback(
      (id: string, bounds: ImageRect, handle: ResizeHandle, delta: ImagePoint) => {
        const resized = resizeAnnotation(
          annotationsRef.current,
          id,
          resizeBoundsFromHandle(bounds, handle, delta),
          { x: 0, y: 0, ...slide.expectedDimensions },
        ).find((annotation) => annotation.id === id)
        return resized ? polygonBounds(resized.polygon) : bounds
      },
      [slide.expectedDimensions],
    )

    useEffect(() => {
      const viewerElement = viewerElementRef.current
      if (!viewerElement) return
      const mountElement: HTMLDivElement = viewerElement

      let disposed = false
      let viewer: OpenSeadragonType.Viewer | null = null
      let pointerMoveHandler: ((event: PointerEvent) => void) | null = null
      let pointerLeaveHandler: (() => void) | null = null
      let pointerDownHandler: ((event: PointerEvent) => void) | null = null
      let pointerUpHandler: ((event: PointerEvent) => void) | null = null
      let pointerCancelHandler: ((event: PointerEvent) => void) | null = null

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
            tileSources: socratesTileSourceUrl(slide.descriptorUrl),
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
            // Keep paired tile loading from starving survey/progress requests.
            imageLoaderLimit: 2,
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
          viewer.setMouseNavEnabled(interactionModeRef.current === 'navigate')

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
            if (interactionModeRef.current !== 'navigate') return
            if (!event.quick || !tiledImageRef.current) return
            const point = tiledImageRef.current.viewerElementToImageCoordinates(event.position)
            callbacksRef.current.onImageSelect({ x: point.x, y: point.y })
          })

          viewer.addHandler('viewport-change', emitViewportSnapshot)
          viewer.addHandler('animation', emitViewportSnapshot)
          viewer.addHandler('animation-finish', emitViewportSnapshot)
          viewer.addHandler('resize', () => {
            // OpenSeadragon 6 adjusts zoom after its resize/after-resize events.
            // Restore the source-pixel crop on the next frame and suppress those
            // transient events so they cannot desynchronize the paired viewer.
            const snapshot = canonicalViewRef.current
            if (!snapshot) return
            if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current)
            resizeFrameRef.current = requestAnimationFrame(() => {
              resizeFrameRef.current = null
              if (disposed || !viewer || !tiledImageRef.current) return
              const rect = snapshot.visibleImageBounds
              synchronizingRef.current = true
              viewer.viewport.fitBounds(
                tiledImageRef.current.imageToViewportRectangle(
                  rect.x,
                  rect.y,
                  rect.width,
                  rect.height,
                  true,
                ),
                true,
              )
              initialZoomRef.current = viewer.viewport.getZoom(true) / snapshot.zoomRatio
              synchronizingRef.current = false
              emitViewportSnapshot()
            })
          })

          const imagePointFromPointer = (event: { clientX: number; clientY: number }) => {
            const activeTiledImage = tiledImageRef.current
            if (!activeTiledImage || !viewer) return null

            const viewerBounds = viewer.element.getBoundingClientRect()
            return activeTiledImage.viewerElementToImageCoordinates(
              new OpenSeadragon.Point(
                event.clientX - viewerBounds.left,
                event.clientY - viewerBounds.top,
              ),
            )
          }
          imagePointFromPointerRef.current = imagePointFromPointer

          pointerMoveHandler = (event: PointerEvent) => {
            const point = imagePointFromPointer(event)
            if (!point) return

            const moveStart = moveStartRef.current
            if (
              interactionModeRef.current === 'move-rectangle' &&
              moveStart &&
              event.pointerId === moveStart.pointerId
            ) {
              event.preventDefault()
              const delta = { x: point.x - moveStart.point.x, y: point.y - moveStart.point.y }
              setDraftRectangle(
                moveStart.handle
                  ? resizedBounds(moveStart.id, moveStart.bounds, moveStart.handle, delta)
                  : {
                      ...moveStart.bounds,
                      x: moveStart.bounds.x + delta.x,
                      y: moveStart.bounds.y + delta.y,
                    },
              )
              return
            }

            const drawStart = drawStartRef.current
            if (interactionModeRef.current === 'draw-rectangle' && drawStart) {
              event.preventDefault()
              setDraftRectangle({
                x: Math.min(drawStart.x, point.x),
                y: Math.min(drawStart.y, point.y),
                width: Math.abs(point.x - drawStart.x),
                height: Math.abs(point.y - drawStart.y),
              })
              return
            }

            callbacksRef.current.onImageHover({ x: point.x, y: point.y })
          }
          pointerLeaveHandler = () => {
            if (!drawStartRef.current && !moveStartRef.current)
              callbacksRef.current.onImageHover(null)
          }
          pointerDownHandler = (event: PointerEvent) => {
            if (event.button !== 0 || moveStartRef.current || drawStartRef.current) return
            if (interactionModeRef.current === 'move-rectangle') {
              const point = imagePointFromPointer(event)
              if (!point) return
              const region = findDeepestAnnotationAtPoint(
                annotationsRef.current,
                new Set(annotationsRef.current.map((a) => a.id)),
                point,
              )
              callbacksRef.current.onImageSelect(point)
              if (!region) return
              event.preventDefault()
              callbacksRef.current.onImageHover(null)
              moveStartRef.current = {
                id: region.id,
                point,
                bounds: polygonBounds(region.polygon),
                pointerId: event.pointerId,
              }
              viewer?.canvas.setPointerCapture?.(event.pointerId)
              return
            }
            if (interactionModeRef.current !== 'draw-rectangle') return
            const point = imagePointFromPointer(event)
            if (!point) return
            event.preventDefault()
            callbacksRef.current.onImageHover(null)
            drawStartRef.current = { x: point.x, y: point.y }
            setDraftRectangle(null)
            viewer?.canvas.setPointerCapture?.(event.pointerId)
          }
          pointerUpHandler = (event: PointerEvent) => {
            const moveStart = moveStartRef.current
            if (
              interactionModeRef.current === 'move-rectangle' &&
              moveStart &&
              event.pointerId === moveStart.pointerId
            ) {
              const point = imagePointFromPointer(event)
              event.preventDefault()
              moveStartRef.current = null
              setDraftRectangle(null)
              viewer?.canvas.releasePointerCapture?.(event.pointerId)
              if (point && (point.x !== moveStart.point.x || point.y !== moveStart.point.y)) {
                const delta = { x: point.x - moveStart.point.x, y: point.y - moveStart.point.y }
                if (moveStart.handle)
                  callbacksRef.current.onResizeAnnotation?.(
                    moveStart.id,
                    resizedBounds(moveStart.id, moveStart.bounds, moveStart.handle, delta),
                  )
                else callbacksRef.current.onMoveAnnotation?.(moveStart.id, delta)
              }
              return
            }
            const drawStart = drawStartRef.current
            if (interactionModeRef.current !== 'draw-rectangle' || !drawStart) return
            const point = imagePointFromPointer(event)
            event.preventDefault()
            drawStartRef.current = null
            viewer?.canvas.releasePointerCapture?.(event.pointerId)
            if (!point) {
              setDraftRectangle(null)
              return
            }

            const rectangle = {
              x: Math.min(drawStart.x, point.x),
              y: Math.min(drawStart.y, point.y),
              width: Math.abs(point.x - drawStart.x),
              height: Math.abs(point.y - drawStart.y),
            }
            setDraftRectangle(null)
            if (rectangle.width >= 2 && rectangle.height >= 2) {
              callbacksRef.current.onDrawRectangle?.(rectangle)
            }
          }
          pointerCancelHandler = (event: PointerEvent) => {
            if (!drawStartRef.current && !moveStartRef.current) return
            if (moveStartRef.current && event.pointerId !== moveStartRef.current.pointerId) return
            drawStartRef.current = null
            moveStartRef.current = null
            setDraftRectangle(null)
            viewer?.canvas.releasePointerCapture?.(event.pointerId)
          }
          viewer.canvas.addEventListener('pointermove', pointerMoveHandler, { passive: false })
          viewer.canvas.addEventListener('pointerleave', pointerLeaveHandler)
          viewer.canvas.addEventListener('pointerdown', pointerDownHandler)
          viewer.canvas.addEventListener('pointerup', pointerUpHandler)
          viewer.canvas.addEventListener('pointercancel', pointerCancelHandler)
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
        if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
        canonicalViewRef.current = null
        if (viewer && pointerMoveHandler) {
          viewer.canvas.removeEventListener('pointermove', pointerMoveHandler)
        }
        if (viewer && pointerLeaveHandler) {
          viewer.canvas.removeEventListener('pointerleave', pointerLeaveHandler)
        }
        if (viewer && pointerDownHandler) {
          viewer.canvas.removeEventListener('pointerdown', pointerDownHandler)
        }
        if (viewer && pointerUpHandler) {
          viewer.canvas.removeEventListener('pointerup', pointerUpHandler)
        }
        if (viewer && pointerCancelHandler) {
          viewer.canvas.removeEventListener('pointercancel', pointerCancelHandler)
        }
        callbacksRef.current.onImageHover(null)
        drawStartRef.current = null
        moveStartRef.current = null
        imagePointFromPointerRef.current = null
        tiledImageRef.current = null
        viewerRef.current = null
        viewer?.destroy()
      }
    }, [
      attempt,
      emitViewportSnapshot,
      fitImageRect,
      publishStatus,
      resizedBounds,
      slide.descriptorUrl,
      slide.expectedDimensions.height,
      slide.expectedDimensions.width,
      slide.initialImageRect,
    ])

    return (
      <div
        className={styles.viewerSurface}
        data-testid="deep-zoom-viewer"
        data-status={status.phase}
        aria-busy={status.phase === 'loading'}
      >
        <div
          ref={viewerElementRef}
          className={`${styles.viewerCanvas} ${
            interactionMode === 'draw-rectangle'
              ? styles.viewerCanvasDrawing
              : interactionMode === 'move-rectangle'
                ? styles.viewerCanvasMoving
                : ''
          }`}
          aria-label={ariaLabel}
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
                {draftRectangle ? (
                  <polygon
                    points={rectangleToPolygon(draftRectangle)
                      .map((point) => `${point.x},${point.y}`)
                      .join(' ')}
                    className={`${styles.annotationPolygon} ${styles.annotationDraft}`}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>,
              overlayElement,
            )
          : null}

        {interactionMode === 'move-rectangle' &&
          onResizeAnnotation &&
          selectedAnnotation &&
          !draftRectangle &&
          status.phase === 'ready' &&
          resizeHandles.map((handle, index) => {
            const position = handlePositions[index]
            if (!position) return null
            return (
              <button
                key={handle.id}
                type="button"
                className={styles.resizeHandle}
                data-handle={handle.id}
                style={{ left: position.x, top: position.y, cursor: `${handle.id}-resize` }}
                aria-label={`Resize ${selectedAnnotation.label}: ${handle.label}`}
                title="Drag to resize. Arrow keys resize by 10 pixels; Shift by 1 pixel."
                onPointerDown={(event) => {
                  const viewer = viewerRef.current
                  const point = imagePointFromPointerRef.current?.(event)
                  if (event.button !== 0 || !viewer || !point || moveStartRef.current) return
                  event.preventDefault()
                  event.stopPropagation()
                  event.currentTarget.focus({ preventScroll: true })
                  callbacksRef.current.onImageHover(null)
                  moveStartRef.current = {
                    id: selectedAnnotation.id,
                    point,
                    bounds: polygonBounds(selectedAnnotation.polygon),
                    pointerId: event.pointerId,
                    handle: handle.id,
                  }
                  viewer.canvas.setPointerCapture?.(event.pointerId)
                }}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
                    return
                  event.preventDefault()
                  const distance = event.shiftKey ? 1 : 10
                  const delta = {
                    x:
                      event.key === 'ArrowLeft'
                        ? -distance
                        : event.key === 'ArrowRight'
                          ? distance
                          : 0,
                    y:
                      event.key === 'ArrowUp'
                        ? -distance
                        : event.key === 'ArrowDown'
                          ? distance
                          : 0,
                  }
                  callbacksRef.current.onResizeAnnotation?.(
                    selectedAnnotation.id,
                    resizedBounds(
                      selectedAnnotation.id,
                      polygonBounds(selectedAnnotation.polygon),
                      handle.id,
                      delta,
                    ),
                  )
                }}
              />
            )
          })}

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
