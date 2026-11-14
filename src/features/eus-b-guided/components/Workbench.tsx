'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMPTY_EUSB_OBSERVATION,
  isEusbMessage,
  sameEusbContract,
  type EusbHeld,
  type EusbObservation,
  type EusbWorkbenchConfig,
} from '@/lib/eus-b-guided-bridge'
import type { EusbLabId, EusbPane } from '@/lib/eus-b-guided-contract'
import { buildEmbeddedAppSrc, socalEusBGuidedAppPath } from '@/lib/embedded-app-locale'
import styles from './eus-b-guided.module.css'

/** What the lesson wants the lab to show right now. */
export interface StageRequest {
  labId: EusbLabId
  phase: 'work' | 'review'
  names: 'hidden' | 'shown'
  panes: EusbPane[]
  held?: EusbHeld[]
  /** Changes whenever the request means something new, so an answer to an older one is dropped. */
  request: number
}

/**
 * The lab frame and its messages.
 *
 * One frame lives for the whole lesson and is told what to show; it is never remounted between
 * tasks, because each start of the lab loads the case again. An observation reaches the lesson only
 * when it comes from this frame, for this session, for the request now in force and for the lab now
 * asked for.
 */
export function Workbench({
  stage,
  sessionId,
  locale = 'en',
  fill,
  onObservation,
}: {
  stage: StageRequest
  sessionId: string
  locale?: string
  /** Fill a fixed-height stage instead of growing with the lab's content. */
  fill: boolean
  onObservation: (observation: EusbObservation) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const callback = useRef(onObservation)
  useEffect(() => {
    callback.current = onObservation
  }, [onObservation])
  const [height, setHeight] = useState(640)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [ready, setReady] = useState(false)
  const [generation, setGeneration] = useState('initial')
  const [large, setLarge] = useState<boolean | null>(null)
  const src = useMemo(
    () =>
      buildEmbeddedAppSrc(socalEusBGuidedAppPath, locale, {
        publicTraining: '1',
        publicScope: 'ebus',
      }),
    [locale],
  )
  const config = useMemo<EusbWorkbenchConfig>(
    () => ({
      sessionId: sessionId + '-' + generation,
      labId: stage.labId,
      phase: stage.phase,
      names: stage.names,
      panes: stage.panes,
      held: stage.held,
      observationRequest: stage.request,
    }),
    [sessionId, generation, stage],
  )
  const latest = useRef(config)
  useEffect(() => {
    latest.current = config
  }, [config])

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const assess = () => {
      setLarge(query.matches)
      if (!query.matches) callback.current(EMPTY_EUSB_OBSERVATION)
    }
    assess()
    query.addEventListener('change', assess)
    return () => query.removeEventListener('change', assess)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setError('The lab is taking longer than expected. Retry if it does not load.'),
      45000,
    )
    const listener = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow ||
        !isEusbMessage(event.data)
      )
        return
      const message = event.data
      if (message.type === 'ready') {
        if (!sameEusbContract(message.contractRevision)) {
          setError(
            'This page and its lab are from different versions of the course. Reload the page.',
          )
          return
        }
        // Every start of the frame begins a new session: nothing from before it counts.
        const next = Math.random().toString(36).slice(2)
        latest.current = { ...latest.current, sessionId: sessionId + '-' + next }
        callback.current(EMPTY_EUSB_OBSERVATION)
        setGeneration(next)
        setReady(true)
        setError('')
        // The frame answered. While its stage is not on screen it may draw nothing yet.
        window.clearTimeout(timeout)
        frame.current?.contentWindow?.postMessage(
          { version: 1, type: 'configure', config: latest.current },
          window.location.origin,
        )
        return
      }
      // The lab never configures the page; and nothing from another session counts.
      if (message.type === 'configure' || message.sessionId !== latest.current.sessionId) return
      if (message.type === 'resize') setHeight(message.height)
      if (message.type === 'observation') {
        if (
          message.observationRequest !== latest.current.observationRequest ||
          message.observation.labId !== latest.current.labId
        )
          return
        if (message.observation.frameReady) {
          setError('')
          window.clearTimeout(timeout)
        }
        callback.current(message.observation)
      }
      if (message.type === 'error') {
        setError(message.message)
        callback.current(EMPTY_EUSB_OBSERVATION)
      }
    }
    window.addEventListener('message', listener)
    return () => {
      window.removeEventListener('message', listener)
      window.clearTimeout(timeout)
    }
  }, [sessionId, retry])

  useEffect(() => {
    if (ready)
      frame.current?.contentWindow?.postMessage(
        { version: 1, type: 'configure', config },
        window.location.origin,
      )
  }, [config, ready])

  if (large === false)
    return (
      <div className={styles.notice} data-lab-unavailable>
        <h2>This task needs a larger screen</h2>
        <p>
          The scope tasks need a tablet or desktop. You can read the lesson here and continue the
          tasks on a larger screen.
        </p>
      </div>
    )
  return (
    <section aria-label="EUS-B lab" className={styles.embed} data-fill={fill || undefined}>
      {!ready && !error && <p role="status">Loading the lab…</p>}
      {error && (
        <div role="alert" className={styles.notice}>
          <p>{error}</p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              callback.current(EMPTY_EUSB_OBSERVATION)
              setReady(false)
              setError('')
              setRetry((value) => value + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}
      {large && (
        <iframe
          key={retry}
          ref={frame}
          title="EUS-B lab"
          style={fill ? undefined : { height }}
          src={src}
          allow="fullscreen"
        />
      )}
    </section>
  )
}
