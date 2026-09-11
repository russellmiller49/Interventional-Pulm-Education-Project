'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Crosshair } from 'lucide-react'

import { HandoffContent } from '@/i18n/handoff'

/**
 * The eight-way steering ring and the press-and-hold buttons of the virtual bronchoscope.
 *
 * Extracted from the admin airway-anatomy module unchanged, so its captures stay byte-identical;
 * the Bronchoscopy Foundations pane reuses them.
 */
export const STEER_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export function SteeringRing({
  onSteer,
  onRecenter,
}: {
  onSteer: (dxUnit: number, dyUpUnit: number) => void
  onRecenter: () => void
}) {
  return (
    <HandoffContent>
      {
        <div className="relative mx-auto mt-2 h-44 w-44">
          {STEER_ANGLES.map((angleDeg) => (
            <SteerButton key={angleDeg} angleDeg={angleDeg} onSteer={onSteer} />
          ))}
          <button
            type="button"
            aria-label="Recenter view"
            title="Recenter view (R)"
            onClick={onRecenter}
            className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200 active:bg-cyan-400/15"
          >
            <Crosshair className="h-5 w-5" />
          </button>
        </div>
      }
    </HandoffContent>
  )
}

export function SteerButton({
  angleDeg,
  onSteer,
}: {
  angleDeg: number
  onSteer: (dxUnit: number, dyUpUnit: number) => void
}) {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dyUp = Math.cos(rad)
  const hold = useHoldRepeat(() => onSteer(dx, dyUp), 80)
  const left = 50 + 36 * Math.sin(rad)
  const top = 50 - 36 * Math.cos(rad)

  return (
    <HandoffContent>
      {
        <button
          type="button"
          aria-label={`Steer ${angleDeg} degrees clockwise from up`}
          style={{ left: `${left}%`, top: `${top}%` }}
          className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none select-none items-center justify-center rounded-full border border-slate-600 bg-slate-800/90 text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200 active:border-cyan-200 active:bg-cyan-400/20"
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            hold.start()
          }}
          onPointerUp={hold.stop}
          onPointerCancel={hold.stop}
          onLostPointerCapture={hold.stop}
          onContextMenu={(event) => event.preventDefault()}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            style={{ transform: `rotate(${angleDeg}deg)` }}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V6" />
            <path d="m6 11 6-6 6 6" />
          </svg>
        </button>
      }
    </HandoffContent>
  )
}

export function HoldButton({
  onTrigger,
  intervalMs,
  className,
  ariaLabel,
  children,
}: {
  onTrigger: () => void
  intervalMs?: number
  className?: string
  ariaLabel: string
  children: React.ReactNode
}) {
  const hold = useHoldRepeat(onTrigger, intervalMs)
  return (
    <HandoffContent>
      {
        <button
          type="button"
          aria-label={ariaLabel}
          className={`touch-none select-none ${className ?? ''}`}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            hold.start()
          }}
          onPointerUp={hold.stop}
          onPointerCancel={hold.stop}
          onLostPointerCapture={hold.stop}
          onContextMenu={(event) => event.preventDefault()}
        >
          {children}
        </button>
      }
    </HandoffContent>
  )
}

export function useHoldRepeat(action: () => void, intervalMs = 90, delayMs = 260) {
  const actionRef = useRef(action)
  useEffect(() => {
    actionRef.current = action
  })
  const timersRef = useRef<{ timeout: number | null; interval: number | null }>({
    timeout: null,
    interval: null,
  })

  const stop = useCallback(() => {
    if (timersRef.current.timeout != null) window.clearTimeout(timersRef.current.timeout)
    if (timersRef.current.interval != null) window.clearInterval(timersRef.current.interval)
    timersRef.current = { timeout: null, interval: null }
  }, [])

  const start = useCallback(() => {
    stop()
    actionRef.current()
    timersRef.current.timeout = window.setTimeout(() => {
      timersRef.current.interval = window.setInterval(() => actionRef.current(), intervalMs)
    }, delayMs)
  }, [delayMs, intervalMs, stop])

  useEffect(() => stop, [stop])

  return { start, stop }
}
