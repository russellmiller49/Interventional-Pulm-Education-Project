'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMPTY_EBUS_OBSERVATION,
  isEbusMessage,
  type EbusObservation,
  type EbusWorkbenchConfig,
} from '@/lib/ebus-guided-bridge'
import type { Lab } from '../content/types'
import styles from './course.module.css'
export function Workbench({
  lab,
  locked,
  reveal,
  sessionId,
  onObservation,
  demonstration = false,
}: {
  lab: Lab
  locked: boolean
  reveal: boolean
  sessionId: string
  onObservation: (v: EbusObservation) => void
  demonstration?: boolean
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const callback = useRef(onObservation)
  useEffect(() => {
    callback.current = onObservation
  }, [onObservation])
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const config = useMemo<EbusWorkbenchConfig>(
    () => ({
      sessionId,
      kind: lab.kind,
      presetKey: lab.presetKey,
      controls: lab.controls,
      locked,
      reveal,
      view: 'sector',
      freeDrive: lab.freeDrive,
      linkedLesson: lab.linkedLesson,
      demonstration,
      initialRoll: lab.initialRoll ?? 35,
      initialDepth: lab.initialDepth ?? 40,
      initialGain: lab.initialGain ?? (lab.kind === 'simulator' ? 0 : 43),
    }),
    [sessionId, lab, locked, reveal, demonstration],
  )
  const latest = useRef(config)
  useEffect(() => {
    latest.current = config
  }, [config])
  useEffect(() => {
    const assess = () => {
      if (lab.kind === 'knobology') {
        setSupported(true)
        return
      }
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      setSupported(window.innerWidth >= 768 && !!gl)
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
    assess()
    const query = window.matchMedia('(min-width: 768px)')
    query.addEventListener('change', assess)
    return () => query.removeEventListener('change', assess)
  }, [lab.kind])
  useEffect(() => {
    const timeout = window.setTimeout(
      () =>
        setError(
          'The workbench is taking longer than expected. Retry the activity if it does not load.',
        ),
      45000,
    )
    const listener = (e: MessageEvent) => {
      if (
        e.origin !== window.location.origin ||
        e.source !== frame.current?.contentWindow ||
        !isEbusMessage(e.data)
      )
        return
      if (e.data.type === 'ready') {
        setReady(true)
        setError('')
        frame.current?.contentWindow?.postMessage(
          { version: 1, type: 'configure', config: latest.current },
          window.location.origin,
        )
      }
      if (e.data.type === 'observation' && e.data.sessionId === latest.current.sessionId) {
        if (e.data.observation.frameReady) {
          setError('')
          window.clearTimeout(timeout)
        }
        if (!latest.current.demonstration) callback.current(e.data.observation)
      }
      if (e.data.type === 'error' && e.data.sessionId === latest.current.sessionId) {
        setError(e.data.message)
        callback.current(EMPTY_EBUS_OBSERVATION)
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
  if (supported === false)
    return (
      <div className={styles.notice}>
        <h2>Desktop or tablet lab</h2>
        <p>
          This required scope activity needs a larger viewport and WebGL 2. You can read the lesson
          here; continue this lab on a supported device. No completion has been recorded.
        </p>
      </div>
    )
  return (
    <section aria-label="EBUS workbench" className={styles.embed}>
      {!ready && <p role="status">Loading EBUS workbench…</p>}
      {error && (
        <div role="alert" className={styles.notice}>
          <p>{error}</p>
          <button
            className={styles.secondary}
            onClick={() => {
              callback.current(EMPTY_EBUS_OBSERVATION)
              setReady(false)
              setError('')
              setRetry((v) => v + 1)
            }}
          >
            Retry workbench
          </button>
        </div>
      )}
      {supported && (
        <iframe
          key={retry}
          ref={frame}
          title="EBUS workbench"
          src="/socal-ebus-course/app/guided.html?locale=en&publicTraining=1&publicScope=ebus"
          allow="fullscreen"
        />
      )}
    </section>
  )
}
