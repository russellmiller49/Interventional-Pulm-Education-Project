'use client'

import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'

import { InstrumentHandleView } from './InstrumentHandleView'
import { InstrumentTipView } from './InstrumentTipView'
import {
  OUT_MIN_MM,
  TARGET_MM,
  initialLabState,
  labComplete,
  labFaults,
  labReducer,
  labSteps,
  type FaultId,
  type InstrumentId,
  type LabState,
} from './instrument-model'

/**
 * The instrument lab: one accessory through the working channel, its handle in the hand beside the
 * tip in the airway. The learner works the catheter and the handle; the lab names the next step,
 * marks each one done, and says plainly when a move would damage the scope or spoil the sample.
 *
 * Shared by the dolphin and the human bronchoscopy modules. A module chooses the instruments, names
 * the target, and may add clips of the real devices.
 */

export interface InstrumentClip {
  readonly src: string
  readonly poster?: string
  /** What the clip shows, read before it plays. */
  readonly caption: string
}

export interface InstrumentClips {
  readonly tip: InstrumentClip
  readonly hand: InstrumentClip
}

export const INSTRUMENT_NAMES: Readonly<Record<InstrumentId, string>> = {
  forceps: 'Biopsy forceps',
  brush: 'Cytology brush',
  needle: 'Aspiration needle',
}

export interface InstrumentLabProps {
  readonly instruments?: readonly InstrumentId[]
  readonly targetLabels?: Partial<Record<InstrumentId, string>>
  readonly clips?: Partial<Record<InstrumentId, InstrumentClips>>
  /** Called once each time an instrument's sequence is completed. */
  readonly onComplete?: (instrument: InstrumentId, faults: readonly FaultId[]) => void
  /** A line under the views: what the panel shows. */
  readonly caption?: ReactNode
}

const DEFAULT_TARGETS: Readonly<Record<InstrumentId, string>> = {
  forceps: 'Lesion',
  brush: 'Lesion',
  needle: 'Node beyond the wall',
}

const STEP_MM = 0.6
const REPEAT_MS = 70

