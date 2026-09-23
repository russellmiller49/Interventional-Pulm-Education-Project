'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { CtMark, CtTrace, CtViewerState } from '../content/ct-types'
import type { Vec3 } from '../geometry/coordinates'
import { nativeImageUrl } from '../geometry/native-ct'
import { parentCameraCaption } from '../geometry/reference-frames'
import {
  orientedPixel,
  orientationLabels,
  orientationName,
  orientationTransform,
  STANDARD_ORIENTATION,
  type CtOrientation,
} from '../geometry/orientation'
import styles from './branch-tracing.module.css'

const ClinicalAirwayView = dynamic(
  () => import('./ClinicalAirwayView').then((m) => m.ClinicalAirwayView),
  {
    ssr: false,
    loading: () => <p role="status">Loading virtual bronchoscopy…</p>,
  },
)

/** The modelled parent camera at the anchor plane; a fixed reference beside the two CT copies. */
export interface ComparisonScope {
  position: Vec3
  direction: Vec3
  up: Vec3
  atJunction: boolean
  airwayCode: string
}

/** An explanatory observer reference. It never changes the live camera or patient. */
export function ObserverReference() {
  return (
    <figure className={styles.observerReference}>
      <div className={styles.observerDirections}>
        <p>
          Parent observer
          <br />
          <strong>↓</strong>
          <br />
          Toward carina
          <br />
          Caudal
        </p>
        <svg
          viewBox="0 0 100 115"
          role="img"
          aria-label="Patient fixed, head above feet; straight central airway divides at the carina."
        >
          <g fill="none" stroke="#9db5c0" strokeWidth="3">
            <circle cx="50" cy="20" r="15" />
            <path d="M20 105 V52 Q50 35 80 52 V105 M50 50 V78 M50 78 L30 95 M50 78 L70 95" />
          </g>
        </svg>
        <p>
          CT observer
          <br />
          <strong>↑</strong>
          <br />
          Toward head
          <br />
          Cranial
        </p>
      </div>
      <figcaption>
        Patient fixed · straight central-airway reference. Anterior held at the top of both
        cross-sectional displays.
      </figcaption>
    </figure>
  )
}

/** Both copies share one source plane, window, native crop and landmark. Only display orientation varies. */
export function CtViewpointComparison({
  trace,
  view,
  marks,
  orientation,
  onReadyChange,
  scope,
}: {
  trace: CtTrace
  view: CtViewerState
  marks: (CtMark | null)[]
  orientation: CtOrientation
  onReadyChange: (ready: boolean) => void
  /** When supplied, the fixed parent airway view is shown beside the two CT copies. */
  scope?: ComparisonScope
}) {
  const [loaded, setLoaded] = useState<boolean[]>([false, false])
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [showScope, setShowScope] = useState(true)
  const scopeShown = Boolean(scope) && showScope
  const center = view.full ? [255.5, 255.5] : trace.anchor.pixel
  const size = (view.full ? 512 : 110) / view.magnification
  const url = nativeImageUrl(view.slice)
  useEffect(() => onReadyChange(loaded.every(Boolean) && !failed), [loaded, failed, onReadyChange])
  return (
    <section
      className={styles.viewpointComparison}
      aria-label="Same-slice viewpoint comparison"
      data-comparison-slice={view.slice}
      data-comparison-ready={loaded.every(Boolean) && !failed}
    >
      <div className={`${styles.comparisonImages} ${scopeShown ? styles.comparisonWithScope : ''}`}>
        {[STANDARD_ORIENTATION, orientation].map((display, i) => {
          const labels = orientationLabels(display)
          return (
            <figure key={i}>
              <figcaption>
                <strong>{i === 0 ? 'Standard axial reference' : 'Comparison display'}</strong>
                <br />
                {orientationName(display)}
              </figcaption>
              <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label={`${i === 0 ? 'Standard reference' : 'Comparison'}: same CT slice ${view.slice}, ${orientationName(display)}`}
                data-comparison-copy={i}
              >
                <rect width="100" height="100" fill="#020507" />
                <g
                  transform={`translate(50 50) ${orientationTransform(display)} scale(${100 / size}) translate(${-center[0]} ${-center[1]})`}
                >
                  <image
                    key={`${url}-${retry}`}
                    href={url}
                    x={-0.5}
                    y={-0.5}
                    width="512"
                    height="512"
                    onLoad={() => setLoaded((v) => v.map((value, n) => n === i || value))}
                    onError={() => setFailed(true)}
                  />
                </g>
                {loaded[i] &&
                  [{ pixel: trace.anchor.pixel, slice: trace.anchor.slice }, ...marks].map(
                    (mark, n) => {
                      if (!mark?.pixel || mark.slice !== view.slice) return null
                      const point = orientedPixel(mark.pixel, center, size, display)
                      return (
                        <circle
                          key={n}
                          cx={point[0]}
                          cy={point[1]}
                          r={n === 0 ? 2 : 2.8}
                          fill="none"
                          stroke={n === 0 ? '#f6c66c' : '#81f1ed'}
                          strokeWidth=".6"
                          data-comparison-landmark={n}
                        />
                      )
                    },
                  )}
                {[
                  { text: labels.top, x: 50, y: 7 },
                  { text: labels.right, x: 95, y: 52 },
                  { text: labels.bottom, x: 50, y: 97 },
                  { text: labels.left, x: 5, y: 52 },
                ].map((label) => (
                  <text
                    key={label.text}
                    x={label.x}
                    y={label.y}
                    fill="white"
                    stroke="#020507"
                    strokeWidth="1"
                    paintOrder="stroke"
                    textAnchor="middle"
                    fontSize="5"
                  >
                    {label.text}
                  </text>
                ))}
              </svg>
            </figure>
          )
        })}
        {scope && scopeShown && (
          <figure data-comparison-scope>
            <figcaption>
              <strong>Parent airway view</strong>
              <br />
              Fixed model camera · does not change with the CT display
            </figcaption>
            <div className={styles.comparisonScope}>
              <ClinicalAirwayView
                paired
                position={scope.position}
                direction={scope.direction}
                referenceUp={scope.up}
                roll={0}
                slice={view.slice}
              />
            </div>
          </figure>
        )}
      </div>
      {scope && (
        <p className={styles.walkthroughControls}>
          <button aria-pressed={scopeShown} onClick={() => setShowScope((value) => !value)}>
            {scopeShown ? 'Hide parent airway view' : 'Show parent airway view'}
          </button>
        </p>
      )}
      {failed ? (
        <p role="alert">
          The comparison CT could not load.{' '}
          <button
            onClick={() => {
              setFailed(false)
              setLoaded([false, false])
              setRetry((v) => v + 1)
            }}
          >
            Retry comparison
          </button>
        </p>
      ) : (
        !loaded.every(Boolean) && <p role="status">Loading both CT copies…</p>
      )}
      <p>
        Same native slice {view.slice}, crop, magnification and lung window. Gold ring: the same
        model landmark. The comparison changes only the CT display; the patient and virtual camera
        stay fixed.
      </p>
      {scope && (
        <p data-comparison-scope-caption>
          {parentCameraCaption(scope, scope.airwayCode)} It is a CT-derived model surface, not
          recorded bronchoscopy, and it renders the same whichever CT display you choose.
        </p>
      )}
    </section>
  )
}
