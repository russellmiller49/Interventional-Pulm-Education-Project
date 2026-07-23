'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import type { Route } from 'next'

import { Link } from '@/i18n/navigation'

import styles from './learning-module-v2.module.css'

export interface SimulationLaunchGateProps {
  readonly activityTitle: string
  readonly minimumViewport: 'tablet' | 'desktop'
  readonly bandwidthClass: 'standard' | 'heavy'
  readonly estimatedSizeLabel: string
  readonly lightweightAlternativeHref?: string
  readonly onSaveForLater?: () => void
  readonly children: ReactNode
  readonly forceGate?: boolean
  readonly forceLowBandwidth?: boolean
  readonly theme?: 'light' | 'dark'
}

interface NetworkInformationLike {
  readonly effectiveType?: string
  readonly saveData?: boolean
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

function currentConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection
}

export function isLowBandwidthConnection(connection: NetworkInformationLike | undefined): boolean {
  return (
    connection?.saveData === true ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  )
}

function isViewportConstrained(minimumViewport: 'tablet' | 'desktop'): boolean {
  if (typeof window === 'undefined') return false
  const minimumWidth = minimumViewport === 'desktop' ? 1024 : 768
  return window.innerWidth < minimumWidth || window.innerHeight < 700
}

export function SimulationLaunchGate({
  activityTitle,
  minimumViewport,
  bandwidthClass,
  estimatedSizeLabel,
  lightweightAlternativeHref,
  onSaveForLater,
  children,
  forceGate,
  forceLowBandwidth,
  theme = 'light',
}: SimulationLaunchGateProps) {
  const [constrained, setConstrained] = useState(forceGate ?? false)
  const [lowBandwidth, setLowBandwidth] = useState(forceLowBandwidth ?? false)
  const [suitabilityChecked, setSuitabilityChecked] = useState(
    forceGate !== undefined || forceLowBandwidth !== undefined,
  )
  const [continued, setContinued] = useState(false)
  const headingId = useId()

  useEffect(() => {
    if (forceGate !== undefined || forceLowBandwidth !== undefined) return
    const connection = currentConnection()
    const update = () => {
      const nextConstrained = isViewportConstrained(minimumViewport)
      const nextLowBandwidth =
        bandwidthClass === 'heavy' && isLowBandwidthConnection(currentConnection())
      setConstrained(nextConstrained)
      setLowBandwidth(nextLowBandwidth)
      setSuitabilityChecked(true)
      if (!nextConstrained && !nextLowBandwidth) setContinued(true)
    }
    const timer = window.setTimeout(update, 0)
    window.addEventListener('resize', update)
    connection?.addEventListener?.('change', update)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', update)
      connection?.removeEventListener?.('change', update)
    }
  }, [bandwidthClass, forceGate, forceLowBandwidth, minimumViewport])

  const gateActive = (forceGate ?? constrained) || (forceLowBandwidth ?? lowBandwidth)

  if (!suitabilityChecked) {
    return (
      <section
        className={styles.launchGate}
        data-learning-module-v2-theme-root
        data-theme={theme}
        aria-labelledby={headingId}
      >
        <div className={styles.launchGateCard} role="status" aria-live="polite">
          <span className={styles.eyebrow}>Device suitability check</span>
          <h2 id={headingId}>Checking this display</h2>
          <p>
            Confirming that {activityTitle} can keep its controls and simulation surfaces usable.
          </p>
        </div>
      </section>
    )
  }

  if (!gateActive || continued) return children

  const gateReason =
    constrained && lowBandwidth ? 'viewport-and-bandwidth' : lowBandwidth ? 'bandwidth' : 'viewport'
  const heading =
    gateReason === 'viewport-and-bandwidth'
      ? 'A larger screen or lightweight version is recommended'
      : gateReason === 'bandwidth'
        ? 'A lightweight version is recommended'
        : 'A larger screen is recommended'

  return (
    <section
      className={styles.launchGate}
      data-learning-module-v2-theme-root
      data-theme={theme}
      data-gate-reason={gateReason}
      aria-labelledby={headingId}
    >
      <div className={styles.launchGateCard}>
        <span className={styles.eyebrow}>Device suitability check</span>
        <h2 id={headingId}>{heading}</h2>
        <p>
          {activityTitle} remains available, but its simultaneous controls and visual surfaces work
          best on a {minimumViewport} display
          {lowBandwidth ? ' with a standard connection' : ''}. Continuing does not change simulation
          behavior.
        </p>
        <dl className={styles.launchFacts}>
          <div className={styles.launchFact}>
            <dt>Recommended screen</dt>
            <dd>{minimumViewport}</dd>
          </div>
          <div className={styles.launchFact}>
            <dt>Asset class</dt>
            <dd>{bandwidthClass}</dd>
          </div>
          <div className={styles.launchFact}>
            <dt>Estimated download</dt>
            <dd>{estimatedSizeLabel}</dd>
          </div>
        </dl>
        <div className={styles.launchActions}>
          <button type="button" className={styles.primaryButton} onClick={() => setContinued(true)}>
            Continue on this device
          </button>
          {lightweightAlternativeHref ? (
            <Link href={lightweightAlternativeHref as Route} className={styles.secondaryButton}>
              Open lightweight alternative
            </Link>
          ) : null}
          {onSaveForLater ? (
            <button type="button" className={styles.secondaryButton} onClick={onSaveForLater}>
              Save for later
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