export function InstrumentLab({
  instruments = ['forceps', 'brush', 'needle'],
  targetLabels,
  clips,
  onComplete,
  caption,
}: InstrumentLabProps) {
  const [state, dispatch] = useReducer(labReducer, instruments[0] ?? 'forceps', initialLabState)
  const steps = labSteps(state.instrument)
  const faults = labFaults(state)
  const complete = labComplete(state)
  const reported = useRef<string | null>(null)

  useEffect(() => {
    const key = `${state.instrument}:${state.memory.done.length}`
    if (complete && reported.current !== key) {
      reported.current = key
      onComplete?.(state.instrument, state.memory.faults)
    }
  }, [complete, onComplete, state.instrument, state.memory.done.length, state.memory.faults])

  const targetLabel = targetLabels?.[state.instrument] ?? DEFAULT_TARGETS[state.instrument]
  const clip = clips?.[state.instrument]
  const nextIndex = steps.findIndex((step) => !state.memory.done.includes(step.id))

  return (
    <section
      className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-sm"
      aria-label="Instrument lab"
      data-instrument-lab={state.instrument}
    >
      {instruments.length > 1 ? (
        <div role="tablist" aria-label="Instrument" className="flex flex-wrap gap-2">
          {instruments.map((instrument) => (
            <button
              key={instrument}
              type="button"
              role="tab"
              aria-selected={state.instrument === instrument}
              onClick={() => dispatch({ type: 'select', instrument })}
              className={`rounded-full border px-3 py-1.5 font-semibold transition ${
                state.instrument === instrument
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {INSTRUMENT_NAMES[instrument]}
            </button>
          ))}
        </div>
      ) : null}

      {/* Columns follow the lab's own width, not the window's: it often sits in a narrow panel. */}
      <div
        className="grid items-start gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))' }}
      >
        <figure className="m-0 overflow-hidden rounded-lg border border-border/60 bg-white">
          <InstrumentTipView state={state} targetLabel={targetLabel} />
          <figcaption className="border-t border-border/40 px-3 py-1.5 text-xs text-slate-600">
            At the tip, from the side
          </figcaption>
        </figure>
        <figure className="m-0 overflow-hidden rounded-lg border border-border/60 bg-white">
          <InstrumentHandleView
            instrument={state.instrument}
            control={state.control}
            suction={state.suction}
            onControl={(value) => dispatch({ type: 'control', value })}
          />
          <figcaption className="border-t border-border/40 px-3 py-1.5 text-xs text-slate-600">
            In your hand: drag the {handleName(state.instrument)}, or focus it and use the arrow
            keys
          </figcaption>
        </figure>
      </div>

      <CatheterControls state={state} dispatch={dispatch} />

      <div
        className="grid items-start gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))' }}
      >
        <ol className="grid gap-1.5" aria-label={`${INSTRUMENT_NAMES[state.instrument]}: steps`}>
          {steps.map((step, index) => {
            const done = state.memory.done.includes(step.id)
            const current = index === nextIndex
            return (
              <li
                key={step.id}
                aria-current={current ? 'step' : undefined}
                className={`rounded-md border px-2.5 py-1.5 ${
                  current
                    ? 'border-primary/70 bg-primary/10'
                    : done
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-border/50 text-muted-foreground'
                }`}
              >
                <span className="font-semibold">{done ? '✓ ' : `${index + 1}. `}</span>
                {done ? step.result : step.label}
              </li>
            )
          })}
        </ol>
        <div className="grid content-start gap-2">
          <div role="status" aria-live="polite" className="grid gap-1.5">
            {complete ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5">
                {faults.length === 0
                  ? 'Sequence complete, with the channel protected throughout.'
                  : 'Sequence complete. Go through it once more without the moves flagged below.'}
              </p>
            ) : null}
            {faults.map((fault) => (
              <p
                key={fault.id}
                className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5"
                data-lab-fault={fault.id}
              >
                {fault.message}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'reset' })}
            className="justify-self-start rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-muted"
          >
            Start this instrument again
          </button>
        </div>
      </div>

      {clip ? <RealDevice name={INSTRUMENT_NAMES[state.instrument]} clips={clip} /> : null}
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </section>
  )
}

function handleName(instrument: InstrumentId): string {
  return instrument === 'forceps' ? 'spool' : instrument === 'brush' ? 'plunger' : 'needle hub'
}

function CatheterControls({
  state,
  dispatch,
}: {
  readonly state: LabState
  readonly dispatch: (action: Parameters<typeof labReducer>[1]) => void
}) {
  const move = (deltaMm: number) => dispatch({ type: 'nudge', deltaMm })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <HoldButton label="Withdraw catheter" onStep={() => move(-STEP_MM)}>
        ← Withdraw
      </HoldButton>
      <label className="flex min-w-[12rem] flex-1 items-center gap-2">
        <span className="whitespace-nowrap text-xs text-muted-foreground">Catheter</span>
        <input
          type="range"
          min={OUT_MIN_MM}
          max={TARGET_MM}
          step={0.5}
          value={state.outMm}
          onChange={(event) => dispatch({ type: 'move', outMm: Number(event.target.value) })}
          aria-label="Catheter beyond the scope tip"
          aria-valuetext={
            state.outMm < 0
              ? 'Inside the working channel'
              : state.outMm >= TARGET_MM - 1.2
                ? 'At the target'
                : 'Out of the scope tip'
          }
          className="w-full accent-[hsl(var(--primary))]"
        />
      </label>
      <HoldButton label="Advance catheter" onStep={() => move(STEP_MM)}>
        Advance →
      </HoldButton>
      {state.instrument === 'needle' ? (
        <button
          type="button"
          aria-pressed={state.suction}
          onClick={() => dispatch({ type: 'suction', on: !state.suction })}
          className={`rounded-md border px-3 py-1.5 font-semibold ${
            state.suction ? 'border-amber-500/70 bg-amber-500/15' : 'border-border hover:bg-muted'
          }`}
        >
          {state.suction ? 'Suction on' : 'Suction off'}
        </button>
      ) : null}
    </div>
  )
}

/** Press once to step; hold to keep moving. */
function HoldButton({
  label,
  onStep,
  children,
}: {
  readonly label: string
  readonly onStep: () => void
  readonly children: ReactNode
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  }, [onStep])
  const stop = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        step.current()
        stop()
        timer.current = setInterval(() => step.current(), REPEAT_MS)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          step.current()
        }
      }}
      className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-muted"
    >
      {children}
    </button>
  )
}

function RealDevice({ name, clips }: { readonly name: string; readonly clips: InstrumentClips }) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className="rounded-lg border border-border/60 px-3 py-2"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">The real {name.toLowerCase()}</summary>
      {open ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {[clips.hand, clips.tip].map((clip) => (
            <figure key={clip.src} className="m-0 grid gap-1">
              <video
                src={clip.src}
                poster={clip.poster}
                controls
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full rounded-md bg-black"
              />
              <figcaption className="text-xs text-muted-foreground">{clip.caption}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </details>
  )
}
