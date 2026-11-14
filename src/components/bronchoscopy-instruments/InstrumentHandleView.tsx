import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react'

import type { InstrumentId } from './instrument-model'

/**
 * The accessory's handle, as the hand holds it. The part the hand moves — the forceps spool, the
 * brush plunger, the needle hub — is a slider: drag it, or focus it and use the arrow keys.
 *
 * Each handle is drawn from the owner's videos of the devices: push the forceps spool away from the
 * thumb ring to open the cups; push the brush plunger toward the ring to put the brush out; push the
 * needle hub forward to drive the needle out of its catheter.
 */

interface Track {
  /** x where the control sits at 0 (closed, sheathed) and at 1 (open, out). */
  readonly from: number
  readonly to: number
}

const TRACKS: Readonly<Record<InstrumentId, Track>> = {
  forceps: { from: 252, to: 138 },
  brush: { from: 340, to: 298 },
  needle: { from: 268, to: 212 },
}

const LABELS: Readonly<Record<InstrumentId, { name: string; state: (value: number) => string }>> = {
  forceps: {
    name: 'Forceps spool: push away from the thumb ring to open the cups',
    state: (v) => (v > 0.6 ? 'Cups open' : v > 0.15 ? 'Cups partly open' : 'Cups closed'),
  },
  brush: {
    name: 'Brush plunger: push toward the thumb ring to put the brush out',
    state: (v) => (v > 0.6 ? 'Brush out' : v > 0.15 ? 'Brush partly out' : 'Brush sheathed'),
  },
  needle: {
    name: 'Needle hub: push forward to drive the needle out',
    state: (v) => (v > 0.6 ? 'Needle out' : v > 0.15 ? 'Needle partly out' : 'Needle inside'),
  },
}

