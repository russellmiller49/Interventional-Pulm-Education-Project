'use client'

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { getInvenioPair } from '@/features/socrates-builder/invenio-source'
import type { DeepZoomViewerHandle, DeepZoomViewerStatus, ViewportSnapshot } from '../types'
import { DeepZoomViewer, type DeepZoomViewerProps } from './DeepZoomViewer'
import styles from './comparison-slide-viewer.module.css'

type Pane = 'tissue' | 'annotated'
type Mode = 'side-by-side' | Pane
const modes: { id: Mode; label: string }[] = [
  { id: 'side-by-side', label: 'Side by side' },
  { id: 'tissue', label: 'Tissue only' },
  { id: 'annotated', label: 'Color annotated' },
]

function sameView(first: ViewportSnapshot, second: ViewportSnapshot) {
  return (
    Math.abs(first.zoomRatio - second.zoomRatio) < 0.0001 &&
    (['x', 'y', 'width', 'height'] as const).every(
      (key) => Math.abs(first.visibleImageBounds[key] - second.visibleImageBounds[key]) < 0.05,
    )
  )
}

function sameFocus(first: ViewportSnapshot, second: ViewportSnapshot) {
  const a = first.visibleImageBounds
  const b = second.visibleImageBounds
  return (
    Math.abs(first.zoomRatio - second.zoomRatio) < 0.0001 &&
    Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 0.05 &&
    Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 0.05
  )
}

const PairedViewer = forwardRef<DeepZoomViewerHandle, DeepZoomViewerProps>(
  function PairedViewer(props, ref) {
    const { onViewportChange, onStatusChange } = props
    const pair = getInvenioPair(props.slide.descriptorUrl)!
    const [mode, setMode] = useState<Mode>('side-by-side')
    const handles = useRef<Partial<Record<Pane, DeepZoomViewerHandle | null>>>({})
    const statuses = useRef<Record<Pane, DeepZoomViewerStatus>>({
      tissue: { phase: 'loading' },
      annotated: { phase: 'loading' },
    })
    const lastView = useRef<ViewportSnapshot>({
      zoomRatio: 1,
      visibleImageBounds: props.slide.initialImageRect,
    })
    const panes: Pane[] = mode === 'side-by-side' ? ['tissue', 'annotated'] : [mode]
    const sources = useMemo(
      () => ({
        tissue: { ...props.slide, descriptorUrl: pair.tissueUrl },
        annotated: { ...props.slide, descriptorUrl: pair.annotatedUrl },
      }),
      [props.slide, pair.tissueUrl, pair.annotatedUrl],
    )

    useImperativeHandle(ref, () => {
      const leader = () =>
        panes
          .filter((pane) => statuses.current[pane].phase === 'ready')
          .map((pane) => handles.current[pane])
          .find(Boolean)
      return {
        fitImageRect: (rect) => leader()?.fitImageRect(rect),
        zoomBy: (factor) => leader()?.zoomBy(factor),
        resetToInitialView: () => leader()?.resetToInitialView(),
        retry: () => panes.forEach((pane) => handles.current[pane]?.retry()),
        synchronizeViewport: (snapshot) => {
          lastView.current = snapshot
          panes.forEach((pane) => handles.current[pane]?.synchronizeViewport?.(snapshot))
        },
      }
    })

    const onViewport = useCallback(
      (pane: Pane, snapshot: ViewportSnapshot) => {
        if (statuses.current[pane].phase !== 'ready' || sameView(lastView.current, snapshot)) return
        // Fitting the same area into a wider/narrower pane adds padding. Keep the
        // canonical area so repeated mode switches do not progressively zoom out.
        if (sameFocus(lastView.current, snapshot)) {
          onViewportChange(snapshot)
          return
        }
        lastView.current = snapshot
        const other = pane === 'tissue' ? 'annotated' : 'tissue'
        handles.current[other]?.synchronizeViewport?.(snapshot)
        onViewportChange(snapshot)
      },
      [onViewportChange],
    )

    const onStatus = useCallback(
      (pane: Pane, status: DeepZoomViewerStatus) => {
        statuses.current[pane] = status
        if (status.phase === 'ready') {
          handles.current[pane]?.synchronizeViewport?.(lastView.current)
          onViewportChange(lastView.current)
        }
        const visibleStatuses = (
          mode === 'side-by-side' ? (['tissue', 'annotated'] as const) : [mode]
        ).map((visiblePane) => statuses.current[visiblePane])
        onStatusChange?.(
          visibleStatuses.find((candidate) => candidate.phase === 'ready') ??
            visibleStatuses.find((candidate) => candidate.phase === 'loading') ??
            status,
        )
      },
      [mode, onStatusChange, onViewportChange],
    )

    return (
      <div className={styles.comparison} data-testid="comparison-slide-viewer">
        <div className={styles.toolbar}>
          <div role="group" aria-label="Image comparison mode" className={styles.modes}>
            {modes.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={mode === option.id}
                onClick={() => setMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span>{mode === 'side-by-side' ? 'Pan and zoom linked' : 'Same teaching regions'}</span>
        </div>
        <div className={styles.panes} data-paired={mode === 'side-by-side'}>
          {panes.map((pane) => (
            <section
              key={`${mode}:${pane}`}
              className={styles.pane}
              aria-label={pane === 'tissue' ? 'Tissue image' : 'Invenio color annotation image'}
            >
              <div className={styles.paneLabel}>
                {pane === 'tissue' ? 'Tissue' : 'Invenio color annotations'}
              </div>
              <DeepZoomViewer
                {...props}
                ref={(handle) => {
                  handles.current[pane] = handle
                }}
                slide={sources[pane]}
                ariaLabel={`${pane === 'tissue' ? 'Tissue' : 'Color annotated'} pathology slide. Drag to pan, scroll or pinch to zoom.`}
                onViewportChange={(snapshot) => onViewport(pane, snapshot)}
                onStatusChange={(status) => onStatus(pane, status)}
              />
            </section>
          ))}
        </div>
      </div>
    )
  },
)

export const ComparisonSlideViewer = forwardRef<DeepZoomViewerHandle, DeepZoomViewerProps>(
  function ComparisonSlideViewer(props, ref) {
    return getInvenioPair(props.slide.descriptorUrl) ? (
      <PairedViewer
        key={`${props.slide.descriptorUrl}:${JSON.stringify(props.slide.initialImageRect)}`}
        {...props}
        ref={ref}
      />
    ) : (
      <DeepZoomViewer {...props} ref={ref} />
    )
  },
)