export function InstrumentHandleView({
  instrument,
  control,
  suction,
  onControl,
}: {
  readonly instrument: InstrumentId
  readonly control: number
  readonly suction: boolean
  readonly onControl: (value: number) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const track = TRACKS[instrument]
  const at = track.from + (track.to - track.from) * control

  const valueAt = useCallback(
    (clientX: number, clientY: number) => {
      const element = svg.current
      const matrix = element?.getScreenCTM()
      if (!element || !matrix) return control
      const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
      return Math.min(1, Math.max(0, (point.x - track.from) / (track.to - track.from)))
    },
    [control, track],
  )

  const onPointerDown = (event: PointerEvent<SVGGElement>) => {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
  }
  const onPointerMove = (event: PointerEvent<SVGGElement>) => {
    if (dragging.current) onControl(valueAt(event.clientX, event.clientY))
  }
  const onPointerUp = (event: PointerEvent<SVGGElement>) => {
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    // The control's "forward" runs leftward on screen, toward the scope.
    const step = event.shiftKey ? 0.25 : 0.1
    const moves: Record<string, number> = {
      ArrowLeft: control + step,
      ArrowUp: control + step,
      ArrowRight: control - step,
      ArrowDown: control - step,
      Home: 0,
      End: 1,
    }
    if (event.key in moves) {
      event.preventDefault()
      onControl(Math.min(1, Math.max(0, moves[event.key])))
    }
  }

  const label = LABELS[instrument]
  return (
    <svg
      ref={svg}
      viewBox="0 0 360 172"
      className="block h-auto w-full touch-none select-none"
      aria-label="The handle in your hand"
    >
      <defs>
        <linearGradient id="bi-ivory" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf8f0" />
          <stop offset="1" stopColor="#d9d2c2" />
        </linearGradient>
        <linearGradient id="bi-teal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3db" />
          <stop offset="1" stopColor="#4ea3ae" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="360" height="172" rx="10" fill="#f5f7f8" />
      <text x="14" y="22" fontSize="11" fill="#5b6870">
        To the scope
      </text>
      <path d="M14 30 l-6 4 l6 4" fill="none" stroke="#5b6870" strokeWidth="1.4" />

      {instrument === 'forceps' ? (
        <g>
          <rect x="0" y="94" width="44" height="12" fill="#2f7a5c" />
          <rect
            x="44"
            y="93"
            width="248"
            height="14"
            rx="5"
            fill="url(#bi-ivory)"
            stroke="#bdb5a3"
          />
          <circle cx="318" cy="100" r="25" fill="none" stroke="url(#bi-ivory)" strokeWidth="13" />
          <circle cx="318" cy="100" r="25" fill="none" stroke="#bdb5a3" strokeWidth="0.8" />
          <text x="352" y="140" fontSize="11" fill="#5b6870" textAnchor="end">
            Thumb ring
          </text>
        </g>
      ) : instrument === 'brush' ? (
        <g>
          <rect x="0" y="95" width="70" height="10" rx="3" fill="#e6edf1" stroke="#aebbc4" />
          <rect
            x="70"
            y="92"
            width="170"
            height="16"
            rx="6"
            fill="url(#bi-ivory)"
            stroke="#bdb5a3"
          />
          <circle cx="258" cy="100" r="22" fill="none" stroke="url(#bi-ivory)" strokeWidth="12" />
          <circle cx="258" cy="100" r="22" fill="none" stroke="#bdb5a3" strokeWidth="0.8" />
          <line x1="240" y1="100" x2={at} y2="100" stroke="#8d969d" strokeWidth="2.4" />
          <text x="282" y="138" fontSize="11" fill="#5b6870" textAnchor="end">
            Thumb ring
          </text>
        </g>
      ) : (
        <g>
          <rect x="0" y="94" width="70" height="12" rx="3" fill="#8d979f" />
          <rect
            x="70"
            y="88"
            width="138"
            height="24"
            rx="8"
            fill="url(#bi-teal)"
            stroke="#3f8a94"
          />
          <rect x="112" y="52" width="12" height="38" fill="url(#bi-teal)" stroke="#3f8a94" />
          <g transform="translate(96 4)">
            <rect x="0" y="0" width="44" height="46" rx="4" fill="#ffffffcc" stroke="#9aa6ae" />
            <rect x="4" y={suction ? 4 : 26} width="36" height="5" fill="#40484e" />
            <line x1="22" y1={suction ? 4 : 26} x2="22" y2="-10" stroke="#40484e" strokeWidth="3" />
            <text x="52" y="22" fontSize="11" fill="#5b6870">
              {suction ? 'Suction on' : 'Syringe'}
            </text>
          </g>
          <line x1="208" y1="100" x2="330" y2="100" stroke="#9aa4ac" strokeWidth="1.6" />
          <rect x="324" y="88" width="22" height="24" rx="6" fill="#efe9dc" stroke="#bdb5a3" />
          <text x="352" y="134" fontSize="11" fill="#5b6870" textAnchor="end">
            Stylet cap
          </text>
        </g>
      )}

      {/* The moving part. */}
      <g
        role="slider"
        tabIndex={0}
        aria-label={label.name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(control * 100)}
        aria-valuetext={label.state(control)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="cursor-grab outline-none focus-visible:[&>.bi-focus]:opacity-100 active:cursor-grabbing"
      >
        <rect
          className="bi-focus opacity-0"
          x={at - 30}
          y="58"
          width="60"
          height="76"
          rx="10"
          fill="none"
          stroke="#1f7aa8"
          strokeWidth="2.5"
        />
        {instrument === 'forceps' ? (
          <g transform={`translate(${at} 100)`}>
            <ellipse cx="-14" cy="0" rx="6" ry="26" fill="url(#bi-ivory)" stroke="#bdb5a3" />
            <rect x="-14" y="-13" width="28" height="26" fill="url(#bi-ivory)" stroke="#bdb5a3" />
            <ellipse cx="14" cy="0" rx="6" ry="26" fill="url(#bi-ivory)" stroke="#bdb5a3" />
          </g>
        ) : instrument === 'brush' ? (
          <g transform={`translate(${at} 100)`}>
            <ellipse cx="0" cy="0" rx="9" ry="20" fill="url(#bi-ivory)" stroke="#bdb5a3" />
            <circle cx="0" cy="0" r="2.5" fill="#8d969d" />
          </g>
        ) : (
          <g transform={`translate(${at} 100)`}>
            <rect x="-6" y="-17" width="40" height="34" rx="7" fill="#3f8f99" stroke="#2f6f78" />
            <rect x="-6" y="-17" width="8" height="34" rx="3" fill="#2f6f78" />
          </g>
        )}
        <text x={at} y="152" fontSize="11" fill="#1f5f80" textAnchor="middle" fontWeight="600">
          {label.state(control)}
        </text>
        <path
          d={`M${Math.min(track.from, track.to) - 4} 163 H${Math.max(track.from, track.to) + 4}`}
          stroke="#c9d3d9"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={at} cy="163" r="4.5" fill="#1f7aa8" />
      </g>
    </svg>
  )
}
